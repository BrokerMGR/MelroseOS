/**
 * MelroseOS Enterprise Core
 * File: CORE-20_PublicEmailLibraryBridge.gs
 * Purpose:
 * Stable public library API for cross-project compliant email delivery.
 */

function MGR_CORE_sendCompliantEmail(message) {
  if (typeof MGR_EMAIL_send !== 'function') {
    throw new Error(
      'CORE email compliance sender MGR_EMAIL_send is unavailable.'
    );
  }

  return MGR_EMAIL_send(message);
}

function MGR_CORE_emailBridgeDiagnostics() {
  return {
    success:
      typeof MGR_EMAIL_send === 'function' &&
      typeof MGR_CORE_sendCompliantEmail === 'function',
    emailSenderAvailable:
      typeof MGR_EMAIL_send === 'function',
    publicBridgeAvailable:
      typeof MGR_CORE_sendCompliantEmail === 'function',
    complianceVersion:
      typeof MGR_EMAIL_COMPLIANCE_VERSION !== 'undefined'
        ? MGR_EMAIL_COMPLIANCE_VERSION
        : '',
    timestamp: new Date().toISOString()
  };
}
