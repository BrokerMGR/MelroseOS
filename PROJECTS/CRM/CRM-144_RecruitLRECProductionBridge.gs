/**
 * MelroseOS CRM
 * File: CRM-144_RecruitLRECProductionBridge.gs
 * Version: 1.0.0
 *
 * Bridges the proven CRM-143.2 verifier into recruit production gating.
 * This module does NOT enable outbound.
 */

const MGR_RECRUIT_144 = Object.freeze({
  VERSION: '1.0.0'
});

function MGR_RECRUIT_144_verifyPendingCandidate(recruit) {
  recruit = recruit || {};

  if (typeof MGR_LREC_143_verifyRecruit !== 'function') {
    return {
      success: false,
      decision: 'HOLD',
      reason: 'CRM143_VERIFIER_MISSING'
    };
  }

  const result = MGR_LREC_143_verifyRecruit(
    recruit.firstName || recruit.FirstName || '',
    recruit.lastName || recruit.LastName || '',
    recruit.licenseNumber || recruit.credentialNumber ||
      recruit.CredentialNumber || recruit.AccountNumber || '',
    recruit.phone || recruit.Phone || recruit.PhoneNumber || ''
  );

  if (!result || result.success !== true) {
    return {
      success: false,
      decision: 'HOLD',
      reason: (result && result.error) || 'LREC_VERIFICATION_FAILED',
      lrec: result || null
    };
  }

  if (result.recordFound === true) {
    return {
      success: true,
      decision: 'TRANSITION_EXISTING_AGENT',
      reason: 'LREC_RECORD_FOUND',
      existingAgentOutbound: 'OFF',
      lrec: result
    };
  }

  if (result.noResults === true) {
    return {
      success: true,
      decision: 'ALLOW_PENDING_RECRUIT',
      reason: 'EXPLICIT_LREC_NO_RESULT',
      lrec: result
    };
  }

  return {
    success: false,
    decision: 'HOLD',
    reason: 'LREC_AMBIGUOUS',
    lrec: result
  };
}

function RUN_RECRUIT_144_BRIDGE_CERTIFICATION() {
  const positive = MGR_RECRUIT_144_verifyPendingCandidate({
    firstName: 'Clarissa',
    lastName: 'Brown',
    licenseNumber: '995720225'
  });

  const negative = MGR_RECRUIT_144_verifyPendingCandidate({
    firstName: 'Zzzmelroseosnorecord',
    lastName: 'Zzzvalidation'
  });

  const result = {
    success:
      positive.success === true &&
      positive.decision === 'TRANSITION_EXISTING_AGENT' &&
      negative.success === true &&
      negative.decision === 'ALLOW_PENDING_RECRUIT',
    version: MGR_RECRUIT_144.VERSION,
    positiveDecision: positive,
    negativeDecision: negative,
    existingAgentOutbound: 'OFF',
    recruitOutboundReleaseAllowed: false,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_144_BRIDGE_CERTIFICATION\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
