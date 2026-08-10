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

const MGR_EMAIL_COMPLIANCE_VERSION = '1.6.1';

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
  // SYSTEM-WIDE EMAIL QUOTA GOVERNOR
  if (typeof MGR_EMAIL_assertQuota === 'function') {
    MGR_EMAIL_assertQuota(message);
  }

  MGR_EMAIL_assertObject_(message, 'message');

  const to = MGR_EMAIL_normalizeEmail_(message.to);
  const subject = MGR_EMAIL_normalizeOutboundText_(
    String(message.subject || '').trim(),
    'subject'
  );

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
/* ASCII_SAFE_BRAND_HEADER_V2
 * Global email branding must use ASCII-only decorative separators.
 * Approved header subtitle: REAL ESTATE | LOUISIANA
 */

const MGR_EMAIL_RESPONSIVE_STYLE_V2 =
  '<style>' +
  'html,body{margin:0!important;padding:0!important;width:100%!important;}' +
  'body{min-width:100%!important;-webkit-text-size-adjust:100%!important;-ms-text-size-adjust:100%!important;}' +
  'table{border-spacing:0!important;border-collapse:collapse!important;}' +
  'img{border:0!important;outline:none!important;text-decoration:none!important;max-width:100%!important;height:auto!important;}' +
  '.mgr-shell{width:100%!important;max-width:680px!important;}' +
  '.mgr-content{padding:34px 34px 18px 34px!important;}' +
  '.mgr-button{display:inline-block!important;box-sizing:border-box!important;}' +
  '@media only screen and (max-width:720px){' +
  '.mgr-shell{width:100%!important;max-width:100%!important;border-radius:10px!important;}' +
  '.mgr-header{padding:20px 18px!important;}' +
  '.mgr-header-title{font-size:24px!important;line-height:1.2!important;}' +
  '.mgr-header-subtitle{font-size:11px!important;letter-spacing:.8px!important;}' +
  '.mgr-content{padding:26px 22px 14px 22px!important;font-size:16px!important;line-height:1.6!important;}' +
  '.mgr-actions,.mgr-actions tbody,.mgr-actions tr,.mgr-actions td{display:block!important;width:100%!important;max-width:100%!important;}' +
  '.mgr-button{display:block!important;width:100%!important;max-width:100%!important;margin:8px 0!important;text-align:center!important;}' +
  '.mgr-card-wrap{padding:0 18px 20px 18px!important;}' +
  '.mgr-footer{padding:18px 20px 22px 20px!important;}' +
  '}' +
  '@media only screen and (max-width:480px){' +
  '.mgr-content{padding:22px 16px 12px 16px!important;font-size:15px!important;}' +
  '.mgr-header-title{font-size:22px!important;}' +
  '.mgr-card-wrap img{width:100%!important;max-width:100%!important;}' +
  '}' +
  '</style>';

