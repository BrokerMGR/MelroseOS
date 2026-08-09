/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-001_SpreadsheetConnector
 * Release: MOS5-021
 * Version: 1.0.0
 */

const REC_REQUIRED_SOURCE_HEADER_ALIASES = Object.freeze({
  firstName: ['First Name', 'FirstName', 'First', 'FName'],
  lastName: ['Last Name', 'LastName', 'Last', 'LName'],
  email: ['Email', 'Email Address', 'EmailAddress'],
  phone: ['Phone', 'Phone Number', 'PhoneNumber', 'Mobile'],
  city: ['City'],
  parish: ['Parish', 'County'],
  licenseNumber: [
    'License Number',
    'LicenseNumber',
    'Credential Number',
    'CredentialNumber',
    'License #',
    'Credential #'
  ],
  applicationDate: [
    'Application Date',
    'ApplicationDate',
    'Applied Date',
    'AppliedDate'
  ]
});

const REC_SYSTEM_COLUMNS = Object.freeze([
  'RecruitID',
  'RecruitStage',
  'CampaignStatus',
  'SequenceNumber',
  'LastEmailSent',
  'NextEmailDate',
  'EmailCount',
  'LastTemplateSent',
  'LRECStatus',
  'SponsoringBroker',
  'LRECLastChecked',
  'ReplyDetected',
  'Unsubscribed',
  'DoNotContact',
  'ActiveRecruitingQueue',
  'CampaignNotes'
]);

function REC_openRecruitingSpreadsheet() {
  REC_assertSafeMode();
  const ss = SpreadsheetApp.openById(REC_CONFIG.sourceSpreadsheetId);
  if (!ss) throw new Error('Unable to open recruiting spreadsheet.');
  return ss;
}

function REC_getRecruitingSheet() {
  const ss = REC_openRecruitingSpreadsheet();
  const sheets = ss.getSheets();
  if (!sheets.length) throw new Error('Recruiting spreadsheet contains no sheets.');

  let best = null;
  let bestScore = -1;

  sheets.forEach(function(sheet) {
    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) return;

    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const normalized = headers.map(function(h) {
      return String(h || '').trim().toLowerCase();
    });

    let score = 0;
    Object.keys(REC_REQUIRED_SOURCE_HEADER_ALIASES).forEach(function(key) {
      const aliases = REC_REQUIRED_SOURCE_HEADER_ALIASES[key].map(function(a) {
        return a.toLowerCase();
      });
      if (normalized.some(function(h) { return aliases.indexOf(h) !== -1; })) score++;
    });

    if (score > bestScore) {
      bestScore = score;
      best = sheet;
    }
  });

  if (!best) throw new Error('Unable to discover a recruiting data sheet.');

  REC_log('PASS', 'REC-001_SpreadsheetConnector', 'Recruit sheet discovered.', {
    sheetName: best.getName(),
    headerMatchScore: bestScore
  });

  return best;
}

function REC_getHeaderMap(sheet) {
  const targetSheet = sheet || REC_getRecruitingSheet();
  const lastColumn = targetSheet.getLastColumn();
  if (lastColumn < 1) throw new Error('Recruit sheet has no header row.');

  const headers = targetSheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const map = {};

  headers.forEach(function(header, index) {
    const cleaned = String(header || '').trim();
    if (cleaned) map[cleaned.toLowerCase()] = index + 1;
  });

  return { headers: headers, map: map };
}

function REC_findHeaderColumn_(headerMap, aliases) {
  const lowerAliases = aliases.map(function(v) {
    return String(v).trim().toLowerCase();
  });

  for (let i = 0; i < lowerAliases.length; i++) {
    if (headerMap.map[lowerAliases[i]]) return headerMap.map[lowerAliases[i]];
  }
  return null;
}

function REC_resolveSourceColumns(sheet) {
  const headerMap = REC_getHeaderMap(sheet);
  const resolved = {};

  Object.keys(REC_REQUIRED_SOURCE_HEADER_ALIASES).forEach(function(field) {
    resolved[field] = REC_findHeaderColumn_(
      headerMap,
      REC_REQUIRED_SOURCE_HEADER_ALIASES[field]
    );
  });

  const missingCritical = [];
  ['firstName', 'lastName', 'email'].forEach(function(field) {
    if (!resolved[field]) missingCritical.push(field);
  });

  return {
    resolved: resolved,
    missingCritical: missingCritical,
    headerMap: headerMap
  };
}

function REC_installSystemColumns() {
  REC_assertSafeMode();

  const sheet = REC_getRecruitingSheet();
  const current = REC_getHeaderMap(sheet);
  const added = [];

  REC_SYSTEM_COLUMNS.forEach(function(columnName) {
    const key = columnName.toLowerCase();
    if (!current.map[key]) {
      const newColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColumn).setValue(columnName);
      added.push(columnName);
      current.map[key] = newColumn;
      current.headers.push(columnName);
    }
  });

  if (added.length) {
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  }

  REC_log('PASS', 'REC-001_SpreadsheetConnector', 'System columns verified.', {
    sheetName: sheet.getName(),
    added: added
  });

  return REC_result(true, {
    sheetName: sheet.getName(),
    addedColumns: added,
    totalSystemColumns: REC_SYSTEM_COLUMNS.length
  });
}

function REC_readRecruitRows(limit) {
  const sheet = REC_getRecruitingSheet();
  const source = REC_resolveSourceColumns(sheet);

  if (source.missingCritical.length) {
    throw new Error('Missing critical source columns: ' + source.missingCritical.join(', '));
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const rowCount = Math.min(Math.max(Number(limit || lastRow - 1), 0), lastRow - 1);
  if (!rowCount) return [];

  const values = sheet.getRange(2, 1, rowCount, lastColumn).getValues();
  const headerMap = REC_getHeaderMap(sheet);

  return values.map(function(row, idx) {
    return REC_mapSheetRowToRecruit(row, idx + 2, source.resolved, headerMap);
  });
}

function REC_runSpreadsheetDiagnostics() {
  REC_assertSafeMode();

  const ss = REC_openRecruitingSpreadsheet();
  const sheet = REC_getRecruitingSheet();
  const source = REC_resolveSourceColumns(sheet);

  const checks = [
    { name: 'Spreadsheet opened', pass: Boolean(ss), detail: ss.getName() },
    { name: 'Recruit sheet discovered', pass: Boolean(sheet), detail: sheet.getName() },
    { name: 'First name column', pass: Boolean(source.resolved.firstName), detail: String(source.resolved.firstName || '') },
    { name: 'Last name column', pass: Boolean(source.resolved.lastName), detail: String(source.resolved.lastName || '') },
    { name: 'Email column', pass: Boolean(source.resolved.email), detail: String(source.resolved.email || '') }
  ];

  const failed = checks.filter(function(c) { return !c.pass; });

  REC_log(
    failed.length ? 'FAIL' : 'PASS',
    'REC-001_SpreadsheetConnector',
    'Spreadsheet diagnostics complete.',
    { checks: checks }
  );

  return REC_result(failed.length === 0, {
    spreadsheetName: ss.getName(),
    sheetName: sheet.getName(),
    checks: checks,
    resolvedColumns: source.resolved
  }, failed.length ? 'Spreadsheet diagnostics failed.' : null);
}
