/**
 * MelroseOS Enterprise Core
 * File: CORE-15_EmailComplianceGate.gs
 * Release: MOS5-CORE-15
 * Version: 1.0.0
 *
 * SYSTEM-WIDE EMAIL COMPLIANCE GATE
 *
 * Design rule:
 * ALL MelroseOS email engines must send through MGR_EMAIL_send().
 * Direct GmailApp.sendEmail() / MailApp.sendEmail() calls are prohibited
 * in MelroseOS production modules.
 *
 * Every outbound email receives:
 * - Brokerage identity
 * - Website link
 * - Consultation link
 * - Academy access link
 * - Unsubscribe link
 * - Physical postal address
 * - Reply-to when configured
 * - Pre-send suppression check
 * - Audit record
 *
 * IMPORTANT:
 * Configure the brokerage postal address before production sends:
 *   MGR_EMAIL_setPostalAddress('YOUR VALID POSTAL ADDRESS')
 *
 * Configure Academy URL if it differs from the default:
 *   MGR_EMAIL_setAcademyUrl('https://...')
 *
 * Configure unsubscribe web-app base URL:
 *   MGR_EMAIL_setUnsubscribeBaseUrl('https://script.google.com/macros/s/.../exec')
 */

const MGR_EMAIL_COMPLIANCE_VERSION = '1.1.0';

const MGR_EMAIL_BUSINESS_CARD_FILE_ID =
  '1jqKjYqgOB9B_r5owweR-b9q9SyFDlfR5';
const MGR_EMAIL_BUSINESS_CARD_CID =
  'mgrBusinessCard';

const MGR_EMAIL_CFG = Object.freeze({
  PROPERTY_POSTAL_ADDRESS: 'MGR_EMAIL_POSTAL_ADDRESS',
  PROPERTY_ACADEMY_URL: 'MGR_EMAIL_ACADEMY_URL',
  PROPERTY_UNSUBSCRIBE_BASE_URL: 'MGR_EMAIL_UNSUBSCRIBE_BASE_URL',
  PROPERTY_CONSULTATION_URL: 'MGR_EMAIL_CONSULTATION_URL',
  PROPERTY_WEBSITE_URL: 'MGR_EMAIL_WEBSITE_URL',
  PROPERTY_REPLY_TO: 'MGR_EMAIL_REPLY_TO',

  DEFAULT_WEBSITE_URL: 'https://melrosegrouprealty.com',
  DEFAULT_CONSULTATION_URL: 'https://melrosegrouprealty.com/book-now',
  DEFAULT_ACADEMY_URL: 'https://melrosegrouprealty.com',
  DEFAULT_REPLY_TO: 'melrosegrouprealty@gmail.com',

  BROKERAGE_NAME: 'Melrose Group Realty',
  OFFICE_PHONE: '(985) 250-0071',
  LOCATION: 'Mandeville, LA',
  LICENSE_TEXT: 'Licensed in Louisiana',

  UNSUBSCRIBE_PARAM: 'unsubscribe',
  AUDIT_SHEET: 'EMAIL_COMPLIANCE_AUDIT'
});

/**
 * SYSTEM-WIDE SEND ENTRY POINT.
 *
 * @param {Object} message
 * Required:
 *   to, subject
 * One of:
 *   htmlBody OR body
 *
 * Optional:
 *   name, replyTo, cc, bcc, attachments, inlineImages,
 *   campaign, category, leadId, metadata
 *
 * @return {Object}
 */
