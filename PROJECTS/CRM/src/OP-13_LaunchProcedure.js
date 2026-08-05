/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-13_LaunchProcedure.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Runs the final controlled production launch procedure in explicit stages.
 *
 * IMPORTANT:
 *   - OP_testLaunchProcedure() is NON-DESTRUCTIVE.
 *   - OP_getLaunchProcedurePreview() is NON-DESTRUCTIVE.
 *   - Actual launch requires:
 *
 *       OP_executeLaunchProcedure("LAUNCH MELROSEOS")
 *
 *   This procedure:
 *     1. Validates SHADOW readiness.
 *     2. Consolidates recognized legacy operational triggers.
 *     3. Verifies exactly one managed operations trigger.
 *     4. Re-runs health and pre-LIVE validation.
 *     5. Activates LIVE mode.
 *     6. Installs the hourly post-launch monitor.
 *
 * Requires:
 *   OP-01 through OP-12
 *   CO-01 through CO-07
 ******************************************************************************/

const OP_LAUNCH_PROCEDURE_SHEET = "OP_LAUNCH_PROCEDURE";

function OP_initializeLaunchProcedure() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_LAUNCH_PROCEDURE_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "Stage",
    "Status",
    "Details",
    "UpdatedAt"
  ]);

  return true;
}

function OP_getLaunchProcedurePreview() {
  OP_initializeLaunchProcedure();

  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const finalInstall =
    typeof OP_getFinalOperationsInstallationStatus === "function"
      ? OP_getFinalOperationsInstallationStatus()
      : {};

  const finalValidation =
    typeof OP_runFinalValidation === "function"
      ? OP_runFinalValidation()
      : null;

  const preLive =
    typeof OP_runPreLiveVerification === "function"
      ? OP_runPreLiveVerification()
      : null;

  const triggerPlan =
    typeof OP_getControlledCutoverPlan === "function"
      ? OP_getControlledCutoverPlan()
      : null;

  const issues = [];

  if (
    String(
      finalInstall.complete || ""
    ).toUpperCase() !== "TRUE"
  ) {
    issues.push(
      "Final Operations installation has not completed successfully."
    );
  }

  if (!finalValidation || !finalValidation.success) {
    issues.push(
      "Operations final validation is not passing."
    );
  }

  if (!preLive || !preLive.success) {
    issues.push(
      "Pre-LIVE verification is not passing."
    );
  }

  if (!triggerPlan || !triggerPlan.success) {
    issues.push(
      "Controlled trigger cutover plan is unavailable."
    );
  }

  if (
    typeof CO_getState !== "function" ||
    CO_getState() !== "SHADOW"
  ) {
    issues.push(
      "System is not in SHADOW mode."
    );
  }

  const ready = issues.length === 0;

  OP_writeLaunchStage_(
    "Launch Preview",
    ready ? "READY" : "BLOCKED",
    ready
      ? "All launch prerequisites passed."
      : issues.join(" ")
  );

  return {
    success: ready,
    ready: ready,
    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",
    legacyTriggersToRemove:
      triggerPlan
        ? Number(
            triggerPlan.legacyTriggersToRemove || 0
          )
        : 0,
    issues: issues
  };
}

