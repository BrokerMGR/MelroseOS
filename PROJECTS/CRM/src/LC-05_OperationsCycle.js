/******************************************************************************
 * MelroseOS Enterprise
 * Lead Lifecycle Management
 * File: LC-05_OperationsCycle.gs
 * Version: 1.0.0
 ******************************************************************************/

function LC_runLifecycleCycle(limit) {
  LC_initializeCore();

  const max = Math.max(1, Number(limit || 50));

  const result = {
    success: true,
    replies: null,
    appointments: null,
    followUps: null,
    errors: []
  };

  try {
    result.replies = LC_scanLeadReplies(max);
  } catch (error) {
    result.success = false;
    result.errors.push(
      "Reply Detection: " +
      (error.message || String(error))
    );
  }

  try {
    result.appointments = LC_syncAppointmentLifecycle(max);
  } catch (error) {
    result.success = false;
    result.errors.push(
      "Appointment Lifecycle: " +
      (error.message || String(error))
    );
  }

  try {
    result.followUps = LC_syncFollowUpLifecycle(max);
  } catch (error) {
    result.success = false;
    result.errors.push(
      "Follow-Up Lifecycle: " +
      (error.message || String(error))
    );
  }

  return result;
}

function LC_getOperationsStatus() {
  return {
    lifecycle: LC_getLifecycleSummary(),
    replyDetectionAvailable:
      typeof LC_scanLeadReplies === "function",
    appointmentSyncAvailable:
      typeof LC_syncAppointmentLifecycle === "function",
    followUpSyncAvailable:
      typeof LC_syncFollowUpLifecycle === "function"
  };
}

function LC_testOperationsCycle() {
  const result = LC_runLifecycleCycle(10);

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(LC_getOperationsStatus()));

  return true;
}
