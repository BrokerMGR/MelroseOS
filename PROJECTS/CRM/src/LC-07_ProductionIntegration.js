/******************************************************************************
 * MelroseOS Enterprise
 * Lead Lifecycle Management
 * File: LC-07_ProductionIntegration.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Production validation and controls for automated lifecycle processing.
 *
 * The main OP operations trigger already calls LC_runLifecycleCycle() through
 * OP_runOperationsCycle(). This file validates that integration and provides a
 * single status function for production monitoring.
 *
 * Requires:
 *   LC-01 through LC-06
 *   OP-01 Orchestrator v1.3+
 ******************************************************************************/

function LC_getProductionIntegrationStatus() {
  const opAvailable =
    typeof OP_runOperationsCycle === "function";

  const lifecycleAvailable =
    typeof LC_runLifecycleCycle === "function";

  const replyDetectionAvailable =
    typeof LC_scanLeadReplies === "function";

  const followUpCancellationAvailable =
    typeof NF_cancelLeadFollowUps === "function";

  const operationsTriggers =
    typeof OP_getOperationsTriggers_ === "function"
      ? OP_getOperationsTriggers_().length
      : 0;

  return {
    success:
      opAvailable &&
      lifecycleAvailable &&
      replyDetectionAvailable &&
      followUpCancellationAvailable,

    orchestratorAvailable:
      opAvailable,

    lifecycleCycleAvailable:
      lifecycleAvailable,

    replyDetectionAvailable:
      replyDetectionAvailable,

    followUpCancellationAvailable:
      followUpCancellationAvailable,

    operationsTriggerCount:
      operationsTriggers,

    lifecycle:
      typeof LC_getLifecycleSummary === "function"
        ? LC_getLifecycleSummary()
        : {}
  };
}

function LC_runProductionLifecycleNow() {
  return LC_runLifecycleCycle(100);
}

function LC_testProductionIntegration() {
  const status =
    LC_getProductionIntegrationStatus();

  Logger.log(
    JSON.stringify(status)
  );

  if (!status.success) {
    throw new Error(
      "Lifecycle production integration is incomplete."
    );
  }

  if (
    status.operationsTriggerCount !== 1
  ) {
    throw new Error(
      "Expected exactly one managed operations trigger; found " +
      status.operationsTriggerCount +
      "."
    );
  }

  return true;
}