function MGR_EMAIL_send(message) {
  MGR_EMAIL_assertObject_(message, 'message');

  const to = MGR_EMAIL_normalizeEmail_(message.to);
  const subject = String(message.subject || '').trim();

  if (!MGR_EMAIL_isValidEmail_(to)) {
    throw new Error('EMAIL_COMPLIANCE_BLOCK: Invalid recipient email.');
  }

  if (!subject) {
    throw new Error('EMAIL_COMPLIANCE_BLOCK: Subject is required.');
  }

  MGR_EMAIL_assertConfigured_();

  if (MGR_EMAIL_isSuppressed(to)) {
    throw new Error(
      'EMAIL_COMPLIANCE_BLOCK: Recipient is unsubscribed or suppressed: ' + to
    );
  }

  const token = MGR_EMAIL_createUnsubscribeToken_(to);
  const urls = MGR_EMAIL_getRequiredUrls_(token);

  const rawHtml = message.htmlBody
    ? String(message.htmlBody)
    : MGR_EMAIL_textToHtml_(String(message.body || ''));

  const compliantHtml = MGR_EMAIL_wrapCompliantHtml_(
    rawHtml,
    urls,
    message
  );

  const plainBody = MGR_EMAIL_buildPlainText_(
    String(message.body || MGR_EMAIL_stripHtml_(rawHtml)),
    urls
  );

  const options = {
    htmlBody: compliantHtml,
    name: message.name || MGR_EMAIL_CFG.BROKERAGE_NAME,
    replyTo: message.replyTo || MGR_EMAIL_getSetting_(
      MGR_EMAIL_CFG.PROPERTY_REPLY_TO,
      MGR_EMAIL_CFG.DEFAULT_REPLY_TO
    )
  };

  if (message.cc) options.cc = message.cc;
  if (message.bcc) options.bcc = message.bcc;
  if (message.attachments) options.attachments = message.attachments;
  const complianceInlineImages =
    MGR_EMAIL_getComplianceInlineImages_(
      message.inlineImages || {}
    );

  if (
    complianceInlineImages &&
    Object.keys(complianceInlineImages).length
  ) {
    options.inlineImages = complianceInlineImages;
  }

  GmailApp.sendEmail(to, subject, plainBody, options);

  const audit = {
    Timestamp: new Date().toISOString(),
    Recipient: to,
    Subject: subject,
    Campaign: String(message.campaign || ''),
    Category: String(message.category || ''),
    LeadID: String(message.leadId || ''),
    ComplianceVersion: MGR_EMAIL_COMPLIANCE_VERSION,
    WebsiteIncluded: true,
    ConsultationIncluded: true,
    AcademyIncluded: true,
    UnsubscribeIncluded: true,
    PostalAddressIncluded: true,
    Result: 'SENT',
    MetadataJSON: JSON.stringify(message.metadata || {})
  };

  MGR_EMAIL_writeAudit_(audit);

  return {
    success: true,
    sent: true,
    recipient: to,
    subject: subject,
    complianceVersion: MGR_EMAIL_COMPLIANCE_VERSION,
    timestamp: audit.Timestamp
  };
}

/**
 * Render without sending.
 */
function MGR_EMAIL_preview(message) {
  MGR_EMAIL_assertObject_(message, 'message');
  MGR_EMAIL_assertConfigured_();

  const to = MGR_EMAIL_normalizeEmail_(
    message.to || 'preview@example.com'
  );

  const token = MGR_EMAIL_createUnsubscribeToken_(to);
  const urls = MGR_EMAIL_getRequiredUrls_(token);

  const rawHtml = message.htmlBody
    ? String(message.htmlBody)
    : MGR_EMAIL_textToHtml_(String(message.body || ''));

  return {
    htmlBody: MGR_EMAIL_wrapCompliantHtml_(rawHtml, urls, message),
    plainBody: MGR_EMAIL_buildPlainText_(
      String(message.body || MGR_EMAIL_stripHtml_(rawHtml)),
      urls
    ),
    urls: urls
  };
}

/**
 * Compliance-only test email.
 * Sends to the effective user's email unless explicit recipient is supplied.
 */
