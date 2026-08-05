/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-10_FinalLaunchSequence.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Provides the final controlled launch sequence.
 *
 * IMPORTANT:
 *   OP_testFinalLaunchSequence() is NON-DESTRUCTIVE.
 *   OP_previewFinalLaunch() is NON-DESTRUCTIVE.
 *
 *   Actual launch requires explicit execution of:
 *     OP_executeFinalLaunch("LAUNCH MELROSEOS")
 *
 *   The launch sequence:
 *     1. Forces/validates SHADOW mode.
 *     2. Runs final validation.
 *     3. Runs pre-LIVE verification.
 *     4. Consolidates recognized legacy operational triggers.
 *     5. Re-validates health.
 *     6. Activates LIVE mode.
 ******************************************************************************/

const OP_FINAL_LAUNCH_SHEET = "OP_FINAL_LAUNCH";

function OP_initializeFinalLaunchSequence() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_FINAL_LAUNCH_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "Step",
    "Status",
    "Details",
    "UpdatedAt"
  ]);

  return true;
}

function OP_previewFinalLaunch() {
  OP_initializeFinalLaunchSequence();

  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const finalValidation =
    OP_runFinalValidation();

  const preLive =
    OP_runPreLiveVerification();

  const triggerPlan =
    OP_getControlledCutoverPlan();

  const issues = [];

  if (!finalValidation.success) {
    issues.push(
      "Final Operations Validation is not passing."
    );
  }

  if (!preLive.success) {
    issues.push(
      "Pre-LIVE verification is not passing."
    );
  }

  if (!triggerPlan.success) {
    issues.push(
      "Controlled trigger cutover plan is unavailable."
    );
  }

  if (CO_getState() !== "SHADOW") {
    issues.push(
      "System is not in SHADOW mode."
    );
  }

  const ready = issues.length === 0;

  OP_writeFinalLaunchStep_(
    "Final Launch Preview",
    ready ? "READY" : "BLOCKED",
    ready
      ? "Launch prerequisites passed. No LIVE activation performed."
      : issues.join(" ")
  );

  return {
    success: ready,
    ready: ready,
    state: CO_getState(),
    legacyTriggersToRemove:
      triggerPlan.legacyTriggersToRemove || 0,
    issues: issues,
    liveActivated: false
  };
}

function OP_executeFinalLaunch(
  confirmationPhrase
) {
  const requiredPhrase =
    "LAUNCH MELROSEOS";

  OP_initializeFinalLaunchSequence();

  if (
    String(confirmationPhrase || "")
      .trim()
      .toUpperCase() !== requiredPhrase
  ) {
    throw new Error(
      "Final launch blocked. Required confirmation phrase: " +
      requiredPhrase
    );
  }

  if (CO_getState() !== "SHADOW") {
    throw new Error(
      "Final launch must begin in SHADOW mode."
    );
  }

  const preview =
    OP_previewFinalLaunch();

  if (!preview.ready) {
    throw new Error(
      "Final launch blocked. Review OP_FINAL_LAUNCH."
    );
  }

  OP_writeFinalLaunchStep_(
    "Launch Validation",
    "PASSED",
    "Final validation and pre-LIVE verification passed."
  );

  const cutover =
    OP_executeControlledTriggerCutover(
      "CONSOLIDATE MELROSEOS TRIGGERS"
    );

  OP_writeFinalLaunchStep_(
    "Trigger Consolidation",
    cutover.success ? "PASSED" : "FAILED",
    cutover.removedLegacyTriggers +
      " recognized legacy trigger(s) removed. " +
      cutover.managedOperationsTriggers +
      " managed operations trigger(s) active."
  );

  if (!cutover.success) {
    throw new Error(
      "Final launch stopped during trigger consolidation."
    );
  }

  const readiness =
    OP_getLiveActivationReadiness();

  OP_writeFinalLaunchStep_(
    "LIVE Readiness",
    readiness.ready ? "PASSED" : "FAILED",
    readiness.ready
      ? "All LIVE activation gates passed."
      : readiness.issues.join(" ")
  );

  if (!readiness.ready) {
    throw new Error(
      "Final launch stopped. LIVE activation readiness failed."
    );
  }

  const activation =
    OP_activateMelroseOSLive(
      "ACTIVATE MELROSEOS LIVE"
    );

  OP_writeFinalLaunchStep_(
    "LIVE Activation",
    activation.success
      ? "ACTIVATED"
      : "FAILED",
    activation.success
      ? "MelroseOS is LIVE."
      : "LIVE activation failed."
  );

  if (!activation.success) {
    throw new Error(
      "Final launch failed during LIVE activation."
    );
  }

  setDocProperty_(
    "OP_FINAL_LAUNCH_COMPLETE",
    "TRUE"
  );

  setDocProperty_(
    "OP_FINAL_LAUNCH_AT",
    new Date().toISOString()
  );

  return {
    success: true,
    state: CO_getState(),
    removedLegacyTriggers:
      cutover.removedLegacyTriggers,
    managedOperationsTriggers:
      cutover.managedOperationsTriggers,
    liveActivated:
      CO_getState() === "LIVE"
  };
}

function OP_writeFinalLaunchStep_(
  step,
  status,
  details
) {
  const sheet = workbook_().getSheetByName(
    OP_FINAL_LAUNCH_SHEET
  );

  if (!sheet) {
    return;
  }

  sheet.appendRow([
    step,
    status,
    details,
    timestamp_()
  ]);
}

function OP_getFinalLaunchStatus() {
  return {
    complete:
      getDocProperty_(
        "OP_FINAL_LAUNCH_COMPLETE"
      ) || "FALSE",

    launchedAt:
      getDocProperty_(
        "OP_FINAL_LAUNCH_AT"
      ) || "",

    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",

    live:
      typeof CO_getState === "function"
        ? CO_getState() === "LIVE"
        : false,

    operationsTriggers:
      typeof OP_getOperationsTriggers_ === "function"
        ? OP_getOperationsTriggers_().length
        : 0
  };
}

function OP_testFinalLaunchSequence() {
  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const preview =
    OP_previewFinalLaunch();

  Logger.log(
    JSON.stringify(preview)
  );

  Logger.log(
    JSON.stringify(
      OP_getFinalLaunchStatus()
    )
  );

  if (!preview.success) {
    throw new Error(
      "Final Launch Sequence is not ready. Review OP_FINAL_LAUNCH."
    );
  }

  if (CO_getState() !== "SHADOW") {
    throw new Error(
      "Final Launch Sequence self-test failed: system is not in SHADOW mode."
    );
  }

  return true;
}
