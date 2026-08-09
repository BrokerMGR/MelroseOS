/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-007_TestMailer
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Sends branded SANDBOX tests only.
 * Production recruit delivery remains prohibited.
 */

const REC_DEFAULT_TEST_RECIPIENT = 'melrosegroupbroker@gmail.com';

function REC_assertTestMailerSafety_(recipient) {
  REC_assertSafeMode();

  const to = REC_normalizeEmail(recipient || REC_DEFAULT_TEST_RECIPIENT);
  const allowed = [
    'melrosegroupbroker@gmail.com',
    'melrosegrouprealty@gmail.com'
  ];

  if (allowed.indexOf(to) === -1) {
    throw new Error(
      'SANDBOX test mail is restricted to approved Melrose Group Realty test addresses.'
    );
  }

  const effective = REC_normalizeEmail(Session.getEffectiveUser().getEmail());
  const configuredSender = REC_normalizeEmail(REC_CONFIG.senderAccount);

  if (effective && effective !== configuredSender) {
    throw new Error(
      'Run this Apps Script project while signed into ' +
      configuredSender +
      '. Effective user is ' +
      effective +
      '.'
    );
  }

  return to;
}

function REC_getTestRecruit_() {
  return {
    recruitId: 'REC-SANDBOX-TEST',
    firstName: 'Ulysses',
    lastName: 'Test',
    email: REC_DEFAULT_TEST_RECIPIENT,
    city: 'Mandeville',
    parish: 'St. Tammany',
    licenseNumber: 'PRE-LICENSE',
    recruitStage: 'PRE_LICENSE',
    campaignStatus: 'TEST',
    lrecStatus: 'UNKNOWN',
    sponsoringBroker: '',
    replyDetected: false,
    unsubscribed: false,
    doNotContact: false
  };
}

function REC_sendBrandedTestEmail(recipient) {
  const to = REC_assertTestMailerSafety_(recipient);

  const assetCheck = REC_runBrandAssetDiagnostics();
  if (!assetCheck.success) {
    REC_seedBrandingAssets();
  }

  const assets = REC_getBrandAssetBlobs();
  const recruit = REC_getTestRecruit_();

  const email = REC_buildPreLicenseEmail(recruit, {
    logoCid: 'mgrLogo',
    businessCardCid: 'brokerCard',
    consultationUrl: 'https://melrosegrouprealty.com/book-now',
    academyUrl: 'https://melrosegrouprealty.com',
    unsubscribeUrl: 'https://melrosegrouprealty.com'
  });

  GmailApp.sendEmail(
    to,
    '[SANDBOX TEST] ' + email.subject,
    email.plainText,
    {
      htmlBody: email.html,
      inlineImages: assets,
      name: 'Melrose Group Realty',
      replyTo: REC_CONFIG.senderAccount
    }
  );

  REC_log('PASS', 'REC-007_TestMailer', 'Branded sandbox test email sent.', {
    recipient: to,
    subject: email.subject
  });

  return REC_result(true, {
    recipient: to,
    subject: email.subject,
    senderAccount: REC_CONFIG.senderAccount,
    sandbox: true
  });
}

function REC_runTestMailerDiagnostics() {
  REC_assertSafeMode();

  const effective = REC_normalizeEmail(Session.getEffectiveUser().getEmail());
  const configured = REC_normalizeEmail(REC_CONFIG.senderAccount);

  const checks = [
    {
      name: 'Sandbox mode',
      pass: REC_CONFIG.mode === 'SANDBOX',
      detail: REC_CONFIG.mode
    },
    {
      name: 'Production outbound disabled',
      pass: REC_CONFIG.outboundEnabled === false,
      detail: String(REC_CONFIG.outboundEnabled)
    },
    {
      name: 'Execution account',
      pass: !effective || effective === configured,
      detail: effective || '(not returned by Session)'
    }
  ];

  return REC_result(
    checks.every(function(c) { return c.pass; }),
    { checks: checks }
  );
}