function MGR_EMAIL_sendComplianceTest(recipient) {
  const target = MGR_EMAIL_normalizeEmail_(
    recipient || Session.getEffectiveUser().getEmail()
  );

  if (!MGR_EMAIL_isValidEmail_(target)) {
    throw new Error(
      'Unable to determine test recipient. Pass your email to ' +
      'MGR_EMAIL_sendComplianceTest("you@example.com").'
    );
  }

  const academyUrl = MGR_EMAIL_getSetting_(
    MGR_EMAIL_CFG.PROPERTY_ACADEMY_URL,
    MGR_EMAIL_CFG.DEFAULT_ACADEMY_URL
  );

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#172033;">',
    '<h1 style="font-size:28px;margin:0 0 16px;">Build your real estate business with the right tools from day one.</h1>',
    '<p style="font-size:16px;line-height:1.65;">',
    'This is a MelroseOS compliance test showing the production structure used for recruiting communications from Melrose Group Realty.',
    '</p>',
    '<p style="font-size:16px;line-height:1.65;">',
    'Recruits can schedule a confidential consultation, explore the brokerage website, and request access to the Agent Academy from the same email.',
    '</p>',
    '<div style="margin:28px 0;">',
    '<a href="' + MGR_EMAIL_escapeAttr_(MGR_EMAIL_getSetting_(MGR_EMAIL_CFG.PROPERTY_CONSULTATION_URL, MGR_EMAIL_CFG.DEFAULT_CONSULTATION_URL)) + '" ',
    'style="display:inline-block;padding:13px 20px;margin:0 8px 8px 0;background:#172033;color:#ffffff;text-decoration:none;border-radius:5px;font-weight:bold;">Schedule Consultation</a>',
    '<a href="' + MGR_EMAIL_escapeAttr_(academyUrl) + '" ',
    'style="display:inline-block;padding:13px 20px;margin:0 8px 8px 0;border:1px solid #172033;color:#172033;text-decoration:none;border-radius:5px;font-weight:bold;">Request Academy Access</a>',
    '</div>',
    '<p style="font-size:14px;line-height:1.6;">',
    '<strong>TEST MESSAGE:</strong> No recruiting campaign status is changed by this email.',
    '</p>',
    '</div>'
  ].join('');

  return MGR_EMAIL_send({
    to: target,
    subject: '[TEST] MelroseOS Recruiting Email Compliance Review',
    htmlBody: html,
    campaign: 'COMPLIANCE_TEST',
    category: 'SYSTEM_TEST',
    metadata: {
      testOnly: true,
      academyUrl: academyUrl
    }
  });
}

/**
 * Record unsubscribe/suppression.
 */
function MGR_EMAIL_unsubscribe(email, reason) {
  const normalized = MGR_EMAIL_normalizeEmail_(email);

  if (!MGR_EMAIL_isValidEmail_(normalized)) {
    throw new Error('Valid email required.');
  }

  const key = MGR_EMAIL_suppressionKey_(normalized);

  PropertiesService.getScriptProperties().setProperty(
    key,
    JSON.stringify({
      email: normalized,
      reason: String(reason || 'UNSUBSCRIBE'),
      unsubscribedAt: new Date().toISOString()
    })
  );

  MGR_EMAIL_writeAudit_({
    Timestamp: new Date().toISOString(),
    Recipient: normalized,
    Subject: '',
    Campaign: '',
    Category: 'UNSUBSCRIBE',
    LeadID: '',
    ComplianceVersion: MGR_EMAIL_COMPLIANCE_VERSION,
    WebsiteIncluded: '',
    ConsultationIncluded: '',
    AcademyIncluded: '',
    UnsubscribeIncluded: '',
    PostalAddressIncluded: '',
    Result: 'UNSUBSCRIBED',
    MetadataJSON: JSON.stringify({ reason: reason || 'UNSUBSCRIBE' })
  });

  return {
    success: true,
    unsubscribed: true,
    email: normalized
  };
}

function MGR_EMAIL_isSuppressed(email) {
  const normalized = MGR_EMAIL_normalizeEmail_(email);
  if (!normalized) return false;

  return PropertiesService.getScriptProperties()
    .getProperty(MGR_EMAIL_suppressionKey_(normalized)) !== null;
}

/**
 * Web-app unsubscribe handler helper.
 *
 * Existing doGet router should route requests containing ?unsubscribe=TOKEN
 * to this function rather than replacing the existing doGet.
 */
function MGR_EMAIL_handleUnsubscribeRequest(e) {
  const token = e && e.parameter
    ? String(e.parameter[MGR_EMAIL_CFG.UNSUBSCRIBE_PARAM] || '')
    : '';

  if (!token) {
    return HtmlService.createHtmlOutput(
      '<h2>Invalid unsubscribe request.</h2>'
    );
  }

  const email = MGR_EMAIL_decodeUnsubscribeToken_(token);

  if (!email) {
    return HtmlService.createHtmlOutput(
      '<h2>This unsubscribe link is invalid or expired.</h2>'
    );
  }

  MGR_EMAIL_unsubscribe(email, 'EMAIL_LINK');

  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:50px auto;">' +
    '<h2>You have been unsubscribed.</h2>' +
    '<p>You will no longer receive Melrose Group Realty marketing emails at ' +
    MGR_EMAIL_escapeHtml_(email) +
    '.</p>' +
    '</div>'
  );
}

/**
 * Required configuration.
 */
function MGR_EMAIL_setPostalAddress(address) {
  if (!address || !String(address).trim()) {
    throw new Error('Valid physical postal address is required.');
  }

  PropertiesService.getScriptProperties().setProperty(
    MGR_EMAIL_CFG.PROPERTY_POSTAL_ADDRESS,
    String(address).trim()
  );

  return true;
}

