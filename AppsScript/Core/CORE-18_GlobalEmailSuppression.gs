/**
 * MelroseOS Enterprise Core
 * File: CORE-18_GlobalEmailSuppression.gs
 * Release: MOS5-CORE-18
 * Version: 1.0.0
 *
 * Purpose:
 * Shared, cross-project email suppression registry.
 *
 * CORE and WEBSITE cannot share Script Properties, so all unsubscribe
 * decisions are persisted in the Core workbook and checked there before send.
 */

const MGR_EMAIL_GLOBAL_SUPPRESSION = Object.freeze({
  WORKBOOK_ID: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  SHEET_NAME: 'EMAIL_SUPPRESSION',
  HEADERS: Object.freeze([
    'Email',
    'Suppressed',
    'Reason',
    'SuppressedAt',
    'Source',
    'UpdatedAt'
  ])
});

function MGR_EMAIL_globalSuppressionSheet_() {
  const ss = SpreadsheetApp.openById(
    MGR_EMAIL_GLOBAL_SUPPRESSION.WORKBOOK_ID
  );

  let sheet = ss.getSheetByName(
    MGR_EMAIL_GLOBAL_SUPPRESSION.SHEET_NAME
  );

  if (!sheet) {
    sheet = ss.insertSheet(
      MGR_EMAIL_GLOBAL_SUPPRESSION.SHEET_NAME
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        MGR_EMAIL_GLOBAL_SUPPRESSION.HEADERS.length
      )
      .setValues([
        MGR_EMAIL_GLOBAL_SUPPRESSION.HEADERS.slice()
      ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function MGR_EMAIL_globalSuppressionRow_(email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return 0;
  }

  const sheet = MGR_EMAIL_globalSuppressionSheet_();

  if (sheet.getLastRow() < 2) {
    return 0;
  }

  const match = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(normalized)
    .matchEntireCell(true)
    .findNext();

  return match ? match.getRow() : 0;
}

function MGR_EMAIL_setGlobalSuppression(
  email,
  suppressed,
  reason,
  source
) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error('Valid email required.');
  }

  const sheet = MGR_EMAIL_globalSuppressionSheet_();
  const row = MGR_EMAIL_globalSuppressionRow_(normalized);
  const now = new Date().toISOString();

  const values = [
    normalized,
    suppressed === false ? false : true,
    String(reason || 'UNSUBSCRIBE'),
    suppressed === false ? '' : now,
    String(source || 'CORE'),
    now
  ];

  if (row > 1) {
    sheet
      .getRange(
        row,
        1,
        1,
        values.length
      )
      .setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  return {
    success: true,
    email: normalized,
    suppressed: values[1],
    reason: values[2],
    source: values[4],
    timestamp: now
  };
}

function MGR_EMAIL_isGloballySuppressed(email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  const row = MGR_EMAIL_globalSuppressionRow_(normalized);

  if (row < 2) {
    return false;
  }

  const sheet = MGR_EMAIL_globalSuppressionSheet_();
  const value = sheet.getRange(row, 2).getValue();

  return (
    value === true ||
    String(value).trim().toUpperCase() === 'TRUE' ||
    String(value).trim().toUpperCase() === 'YES' ||
    String(value).trim() === '1'
  );
}

/**
 * Overrides the CORE-15 suppression check with global shared storage.
 */
function MGR_EMAIL_isSuppressed(email) {
  const normalized = MGR_EMAIL_normalizeEmail_(email);

  if (!normalized) {
    return false;
  }

  if (MGR_EMAIL_isGloballySuppressed(normalized)) {
    return true;
  }

  const legacyKey = MGR_EMAIL_suppressionKey_(normalized);

  return (
    PropertiesService
      .getScriptProperties()
      .getProperty(legacyKey) !== null
  );
}

/**
 * Overrides CORE-15 unsubscribe persistence so all projects honor it.
 */
function MGR_EMAIL_unsubscribe(email, reason) {
  const normalized = MGR_EMAIL_normalizeEmail_(email);

  if (!MGR_EMAIL_isValidEmail_(normalized)) {
    throw new Error('Valid email required.');
  }

  // Preserve legacy local property for compatibility.
  const key = MGR_EMAIL_suppressionKey_(normalized);

  PropertiesService
    .getScriptProperties()
    .setProperty(
      key,
      JSON.stringify({
        email: normalized,
        reason: String(reason || 'UNSUBSCRIBE'),
        unsubscribedAt: new Date().toISOString()
      })
    );

  const globalResult =
    MGR_EMAIL_setGlobalSuppression(
      normalized,
      true,
      reason || 'UNSUBSCRIBE',
      'CORE'
    );

  try {
    MGR_EMAIL_writeAudit_({
      Timestamp: new Date().toISOString(),
      Recipient: normalized,
      Subject: '',
      Campaign: '',
      Category: 'UNSUBSCRIBE',
      LeadID: '',
      ComplianceVersion:
        MGR_EMAIL_COMPLIANCE_VERSION,
      WebsiteIncluded: '',
      ConsultationIncluded: '',
      AcademyIncluded: '',
      UnsubscribeIncluded: '',
      PostalAddressIncluded: '',
      Result: 'UNSUBSCRIBED',
      MetadataJSON: JSON.stringify({
        reason: reason || 'UNSUBSCRIBE',
        globalSuppression: true
      })
    });
  } catch (err) {}

  return {
    success: true,
    unsubscribed: true,
    email: normalized,
    globalSuppression: globalResult
  };
}

function MGR_EMAIL_globalSuppressionDiagnostics() {
  const sheet = MGR_EMAIL_globalSuppressionSheet_();

  return {
    success: !!sheet,
    workbookId:
      MGR_EMAIL_GLOBAL_SUPPRESSION.WORKBOOK_ID,
    sheet:
      MGR_EMAIL_GLOBAL_SUPPRESSION.SHEET_NAME,
    rowCount: sheet.getLastRow(),
    timestamp: new Date().toISOString()
  };
}
