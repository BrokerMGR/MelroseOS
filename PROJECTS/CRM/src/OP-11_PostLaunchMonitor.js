/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-11_PostLaunchMonitor.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Monitors MelroseOS immediately after LIVE activation and automatically
 *   returns the system to SHADOW mode if critical operational failures are
 *   detected.
 *
 * Requires:
 *   OP-01 through OP-10
 *   CO-01 through CO-07
 ******************************************************************************/

const OP_POST_LAUNCH_SHEET = "OP_POST_LAUNCH_MONITOR";

function OP_initializePostLaunchMonitor() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_POST_LAUNCH_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "MonitorID",
    "State",
    "HealthStatus",
    "IntakeErrors",
    "NotificationErrors",
    "OperationsTriggerCount",
    "Action",
    "Details",
    "CheckedAt"
  ]);

  return true;
}

function OP_runPostLaunchMonitor() {
  OP_initializePostLaunchMonitor();

  const state =
    typeof CO_getState === "function"
      ? CO_getState()
      : "UNKNOWN";

  const health =
    typeof CO_runHealthCheck === "function"
      ? CO_runHealthCheck()
      : null;

  const intake =
    typeof LI_getQueueStatus === "function"
      ? LI_getQueueStatus()
      : {};

  const notifications =
    typeof NF_getSendEngineStatus === "function"
      ? NF_getSendEngineStatus()
      : {};

  const triggerCount =
    typeof OP_getOperationsTriggers_ === "function"
      ? OP_getOperationsTriggers_().length
      : 0;

  const intakeErrors =
    Number(intake.error || 0);

  const notificationErrors =
    Number(notifications.errors || 0);

  const criticalIssues = [];

  if (!health || !health.success) {
    criticalIssues.push(
      "System health check failed."
    );
  }

  if (triggerCount !== 1) {
    criticalIssues.push(
      "Expected exactly one managed operations trigger; found " +
      triggerCount +
      "."
    );
  }

  if (intakeErrors >= 5) {
    criticalIssues.push(
      intakeErrors +
      " Lead Intake ERROR records detected."
    );
  }

  if (notificationErrors >= 5) {
    criticalIssues.push(
      notificationErrors +
      " Notification ERROR records detected."
    );
  }

  let action = "NO_ACTION";

  if (
    state === "LIVE" &&
    criticalIssues.length > 0
  ) {
    if (
      typeof OP_emergencyReturnToShadow ===
      "function"
    ) {
      OP_emergencyReturnToShadow();
      action = "AUTO_ROLLBACK_TO_SHADOW";
    }
  }

  const sheet = workbook_().getSheetByName(
    OP_POST_LAUNCH_SHEET
  );

  const monitorId =
    "MON-" +
    Utilities
      .getUuid()
      .substring(0, 8)
      .toUpperCase();

  sheet.appendRow([
    monitorId,
    state,
    health && health.success
      ? "PASSED"
      : "FAILED",
    intakeErrors,
    notificationErrors,
    triggerCount,
    action,
    criticalIssues.join(" "),
    timestamp_()
  ]);

  setDocProperty_(
    "OP_LAST_POST_LAUNCH_MONITOR",
    new Date().toISOString()
  );

  setDocProperty_(
    "OP_LAST_POST_LAUNCH_ACTION",
    action
  );

  return {
    success: criticalIssues.length === 0,
    stateBeforeCheck: state,
    stateAfterCheck:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",
    action: action,
    criticalIssues: criticalIssues,
    intakeErrors: intakeErrors,
    notificationErrors: notificationErrors,
    operationsTriggerCount: triggerCount
  };
}

function OP_getPostLaunchMonitorStatus() {
  return {
    lastChecked:
      getDocProperty_(
        "OP_LAST_POST_LAUNCH_MONITOR"
      ) || "",

    lastAction:
      getDocProperty_(
        "OP_LAST_POST_LAUNCH_ACTION"
      ) || "",

    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN"
  };
}

function OP_installPostLaunchMonitorTrigger() {
  const handler =
    "OP_runPostLaunchMonitor";

  const existing =
    ScriptApp
      .getProjectTriggers()
      .filter(function(trigger) {
        return (
          trigger.getHandlerFunction() ===
          handler
        );
      });

  if (existing.length > 1) {
    existing
      .slice(1)
      .forEach(function(trigger) {
        ScriptApp.deleteTrigger(trigger);
      });
  }

  if (existing.length === 0) {
    ScriptApp
      .newTrigger(handler)
      .timeBased()
      .everyHours(1)
      .create();
  }

  return {
    success: true,
    triggerCount:
      ScriptApp
        .getProjectTriggers()
        .filter(function(trigger) {
          return (
            trigger.getHandlerFunction() ===
            handler
          );
        }).length
  };
}

function OP_removePostLaunchMonitorTrigger() {
  const handler =
    "OP_runPostLaunchMonitor";

  const triggers =
    ScriptApp
      .getProjectTriggers()
      .filter(function(trigger) {
        return (
          trigger.getHandlerFunction() ===
          handler
        );
      });

  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  return {
    success: true,
    removed: triggers.length
  };
}

function OP_testPostLaunchMonitor() {
  OP_initializePostLaunchMonitor();

  if (
    typeof CO_forceShadowMode ===
    "function"
  ) {
    CO_forceShadowMode();
  }

  const result =
    OP_runPostLaunchMonitor();

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      OP_getPostLaunchMonitorStatus()
    )
  );

  if (
    typeof CO_getState === "function" &&
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "Post-Launch Monitor self-test failed: system is not in SHADOW mode."
    );
  }

  return true;
}