function MGR_EMAIL_setAcademyUrl(url) {
  return MGR_EMAIL_setUrlSetting_(
    MGR_EMAIL_CFG.PROPERTY_ACADEMY_URL,
    url
  );
}

function MGR_EMAIL_setUnsubscribeBaseUrl(url) {
  return MGR_EMAIL_setUrlSetting_(
    MGR_EMAIL_CFG.PROPERTY_UNSUBSCRIBE_BASE_URL,
    url
  );
}

function MGR_EMAIL_setConsultationUrl(url) {
  return MGR_EMAIL_setUrlSetting_(
    MGR_EMAIL_CFG.PROPERTY_CONSULTATION_URL,
    url
  );
}

function MGR_EMAIL_setWebsiteUrl(url) {
  return MGR_EMAIL_setUrlSetting_(
    MGR_EMAIL_CFG.PROPERTY_WEBSITE_URL,
    url
  );
}

function MGR_EMAIL_setReplyTo(email) {
  const normalized = MGR_EMAIL_normalizeEmail_(email);
  if (!MGR_EMAIL_isValidEmail_(normalized)) {
    throw new Error('Valid reply-to email required.');
  }

  PropertiesService.getScriptProperties().setProperty(
    MGR_EMAIL_CFG.PROPERTY_REPLY_TO,
    normalized
  );

  return true;
}

/**
 * Diagnostics.
 */
function MGR_EMAIL_complianceDiagnostics() {
  const props = PropertiesService.getScriptProperties();

  const postal = props.getProperty(
    MGR_EMAIL_CFG.PROPERTY_POSTAL_ADDRESS
  ) || '';

  const unsubscribeBase = props.getProperty(
    MGR_EMAIL_CFG.PROPERTY_UNSUBSCRIBE_BASE_URL
  ) || '';

  const website = MGR_EMAIL_getSetting_(
    MGR_EMAIL_CFG.PROPERTY_WEBSITE_URL,
    MGR_EMAIL_CFG.DEFAULT_WEBSITE_URL
  );

  const consultation = MGR_EMAIL_getSetting_(
    MGR_EMAIL_CFG.PROPERTY_CONSULTATION_URL,
    MGR_EMAIL_CFG.DEFAULT_CONSULTATION_URL
  );

  const academy = MGR_EMAIL_getSetting_(
    MGR_EMAIL_CFG.PROPERTY_ACADEMY_URL,
    MGR_EMAIL_CFG.DEFAULT_ACADEMY_URL
  );

  const checks = {
    postalAddressConfigured: !!postal,
    unsubscribeBaseConfigured: !!unsubscribeBase,
    websiteConfigured: MGR_EMAIL_isHttpUrl_(website),
    consultationConfigured: MGR_EMAIL_isHttpUrl_(consultation),
    academyConfigured: MGR_EMAIL_isHttpUrl_(academy)
  };

  const failed = Object.keys(checks).filter(function(key) {
    return checks[key] !== true;
  });

  return {
    success: failed.length === 0,
    version: MGR_EMAIL_COMPLIANCE_VERSION,
    checks: checks,
    failed: failed,
    website: website,
    consultation: consultation,
    academy: academy,
    timestamp: new Date().toISOString()
  };
}

/**
 * Compliance wrapper.
 */
