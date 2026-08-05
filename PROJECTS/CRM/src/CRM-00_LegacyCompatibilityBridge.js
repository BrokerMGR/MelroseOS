/******************************************************************************
 * MelroseOS
 * File: CRM-00_LegacyCompatibilityBridge.js
 * Version: 1.0.0
 *
 * Compatibility wrappers for legacy callers.
 ******************************************************************************/

const CRM_LEGACY_BRIDGE_VERSION = "1.0.0";

/**
 * Compatibility scoring wrapper.
 *
 * @param {Object} payload
 * @return {*}
 */
function MOS5CI_scoreSubmission_(payload) {
  if (typeof scoreM5Lead === "function") {
    return scoreM5Lead(payload || {});
  }

  throw new Error(
    "MOS5CI_scoreSubmission_ could not locate scoreM5Lead()."
  );
}

/**
 * Legacy intake wrapper.
 *
 * @param {Object} payload
 * @return {Object}
 */
function LI_intakeLead(payload) {
  return CRM_routeLegacyLead_(payload, {
    requestedAction: "INTAKE"
  });
}

/**
 * Legacy routing wrapper.
 *
 * @param {Object} payload
 * @return {Object}
 */
function LI_routeLead(payload) {
  return CRM_routeLegacyLead_(payload, {
    requestedAction: "ROUTE"
  });
}

/**
 * Legacy CRM creation wrapper.
 *
 * All creation now flows through the canonical intake authority.
 *
 * @param {Object} payload
 * @return {Object}
 */
function CRM_createLead(payload) {
  return CRM_routeLegacyLead_(payload, {
    requestedAction: "CREATE"
  });
}

/**
 * Sends all legacy intake paths into the canonical pipeline.
 *
 * @param {Object} payload
 * @param {Object=} options
 * @return {Object}
 */
function CRM_routeLegacyLead_(payload, options) {
  const input = payload || {};
  const settings = options || {};

  if (typeof MOS5_submitCanonicalLead === "function") {
    return MOS5_submitCanonicalLead(input, {
      source:
        input.Source ||
        input.source ||
        input.LeadSource ||
        "LEGACY_GMAIL_INTAKE",
      requestedAction:
        settings.requestedAction || "LEGACY"
    });
  }

  if (typeof LI_routeIncomingLead === "function") {
    return LI_routeIncomingLead(input, {
      source:
        input.Source ||
        input.source ||
        input.LeadSource ||
        "LEGACY_GMAIL_INTAKE",
      autoProcess: false
    });
  }

  if (typeof submitM5Lead === "function") {
    return submitM5Lead(input);
  }

  throw new Error(
    "No canonical MelroseOS lead intake authority is available."
  );
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function CRM_runLegacyCompatibilityDiagnostics() {
  const tests = [];

  function add(code, passed, details) {
    tests.push({
      code: code,
      status: passed ? "PASS" : "FAIL",
      details: details
    });
  }

  add(
    "SCORING_AUTHORITY",
    typeof scoreM5Lead === "function",
    "scoreM5Lead is available."
  );

  add(
    "CANONICAL_INTAKE_AUTHORITY",
    typeof MOS5_submitCanonicalLead === "function" ||
      typeof LI_routeIncomingLead === "function" ||
      typeof submitM5Lead === "function",
    "At least one approved intake authority is available."
  );

  const failed = tests.filter(function(test) {
    return test.status === "FAIL";
  }).length;

  const result = {
    release: "CRM-00-LEGACY-COMPATIBILITY",
    version: CRM_LEGACY_BRIDGE_VERSION,
    overallStatus: failed ? "FAIL" : "PASS",
    passed: tests.length - failed,
    failed: failed,
    tests: tests,
    productionChanged: false,
    completedAt: new Date().toISOString()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}