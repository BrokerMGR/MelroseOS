/**
 * MelroseOS CRM
 * File: CRM-127_RecruitRosterLocatorAndSourceLock.gs
 * Version: 1.0.0
 *
 * Finds and permanently locks the New/Pending Recruit roster source.
 */

const MGR_RECRUIT_ROSTER_SOURCE = Object.freeze({
  SPREADSHEET_ID_KEY: 'MGR_RECRUIT_ROSTER_SPREADSHEET_ID',
  SHEET_NAME_KEY: 'MGR_RECRUIT_ROSTER_SHEET_NAME',
  MAX_SPREADSHEETS_TO_SCAN: 150
});

function RUN_RECRUIT_ROSTER_LOCATOR() {
  const results = MGR_RECRUIT_scanAccessibleSpreadsheets_();

  const output = {
    success: results.length > 0,
    candidateCount: results.length,
    candidates: results.slice(0, 20),
    topCandidate: results.length ? results[0] : null,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_ROSTER_LOCATOR\n' +
    JSON.stringify(output, null, 2)
  );

  if (results.length) {
    console.log(
      'TOP CANDIDATE:\n' +
      'Spreadsheet: ' + results[0].spreadsheetName + '\n' +
      'Spreadsheet ID: ' + results[0].spreadsheetId + '\n' +
      'Sheet: ' + results[0].sheetName + '\n' +
      'Score: ' + results[0].score
    );
  } else {
    console.error(
      'NO RECRUIT ROSTER CANDIDATE FOUND.'
    );
  }

  return output;
}