function MGR_EMAIL_wrapCompliantHtml_(contentHtml, urls, message) {
  const postal = MGR_EMAIL_getSetting_(
    MGR_EMAIL_CFG.PROPERTY_POSTAL_ADDRESS,
    ''
  );

  const footer = [
    '<div style="max-width:680px;margin:30px auto 0;padding:22px 18px;border-top:1px solid #d8d8d8;',
    'font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.65;color:#626262;text-align:center;">',

    '<div style="margin-bottom:10px;">',
    '<a href="' + MGR_EMAIL_escapeAttr_(urls.website) + '" style="color:#172033;">Website</a>',
    ' &nbsp;â€¢&nbsp; ',
    '<a href="' + MGR_EMAIL_escapeAttr_(urls.consultation) + '" style="color:#172033;">Schedule Consultation</a>',
    ' &nbsp;â€¢&nbsp; ',
    '<a href="' + MGR_EMAIL_escapeAttr_(urls.academy) + '" style="color:#172033;">Request Academy Access</a>',
    '</div>',

    '<div style="margin:0 0 16px;">',
    '<img src="cid:mgrBusinessCard" alt="Melrose Group Realty business card" ',
    'style="display:block;max-width:420px;width:100%;height:auto;margin:0 auto;border:0;">',
    '</div>',

    '<div>',
    MGR_EMAIL_escapeHtml_(MGR_EMAIL_CFG.BROKERAGE_NAME),
    '<br>',
    MGR_EMAIL_escapeHtml_(MGR_EMAIL_CFG.LICENSE_TEXT),
    ' â€¢ ',
    MGR_EMAIL_escapeHtml_(MGR_EMAIL_CFG.OFFICE_PHONE),
    ' â€¢ ',
    MGR_EMAIL_escapeHtml_(MGR_EMAIL_CFG.LOCATION),
    '<br>',
    MGR_EMAIL_escapeHtml_(postal),
    '</div>',

    '<div style="margin-top:10px;">',
    'You are receiving this email because your contact information was included in a Melrose Group Realty business or recruiting workflow. ',
    '<a href="' + MGR_EMAIL_escapeAttr_(urls.unsubscribe) + '" style="color:#172033;">Unsubscribe</a>',
    ' from future marketing communications.',
    '</div>',

    '</div>'
  ].join('');

  return [
    '<!doctype html>',
    '<html><body style="margin:0;padding:20px;background:#ffffff;">',
    '<div style="max-width:680px;margin:0 auto;">',
    contentHtml,
    '</div>',
    footer,
    '</body></html>'
  ].join('');
}

function MGR_EMAIL_buildPlainText_(body, urls) {
  const postal = MGR_EMAIL_getSetting_(
    MGR_EMAIL_CFG.PROPERTY_POSTAL_ADDRESS,
    ''
  );

  return [
    String(body || '').trim(),
    '',
    'Website: ' + urls.website,
    'Schedule Consultation: ' + urls.consultation,
    'Request Academy Access: ' + urls.academy,
    '',
    MGR_EMAIL_CFG.BROKERAGE_NAME,
    MGR_EMAIL_CFG.LICENSE_TEXT + ' â€¢ ' +
      MGR_EMAIL_CFG.OFFICE_PHONE + ' â€¢ ' +
      MGR_EMAIL_CFG.LOCATION,
    postal,
    '',
    'Unsubscribe: ' + urls.unsubscribe
  ].join('\n');
}

function MGR_EMAIL_getRequiredUrls_(token) {
  const unsubscribeBase = MGR_EMAIL_getSetting_(
    MGR_EMAIL_CFG.PROPERTY_UNSUBSCRIBE_BASE_URL,
    ''
  );

  return {
    website: MGR_EMAIL_getSetting_(
      MGR_EMAIL_CFG.PROPERTY_WEBSITE_URL,
      MGR_EMAIL_CFG.DEFAULT_WEBSITE_URL
    ),
    consultation: MGR_EMAIL_getSetting_(
      MGR_EMAIL_CFG.PROPERTY_CONSULTATION_URL,
      MGR_EMAIL_CFG.DEFAULT_CONSULTATION_URL
    ),
    academy: MGR_EMAIL_getSetting_(
      MGR_EMAIL_CFG.PROPERTY_ACADEMY_URL,
      MGR_EMAIL_CFG.DEFAULT_ACADEMY_URL
    ),
    unsubscribe:
      unsubscribeBase +
      (unsubscribeBase.indexOf('?') === -1 ? '?' : '&') +
      MGR_EMAIL_CFG.UNSUBSCRIBE_PARAM +
      '=' +
      encodeURIComponent(token)
  };
}

function MGR_EMAIL_assertConfigured_() {
  const diagnostics = MGR_EMAIL_complianceDiagnostics();

  if (!diagnostics.success) {
    throw new Error(
      'EMAIL_COMPLIANCE_BLOCK: Required configuration missing: ' +
      diagnostics.failed.join(', ')
    );
  }

  return true;
}

function MGR_EMAIL_createUnsubscribeToken_(email) {
  const payload = {
    email: MGR_EMAIL_normalizeEmail_(email),
    issuedAt: new Date().toISOString()
  };

  return Utilities.base64EncodeWebSafe(
    JSON.stringify(payload),
    Utilities.Charset.UTF_8
  );
}

