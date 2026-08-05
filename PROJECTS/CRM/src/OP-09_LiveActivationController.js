/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-09_LiveActivationController.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Final guarded controller for activating MelroseOS LIVE mode.
 *
 * IMPORTANT:
 *   Running OP_testLiveActivationController() DOES NOT activate LIVE mode.
 *   Actual LIVE activation requires explicit execution of:
 *     OP_activateMelroseOSLive("ACTIVATE MELROSEOS LIVE")
 *
 * Requires:
 *   OP-01 through OP-08
 *   CO-01 through CO-07
 ******************************************************************************/

const OP_LIVE_ACTIVATION_SHEET = "OP_LIVE_ACTIVATION";

function OP_initializeLiveActivationController() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_LIVE_ACTIVATION_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "Step",
    "Status",
    "Details",
    "UpdatedAt"
  ]);

  return true;
}

function OP_getLiveActivationReadiness() {
  OP_initializeLiveActivationController();

  const issues = [];

  if (
    typeof CO_getState !== "function" ||
    CO_getState() !== "SHADOW"
  ) {
    issues.push(
      "System must be in SHADOW mode before LIVE activation."
    );
  }

  if (
    getDocProperty_(
      "OP_FINAL_VALIDATION_PASSED"
    ) !== "TRUE"
  ) {
    issues.push(
      "Operations final validation has not passed."
    );
  }

  if (
    getDocProperty_(
      "OP_PRELIVE_VERIFIED"
    ) !== "TRUE"
  ) {
    issues.push(
      "Pre-LIVE verification has not passed."
    );
  }

  if (
    getDocProperty_(
      "OP_CONTROLLED_CUTOVER_COMPLETE"
    ) !== "TRUE"
  ) {
    issues.push(
      "Controlled trigger cutover has not been completed."
    );
  }

  const managedTriggers =
    typeof OP_getOperationsTriggers_ === "function"
      ? OP_getOperationsTriggers_().length
      : 0;

  if (managedTriggers !== 1) {
    issues.push(
      "Exactly one managed operations trigger is required. Current count: " +
      managedTriggers + "."
    );
  }

  const health =
    typeof CO_runHealthCheck === "function"
      ? CO_runHealthCheck()
      : null;

  if (!health || !health.success) {
    issues.push(
      "System health check is not passing."
    );
  }

  const shadow =
    typeof CO_runShadowValidation === "function"
      ? CO_runShadowValidation()
      : null;

  if (!shadow || !shadow.success) {
    issues.push(
      "Shadow validation is not passing."
    );
  }

  const ready = issues.length === 0;

  OP_writeLiveActivationStep_(
    "LIVE Activation Readiness",
    ready ? "READY" : "BLOCKED",
    ready
      ? "All activation gates passed."
      : issues.join(" ")
  );

  return {
    success: ready,
    ready: ready,
    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",
    managedOperationsTriggers:
      managedTriggers,
    issues: issues
  };
}

function OP_activateMelroseOSLive(
  confirmationPhrase
) {
  const requiredPhrase =
    "ACTIVATE MELROSEOS LIVE";

  OP_initializeLiveActivationController();

  if (
    String(confirmationPhrase || "")
      .trim()
      .toUpperCase() !== requiredPhrase
  ) {
    throw new Error(
      "LIVE activation blocked. Required confirmation phrase: " +
      requiredPhrase
    );
  }

  const readiness =
    OP_getLiveActivationReadiness();

  if (!readiness.ready) {
    throw new Error(
      "LIVE activation blocked. Review OP_LIVE_ACTIVATION for readiness issues."
    );
  }

  const result =
    CO_activateLiveMode(
      requiredPhrase
    );

  if (
    !result.success ||
    CO_getState() !== "LIVE"
  ) {
    throw new Error(
      "LIVE activation did not complete successfully."
    );
  }

  setDocProperty_(
    "OP_LIVE_ACTIVATED",
    "TRUE"
  );

  setDocProperty_(
    "OP_LIVE_ACTIVATED_AT",
    new Date().toISOString()
  );

  OP_writeLiveActivationStep_(
    "MelroseOS LIVE Activation",
    "ACTIVATED",
    "MelroseOS operational modules are now in LIVE mode."
  );

  OP_refreshStatus();
  OP_refreshTriggerStatus();

  return {
    success: true,
    state: CO_getState(),
    assignmentMode:
      typeof AE_getMode === "function"
        ? AE_getMode()
        : "UNKNOWN",
    notificationMode:
      typeof NF_getMode === "function"
        ? NF_getMode()
        : "UNKNOWN",
    appointmentMode:
      typeof AP_getMode === "function"
        ? AP_getMode()
        : "UNKNOWN",
    operationsTriggers:
      OP_getOperationsTriggers_().length
  };
}

function OP_emergencyReturnToShadow() {
  const result =
    CO_emergencyRollbackToShadow();

  setDocProperty_(
    "OP_LIVE_ACTIVATED",
    "FALSE"
  );

  setDocProperty_(
    "OP_EMERGENCY_SHADOW_AT",
    new Date().toISOString()
  );

  OP_writeLiveActivationStep_(
    "Emergency Return to SHADOW",
    "COMPLETED",
    "MelroseOS returned to SHADOW mode."
  );

  return result;
}

function OP_writeLiveActivationStep_(
  step,
  status,
  details
) {
  const sheet = workbook_().getSheetByName(
    OP_LIVE_ACTIVATION_SHEET
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

function OP_getLiveActivationStatus() {
  return {
    activated:
      getDocProperty_(
        "OP_LIVE_ACTIVATED"
      ) || "FALSE",

    activatedAt:
      getDocProperty_(
        "OP_LIVE_ACTIVATED_AT"
      ) || "",

    emergencyShadowAt:
      getDocProperty_(
        "OP_EMERGENCY_SHADOW_AT"
      ) || "",

    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",

    managedOperationsTriggers:
      typeof OP_getOperationsTriggers_ === "function"
        ? OP_getOperationsTriggers_().length
        : 0
  };
}

function OP_testLiveActivationController() {
  if (
    typeof CO_forceShadowMode === "function"
  ) {
    CO_forceShadowMode();
  }

  const readiness =
    OP_getLiveActivationReadiness();

  Logger.log(
    JSON.stringify(readiness)
  );

  Logger.log(
    JSON.stringify(
      OP_getLiveActivationStatus()
    )
  );

  if (
    typeof CO_getState === "function" &&
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "LIVE Activation Controller self-test failed: system is not in SHADOW mode."
    );
  }

  return true;
}