function LOCK_TOP_RECRUIT_ROSTER_SOURCE() {
  const results = MGR_RECRUIT_scanAccessibleSpreadsheets_();

  if (!results.length) {
    throw new Error(
      'RECRUIT_ROSTER_LOCK_BLOCK: No matching recruit roster was found.'
    );
  }

  const top = results[0];

  const props = PropertiesService.getScriptProperties();

  props.setProperty(
    MGR_RECRUIT_ROSTER_SOURCE.SPREADSHEET_ID_KEY,
    top.spreadsheetId
  );

  props.setProperty(
    MGR_RECRUIT_ROSTER_SOURCE.SHEET_NAME_KEY,
    top.sheetName
  );

  const result = {
    success: true,
    spreadsheetId: top.spreadsheetId,
    spreadsheetName: top.spreadsheetName,
    sheetName: top.sheetName,
    score: top.score,
    headers: top.headers,
    timestamp: new Date().toISOString()
  };

  console.log(
    'LOCK_TOP_RECRUIT_ROSTER_SOURCE\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

function MGR_RECRUIT_lockRosterSource(
  spreadsheetId,
  sheetName
) {
  const id = String(spreadsheetId || '').trim();
  const name = String(sheetName || '').trim();

  if (!id || !name) {
    throw new Error(
      'Both spreadsheetId and sheetName are required.'
    );
  }

  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheetByName(name);

  if (!sheet) {
    throw new Error(
      'Recruit roster sheet not found: ' + name
    );
  }

  const validation =
    MGR_RECRUIT_validateRosterSheet_(sheet);

  if (!validation.success) {
    throw new Error(
      'Selected sheet does not contain required recruit headers: ' +
      validation.missing.join(', ')
    );
  }

  const props = PropertiesService.getScriptProperties();

  props.setProperty(
    MGR_RECRUIT_ROSTER_SOURCE.SPREADSHEET_ID_KEY,
    id
  );

  props.setProperty(
    MGR_RECRUIT_ROSTER_SOURCE.SHEET_NAME_KEY,
    name
  );

  const result = {
    success: true,
    spreadsheetId: id,
    spreadsheetName: ss.getName(),
    sheetName: name,
    headers: validation.headers,
    timestamp: new Date().toISOString()
  };

  console.log(
    'MGR_RECRUIT_lockRosterSource\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

function RUN_RECRUIT_ROSTER_SOURCE_CERTIFICATION() {
  const props = PropertiesService.getScriptProperties();

  const id = props.getProperty(
    MGR_RECRUIT_ROSTER_SOURCE.SPREADSHEET_ID_KEY
  ) || '';

  const name = props.getProperty(
    MGR_RECRUIT_ROSTER_SOURCE.SHEET_NAME_KEY
  ) || '';

  const result = {
    success: false,
    spreadsheetId: id,
    sheetName: name,
    spreadsheetName: '',
    rowCount: 0,
    validation: null,
    error: '',
    timestamp: new Date().toISOString()
  };

  try {
    if (!id || !name) {
      throw new Error(
        'Recruit roster source is not locked.'
      );
    }

    const ss = SpreadsheetApp.openById(id);
    const sheet = ss.getSheetByName(name);

    if (!sheet) {
      throw new Error(
        'Locked recruit roster sheet no longer exists.'
      );
    }

    const validation =
      MGR_RECRUIT_validateRosterSheet_(sheet);

    result.spreadsheetName = ss.getName();
    result.rowCount = Math.max(0, sheet.getLastRow() - 1);
    result.validation = validation;
    result.success = validation.success;
  } catch (err) {
    result.error = String(
      err && err.message ? err.message : err
    );
  }

  console.log(
    'RUN_RECRUIT_ROSTER_SOURCE_CERTIFICATION\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

function MGR_RECRUIT_getLockedRoster_() {
  const props = PropertiesService.getScriptProperties();

  const id = props.getProperty(
    MGR_RECRUIT_ROSTER_SOURCE.SPREADSHEET_ID_KEY
  ) || '';

  const name = props.getProperty(
    MGR_RECRUIT_ROSTER_SOURCE.SHEET_NAME_KEY
  ) || '';

  if (!id || !name) {
    return null;
  }

  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheetByName(name);

  if (!sheet) {
    return null;
  }

  const validation =
    MGR_RECRUIT_validateRosterSheet_(sheet);

  if (!validation.success) {
    return null;
  }

  return {
    spreadsheet: ss,
    sheet: sheet,
    headerMap: validation.headerMap
  };
}

function MGR_RECRUIT_scanAccessibleSpreadsheets_() {
  const matches = [];

  const files = DriveApp.getFilesByType(
    MimeType.GOOGLE_SHEETS
  );

  let scanned = 0;

  while (
    files.hasNext() &&
    scanned <
      MGR_RECRUIT_ROSTER_SOURCE.MAX_SPREADSHEETS_TO_SCAN
  ) {
    const file = files.next();
    scanned++;

    try {
      const ss = SpreadsheetApp.openById(
        file.getId()
      );

      ss.getSheets().forEach(function(sheet) {
        if (
          sheet.getLastRow() < 1 ||
          sheet.getLastColumn() < 1
        ) {
          return;
        }

        const validation =
          MGR_RECRUIT_validateRosterSheet_(sheet);

        if (!validation.success) {
          return;
        }

        const score =
          MGR_RECRUIT_rosterCandidateScore_(
            ss.getName(),
            sheet.getName(),
            validation.headers,
            sheet.getLastRow()
          );

        matches.push({
          spreadsheetId: ss.getId(),
          spreadsheetName: ss.getName(),
          sheetName: sheet.getName(),
          rowCount:
            Math.max(0, sheet.getLastRow() - 1),
          score: score,
          headers: validation.headers
        });
      });
    } catch (err) {
      // Ignore inaccessible or malformed spreadsheet candidates.
    }
  }

  matches.sort(function(a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return b.rowCount - a.rowCount;
  });

  return matches;
}

function MGR_RECRUIT_validateRosterSheet_(sheet) {
  const headers = sheet
    .getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    )
    .getDisplayValues()[0];

  const map =
    MGR_RECRUIT_headerMap_(
      headers
    );

  const required = [
    'email',
    'credentialnumber',
    'applicationdate'
  ];

  const missing = required.filter(function(name) {
    return map[name] === undefined;
  });

  return {
    success: missing.length === 0,
    missing: missing,
    headers: headers,
    headerMap: map
  };
}

function MGR_RECRUIT_rosterCandidateScore_(
  spreadsheetName,
  sheetName,
  headers,
  lastRow
) {
  const text = (
    String(spreadsheetName || '') +
    ' ' +
    String(sheetName || '')
  ).toLowerCase();

  let score = 0;

  [
    'recruit',
    'new agent',
    'newagent',
    'pending',
    'lrec',
    'applicant',
    'salesperson'
  ].forEach(function(token) {
    if (text.indexOf(token) >= 0) {
      score += 20;
    }
  });

  const normalized = headers.map(
    MGR_RECRUIT_normalizeHeader_
  );

  [
    'firstname',
    'lastname',
    'city',
    'parish',
    'phone',
    'status'
  ].forEach(function(header) {
    if (normalized.indexOf(header) >= 0) {
      score += 3;
    }
  });

  if (lastRow > 10) score += 5;
  if (lastRow > 100) score += 5;

  return score;
}
