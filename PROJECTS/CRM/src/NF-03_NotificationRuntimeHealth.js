/******************************************************************************
 * MelroseOS Enterprise
 * File: NF-03_NotificationRuntimeHealth.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Provides one consolidated health report for the enterprise notification
 *   runtime without sending messages or changing communication controls.
 ******************************************************************************/

const MOS5_NOTIFICATION_RUNTIME_HEALTH_VERSION = "1.0.0";

/**
 * Returns consolidated notification-runtime health.
 *
 * Read-only except that existing status functions may ensure their required
 * sheets exist. This function does not install triggers, activate
 * communications, release held notifications, or send messages.
 *
 * @return {Object}
 */
function MOS5NF_getNotificationRuntimeHealth() {
  const startedAt = new Date();

  const components = {
    communicationsGate:
      MOS5NF_readCommunicationsGateHealth_(),

    subscriber:
      MOS5NF_readComponentHealth_(
        "MOS5NF_getNotificationQueueStatus",
        "NOTIFICATION_SUBSCRIBER"
      ),

    sendWorker:
      MOS5NF_readComponentHealth_(
        "MOS5NF_getSendWorkerStatus",
        "NOTIFICATION_SEND_WORKER"
      ),

    managedTrigger:
      MOS5NF_readComponentHealth_(
        "MOS5NF_getManagedNotificationTriggerStatus",
        "MANAGED_NOTIFICATION_TRIGGER"
      ),

    eventPublisher:
      MOS5NF_readComponentHealth_(
        "MOS5_runCanonicalPublisherDiagnostics",
        "CANONICAL_EVENT_PUBLISHER"
      ),

    eventBus:
      MOS5NF_readComponentHealth_(
        "MOS5_getEventBusStatus",
        "ENTERPRISE_EVENT_BUS"
      )
  };

  const issues =
    MOS5NF_collectNotificationRuntimeIssues_(
      components
    );

  const failed =
    issues.filter(function(issue) {
      return issue.severity === "ERROR";
    }).length;

  const warnings =
    issues.filter(function(issue) {
      return issue.severity === "WARNING";
    }).length;

  const healthy =
    failed === 0;

  return {
    release:
      "MOS5-NF03-NOTIFICATION-RUNTIME-HEALTH",

    version:
      MOS5_NOTIFICATION_RUNTIME_HEALTH_VERSION,

    overallStatus:
      failed > 0
        ? "FAIL"
        : warnings > 0
          ? "WARNING"
          : "PASS",

    healthy:
      healthy,

    readyToProcess:
      healthy &&
      components.communicationsGate.open === true &&
      components.sendWorker.available === true &&
      components.managedTrigger.available === true,

    communicationsOpen:
      components.communicationsGate.open === true,

    triggerInstalled:
      Boolean(
        components.managedTrigger.data &&
        components.managedTrigger.data.installed
      ),

    failed:
      failed,

    warnings:
      warnings,

    components:
      components,

    issues:
      issues,

    productionChanged:
      false,

    startedAt:
      startedAt.toISOString(),

    completedAt:
      new Date().toISOString()
  };
}

/**
 * Returns a compact notification-runtime summary.
 *
 * @return {Object}
 */
