/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-12_FinalInstaller.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Final installer and safety validation for the complete Operations layer.
 *
 * IMPORTANT:
 *   - Does NOT consolidate legacy triggers.
 *   - Does NOT activate LIVE mode.
 *   - Leaves MelroseOS in SHADOW mode.
 *
 * Requires:
 *   OP-01 through OP-11
 *   CO-01 through CO-07
 ******************************************************************************/

const OP_FINAL_INSTALL_SHEET = "OP_FINAL_INSTALL";

function OP_initializeFinalInstaller() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_FINAL_INSTALL_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "Component",
    "Status",
    "Details",
    "UpdatedAt"
  ]);

  return true;
}

function OP_runFinalOperationsInstallation() {
  OP_initializeFinalInstaller();

  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const checks = [];

  OP_finalInstallCheck_(
    checks,
    "Operations Orchestrator",
    typeof OP_runOperationsCycle === "function",
    "OP-01 operational orchestrator."
  );

  OP_finalInstallCheck_(
    checks,
    "Trigger Manager",
    typeof OP_installOperationsTrigger === "function",
    "OP-02 trigger manager."
  );

  OP_finalInstallCheck_(
    checks,
    "Operations Installer",
    typeof OP_installOperationsModule === "function",
    "OP-03 operations installer."
  );

  OP_finalInstallCheck_(
    checks,
    "Trigger Migration",
    typeof OP_auditTriggersForMigration === "function",
    "OP-04 trigger migration audit."
  );

  OP_finalInstallCheck_(
    checks,
    "Trigger Cutover",
    typeof OP_executeTriggerCutover === "function",
    "OP-05 guarded trigger cutover."
  );

  OP_finalInstallCheck_(
    checks,
    "Final Validation",
    typeof OP_runFinalValidation === "function",
    "OP-06 final validation."
  );

  OP_finalInstallCheck_(
    checks,
    "Pre-LIVE Verifier",
    typeof OP_runPreLiveVerification === "function",
    "OP-07 pre-LIVE verifier."
  );

  OP_finalInstallCheck_(
    checks,
    "Controlled Cutover",
    typeof OP_executeControlledTriggerCutover === "function",
    "OP-08 controlled cutover controller."
  );

  OP_finalInstallCheck_(
    checks,
    "LIVE Activation Controller",
    typeof OP_activateMelroseOSLive === "function",
    "OP-09 guarded LIVE activation controller."
  );

  OP_finalInstallCheck_(
    checks,
    "Final Launch Sequence",
    typeof OP_executeFinalLaunch === "function",
    "OP-10 final launch sequence."
  );

  OP_finalInstallCheck_(
    checks,
    "Post-Launch Monitor",
    typeof OP_runPostLaunchMonitor === "function",
    "OP-11 post-launch monitor."
  );

  OP_finalInstallCheck_(
    checks,
    "SHADOW Safety State",
    typeof CO_getState === "function" &&
      CO_getState() === "SHADOW",
    "Current state: " +
      (typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN") +
      "."
  );

  const install =
    typeof OP_installOperationsModule === "function"
      ? OP_installOperationsModule()
      : null;

  OP_finalInstallCheck_(
    checks,
    "Operations Module Installation",
    !!install && install.success,
    install
      ? install.failed +
        " failure(s), " +
        install.warnings +
        " warning(s)."
      : "Operations installer unavailable."
  );

  const health =
    typeof CO_runHealthCheck === "function"
      ? CO_runHealthCheck()
      : null;

  OP_finalInstallCheck_(
    checks,
    "System Health",
    !!health && health.success,
    health
      ? health.failed +
        " failure(s), " +
        health.warnings +
        " warning(s)."
      : "Health check unavailable."
  );

  const validation =
    typeof OP_runFinalValidation === "function"
      ? OP_runFinalValidation()
      : null;

  OP_finalInstallCheck_(
    checks,
    "Operations Final Validation",
    !!validation && validation.success,
    validation
      ? validation.failed +
        " failure(s), " +
        validation.warnings +
        " warning(s)."
      : "Final validation unavailable."
  );

  const preLive =
    typeof OP_runPreLiveVerification === "function"
      ? OP_runPreLiveVerification()
      : null;

  OP_finalInstallCheck_(
    checks,
    "Pre-LIVE Verification",
    !!preLive && preLive.success,
    preLive
      ? preLive.failed +
        " failure(s), " +
        preLive.warnings +
        " warning(s)."
      : "Pre-LIVE verification unavailable."
  );

  OP_writeFinalInstallChecks_(checks);

  const failed = checks.filter(function(check) {
    return check.status === "FAILED";
  });

  const success = failed.length === 0;

  setDocProperty_(
    "OP_FINAL_INSTALLATION_COMPLETE",
    success ? "TRUE" : "FALSE"
  );

  setDocProperty_(
    "OP_FINAL_INSTALLATION_AT",
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
    liveActivated: false
  };
}

function OP_finalInstallCheck_(
  checks,
  component,
  passed,
  details
) {
  checks.push({
    component: component,
    status: passed ? "PASSED" : "FAILED",
    details: details
  });
}

function OP_writeFinalInstallChecks_(checks) {
  const sheet = workbook_().getSheetByName(
    OP_FINAL_INSTALL_SHEET
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
      check.component,
      check.status,
      check.details,
      timestamp_()
    ];
  });

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, 4)
      .setValues(rows);
  }

  sheet.setFrozenRows(1);
  autoResize_(sheet);
}

function OP_getFinalOperationsInstallationStatus() {
  return {
    complete:
      getDocProperty_(
        "OP_FINAL_INSTALLATION_COMPLETE"
      ) || "FALSE",

    completedAt:
      getDocProperty_(
        "OP_FINAL_INSTALLATION_AT"
      ) || "",

    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",

    finalValidation:
      getDocProperty_(
        "OP_FINAL_VALIDATION_PASSED"
      ) || "FALSE",

    preLiveVerified:
      getDocProperty_(
        "OP_PRELIVE_VERIFIED"
      ) || "FALSE",

    controlledCutover:
      getDocProperty_(
        "OP_CONTROLLED_CUTOVER_COMPLETE"
      ) || "FALSE",

    liveActivated:
      getDocProperty_(
        "OP_LIVE_ACTIVATED"
      ) || "FALSE"
  };
}

function OP_testFinalInstaller() {
  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const result =
    OP_runFinalOperationsInstallation();

  Logger.log(JSON.stringify(result));

  Logger.log(
    JSON.stringify(
      OP_getFinalOperationsInstallationStatus()
    )
  );

  if (!result.success) {
    throw new Error(
      "Final Operations installation failed. Review OP_FINAL_INSTALL."
    );
  }

  if (
    typeof CO_getState === "function" &&
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "Final Operations installer safety failure: system is not in SHADOW mode."
    );
  }

  return true;
}