function MGR_EMAIL_wrapCompliantHtml_(contentHtml, urls, message) {
  contentHtml = MGR_EMAIL_removeDuplicateGlobalCtas_(
    contentHtml,
    urls
  );
  const postal = MGR_EMAIL_getSetting_(
    MGR_EMAIL_CFG.PROPERTY_POSTAL_ADDRESS,
    ''
  );

  const subject = String(
    (message && message.subject) || ''
  ).trim();

  const preheader = subject
    ? MGR_EMAIL_escapeHtml_(subject)
    : 'Melrose Group Realty';

  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    MGR_EMAIL_RESPONSIVE_STYLE_V2,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '</head>',
    '<body style="margin:0;padding:0;background:#eef2f6;">',

    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">',
    preheader,
    '</div>',

    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" ',
    'style="width:100%;background:#eef2f6;margin:0;padding:0;">',
    '<tr><td align="center" style="padding:28px 12px;">',

    '<table class="mgr-shell" role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" ',
    'style="width:100%;max-width:680px;background:#ffffff;border-collapse:separate;',
    'border-spacing:0;border-radius:14px;overflow:hidden;',
    'box-shadow:0 8px 28px rgba(15,32,55,0.10);">',

    '<tr>',
    '<td class="mgr-header" style="background:#10243d;padding:22px 28px;text-align:center;">',
    '<div class="mgr-header-title" style="font-family:Georgia,Times New Roman,serif;font-size:26px;',
    'line-height:1.2;color:#ffffff;font-weight:bold;letter-spacing:.3px;">',
    'Melrose Group Realty',
    '</div>',
    '<div class="mgr-header-subtitle" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;',
    'line-height:1.5;color:#d7bd79;margin-top:6px;letter-spacing:1.2px;',
    'text-transform:uppercase;">',
    'REAL ESTATE | LOUISIANA',
    '</div>',
    '</td>',
    '</tr>',

    '<tr>',
    '<td style="height:5px;background:#c7a35a;font-size:0;line-height:0;">&nbsp;</td>',
    '</tr>',

    '<tr>',
    '<td class="mgr-content" style="padding:34px 34px 18px 34px;',
    'font-family:Arial,Helvetica,sans-serif;',
    'font-size:16px;line-height:1.65;color:#26364a;">',
    contentHtml,
    '</td>',
    '</tr>',

    '<tr>',
    '<td style="padding:8px 28px 26px 28px;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">',
    '<tr>',
    '<td align="center" style="padding:0 0 10px 0;">',

    '<a href="' + MGR_EMAIL_escapeAttr_(urls.consultation) + '" ',
    'class="mgr-button" style="display:inline-block;background:#10243d;color:#ffffff;',
    'font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;',
    'text-decoration:none;padding:12px 18px;border-radius:6px;margin:4px;">',
    'Schedule Consultation',
    '</a>',

    '<a href="' + MGR_EMAIL_escapeAttr_(urls.academy) + '" ',
    'class="mgr-button" style="display:inline-block;background:#c7a35a;color:#10243d;',
    'font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;',
    'text-decoration:none;padding:12px 18px;border-radius:6px;margin:4px;">',
    'Request Academy Access',
    '</a>',

    '</td>',
    '</tr>',

    '<tr>',
    '<td align="center" style="padding:2px 0 0 0;">',
    '<a href="' + MGR_EMAIL_escapeAttr_(urls.website) + '" ',
    'style="font-family:Arial,Helvetica,sans-serif;font-size:13px;',
    'color:#10243d;text-decoration:underline;">',
    'Visit MelroseGroupRealty.com',
    '</a>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',

    '<tr>',
    '<td class="mgr-card-wrap" style="padding:0 28px 22px 28px;text-align:center;">',
    '<img src="cid:mgrBusinessCard" alt="Melrose Group Realty business card" ',
    'style="display:block;max-width:430px;width:100%;height:auto;',
    'margin:0 auto;border:0;border-radius:8px;">',
    '</td>',
    '</tr>',

    '<tr>',
    '<td class="mgr-footer" style="background:#f7f8fa;border-top:1px solid #e1e6eb;',
    'padding:20px 28px 24px 28px;text-align:center;">',

    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;',
    'line-height:1.65;color:#667587;">',
    '<strong style="color:#10243d;">',
    MGR_EMAIL_escapeHtml_(MGR_EMAIL_CFG.BROKERAGE_NAME),
    '</strong><br>',
    MGR_EMAIL_escapeHtml_(MGR_EMAIL_CFG.LICENSE_TEXT),
    '<br>',
    MGR_EMAIL_escapeHtml_(MGR_EMAIL_CFG.OFFICE_PHONE),
    '<br>',
    MGR_EMAIL_escapeHtml_(MGR_EMAIL_CFG.LOCATION),
    '<br>',
    MGR_EMAIL_escapeHtml_(postal),
    '</div>',

    '<div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;',
    'font-size:11px;line-height:1.6;color:#7c8794;">',
    'You are receiving this email because your contact information was included ',
    'in a Melrose Group Realty business or recruiting workflow.',
    '</div>',

    '<div style="margin-top:10px;">',
    '<a href="' + MGR_EMAIL_escapeAttr_(urls.unsubscribe) + '" ',
    'style="font-family:Arial,Helvetica,sans-serif;font-size:11px;',
    'color:#6b7280;text-decoration:underline;">',
    'Unsubscribe from marketing emails',
    '</a>',
    '</div>',

    '</td>',
    '</tr>',

    '</table>',
    '</td></tr>',
    '</table>',

    '</body>',
    '</html>'
  ].join('');

  return html;
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
/**
 * Normalize outbound typography and repair common mojibake before send.
 * Legitimate letters and names are preserved; malformed punctuation/control
 * sequences are repaired or blocked.
 */