function OP_executeLaunchProcedure(
  confirmationPhrase
) {
  const requiredPhrase =
    "LAUNCH MELROSEOS";

  OP_initializeLaunchProcedure();

  if (
    String(confirmationPhrase || "")
      .trim()
      .toUpperCase() !== requiredPhrase
  ) {
    throw new Error(
      "Launch blocked. Required confirmation phrase: " +
      requiredPhrase
    );
  }

  if (
    typeof CO_getState !== "function" ||
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "Launch must begin in SHADOW mode."
    );
  }

  const preview =
    OP_getLaunchProcedurePreview();

  if (!preview.ready) {
    throw new Error(
      "Launch blocked. Review OP_LAUNCH_PROCEDURE."
    );
  }

  OP_writeLaunchStage_(
    "Stage 1 - Readiness",
    "PASSED",
    "Final installation, validation, and pre-LIVE checks passed."
  );

  const cutover =
    OP_executeControlledTriggerCutover(
      "CONSOLIDATE MELROSEOS TRIGGERS"
    );

  if (!cutover.success) {
    OP_writeLaunchStage_(
      "Stage 2 - Trigger Consolidation",
      "FAILED",
      "Controlled trigger cutover failed."
    );

    throw new Error(
      "Launch stopped during trigger consolidation."
    );
  }

  OP_writeLaunchStage_(
    "Stage 2 - Trigger Consolidation",
    "PASSED",
    cutover.removedLegacyTriggers +
      " legacy trigger(s) removed; " +
      cutover.managedOperationsTriggers +
      " managed operations trigger active."
  );

  const managedCount =
    OP_getOperationsTriggers_().length;

  if (managedCount !== 1) {
    OP_writeLaunchStage_(
      "Stage 3 - Managed Trigger Verification",
      "FAILED",
      "Expected one managed operations trigger; found " +
        managedCount +
        "."
    );

    throw new Error(
      "Launch stopped: managed trigger verification failed."
    );
  }

  OP_writeLaunchStage_(
    "Stage 3 - Managed Trigger Verification",
    "PASSED",
    "Exactly one managed operations trigger is active."
  );

  const health =
    CO_runHealthCheck();

  const preLive =
    OP_runPreLiveVerification();

  if (
    !health.success ||
    !preLive.success
  ) {
    OP_writeLaunchStage_(
      "Stage 4 - Final Health Verification",
      "FAILED",
      "Health or pre-LIVE verification failed after trigger consolidation."
    );

    throw new Error(
      "Launch stopped during final health verification."
    );
  }

  OP_writeLaunchStage_(
    "Stage 4 - Final Health Verification",
    "PASSED",
    "Post-trigger health and pre-LIVE verification passed."
  );

  const activation =
    OP_activateMelroseOSLive(
      "ACTIVATE MELROSEOS LIVE"
    );

  if (!activation.success) {
    OP_writeLaunchStage_(
      "Stage 5 - LIVE Activation",
      "FAILED",
      "LIVE activation failed."
    );

    throw new Error(
      "Launch failed during LIVE activation."
    );
  }

  OP_writeLaunchStage_(
    "Stage 5 - LIVE Activation",
    "ACTIVATED",
    "MelroseOS is now LIVE."
  );

  const monitor =
    OP_installPostLaunchMonitorTrigger();

  OP_writeLaunchStage_(
    "Stage 6 - Post-Launch Monitoring",
    monitor.success
      ? "PASSED"
      : "FAILED",
    monitor.triggerCount +
      " post-launch monitor trigger(s) active."
  );

  if (
    !monitor.success ||
    monitor.triggerCount !== 1
  ) {
    OP_emergencyReturnToShadow();

    throw new Error(
      "Post-launch monitor installation failed. MelroseOS returned to SHADOW mode."
    );
  }

  setDocProperty_(
    "OP_LAUNCH_PROCEDURE_COMPLETE",
    "TRUE"
  );

  setDocProperty_(
    "OP_LAUNCH_PROCEDURE_AT",
    new Date().toISOString()
  );

  return {
    success: true,
    state: CO_getState(),
    removedLegacyTriggers:
      cutover.removedLegacyTriggers,
    operationsTriggers:
      OP_getOperationsTriggers_().length,
    postLaunchMonitorTriggers:
      monitor.triggerCount,
    live:
      CO_getState() === "LIVE"
  };
}

function OP_writeLaunchStage_(
  stage,
  status,
  details
) {
  const sheet = workbook_().getSheetByName(
    OP_LAUNCH_PROCEDURE_SHEET
  );

  if (!sheet) return;

  sheet.appendRow([
    stage,
    status,
    details,
    timestamp_()
  ]);
}

function OP_getLaunchProcedureStatus() {
  return {
    complete:
      getDocProperty_(
        "OP_LAUNCH_PROCEDURE_COMPLETE"
      ) || "FALSE",

    completedAt:
      getDocProperty_(
        "OP_LAUNCH_PROCEDURE_AT"
      ) || "",

    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",

    operationsTriggers:
      typeof OP_getOperationsTriggers_ === "function"
        ? OP_getOperationsTriggers_().length
        : 0,

    postLaunchMonitorTriggers:
      ScriptApp
        .getProjectTriggers()
        .filter(function(trigger) {
          return (
            trigger.getHandlerFunction() ===
            "OP_runPostLaunchMonitor"
          );
        }).length
  };
}

function OP_testLaunchProcedure() {
  if (
    typeof CO_forceShadowMode === "function"
  ) {
    CO_forceShadowMode();
  }

  const preview =
    OP_getLaunchProcedurePreview();

  Logger.log(
    JSON.stringify(preview)
  );

  Logger.log(
    JSON.stringify(
      OP_getLaunchProcedureStatus()
    )
  );

  if (!preview.success) {
    throw new Error(
      "Launch Procedure is not ready. Review OP_LAUNCH_PROCEDURE."
    );
  }

  if (
    typeof CO_getState === "function" &&
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "Launch Procedure self-test failed: system is not in SHADOW mode."
    );
  }

  return true;
}
function OP_launchMelroseOSNow() {
  return OP_executeLaunchProcedure("LAUNCH MELROSEOS");
}
function OP_showLaunchStatus() {
  const status = OP_getLaunchProcedureStatus();
  Logger.log(JSON.stringify(status, null, 2));
  return status;
}
function OP_showPostLaunchStatus() {
  const result = OP_runPostLaunchMonitor();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}