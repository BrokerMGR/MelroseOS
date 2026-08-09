/**
 * MelroseOS Website
 * File: WEB-23_EmailUnsubscribeBridge.gs
 * Release: MOS5-WEB-23
 * Version: 2.0.0
 *
 * Purpose:
 * Public unsubscribe endpoint for the global email compliance engine.
 *
 * Existing WEBSITE doGet(e) should call:
 *
 *   const unsubscribeResponse =
 *     MGR_WEB_tryHandleEmailUnsubscribe(e);
 *   if (unsubscribeResponse) return unsubscribeResponse;
 */

const MGR_WEB_UNSUB = Object.freeze({
  VERSION: '2.0.0',
  PARAM: 'unsubscribe',
  WORKBOOK_ID:
    '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  SHEET_NAME: 'EMAIL_SUPPRESSION',
  WEBSITE: 'https://melrosegrouprealty.com'
});

function MGR_WEB_tryHandleEmailUnsubscribe(e) {
  const token =
    e &&
    e.parameter &&
    e.parameter[MGR_WEB_UNSUB.PARAM]
      ? String(
          e.parameter[MGR_WEB_UNSUB.PARAM]
        ).trim()
      : '';

  if (!token) {
    return null;
  }

  return MGR_WEB_handleEmailUnsubscribeToken(token);
}

function MGR_WEB_handleEmailUnsubscribeToken(token) {
  const email =
    MGR_WEB_decodeUnsubscribeToken_(token);

  if (!email) {
    return HtmlService
      .createHtmlOutput(
        '<div style="font-family:Arial,sans-serif;' +
        'max-width:640px;margin:60px auto;padding:20px;">' +
        '<h2>Invalid unsubscribe request</h2>' +
        '<p>This unsubscribe link could not be processed.</p>' +
        '</div>'
      );
  }

  MGR_WEB_writeGlobalSuppression_(email);

  return HtmlService
    .createHtmlOutput(
      '<div style="font-family:Arial,sans-serif;' +
      'max-width:640px;margin:60px auto;padding:20px;">' +
      '<h2>You have been unsubscribed.</h2>' +
      '<p>You will no longer receive Melrose Group Realty ' +
      'marketing emails at <strong>' +
      MGR_WEB_escapeHtml_(email) +
      '</strong>.</p>' +
      '<p style="margin-top:24px;">' +
      '<a href="' +
      MGR_WEB_UNSUB.WEBSITE +
      '">Return to Melrose Group Realty</a></p>' +
      '</div>'
    );
}

function MGR_WEB_writeGlobalSuppression_(email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();

  const ss = SpreadsheetApp.openById(
    MGR_WEB_UNSUB.WORKBOOK_ID
  );

  let sheet = ss.getSheetByName(
    MGR_WEB_UNSUB.SHEET_NAME
  );

  const headers = [
    'Email',
    'Suppressed',
    'Reason',
    'SuppressedAt',
    'Source',
    'UpdatedAt'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(
      MGR_WEB_UNSUB.SHEET_NAME
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);
    sheet.setFrozenRows(1);
  }

  let row = 0;

  if (sheet.getLastRow() >= 2) {
    const match = sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        1
      )
      .createTextFinder(normalized)
      .matchEntireCell(true)
      .findNext();

    row = match ? match.getRow() : 0;
  }

  const now = new Date().toISOString();
  const values = [
    normalized,
    true,
    'EMAIL_LINK',
    now,
    'WEBSITE',
    now
  ];

  if (row > 1) {
    sheet
      .getRange(row, 1, 1, values.length)
      .setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  return true;
}

function MGR_WEB_getEmailUnsubscribeEndpoint() {
  let url = '';

  try {
    const service = ScriptApp.getService();

    if (
      service &&
      typeof service.getUrl === 'function'
    ) {
      url = String(
        service.getUrl() || ''
      ).trim();
    }
  } catch (err) {}

  return {
    success: !!url,
    url: url,
    queryParameter: MGR_WEB_UNSUB.PARAM,
    version: MGR_WEB_UNSUB.VERSION,
    timestamp: new Date().toISOString()
  };
}

function MGR_WEB_emailUnsubscribeDiagnostics() {
  const endpoint =
    MGR_WEB_getEmailUnsubscribeEndpoint();

  return {
    success: endpoint.success === true,
    endpoint: endpoint,
    sharedWorkbookId:
      MGR_WEB_UNSUB.WORKBOOK_ID,
    sharedSheet:
      MGR_WEB_UNSUB.SHEET_NAME,
    tokenDecodeTest:
      !!MGR_WEB_decodeUnsubscribeToken_(
        MGR_WEB_encodeTestToken_(
          'test@example.com'
        )
      ),
    timestamp: new Date().toISOString()
  };
}

function MGR_WEB_decodeUnsubscribeToken_(token) {
  try {
    const decoded = Utilities
      .newBlob(
        Utilities.base64DecodeWebSafe(
          String(token)
        )
      )
      .getDataAsString();

    const payload = JSON.parse(decoded);
    const email = String(
      payload.email || ''
    )
      .trim()
      .toLowerCase();

    return MGR_WEB_isValidEmail_(email)
      ? email
      : '';
  } catch (err) {
    return '';
  }
}

function MGR_WEB_encodeTestToken_(email) {
  return Utilities.base64EncodeWebSafe(
    JSON.stringify({
      email: String(email || '')
        .trim()
        .toLowerCase(),
      issuedAt: new Date().toISOString()
    }),
    Utilities.Charset.UTF_8
  );
}

function MGR_WEB_isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || '')
      .trim()
      .toLowerCase()
  );
}

function MGR_WEB_escapeHtml_(value) {
  return String(
    value === null ||
    value === undefined
      ? ''
      : value
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