function MGR_EMAIL_normalizeOutboundText_(value, context) {
  let text = String(
    value === null || value === undefined ? '' : value
  );

  const replacements = [
    [/\u00A0/g, ' '],
    [/\u2018|\u2019|\u201A|\u201B/g, "'"],
    [/\u201C|\u201D|\u201E|\u201F/g, '"'],
    [/\u2013|\u2014|\u2212/g, '-'],
    [/\u2022|\u2023|\u25E6|\u2043/g, '-'],
    [/\u2026/g, '...'],
    [/\u00B7/g, '-'],
    [/\u2122/g, ' TM'],
    [/\u00AE/g, ' (R)'],
    [/\u00A9/g, ' (C)'],

    [/Ã¢â‚¬â„¢/g, "'"],
    [/Ã¢â‚¬Ëœ/g, "'"],
    [/Ã¢â‚¬Å“/g, '"'],
    [/Ã¢â‚¬Â/g, '"'],
    [/Ã¢â‚¬â€œ/g, '-'],
    [/Ã¢â‚¬â€/g, '-'],
    [/Ã¢â‚¬Â¢/g, '-'],
    [/Ã¢â‚¬Â¦/g, '...'],
    [/Ã‚ /g, ' '],
    [/Ã‚/g, ''],
    [/Î“Ã¶Ã‡/g, '-'],
    [/Î“Ã¶Â£/g, '-'],
    [/Î“Ã¶Ã¶/g, '-']
  ];

  replacements.forEach(function(pair) {
    text = text.replace(pair[0], pair[1]);
  });

  text = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();

  MGR_EMAIL_assertTypographySafe_(text, context || 'text');

  return text;
}

/**
 * HTML-safe typography normalization. Keeps markup intact while repairing
 * common malformed punctuation/encoding artifacts in the serialized HTML.
 */
function MGR_EMAIL_normalizeOutboundHtml_(html) {
  let value = String(html || '');

  const replacements = [
    [/\u00A0/g, '&nbsp;'],
    [/\u2018|\u2019|\u201A|\u201B/g, '&#39;'],
    [/\u201C|\u201D|\u201E|\u201F/g, '&quot;'],
    [/\u2013|\u2014|\u2212/g, '-'],
    [/\u2022|\u2023|\u25E6|\u2043/g, '-'],
    [/\u2026/g, '...'],
    [/\u00B7/g, '-'],

    [/Ã¢â‚¬â„¢/g, '&#39;'],
    [/Ã¢â‚¬Ëœ/g, '&#39;'],
    [/Ã¢â‚¬Å“/g, '&quot;'],
    [/Ã¢â‚¬Â/g, '&quot;'],
    [/Ã¢â‚¬â€œ/g, '-'],
    [/Ã¢â‚¬â€/g, '-'],
    [/Ã¢â‚¬Â¢/g, '-'],
    [/Ã¢â‚¬Â¦/g, '...'],
    [/Ã‚ /g, ' '],
    [/Ã‚/g, ''],
    [/Î“Ã¶Ã‡/g, '-'],
    [/Î“Ã¶Â£/g, '-'],
    [/Î“Ã¶Ã¶/g, '-']
  ];

  replacements.forEach(function(pair) {
    value = value.replace(pair[0], pair[1]);
  });

  value = value.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ''
  );

  MGR_EMAIL_assertTypographySafe_(value, 'html');

  return value;
}

/**
 * Fail closed if suspicious encoding artifacts remain.
 */
function MGR_EMAIL_assertTypographySafe_(value, context) {
  const text = String(value || '');

  const forbidden = [
    '\uFFFD',
    'Ãƒ',
    'Ã‚',
    'Ã¢â‚¬',
    'Ã¢â‚¬â„¢',
    'Ã¢â‚¬Å“',
    'Ã¢â‚¬Â',
    'Ã¢â‚¬â€œ',
    'Ã¢â‚¬â€',
    'Ã¢â‚¬Â¢',
    'Î“Ã¶'
  ];

  const found = forbidden.filter(function(token) {
    return text.indexOf(token) !== -1;
  });

  if (found.length) {
    throw new Error(
      'EMAIL_TYPOGRAPHY_BLOCK: Suspicious encoding detected in ' +
      String(context || 'content') +
      ': ' +
      found.join(', ')
    );
  }

  return true;
}

