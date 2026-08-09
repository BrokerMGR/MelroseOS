  /******************************************************************************
 * MelroseOS Enterprise
 * System Integration & Cutover
 * File: CO-04_CutoverGate.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Provides a guarded, explicit cutover gate. LIVE mode is blocked unless
 *   health checks and shadow validation have passed.
 *
 * Requires:
 *   CO-01 through CO-03
 *   AE-01 through AE-10
 *   NF-01 through NF-06
 *   AP-01 through AP-06
 ******************************************************************************/

function CO_evaluateCutoverReadiness() {
  CO_initializeCore();

  const health = CO_runHealthCheck();
  const shadow = CO_runShadowValidation();

  const issues = [];

  if (!health.success) {
    issues.push(
      "System health check has " +
      health.failed +
      " failure(s)."
    );
  }

  if (!shadow.success) {
    issues.push(
      "Shadow validation has " +
      shadow.failed +
      " failure(s)."
    );
  }

  if (
    typeof AE_getMode !== "function" ||
    AE_getMode() !== "SHADOW"
  ) {
    issues.push(
      "Assignment Engine is not in SHADOW mode."
    );
  }

  if (
    typeof NF_getMode !== "function" ||
    NF_getMode() !== "SHADOW"
  ) {
    issues.push(
      "Notification Engine is not in SHADOW mode."
    );
  }

  if (
    typeof AP_getMode !== "function" ||
    AP_getMode() !== "SHADOW"
  ) {
    issues.push(
      "Appointment Engine is not in SHADOW mode."
    );
  }

  const ready = issues.length === 0;

  setDocProperty_(
    "CO_CUTOVER_READY",
    ready ? "TRUE" : "FALSE"
  );

  setDocProperty_(
    "CO_CUTOVER_READY_AT",
    new Date().toISOString()
  );

  CO_log_(
    ready
      ? "CUTOVER_READY"
      : "CUTOVER_NOT_READY",
    CO_getState(),
    CO_getState(),
    ready
      ? "All cutover gates passed."
      : issues.join(" ")
  );

  return {
    success: ready,
    ready: ready,
    state: CO_getState(),
    health: health,
    shadow: shadow,
    issues: issues
  };
}

function CO_activateLiveMode(confirmationPhrase) {
  const requiredPhrase =
    "ACTIVATE MELROSEOS LIVE";

  if (
    String(confirmationPhrase || "")
      .trim()
      .toUpperCase() !== requiredPhrase
  ) {
    throw new Error(
      "Live activation blocked. Required confirmation phrase: " +
      requiredPhrase
    );
  }

  const readiness =
    CO_evaluateCutoverReadiness();

  if (!readiness.ready) {
    throw new Error(
      "Live activation blocked. Cutover readiness checks did not pass."
    );
  }

  const previous = CO_getState();

  if (typeof AE_setLiveMode === "function") {
    AE_setLiveMode();
  }

  if (typeof NF_setLiveMode === "function") {
    NF_setLiveMode();
  }

  if (typeof AP_setLiveMode === "function") {
    AP_setLiveMode();
  }

  setDocProperty_(
    CO.STATE_PROPERTY,
    "LIVE"
  );

  setDocProperty_(
    "CO_LIVE_ACTIVATED_AT",
    new Date().toISOString()
  );

  CO_log_(
    "LIVE_MODE_ACTIVATED",
    previous,
    "LIVE",
    "MelroseOS migrated operational modules activated in LIVE mode."
  );

  return {
    success: true,
    state: "LIVE",
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
        : "UNKNOWN"
  };
}

function CO_emergencyRollbackToShadow() {
  const previous = CO_getState();

  CO_forceShadowMode();

  setDocProperty_(
    "CO_LAST_ROLLBACK_AT",
    new Date().toISOString()
  );

  CO_log_(
    "EMERGENCY_ROLLBACK",
    previous,
    "SHADOW",
    "System returned to SHADOW mode."
  );

  return {
    success: true,
    previousState: previous,
    state: CO_getState()
  };
}

function CO_getCutoverGateStatus() {
  return {
    state: CO_getState(),

    ready:
      getDocProperty_(
        "CO_CUTOVER_READY"
      ) || "FALSE",

    readinessCheckedAt:
      getDocProperty_(
        "CO_CUTOVER_READY_AT"
      ) || "",

    liveActivatedAt:
      getDocProperty_(
        "CO_LIVE_ACTIVATED_AT"
      ) || "",

    lastRollbackAt:
      getDocProperty_(
        "CO_LAST_ROLLBACK_AT"
      ) || ""
  };
}

function CO_testCutoverGate() {
  CO_forceShadowMode();

  const readiness =
    CO_evaluateCutoverReadiness();

  if (!readiness.ready) {
    throw new Error(
      "Cutover Gate self-test failed readiness checks. Review CO_HEALTH_CHECK and CO_SHADOW_VALIDATION."
    );
  }

  if (CO_getState() !== "SHADOW") {
    throw new Error(
      "Cutover Gate self-test failed: state changed unexpectedly."
    );
  }

  Logger.log(
    JSON.stringify(readiness)
  );

  Logger.log(
    JSON.stringify(
      CO_getCutoverGateStatus()
    )
  );

  return true;
}

