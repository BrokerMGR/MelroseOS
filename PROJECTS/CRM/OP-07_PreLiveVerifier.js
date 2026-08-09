/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-07_PreLiveVerifier.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Performs final pre-LIVE verification after trigger audit/consolidation
 *   planning and before any LIVE activation.
 *
 * Safety:
 *   - Forces SHADOW mode.
 *   - Does NOT activate LIVE mode.
 *   - Does NOT delete triggers.
 *
 * Requires:
 *   OP-01 through OP-06
 *   CO-01 through CO-07
 ******************************************************************************/

const OP_PRELIVE_VERIFY_SHEET = "OP_PRELIVE_VERIFY";

function OP_initializePreLiveVerifier() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_PRELIVE_VERIFY_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "Category",
    "Check",
    "Status",
    "Details",
    "VerifiedAt"
  ]);

  return true;
}

function OP_runPreLiveVerification() {
  OP_initializePreLiveVerifier();

  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const checks = [];

  OP_addPreLiveCheck_(
    checks,
    "SAFETY",
    "Cutover State",
    typeof CO_getState === "function" &&
      CO_getState() === "SHADOW",
    "Current cutover state is " +
      (typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN") +
      "."
  );

  OP_addPreLiveCheck_(
    checks,
    "VALIDATION",
    "Final Operations Validation",
    getDocProperty_("OP_FINAL_VALIDATION_PASSED") === "TRUE",
    "OP_FINAL_VALIDATION_PASSED = " +
      (getDocProperty_("OP_FINAL_VALIDATION_PASSED") || "FALSE") +
      "."
  );

  OP_addPreLiveCheck_(
    checks,
    "TRIGGERS",
    "Trigger Audit Complete",
    getDocProperty_("OP_TRIGGER_AUDIT_COMPLETE") === "TRUE",
    "Trigger audit status: " +
      (getDocProperty_("OP_TRIGGER_AUDIT_COMPLETE") || "FALSE") +
      "."
  );

  const cutoverPreview =
    typeof OP_previewTriggerCutover === "function"
      ? OP_previewTriggerCutover()
      : null;

  OP_addPreLiveCheck_(
    checks,
    "TRIGGERS",
    "Trigger Cutover Preview",
    !!cutoverPreview && cutoverPreview.success,
    cutoverPreview
      ? cutoverPreview.removeCount +
        " recognized legacy trigger(s) are marked for removal."
      : "Trigger cutover preview is unavailable."
  );

  const triggerStatus =
    typeof OP_getTriggerManagerStatus === "function"
      ? OP_getTriggerManagerStatus()
      : null;

  OP_addPreLiveCheck_(
    checks,
    "TRIGGERS",
    "Managed Operations Trigger Count",
    !triggerStatus ||
      Number(triggerStatus.operationsTriggerCount || 0) <= 1,
    triggerStatus
      ? Number(triggerStatus.operationsTriggerCount || 0) +
        " managed operations trigger(s) currently exist."
      : "Trigger Manager status unavailable."
  );

  const health =
    typeof CO_runHealthCheck === "function"
      ? CO_runHealthCheck()
      : null;

  OP_addPreLiveCheck_(
    checks,
    "HEALTH",
    "System Health",
    !!health && health.success,
    health
      ? health.failed +
        " failed health check(s), " +
        health.warnings +
        " warning(s)."
      : "System health check unavailable."
  );

  const shadow =
    typeof CO_runShadowValidation === "function"
      ? CO_runShadowValidation()
      : null;

  OP_addPreLiveCheck_(
    checks,
    "SHADOW",
    "Shadow Validation",
    !!shadow && shadow.success,
    shadow
      ? shadow.failed +
        " failed shadow check(s), " +
        shadow.warnings +
        " warning(s)."
      : "Shadow validation unavailable."
  );

  const readiness =
    typeof CO_generateLiveReadinessReport === "function"
      ? CO_generateLiveReadinessReport()
      : null;

  OP_addPreLiveCheck_(
    checks,
    "READINESS",
    "Live Readiness Report",
    !!readiness && readiness.success,
    readiness
      ? readiness.blocked +
        " blocked readiness item(s)."
      : "Live readiness report unavailable."
  );

  OP_writePreLiveVerification_(checks);

  const failed = checks.filter(function(check) {
    return check.status === "FAILED";
  });

  const warnings = checks.filter(function(check) {
    return check.status === "WARNING";
  });

  const success = failed.length === 0;

  setDocProperty_(
    "OP_PRELIVE_VERIFIED",
    success ? "TRUE" : "FALSE"
  );

  setDocProperty_(
    "OP_PRELIVE_VERIFIED_AT",
    new Date().toISOString()
  );

  return {
    success: success,
    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",
    checks: checks.length,
    failed: failed.length,
    warnings: warnings.length,
    triggerCutoverPreview: cutoverPreview
  };
}

function OP_addPreLiveCheck_(
  checks,
  category,
  check,
  passed,
  details,
  warningIfFalse
) {
  checks.push({
    category: category,
    check: check,
    status: passed
      ? "PASSED"
      : warningIfFalse
        ? "WARNING"
        : "FAILED",
    details: details
  });
}

function OP_writePreLiveVerification_(checks) {
  const sheet = workbook_().getSheetByName(
    OP_PRELIVE_VERIFY_SHEET
  );

  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        sheet.getLastColumn()
      )
      .clearContent();
  }

  const rows = checks.map(function(check) {
    return [
      check.category,
      check.check,
      check.status,
      check.details,
      timestamp_()
    ];
  });

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, 5)
      .setValues(rows);
  }

  sheet.setFrozenRows(1);
  autoResize_(sheet);
}

function OP_getPreLiveVerificationStatus() {
  return {
    verified:
      getDocProperty_("OP_PRELIVE_VERIFIED") || "FALSE",

    verifiedAt:
      getDocProperty_("OP_PRELIVE_VERIFIED_AT") || "",

    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",

    triggerAudit:
      getDocProperty_("OP_TRIGGER_AUDIT_COMPLETE") || "FALSE",

    finalValidation:
      getDocProperty_("OP_FINAL_VALIDATION_PASSED") || "FALSE"
  };
}

function OP_testPreLiveVerifier() {
  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const result =
    OP_runPreLiveVerification();

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      OP_getPreLiveVerificationStatus()
    )
  );

  if (!result.success) {
    throw new Error(
      "Pre-LIVE verification failed. Review OP_PRELIVE_VERIFY."
    );
  }

  if (
    typeof CO_getState === "function" &&
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "Pre-LIVE verification safety failure: system is not in SHADOW mode."
    );
  }

  return true;
}
