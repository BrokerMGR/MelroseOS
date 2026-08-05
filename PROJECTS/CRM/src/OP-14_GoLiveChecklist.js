/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-14_GoLiveChecklist.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Generates the final go-live checklist immediately before production launch.
 *
 * Safety:
 *   - Does NOT consolidate triggers.
 *   - Does NOT activate LIVE mode.
 *   - Keeps MelroseOS in SHADOW mode.
 *
 * Requires:
 *   OP-01 through OP-13
 *   CO-01 through CO-07
 ******************************************************************************/

const OP_GO_LIVE_CHECKLIST_SHEET = "OP_GO_LIVE_CHECKLIST";

function OP_initializeGoLiveChecklist() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_GO_LIVE_CHECKLIST_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "Category",
    "Check",
    "Status",
    "Details",
    "CheckedAt"
  ]);

  return true;
}

function OP_runGoLiveChecklist() {
  OP_initializeGoLiveChecklist();

  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const checks = [];

  OP_addGoLiveCheck_(
    checks,
    "SAFETY",
    "System in SHADOW Mode",
    typeof CO_getState === "function" &&
      CO_getState() === "SHADOW",
    "Current state: " +
      (typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN") +
      "."
  );

  OP_addGoLiveCheck_(
    checks,
    "INSTALLATION",
    "Final Operations Installation",
    getDocProperty_(
      "OP_FINAL_INSTALLATION_COMPLETE"
    ) === "TRUE",
    "Final Operations installation status."
  );

  OP_addGoLiveCheck_(
    checks,
    "VALIDATION",
    "Final Validation Passed",
    getDocProperty_(
      "OP_FINAL_VALIDATION_PASSED"
    ) === "TRUE",
    "Operations final validation status."
  );

  OP_addGoLiveCheck_(
    checks,
    "VALIDATION",
    "Pre-LIVE Verification Passed",
    getDocProperty_(
      "OP_PRELIVE_VERIFIED"
    ) === "TRUE",
    "Pre-LIVE verification status."
  );

  OP_addGoLiveCheck_(
    checks,
    "TRIGGERS",
    "Trigger Audit Complete",
    getDocProperty_(
      "OP_TRIGGER_AUDIT_COMPLETE"
    ) === "TRUE",
    "Trigger audit must be complete before launch."
  );

  const triggerPlan =
    typeof OP_getControlledCutoverPlan === "function"
      ? OP_getControlledCutoverPlan()
      : null;

  OP_addGoLiveCheck_(
    checks,
    "TRIGGERS",
    "Controlled Cutover Plan Available",
    !!triggerPlan && triggerPlan.success,
    triggerPlan
      ? triggerPlan.legacyTriggersToRemove +
        " legacy operational trigger(s) identified for consolidation."
      : "Controlled trigger cutover plan unavailable."
  );

  const health =
    typeof CO_runHealthCheck === "function"
      ? CO_runHealthCheck()
      : null;

  OP_addGoLiveCheck_(
    checks,
    "HEALTH",
    "System Health Passing",
    !!health && health.success,
    health
      ? health.failed +
        " failure(s), " +
        health.warnings +
        " warning(s)."
      : "Health check unavailable."
  );

  const shadow =
    typeof CO_runShadowValidation === "function"
      ? CO_runShadowValidation()
      : null;

  OP_addGoLiveCheck_(
    checks,
    "SHADOW",
    "Shadow Validation Passing",
    !!shadow && shadow.success,
    shadow
      ? shadow.failed +
        " failure(s), " +
        shadow.warnings +
        " warning(s)."
      : "Shadow validation unavailable."
  );

  const readiness =
    typeof CO_generateLiveReadinessReport === "function"
      ? CO_generateLiveReadinessReport()
      : null;

  OP_addGoLiveCheck_(
    checks,
    "READINESS",
    "LIVE Readiness Report",
    !!readiness && readiness.success,
    readiness
      ? readiness.blocked +
        " blocked readiness item(s)."
      : "LIVE readiness report unavailable."
  );

  const launchPreview =
    typeof OP_getLaunchProcedurePreview === "function"
      ? OP_getLaunchProcedurePreview()
      : null;

  OP_addGoLiveCheck_(
    checks,
    "LAUNCH",
    "Launch Procedure Preview",
    !!launchPreview && launchPreview.ready,
    launchPreview
      ? launchPreview.legacyTriggersToRemove +
        " legacy trigger(s) would be consolidated at launch."
      : "Launch procedure preview unavailable."
  );

  const postLaunchAvailable =
    typeof OP_runPostLaunchMonitor === "function" &&
    typeof OP_installPostLaunchMonitorTrigger === "function";

  OP_addGoLiveCheck_(
    checks,
    "MONITORING",
    "Post-Launch Monitor Available",
    postLaunchAvailable,
    postLaunchAvailable
      ? "Post-launch monitoring and automatic SHADOW rollback are available."
      : "Post-launch monitoring dependency is unavailable."
  );

  OP_writeGoLiveChecklist_(checks);

  const failed = checks.filter(function(check) {
    return check.status === "FAILED";
  });

  const ready = failed.length === 0;

  setDocProperty_(
    "OP_GO_LIVE_CHECKLIST_READY",
    ready ? "TRUE" : "FALSE"
  );

  setDocProperty_(
    "OP_GO_LIVE_CHECKLIST_AT",
    new Date().toISOString()
  );

  return {
    success: ready,
    ready: ready,
    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",
    checks: checks.length,
    failed: failed.length,
    liveActivated: false
  };
}

function OP_addGoLiveCheck_(
  checks,
  category,
  check,
  passed,
  details
) {
  checks.push({
    category: category,
    check: check,
    status: passed ? "PASSED" : "FAILED",
    details: details
  });
}

function OP_writeGoLiveChecklist_(checks) {
  const sheet = workbook_().getSheetByName(
    OP_GO_LIVE_CHECKLIST_SHEET
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

function OP_getGoLiveChecklistStatus() {
  return {
    ready:
      getDocProperty_(
        "OP_GO_LIVE_CHECKLIST_READY"
      ) || "FALSE",

    checkedAt:
      getDocProperty_(
        "OP_GO_LIVE_CHECKLIST_AT"
      ) || "",

    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN"
  };
}

function OP_testGoLiveChecklist() {
  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const result =
    OP_runGoLiveChecklist();

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      OP_getGoLiveChecklistStatus()
    )
  );

  if (!result.success) {
    throw new Error(
      "Go-Live Checklist is not ready. Review OP_GO_LIVE_CHECKLIST."
    );
  }

  if (
    typeof CO_getState === "function" &&
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "Go-Live Checklist safety failure: system is not in SHADOW mode."
    );
  }

  return true;
}
