/******************************************************************************
 * MelroseOS Enterprise
 * File: OP-08_ControlledCutover.gs
 * Purpose: Controlled trigger consolidation before LIVE activation.
 * Requires: OP-01 through OP-07 and CO-01 through CO-07.
 ******************************************************************************/

const OP_CONTROLLED_CUTOVER_SHEET = "OP_CONTROLLED_CUTOVER";

function OP_initializeControlledCutover() {
  OP_initializeCore();
  const sheet = createSheetIfMissing_(workbook_(), OP_CONTROLLED_CUTOVER_SHEET);
  OP_setHeadersIfEmpty_(sheet, ["Step","Status","Details","UpdatedAt"]);
  return true;
}

function OP_getControlledCutoverPlan() {
  OP_initializeControlledCutover();
  const preview = OP_previewTriggerCutover();
  const preLive = OP_getPreLiveVerificationStatus();

  return {
    success: preview.success,
    state: CO_getState(),
    preLiveVerified: preLive.verified || "FALSE",
    legacyTriggersToRemove: preview.removeCount || 0,
    totalTriggers: preview.triggerCount || 0,
    preview: preview.preview || []
  };
}

function OP_executeControlledTriggerCutover(confirmationPhrase) {
  const requiredPhrase = "CONSOLIDATE MELROSEOS TRIGGERS";
  OP_initializeControlledCutover();

  if (String(confirmationPhrase || "").trim().toUpperCase() !== requiredPhrase) {
    throw new Error("Controlled cutover blocked. Required confirmation phrase: " + requiredPhrase);
  }

  if (CO_getState() !== "SHADOW") {
    throw new Error("Controlled cutover blocked. MelroseOS must be in SHADOW mode.");
  }

  const validation = OP_runFinalValidation();
  if (!validation.success) {
    throw new Error("Controlled cutover blocked. OP final validation did not pass.");
  }

  const preLive = OP_runPreLiveVerification();
  if (!preLive.success) {
    throw new Error("Controlled cutover blocked. Pre-LIVE verification did not pass.");
  }

  const preview = OP_previewTriggerCutover();
  OP_writeControlledCutoverStep_(
    "Pre-Cutover Validation",
    "PASSED",
    preview.removeCount + " recognized legacy operational trigger(s) identified."
  );

  const result = OP_executeTriggerCutover(requiredPhrase);

  OP_writeControlledCutoverStep_(
    "Legacy Trigger Consolidation",
    result.success ? "PASSED" : "FAILED",
    result.removedLegacyTriggers + " legacy trigger(s) removed; " +
      result.preservedTriggers + " trigger(s) preserved."
  );

  const triggerStatus = OP_getTriggerManagerStatus();
  const managedCount = Number(triggerStatus.operationsTriggerCount || 0);
  const triggerHealthy = managedCount === 1;

  OP_writeControlledCutoverStep_(
    "Managed Operations Trigger",
    triggerHealthy ? "PASSED" : "FAILED",
    managedCount + " managed operations trigger(s) exist after consolidation."
  );

  if (!triggerHealthy) {
    throw new Error("Controlled cutover failed. Expected exactly one managed operations trigger.");
  }

  const postHealth = CO_runHealthCheck();

  OP_writeControlledCutoverStep_(
    "Post-Cutover Health Check",
    postHealth.success ? "PASSED" : "FAILED",
    postHealth.failed + " failure(s), " + postHealth.warnings + " warning(s)."
  );

  if (!postHealth.success) {
    throw new Error(
      "Controlled cutover changed triggers, but the post-cutover health check failed. Review CO_HEALTH_CHECK."
    );
  }

  setDocProperty_("OP_CONTROLLED_CUTOVER_COMPLETE", "TRUE");
  setDocProperty_("OP_CONTROLLED_CUTOVER_AT", new Date().toISOString());

  return {
    success: true,
    state: CO_getState(),
    removedLegacyTriggers: result.removedLegacyTriggers,
    preservedTriggers: result.preservedTriggers,
    managedOperationsTriggers: managedCount,
    liveActivated: false
  };
}

function OP_writeControlledCutoverStep_(step, status, details) {
  const sheet = workbook_().getSheetByName(OP_CONTROLLED_CUTOVER_SHEET);
  if (!sheet) return;
  sheet.appendRow([step, status, details, timestamp_()]);
}

function OP_getControlledCutoverStatus() {
  return {
    complete: getDocProperty_("OP_CONTROLLED_CUTOVER_COMPLETE") || "FALSE",
    completedAt: getDocProperty_("OP_CONTROLLED_CUTOVER_AT") || "",
    state: CO_getState(),
    managedOperationsTriggers: OP_getOperationsTriggers_().length,
    liveActivated: CO_getState() === "LIVE"
  };
}

function OP_testControlledCutover() {
  CO_forceShadowMode();

  const plan = OP_getControlledCutoverPlan();

  Logger.log(JSON.stringify(plan));
  Logger.log(JSON.stringify(OP_getControlledCutoverStatus()));

  if (!plan.success) {
    throw new Error("Controlled Cutover plan could not be generated.");
  }

  if (CO_getState() !== "SHADOW") {
    throw new Error("Controlled Cutover self-test failed: system is not in SHADOW mode.");
  }

  return true;
}