function MGR_EMAIL_typographyDiagnostics() {
  const tests = [
    {
      input: 'Seller Ã¢â‚¬â„¢ update Ã¢â‚¬â€ Melrose',
      expected: "Seller ' update - Melrose"
    },
    {
      input: 'Website Î“Ã¶Ã‡ Academy Î“Ã¶Ã‡ Consultation',
      expected: 'Website - Academy - Consultation'
    },
    {
      input: 'Hello\u00A0World',
      expected: 'Hello World'
    }
  ];

  const results = tests.map(function(test) {
    const actual = MGR_EMAIL_normalizeOutboundText_(
      test.input,
      'diagnostic'
    );

    return {
      input: test.input,
      expected: test.expected,
      actual: actual,
      pass: actual === test.expected
    };
  });

  return {
    success: results.every(function(row) {
      return row.pass === true;
    }),
    version: MGR_EMAIL_COMPLIANCE_VERSION,
    results: results,
    timestamp: new Date().toISOString()
  };
}

/**
 * Global CTA de-duplication rule.
 *
 * Consultation and Academy destinations may appear only once in the
 * rendered email. The global colored CTA buttons are authoritative.
 */
function MGR_EMAIL_removeDuplicateGlobalCtas_(html, urls) {
  let value = String(html || '');

  const targets = [
    String((urls && urls.consultation) || '').trim(),
    String((urls && urls.academy) || '').trim()
  ].filter(function(url) {
    return !!url;
  });

  targets.forEach(function(url) {
    const escaped = MGR_EMAIL_escapeRegex_(url);

    value = value.replace(
      new RegExp(
        '<a\\b[^>]*href=["\\\']' +
        escaped +
        '["\\\'][^>]*>[\\s\\S]*?<\\/a>',
        'gi'
      ),
      ''
    );

    value = value.replace(
      new RegExp(escaped, 'gi'),
      ''
    );
  });

  value = value
    .replace(/<p\b[^>]*>\s*<\/p>/gi, '')
    .replace(/<div\b[^>]*>\s*<\/div>/gi, '')
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br>')
    .trim();

  return value;
}

function MGR_EMAIL_escapeRegex_(value) {
  return String(value || '').replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function MGR_EMAIL_singleCtaDiagnostics() {
  const urls = {
    consultation:
      'https://melrosegrouprealty.com/book-now',
    academy:
      'https://melrosegrouprealty.com/agent-academy/'
  };

  const sample =
    '<p><a href="' +
    urls.consultation +
    '">Book Now</a></p>' +
    '<p><a href="' +
    urls.academy +
    '">Academy</a></p>' +
    '<p>Keep this body copy.</p>';

  const cleaned =
    MGR_EMAIL_removeDuplicateGlobalCtas_(
      sample,
      urls
    );

  const wrapped =
    MGR_EMAIL_wrapCompliantHtml_(
      sample,
      {
        consultation: urls.consultation,
        academy: urls.academy,
        website:
          'https://melrosegrouprealty.com',
        unsubscribe:
          'https://example.com/unsubscribe'
      },
      {
        subject: 'CTA Diagnostic'
      }
    );

  const consultationCount =
    (wrapped.match(
      new RegExp(
        MGR_EMAIL_escapeRegex_(
          urls.consultation
        ),
        'g'
      )
    ) || []).length;

  const academyCount =
    (wrapped.match(
      new RegExp(
        MGR_EMAIL_escapeRegex_(
          urls.academy
        ),
        'g'
      )
    ) || []).length;

  return {
    success:
      cleaned.indexOf(urls.consultation) === -1 &&
      cleaned.indexOf(urls.academy) === -1 &&
      cleaned.indexOf('Keep this body copy.') !== -1 &&
      consultationCount === 1 &&
      academyCount === 1,
    consultationCount: consultationCount,
    academyCount: academyCount,
    version: MGR_EMAIL_COMPLIANCE_VERSION,
    timestamp: new Date().toISOString()
  };
}

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




