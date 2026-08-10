/**
 * MelroseOS CRM
 * File: CRM-131_LRECPendingRuleLock.gs
 * Version: 1.0.0
 *
 * Authoritative pending-agent classification rule:
 *
 * CLEAN NO-RESULT from LREC search = PENDING = pending-recruit workflow may continue.
 * ANY license record returned by LREC = EXISTING AGENT = pending-recruit workflow stops.
 * PORTAL ERROR / TIMEOUT / UNPARSEABLE RESPONSE = HOLD = no send.
 */

const MGR_LREC_PENDING_RULE = Object.freeze({
  VERSION: '1.0.0',
  NO_RESULT_ROUTE: 'PENDING_RECRUIT',
  LICENSE_FOUND_ROUTE: 'EXISTING_AGENT_PENDING_WORKFLOW',
  ERROR_ROUTE: 'HOLD_FOR_REVIEW'
});

function MGR_LREC_applyPendingBusinessRule_(lookup) {
  const r = lookup || {};

  if (r.transportError === true || r.parseError === true) {
    return {
      allowPendingRecruitSend: false,
      route: MGR_LREC_PENDING_RULE.ERROR_ROUTE,
      reason: r.error || 'LREC_SEARCH_FAILED'
    };
  }

  if (r.noResults === true) {
    return {
      allowPendingRecruitSend: true,
      route: MGR_LREC_PENDING_RULE.NO_RESULT_ROUTE,
      reason: 'LREC_NO_RESULTS_PENDING'
    };
  }

  if (r.recordFound === true) {
    return {
      allowPendingRecruitSend: false,
      route: MGR_LREC_PENDING_RULE.LICENSE_FOUND_ROUTE,
      reason: 'LREC_LICENSE_RECORD_FOUND'
    };
  }

  return {
    allowPendingRecruitSend: false,
    route: MGR_LREC_PENDING_RULE.ERROR_ROUTE,
    reason: 'LREC_RESULT_AMBIGUOUS'
  };
}

function RUN_LREC_PENDING_RULE_CERTIFICATION() {
  const checks = [
    {
      name: 'NO_RESULT_MEANS_PENDING',
      pass:
        MGR_LREC_applyPendingBusinessRule_({
          noResults: true
        }).allowPendingRecruitSend === true
    },
    {
      name: 'ACTIVE_RECORD_MEANS_EXISTING_AGENT',
      pass:
        MGR_LREC_applyPendingBusinessRule_({
          recordFound: true,
          licenseStatus: 'Active'
        }).route === 'EXISTING_AGENT_PENDING_WORKFLOW'
    },
    {
      name: 'INACTIVE_RECORD_MEANS_EXISTING_AGENT',
      pass:
        MGR_LREC_applyPendingBusinessRule_({
          recordFound: true,
          licenseStatus: 'Inactive'
        }).route === 'EXISTING_AGENT_PENDING_WORKFLOW'
    },
    {
      name: 'PORTAL_ERROR_FAILS_CLOSED',
      pass:
        MGR_LREC_applyPendingBusinessRule_({
          transportError: true,
          error: 'TIMEOUT'
        }).allowPendingRecruitSend === false
    },
    {
      name: 'UNPARSEABLE_FAILS_CLOSED',
      pass:
        MGR_LREC_applyPendingBusinessRule_({
          parseError: true
        }).allowPendingRecruitSend === false
    }
  ];

  const result = {
    success: checks.every(function(c) {
      return c.pass === true;
    }),
    version: MGR_LREC_PENDING_RULE.VERSION,
    checks: checks,
    lockedRule:
      'NO LREC RESULT = PENDING; ANY LICENSE RECORD = EXISTING AGENT; ERROR = HOLD',
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_LREC_PENDING_RULE_CERTIFICATION\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
