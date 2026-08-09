/**
 * MelroseOS Enterprise Core
 * File: CORE-16_EmailComplianceConfig.gs
 * Release: MOS5-CORE-16
 * Version: 1.0.0
 *
 * Purpose:
 * - Install the system-wide outbound email compliance settings.
 * - Configure the brokerage postal address, website, consultation URL,
 *   Academy URL, reply-to, and unsubscribe web-app base URL.
 * - Provide a single setup + diagnostics + test-email workflow.
 */

const MGR_EMAIL_PRODUCTION_CONFIG = Object.freeze({
  POSTAL_ADDRESS:
    '1 St. Ann Drive Suite 92, Mandeville, LA 70471',

  WEBSITE_URL:
    'https://melrosegrouprealty.com',

  CONSULTATION_URL:
    'https://melrosegrouprealty.com/book-now',

  ACADEMY_URL:
    'https://melrosegrouprealty.com/agent-academy/',

  REPLY_TO:
    'melrosegrouprealty@gmail.com'
});

/**
 * Install all known production email compliance settings.
 *
 * If this Apps Script project is deployed as a web app, the current
 * deployment URL is automatically stored as the unsubscribe base URL.
 *
 * @return {Object}
 */
function MGR_EMAIL_installProductionComplianceConfig() {
  MGR_EMAIL_setPostalAddress(
    MGR_EMAIL_PRODUCTION_CONFIG.POSTAL_ADDRESS
  );

  MGR_EMAIL_setWebsiteUrl(
    MGR_EMAIL_PRODUCTION_CONFIG.WEBSITE_URL
  );

  MGR_EMAIL_setConsultationUrl(
    MGR_EMAIL_PRODUCTION_CONFIG.CONSULTATION_URL
  );

  MGR_EMAIL_setAcademyUrl(
    MGR_EMAIL_PRODUCTION_CONFIG.ACADEMY_URL
  );

  MGR_EMAIL_setReplyTo(
    MGR_EMAIL_PRODUCTION_CONFIG.REPLY_TO
  );

  const webAppUrl = MGR_EMAIL_resolveCurrentWebAppUrl_();

  if (webAppUrl) {
    MGR_EMAIL_setUnsubscribeBaseUrl(webAppUrl);
  }

  const diagnostics =
    MGR_EMAIL_complianceDiagnostics();

  return {
    success: diagnostics.success,
    configInstalled: true,
    postalAddress:
      MGR_EMAIL_PRODUCTION_CONFIG.POSTAL_ADDRESS,
    website:
      MGR_EMAIL_PRODUCTION_CONFIG.WEBSITE_URL,
    consultation:
      MGR_EMAIL_PRODUCTION_CONFIG.CONSULTATION_URL,
    academy:
      MGR_EMAIL_PRODUCTION_CONFIG.ACADEMY_URL,
    replyTo:
      MGR_EMAIL_PRODUCTION_CONFIG.REPLY_TO,
    unsubscribeBaseUrl:
      webAppUrl || '',
    webAppDeploymentDetected:
      !!webAppUrl,
    diagnostics: diagnostics,
    timestamp: new Date().toISOString()
  };
}

/**
 * Manually set the unsubscribe deployment URL if this project is not the
 * deployed MelroseOS web-app project or ScriptApp.getService().getUrl()
 * does not return a URL.
 *
 * @param {string} url
 * @return {Object}
 */
function MGR_EMAIL_finishUnsubscribeConfiguration(url) {
  MGR_EMAIL_setUnsubscribeBaseUrl(url);

  return MGR_EMAIL_complianceDiagnostics();
}

/**
 * One-step production readiness check.
 *
 * @return {Object}
 */
function MGR_EMAIL_verifyProductionCompliance() {
  const diagnostics =
    MGR_EMAIL_complianceDiagnostics();

  const required = {
    mailingAddress:
      MGR_EMAIL_PRODUCTION_CONFIG.POSTAL_ADDRESS,
    website:
      MGR_EMAIL_PRODUCTION_CONFIG.WEBSITE_URL,
    consultation:
      MGR_EMAIL_PRODUCTION_CONFIG.CONSULTATION_URL,
    academy:
      MGR_EMAIL_PRODUCTION_CONFIG.ACADEMY_URL,
    replyTo:
      MGR_EMAIL_PRODUCTION_CONFIG.REPLY_TO
  };

  return {
    success: diagnostics.success,
    required: required,
    diagnostics: diagnostics,
    timestamp: new Date().toISOString()
  };
}

/**
 * Install settings, verify them, and send the production-format compliance
 * test email to the effective user or an explicitly supplied email.
 *
 * This never enrolls the recipient in a campaign and never changes lead state.
 *
 * @param {string=} recipient
 * @return {Object}
 */
function MGR_EMAIL_installAndSendComplianceTest(recipient) {
  const installation =
    MGR_EMAIL_installProductionComplianceConfig();

  if (!installation.success) {
    return {
      success: false,
      sent: false,
      installation: installation,
      message:
        'Compliance configuration is incomplete. ' +
        'The most likely missing value is the unsubscribe web-app URL.'
    };
  }

  const sendResult =
    MGR_EMAIL_sendComplianceTest(recipient);

  return {
    success: sendResult.success === true,
    sent: sendResult.sent === true,
    installation: installation,
    sendResult: sendResult
  };
}

/**
 * Resolve current deployed web-app URL.
 *
 * @return {string}
 * @private
 */
function MGR_EMAIL_resolveCurrentWebAppUrl_() {
  try {
    const service = ScriptApp.getService();

    if (
      service &&
      typeof service.getUrl === 'function'
    ) {
      const url = service.getUrl();

      if (
        url &&
        /^https:\/\/script\.google\.com\/macros\/s\//i.test(
          String(url)
        )
      ) {
        return String(url).trim();
      }
    }
  } catch (err) {
    // No deployed web-app URL is available in this execution context.
  }

  return '';
}
