/**
 * MelroseOS Enterprise Core
 * File: CORE-17_EmailComplianceTestRunner.gs
 * Release: MOS5-CORE-17
 * Version: 1.0.0
 *
 * Purpose:
 * Provide obvious one-click runner functions for validating and testing
 * the system-wide email compliance engine without relying on long function
 * names in the Apps Script function picker.
 */

const MGR_EMAIL_TEST_RECIPIENT = 'melrosegroupbroker@gmail.com';

/**
 * Primary one-click test runner.
 *
 * This function:
 * 1. Installs production compliance settings.
 * 2. Verifies production compliance.
 * 3. Sends a production-format test email to the broker account.
 * 4. Logs and returns the complete result.
 *
 * Run this function from the Apps Script function picker:
 *   RUN_EMAIL_COMPLIANCE_TEST
 *
 * @return {Object}
 */
function RUN_EMAIL_COMPLIANCE_TEST() {
  const startedAt = new Date().toISOString();

  const installation =
    MGR_EMAIL_installProductionComplianceConfig();

  const verification =
    MGR_EMAIL_verifyProductionCompliance();

  if (!verification || verification.success !== true) {
    const blocked = {
      success: false,
      sent: false,
      stage: 'VERIFICATION',
      recipient: MGR_EMAIL_TEST_RECIPIENT,
      startedAt: startedAt,
      completedAt: new Date().toISOString(),
      installation: installation,
      verification: verification
    };

    console.error(
      'RUN_EMAIL_COMPLIANCE_TEST BLOCKED\n' +
      JSON.stringify(blocked, null, 2)
    );

    return blocked;
  }

  const sendResult =
    MGR_EMAIL_installAndSendComplianceTest(
      MGR_EMAIL_TEST_RECIPIENT
    );

  const result = {
    success:
      !!sendResult &&
      sendResult.success === true &&
      sendResult.sent === true,
    sent:
      !!sendResult &&
      sendResult.sent === true,
    recipient: MGR_EMAIL_TEST_RECIPIENT,
    startedAt: startedAt,
    completedAt: new Date().toISOString(),
    installation: installation,
    verification: verification,
    sendResult: sendResult
  };

  if (result.success) {
    console.log(
      'RUN_EMAIL_COMPLIANCE_TEST PASS\n' +
      JSON.stringify(result, null, 2)
    );
  } else {
    console.error(
      'RUN_EMAIL_COMPLIANCE_TEST FAIL\n' +
      JSON.stringify(result, null, 2)
    );
  }

  return result;
}

/**
 * Verification-only runner.
 *
 * Run:
 *   RUN_EMAIL_COMPLIANCE_VERIFY
 *
 * @return {Object}
 */
function RUN_EMAIL_COMPLIANCE_VERIFY() {
  const installation =
    MGR_EMAIL_installProductionComplianceConfig();

  const verification =
    MGR_EMAIL_verifyProductionCompliance();

  const result = {
    success:
      !!verification &&
      verification.success === true,
    recipient: MGR_EMAIL_TEST_RECIPIENT,
    installation: installation,
    verification: verification,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_EMAIL_COMPLIANCE_VERIFY\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

/**
 * Diagnostic helper showing the actual effective/active Google account
 * and the fixed broker test recipient.
 *
 * Run:
 *   RUN_EMAIL_TEST_IDENTITY
 *
 * @return {Object}
 */
function RUN_EMAIL_TEST_IDENTITY() {
  let effectiveUser = '';
  let activeUser = '';

  try {
    effectiveUser =
      Session.getEffectiveUser().getEmail() || '';
  } catch (err) {}

  try {
    activeUser =
      Session.getActiveUser().getEmail() || '';
  } catch (err) {}

  const result = {
    success: true,
    fixedTestRecipient: MGR_EMAIL_TEST_RECIPIENT,
    effectiveUser: effectiveUser,
    activeUser: activeUser,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_EMAIL_TEST_IDENTITY\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
