/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-06_FinalValidation.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Performs final non-destructive validation of the Operations layer before
 *   trigger consolidation and eventual LIVE activation.
 *
 * Safety:
 *   - Forces SHADOW mode.
 *   - Does NOT execute trigger cutover.
 *   - Does NOT activate LIVE mode.
 *
 * Requires:
 *   OP-01 through OP-05
 *   CO-01 through CO-07
 ******************************************************************************/

const OP_FINAL_VALIDATION_SHEET = "OP_FINAL_VALIDATION";

function OP_initializeFinalValidation() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_FINAL_VALIDATION_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "Category",
    "Check",
    "Status",
    "Details",
    "ValidatedAt"
  ]);

  return true;
}

function OP_runFinalValidation() {
  OP_initializeFinalValidation();

  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const checks = [];

  OP_addFinalCheck_(
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

  OP_addFinalCheck_(
    checks,
    "OPERATIONS",
    "Orchestrator Available",
    typeof OP_runOperationsCycle === "function",
    "OP_runOperationsCycle availability check."
  );

  OP_addFinalCheck_(
    checks,
    "TRIGGERS",
    "Trigger Manager Available",
    typeof OP_installOperationsTrigger === "function",
    "Operations trigger manager availability check."
  );

  OP_addFinalCheck_(
    checks,
    "TRIGGERS",
    "Trigger Audit Complete",
    getDocProperty_("OP_TRIGGER_AUDIT_COMPLETE") === "TRUE",
    "Trigger migration audit must be completed before consolidation."
  );

  const triggerPreview =
    typeof OP_previewTriggerCutover === "function"
      ? OP_previewTriggerCutover()
      : null;

  OP_addFinalCheck_(
    checks,
    "TRIGGERS",
    "Trigger Cutover Preview",
    !!triggerPreview && triggerPreview.success,
    triggerPreview
      ? triggerPreview.removeCount +
        " recognized legacy trigger(s) would be removed."
      : "Trigger cutover preview is unavailable."
  );

  const duplicateAudit =
    typeof OP_auditDuplicateTriggers === "function"
      ? OP_auditDuplicateTriggers()
      : null;

  OP_addFinalCheck_(
    checks,
    "TRIGGERS",
    "Managed Trigger Duplicates",
    !duplicateAudit ||
      duplicateAudit.duplicateGroups === 0,
    duplicateAudit
      ? duplicateAudit.duplicateGroups +
        " duplicate trigger group(s) detected."
      : "Duplicate trigger audit unavailable.",
    true
  );

  const health =
    typeof CO_runHealthCheck === "function"
      ? CO_runHealthCheck()
      : null;

  OP_addFinalCheck_(
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

  OP_addFinalCheck_(
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

  OP_addFinalCheck_(
    checks,
    "READINESS",
    "Live Readiness",
    !!readiness && readiness.success,
    readiness
      ? readiness.blocked +
        " blocked readiness item(s)."
      : "Live readiness report unavailable."
  );

  OP_writeFinalValidation_(checks);

  const failed = checks.filter(function(check) {
    return check.status === "FAILED";
  });

  const warnings = checks.filter(function(check) {
    return check.status === "WARNING";
  });

  const success = failed.length === 0;

  setDocProperty_(
    "OP_FINAL_VALIDATION_PASSED",
    success ? "TRUE" : "FALSE"
  );

  setDocProperty_(
    "OP_FINAL_VALIDATION_AT",
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
    triggerCutoverPreview: triggerPreview
  };
}

function OP_addFinalCheck_(
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

function OP_writeFinalValidation_(checks) {
  const sheet = workbook_().getSheetByName(
    OP_FINAL_VALIDATION_SHEET
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

function OP_getFinalValidationStatus() {
  return {
    passed:
      getDocProperty_(
        "OP_FINAL_VALIDATION_PASSED"
      ) || "FALSE",

    validatedAt:
      getDocProperty_(
        "OP_FINAL_VALIDATION_AT"
      ) || "",

    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",

    triggerCutover:
      typeof OP_getTriggerCutoverStatus === "function"
        ? OP_getTriggerCutoverStatus()
        : {}
  };
}

function OP_testFinalValidation() {
  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const result = OP_runFinalValidation();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(
    OP_getFinalValidationStatus()
  ));

  if (!result.success) {
    throw new Error(
      "Operations final validation failed. Review OP_FINAL_VALIDATION."
    );
  }

  if (
    typeof CO_getState === "function" &&
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "Operations final validation safety failure: system is not in SHADOW mode."
    );
  }

  return true;
}
