/**
 * MelroseOS Enterprise Core
 * File: CORE-19_UnsubscribeConfigRunner.gs
 * Release: MOS5-CORE-19
 * Version: 1.0.0
 *
 * Purpose:
 * Hard-code the verified production WEBSITE /exec URL into the CORE
 * email compliance engine so the user can run a no-argument function
 * from the Apps Script function picker.
 */

const MGR_EMAIL_PRODUCTION_UNSUBSCRIBE_URL =
  'https://script.google.com/macros/s/AKfycbywBS1wpe1TI4C8a37nWK67SVp8nRrHpa2wjUhvNjNjCxLmU6l_z0aJrBJ5x9NRSGmvTQ/exec';

/**
 * Run this from the CORE Apps Script function picker.
 *
 * This function:
 * 1. Stores the production WEBSITE unsubscribe endpoint in CORE.
 * 2. Runs compliance verification.
 * 3. Logs the complete result.
 *
 * @return {Object}
 */
function RUN_FINISH_UNSUBSCRIBE_CONFIGURATION() {
  const configureResult =
    MGR_EMAIL_finishUnsubscribeConfiguration(
      MGR_EMAIL_PRODUCTION_UNSUBSCRIBE_URL
    );

  const verification =
    MGR_EMAIL_verifyProductionCompliance();

  const result = {
    success:
      !!verification &&
      verification.success === true,
    unsubscribeUrl:
      MGR_EMAIL_PRODUCTION_UNSUBSCRIBE_URL,
    configureResult: configureResult,
    verification: verification,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_FINISH_UNSUBSCRIBE_CONFIGURATION\n' +
    JSON.stringify(result, null, 2)
  );

  if (result.success) {
    console.log(
      'PASS - Production unsubscribe URL configured.'
    );
  } else {
    console.error(
      'FAIL - Compliance verification is still incomplete.'
    );
  }

  return result;
}

/**
 * Convenience runner:
 * configure + verify + send the compliance test email.
 *
 * Test recipient remains fixed by CORE-17 to:
 * melrosegroupbroker@gmail.com
 *
 * @return {Object}
 */
function RUN_CONFIGURE_AND_SEND_EMAIL_TEST() {
  const configResult =
    RUN_FINISH_UNSUBSCRIBE_CONFIGURATION();

  if (!configResult.success) {
    return {
      success: false,
      sent: false,
      stage: 'CONFIGURATION',
      configResult: configResult
    };
  }

  const sendResult =
    RUN_EMAIL_COMPLIANCE_TEST();

  const result = {
    success:
      !!sendResult &&
      sendResult.success === true &&
      sendResult.sent === true,
    sent:
      !!sendResult &&
      sendResult.sent === true,
    configResult: configResult,
    sendResult: sendResult,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_CONFIGURE_AND_SEND_EMAIL_TEST\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