function MGR_EMAIL_decodeUnsubscribeToken_(token) {
  try {
    const decoded = Utilities.newBlob(
      Utilities.base64DecodeWebSafe(token)
    ).getDataAsString();

    const payload = JSON.parse(decoded);

    return MGR_EMAIL_isValidEmail_(payload.email)
      ? MGR_EMAIL_normalizeEmail_(payload.email)
      : '';
  } catch (err) {
    return '';
  }
}

function MGR_EMAIL_suppressionKey_(email) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    MGR_EMAIL_normalizeEmail_(email),
    Utilities.Charset.UTF_8
  );

  const hex = digest.map(function(byte) {
    const normalized = (byte + 256) % 256;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');

  return 'MGR_EMAIL_SUPPRESS_' + hex;
}

function MGR_EMAIL_writeAudit_(record) {
  try {
    const coreId = typeof MGR_getWorkbookId === 'function'
      ? MGR_getWorkbookId('core')
      : '';

    if (!coreId) {
      console.log(JSON.stringify({
        source: 'EMAIL_COMPLIANCE_AUDIT',
        record: record
      }));
      return;
    }

    const ss = SpreadsheetApp.openById(coreId);
    let sheet = ss.getSheetByName(MGR_EMAIL_CFG.AUDIT_SHEET);

    const headers = [
      'Timestamp','Recipient','Subject','Campaign','Category','LeadID',
      'ComplianceVersion','WebsiteIncluded','ConsultationIncluded',
      'AcademyIncluded','UnsubscribeIncluded','PostalAddressIncluded',
      'Result','MetadataJSON'
    ];

    if (!sheet) {
      sheet = ss.insertSheet(MGR_EMAIL_CFG.AUDIT_SHEET);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }

    sheet.appendRow(headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(record, header)
        ? record[header]
        : '';
    }));
  } catch (err) {
    console.error('EMAIL_COMPLIANCE_AUDIT_FAILURE: ' + err.message);
  }
}

function MGR_EMAIL_setUrlSetting_(key, url) {
  if (!MGR_EMAIL_isHttpUrl_(url)) {
    throw new Error('Valid HTTPS/HTTP URL required.');
  }

  PropertiesService.getScriptProperties().setProperty(
    key,
    String(url).trim()
  );

  return true;
}

function MGR_EMAIL_getSetting_(key, fallback) {
  return PropertiesService.getScriptProperties()
    .getProperty(key) || fallback;
}

function MGR_EMAIL_isHttpUrl_(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value || '').trim());
}

function MGR_EMAIL_normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function MGR_EMAIL_isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    MGR_EMAIL_normalizeEmail_(value)
  );
}

function MGR_EMAIL_textToHtml_(text) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;">' +
    MGR_EMAIL_escapeHtml_(text).replace(/\n/g, '<br>') +
    '</div>';
}

function MGR_EMAIL_stripHtml_(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function MGR_EMAIL_escapeHtml_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function MGR_EMAIL_escapeAttr_(value) {
  return MGR_EMAIL_escapeHtml_(value);
}


/**
 * Adds the brokerage business card to every compliant outbound email.
 * Existing caller-provided inline images are preserved.
 */
function MGR_EMAIL_getComplianceInlineImages_(existing) {
  const images = {};

  Object.keys(existing || {}).forEach(function(key) {
    images[key] = existing[key];
  });

  try {
    const file = DriveApp.getFileById(
      MGR_EMAIL_BUSINESS_CARD_FILE_ID
    );

    images[MGR_EMAIL_BUSINESS_CARD_CID] =
      file.getBlob();
  } catch (err) {
    throw new Error(
      'EMAIL_COMPLIANCE_BLOCK: Business card asset could not be loaded. ' +
      err.message
    );
  }

  return images;
}

function MGR_EMAIL_businessCardDiagnostics() {
  try {
    const file = DriveApp.getFileById(
      MGR_EMAIL_BUSINESS_CARD_FILE_ID
    );

    const blob = file.getBlob();

    return {
      success: true,
      fileId: MGR_EMAIL_BUSINESS_CARD_FILE_ID,
      name: file.getName(),
      contentType: blob.getContentType(),
      size: blob.getBytes().length,
      cid: MGR_EMAIL_BUSINESS_CARD_CID,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      fileId: MGR_EMAIL_BUSINESS_CARD_FILE_ID,
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
}
function MGR_EMAIL_assertObject_(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error((label || 'Value') + ' must be an object.');
  }
  return value;
}