function MOS5NF_getNotificationRuntimeSummary() {
  const health =
    MOS5NF_getNotificationRuntimeHealth();

  const subscriberQueue =
    health.components.subscriber.data ||
    {};

  const sendWorkerQueue =
    health.components.sendWorker.data ||
    {};

  const trigger =
    health.components.managedTrigger.data ||
    {};

  return {
    release:
      "MOS5-NF03-NOTIFICATION-RUNTIME-HEALTH",

    version:
      MOS5_NOTIFICATION_RUNTIME_HEALTH_VERSION,

    status:
      health.overallStatus,

    communicationsOpen:
      health.communicationsOpen,

    triggerInstalled:
      Boolean(trigger.installed),

    triggerCount:
      Number(
        trigger.triggerCount || 0
      ),

    duplicateTriggers:
      Number(
        trigger.duplicateTriggers || 0
      ),

    pending:
      Number(
        sendWorkerQueue.pending ||
        subscriberQueue.pending ||
        0
      ),

    held:
      Number(
        sendWorkerQueue.held ||
        subscriberQueue.held ||
        0
      ),

    processing:
      Number(
        sendWorkerQueue.processing ||
        subscriberQueue.processing ||
        0
      ),

    sent:
      Number(
        sendWorkerQueue.sent ||
        subscriberQueue.sent ||
        0
      ),

    failed:
      Number(
        sendWorkerQueue.failed ||
        subscriberQueue.failed ||
        0
      ),

    issueCount:
      health.issues.length,

    productionChanged:
      false,

    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Verifies whether the notification runtime may safely process jobs.
 *
 * @return {Object}
 */
function MOS5NF_assertNotificationRuntimeReady() {
  const health =
    MOS5NF_getNotificationRuntimeHealth();

  if (
    health.failed > 0
  ) {
    throw new Error(
      "Notification runtime failed health verification: " +
      MOS5NF_issueSummary_(
        health.issues
      )
    );
  }

  if (
    !health.components.sendWorker.available
  ) {
    throw new Error(
      "Notification send worker is unavailable."
    );
  }

  if (
    !health.components.managedTrigger.available
  ) {
    throw new Error(
      "Managed notification trigger module is unavailable."
    );
  }

  return {
    success: true,

    status:
      health.communicationsOpen
        ? "READY"
        : "READY_HELD",

    communicationsOpen:
      health.communicationsOpen,

    triggerInstalled:
      health.triggerInstalled,

    health:
      health,

    productionChanged:
      false,

    completedAt:
      new Date().toISOString()
  };
}

/**
 * Repairs duplicate managed notification triggers only.
 *
 * Does not create a trigger when none exists.
 *
 * @return {Object}
 */
function MOS5NF_repairNotificationRuntime() {
  if (
    typeof MOS5NF_repairManagedNotificationTrigger !==
    "function"
  ) {
    return {
      success: false,

      status:
        "TRIGGER_REPAIR_UNAVAILABLE",

      productionChanged:
        false,

      completedAt:
        new Date().toISOString()
    };
  }

  const before =
    MOS5NF_getNotificationRuntimeHealth();

  const repair =
    MOS5NF_repairManagedNotificationTrigger();

  const after =
    MOS5NF_getNotificationRuntimeHealth();

  return {
    success:
      after.failed === 0,

    status:
      repair.status ||
      "COMPLETE",

    repair:
      repair,

    before:
      before,

    after:
      after,

    productionChanged:
      Number(
        repair.removed || 0
      ) > 0,

    completedAt:
      new Date().toISOString()
  };
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function MOS5NF_runNotificationRuntimeHealthDiagnostics() {
  const requiredFunctions = [
    "MOS5NF_getNotificationQueueStatus",
    "MOS5NF_getSendWorkerStatus",
    "MOS5NF_getManagedNotificationTriggerStatus",
    "MOS5M1B_checkCommunicationsGate_"
  ];

  const tests =
    requiredFunctions.map(
      function(functionName) {
        return {
          code:
            functionName,

          status:
            typeof globalThis[
              functionName
            ] === "function"
              ? "PASS"
              : "FAIL"
        };
      }
    );

  const health =
    MOS5NF_getNotificationRuntimeHealth();

  tests.push({
    code:
      "NO_DUPLICATE_NOTIFICATION_TRIGGERS",

    status:
      Number(
        health.components
          .managedTrigger
          .data
          ?.duplicateTriggers ||
        0
      ) === 0
        ? "PASS"
        : "FAIL"
  });

  tests.push({
    code:
      "NOTIFICATION_RUNTIME_COMPONENTS",

    status:
      health.failed === 0
        ? "PASS"
        : "FAIL"
  });

  const failed =
    tests.filter(function(test) {
      return test.status === "FAIL";
    }).length;

  return {
    release:
      "MOS5-NF03-NOTIFICATION-RUNTIME-HEALTH",

    version:
      MOS5_NOTIFICATION_RUNTIME_HEALTH_VERSION,

    overallStatus:
      failed > 0
        ? "FAIL"
        : health.warnings > 0
          ? "WARNING"
          : "PASS",

    passed:
      tests.length - failed,

    failed:
      failed,

    warnings:
      health.warnings,

    tests:
      tests,

    health:
      health,

    productionChanged:
      false,

    completedAt:
      new Date().toISOString()
  };
}

function MOS5NF_readCommunicationsGateHealth_() {
  if (
    typeof MOS5M1B_checkCommunicationsGate_ !==
    "function"
  ) {
    return {
      available:
        false,

      open:
        false,

      status:
        "UNAVAILABLE",

      reason:
        "Canonical communications gate is unavailable.",

      data:
        null
    };
  }

  try {
    const result =
      MOS5M1B_checkCommunicationsGate_();

    const open =
      Boolean(
        result &&
        result.success === true &&
        result.status === "OPEN"
      );

    return {
      available:
        true,

      open:
        open,

      status:
        open
          ? "OPEN"
          : "HELD",

      reason:
        open
          ? ""
          : String(
              result &&
              (
                result.reason ||
                result.message
              ) ||
              "Communications are paused."
            ),

      data:
        result
    };
  } catch (error) {
    return {
      available:
        true,

      open:
        false,

      status:
        "ERROR",

      reason:
        String(
          error &&
          error.message
            ? error.message
            : error
        ),

      data:
        null
    };
  }
}

function MOS5NF_readComponentHealth_(
  functionName,
  componentName
) {
  const handler =
    globalThis[functionName];

  if (
    typeof handler !== "function"
  ) {
    return {
      component:
        componentName,

      functionName:
        functionName,

      available:
        false,

      success:
        false,

      status:
        "UNAVAILABLE",

      error:
        "Required function is unavailable.",

      data:
        null
    };
  }

  try {
    const result =
      handler();

    const resultStatus =
      String(
        result &&
        (
          result.overallStatus ||
          result.status
        ) ||
        "PASS"
      )
        .trim()
        .toUpperCase();

    return {
      component:
        componentName,

      functionName:
        functionName,

      available:
        true,

      success:
        resultStatus !== "FAIL",

      status:
        resultStatus,

      error:
        "",

      data:
        result
    };
  } catch (error) {
    return {
      component:
        componentName,

      functionName:
        functionName,

      available:
        true,

      success:
        false,

      status:
        "ERROR",

      error:
        String(
          error &&
          error.message
            ? error.message
            : error
        ),

      data:
        null
    };
  }
}

function MOS5NF_collectNotificationRuntimeIssues_(
  components
) {
  const issues = [];

  Object.keys(
    components
  ).forEach(function(key) {
    const component =
      components[key];

    if (
      component.available === false
    ) {
      issues.push({
        component:
          key,

        severity:
          "ERROR",

        code:
          "COMPONENT_UNAVAILABLE",

        message:
          component.error ||
          component.reason ||
          "Required component is unavailable."
      });

      return;
    }

    if (
      component.status === "ERROR" ||
      component.status === "FAIL"
    ) {
      issues.push({
        component:
          key,

        severity:
          "ERROR",

        code:
          "COMPONENT_FAILURE",

        message:
          component.error ||
          component.reason ||
          "Component health check failed."
      });
    }
  });

  const gate =
    components.communicationsGate;

  if (
    gate.available &&
    !gate.open &&
    gate.status !== "ERROR"
  ) {
    issues.push({
      component:
        "communicationsGate",

      severity:
        "WARNING",

      code:
        "COMMUNICATIONS_HELD",

      message:
        gate.reason ||
        "Communications are paused."
    });
  }

  const triggerData =
    components.managedTrigger.data ||
    {};

  if (
    components.managedTrigger.available &&
    Number(
      triggerData.duplicateTriggers ||
      0
    ) > 0
  ) {
    issues.push({
      component:
        "managedTrigger",

      severity:
        "ERROR",

      code:
        "DUPLICATE_TRIGGERS",

      message:
        String(
          triggerData.duplicateTriggers
        ) +
        " duplicate notification trigger(s) detected."
    });
  }

  if (
    components.managedTrigger.available &&
    !triggerData.installed
  ) {
    issues.push({
      component:
        "managedTrigger",

      severity:
        "WARNING",

      code:
        "TRIGGER_NOT_INSTALLED",

      message:
        "Managed notification trigger is not installed."
    });
  }

  const sendQueue =
    components.sendWorker.data ||
    {};

  if (
    Number(
      sendQueue.failed || 0
    ) > 0
  ) {
    issues.push({
      component:
        "sendWorker",

      severity:
        "WARNING",

      code:
        "FAILED_NOTIFICATION_JOBS",

      message:
        String(
          sendQueue.failed
        ) +
        " failed notification job(s) require review."
    });
  }

  if (
    Number(
      sendQueue.processing || 0
    ) > 0
  ) {
    issues.push({
      component:
        "sendWorker",

      severity:
        "WARNING",

      code:
        "PROCESSING_NOTIFICATION_JOBS",

      message:
        String(
          sendQueue.processing
        ) +
        " notification job(s) are currently processing."
    });
  }

  return issues;
}

function MOS5NF_issueSummary_(
  issues
) {
  return (
    issues || []
  )
    .map(function(issue) {
      return (
        String(
          issue.code || "ISSUE"
        ) +
        ": " +
        String(
          issue.message || ""
        )
      );
    })
    .join("; ");
}