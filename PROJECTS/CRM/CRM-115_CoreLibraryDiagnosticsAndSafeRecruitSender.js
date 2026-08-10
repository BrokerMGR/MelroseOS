/**
 * MelroseOS CRM
 * File: CRM-115_CoreLibraryDiagnosticsAndSafeRecruitSender.gs
 * Purpose:
 * Diagnose CORE library visibility from CRM and provide a safe test sender.
 */

function MGR_RECRUIT_coreLibraryDiagnostics() {
  const result = {
    success: false,
    librarySymbol: 'MGRCORE',
    libraryVisible: false,
    publicBridgeVisible: false,
    publicBridgeType: '',
    error: '',
    timestamp: new Date().toISOString()
  };

  try {
    result.libraryVisible =
      typeof MGRCORE !== 'undefined';

    if (!result.libraryVisible) {
      result.error =
        'CRM does not currently see the MGRCORE library symbol.';
      console.error(
        'MGR_RECRUIT_coreLibraryDiagnostics\n' +
        JSON.stringify(result, null, 2)
      );
      return result;
    }

    let bridgeType = '';

    try {
      bridgeType =
        typeof MGRCORE.MGR_CORE_sendCompliantEmail;
    } catch (bridgeErr) {
      result.error =
        'MGRCORE is visible, but the public bridge could not be read: ' +
        bridgeErr.message;

      console.error(
        'MGR_RECRUIT_coreLibraryDiagnostics\n' +
        JSON.stringify(result, null, 2)
      );

      return result;
    }

    result.publicBridgeType = bridgeType;
    result.publicBridgeVisible =
      bridgeType === 'function';

    if (!result.publicBridgeVisible) {
      result.error =
        'MGRCORE is visible, but MGR_CORE_sendCompliantEmail is not exported as a function.';
    }

    result.success =
      result.libraryVisible &&
      result.publicBridgeVisible;

    console.log(
      'MGR_RECRUIT_coreLibraryDiagnostics\n' +
      JSON.stringify(result, null, 2)
    );

    return result;
  } catch (err) {
    result.error = err.message;

    console.error(
      'MGR_RECRUIT_coreLibraryDiagnostics\n' +
      JSON.stringify(result, null, 2)
    );

    return result;
  }
}

function MGR_RECRUIT_sendFirstFiveTestsToBroker_SAFE() {
  const diagnostics =
    MGR_RECRUIT_coreLibraryDiagnostics();

  if (!diagnostics.success) {
    throw new Error(
      'CORE_LIBRARY_NOT_READY: ' +
      diagnostics.error
    );
  }

  if (
    typeof MGR_RECRUIT_getFirstFive_ !== 'function'
  ) {
    throw new Error(
      'CRM-114 recruit sequence is unavailable.'
    );
  }

  const recipient =
    'melrosegroupbroker@gmail.com';

  const lead = {
    firstName: 'Ulysses',
    credentialNumber:
      '[TEST - Credential Number]',
    applicationDate:
      '[TEST - Application Date]'
  };

  const messages =
    MGR_RECRUIT_getFirstFive_(lead);

  const results = [];

  messages.forEach(function(message, i) {
    const sendResult =
      MGRCORE.MGR_CORE_sendCompliantEmail({
        to: recipient,
        subject:
          '[RECRUIT TEST ' +
          (i + 1) +
          '/5] ' +
          message.subject,
        htmlBody: message.html,
        message: {
          campaign: 'RECRUIT_MENTORSHIP',
          sequence: i + 1,
          test: true
        }
      });

    results.push({
      sequence: i + 1,
      result: sendResult
    });
  });

  const result = {
    success: true,
    recipient: recipient,
    count: results.length,
    results: results,
    timestamp: new Date().toISOString()
  };

  console.log(
    'MGR_RECRUIT_sendFirstFiveTestsToBroker_SAFE\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
