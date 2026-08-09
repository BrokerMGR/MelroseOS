/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-01_Orchestrator.gs
 * Version: 1.3.0
 *
 * Purpose:
 *   Central operational orchestrator connecting Lead Intake, Assignment,
 *   Agent Lead Distribution, Notifications, Appointments, and system health.
 *
 * Safety:
 *   Respects existing module modes.
 *   Does NOT force SHADOW or LIVE mode during normal operations.
 *
 * Requires:
 *   AE-01 through AE-13
 *   LI-01 through LI-09
 *   NF-01 through NF-06
 *   AP-01 through AP-06
 *   CO-01 through CO-07
 *   LC-01 through LC-06
 ******************************************************************************/

const OP = {
  VERSION: "1.3.0",
  SHEETS: {
    RUNS: "OP_RUN_LOG",
    STATUS: "OP_STATUS"
  }
};

function OP_initializeCore() {
  const ss = workbook_();

  Object.keys(OP.SHEETS).forEach(function(key) {
    createSheetIfMissing_(ss, OP.SHEETS[key]);
  });

  OP_setHeadersIfEmpty_(
    ss.getSheetByName(OP.SHEETS.RUNS),
    [
      "RunID",
      "RunType",
      "Status",
      "IntakeProcessed",
      "NotificationsProcessed",
      "AppointmentsProcessed",
      "Errors",
      "StartedAt",
      "CompletedAt",
      "Details"
    ]
  );

  OP_setHeadersIfEmpty_(
    ss.getSheetByName(OP.SHEETS.STATUS),
    [
      "Component",
      "Mode",
      "Status",
      "Details",
      "UpdatedAt"
    ]
  );

  return {
    success: true,
    version: OP.VERSION
  };
}

function OP_setHeadersIfEmpty_(sheet, headers) {
  if (!sheet) {
    throw new Error("Required Operations sheet is missing.");
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    sheet.setFrozenRows(1);
    autoResize_(sheet);
    return;
  }

  const width = Math.max(
    sheet.getLastColumn(),
    headers.length
  );

  const existing = sheet
    .getRange(1, 1, 1, width)
    .getDisplayValues()[0];

  const hasHeaders = existing.some(function(value) {
    return String(value || "").trim() !== "";
  });

  if (!hasHeaders) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    sheet.setFrozenRows(1);
    autoResize_(sheet);
  }
}

function OP_runOperationsCycle(options) {
  OP_initializeCore();

  options = options || {};

  const runId =
    "OP-" +
    Utilities
      .getUuid()
      .substring(0, 8)
      .toUpperCase();

  const startedAt = timestamp_();

  const limits = {
    intake: Math.max(
      1,
      Number(options.intakeLimit || 25)
    ),
    notifications: Math.max(
      1,
      Number(options.notificationLimit || 25)
    ),
    appointments: Math.max(
      1,
      Number(options.appointmentLimit || 25)
    )
  };

  const result = {
    runId: runId,
    success: true,
    intake: null,
    notifications: null,
    appointments: null,
    lifecycle: null,
    health: null,
    errors: []
  };

  /*
   * Lead Intake -> Assignment -> Agent Workbook Distribution
   *
   * Preferred path:
   * LI_processIntakeQueueComplete()
   *
   * Fallback:
   * LI_processIntakeQueueAndDistribute()
   * then LI_processIntakeQueue()
   */
  try {
    if (
      typeof LI_processIntakeQueueComplete ===
      "function"
    ) {
      result.intake =
        LI_processIntakeQueueComplete(
          limits.intake
        );
    } else if (
      typeof LI_processIntakeQueueAndDistribute ===
      "function"
    ) {
      result.intake =
        LI_processIntakeQueueAndDistribute(
          limits.intake
        );

      result.errors.push(
        "WARNING: Complete assignment-notification bridge is unavailable; distribution-aware intake processor was used."
      );
    } else if (
      typeof LI_processIntakeQueue ===
      "function"
    ) {
      result.intake =
        LI_processIntakeQueue(
          limits.intake
        );

      result.errors.push(
        "WARNING: Distribution-aware intake bridge is unavailable; fallback intake processor was used."
      );
    } else {
      throw new Error(
        "No Lead Intake queue processor is available."
      );
    }
  } catch (error) {
    result.success = false;

    result.errors.push(
      "Lead Intake: " +
      (error.message || String(error))
    );
  }

  /*
   * Notification Send Queue
   */
  try {
    if (
      typeof NF_processSendQueue ===
      "function"
    ) {
      result.notifications =
        NF_processSendQueue(
          limits.notifications
        );
    }
  } catch (error) {
    result.success = false;

    result.errors.push(
      "Notifications: " +
      (error.message || String(error))
    );
  }

  /*
   * Appointment / Calendar Sync
   */
  try {
    if (
      typeof AP_syncPendingAppointments ===
      "function"
    ) {
      result.appointments =
        AP_syncPendingAppointments(
          limits.appointments
        );
    }
  } catch (error) {
    result.success = false;

    result.errors.push(
      "Appointments: " +
      (error.message || String(error))
    );
  }

  /*
   * Lead Lifecycle
   */
  try {
    if (
      typeof LC_runLifecycleCycle ===
      "function"
    ) {
      result.lifecycle =
        LC_runLifecycleCycle(
          Math.max(
            limits.intake,
            limits.notifications,
            limits.appointments
          )
        );
    }
  } catch (error) {
    result.success = false;

    result.errors.push(
      "Lead Lifecycle: " +
      (error.message || String(error))
    );
  }

  /*
   * System Health
   */
  try {
    if (
      typeof CO_runHealthCheck ===
      "function"
    ) {
      result.health =
        CO_runHealthCheck();

      if (
        result.health &&
        result.health.success === false
      ) {
        result.success = false;

        result.errors.push(
          "Health Check: " +
          Number(
            result.health.failed || 0
          ) +
          " failure(s) detected."
        );
      }
    }
  } catch (error) {
    result.success = false;

    result.errors.push(
      "Health Check: " +
      (error.message || String(error))
    );
  }

  OP_writeRunLog_(
    result,
    startedAt,
    timestamp_()
  );

  OP_refreshStatus();

  return result;
}

function OP_writeRunLog_(
  result,
  startedAt,
  completedAt
) {
  const sheet = workbook_().getSheetByName(
    OP.SHEETS.RUNS
  );

  if (!sheet) {
    return;
  }

  sheet.appendRow([
    result.runId,
    "OPERATIONS_CYCLE",
    result.success
      ? "SUCCESS"
      : "WARNING",

    result.intake
      ? Number(
          result.intake.processed || 0
        )
      : 0,

    result.notifications
      ? Number(
          result.notifications.processed || 0
        )
      : 0,

    result.appointments
      ? Number(
          result.appointments.processed || 0
        )
      : 0,

    result.errors.length,
    startedAt,
    completedAt,
    result.errors.join(" | ")
  ]);
}

function OP_refreshStatus() {
  OP_initializeCore();

  const sheet = workbook_().getSheetByName(
    OP.SHEETS.STATUS
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

  const distributionStatus =
    typeof AE_getAgentLeadDistributionStatus ===
      "function"
      ? AE_getAgentLeadDistributionStatus()
      : {};

  const rows = [
    [
      "Assignment Engine",
      typeof AE_getMode === "function"
        ? AE_getMode()
        : "UNKNOWN",
      typeof AE_getMode === "function"
        ? "AVAILABLE"
        : "MISSING",
      "Assignment routing module.",
      timestamp_()
    ],

    [
      "Lead Intake",
      typeof AE_getMode === "function"
        ? AE_getMode()
        : "UNKNOWN",
      typeof LI_processIntakeQueueComplete === "function"
        ? "AVAILABLE"
        : "MISSING",
      "Complete intake, assignment, agent workbook distribution, and notification queue processing.",
      timestamp_()
    ],

    [
      "Agent Lead Distribution",
      "LIVE BRIDGE",
      typeof AE_distributeAssignedLead === "function"
        ? "AVAILABLE"
        : "MISSING",
      (
        distributionStatus.activeAgentsWithLeadSheets !== undefined
          ? distributionStatus.activeAgentsWithLeadSheets +
            " active agent(s) have linked lead workbooks."
          : "Agent lead distribution bridge."
      ),
      timestamp_()
    ],

    [
      "Notifications",
      typeof NF_getMode === "function"
        ? NF_getMode()
        : "UNKNOWN",
      typeof NF_getMode === "function"
        ? "AVAILABLE"
        : "MISSING",
      "Notification and follow-up module.",
      timestamp_()
    ],

    [
      "Appointments",
      typeof AP_getMode === "function"
        ? AP_getMode()
        : "UNKNOWN",
      typeof AP_getMode === "function"
        ? "AVAILABLE"
        : "MISSING",
      "Appointment confirmation and calendar module.",
      timestamp_()
    ],

    [
      "Lead Lifecycle",
      "LIVE",
      typeof LC_runLifecycleCycle === "function"
        ? "AVAILABLE"
        : "MISSING",
      "Reply detection, appointment lifecycle, and follow-up state synchronization.",
      timestamp_()
    ],

    [
      "Cutover",
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",
      typeof CO_getState === "function"
        ? "AVAILABLE"
        : "MISSING",
      "System integration and cutover controller.",
      timestamp_()
    ]
  ];

  sheet
    .getRange(
      2,
      1,
      rows.length,
      rows[0].length
    )
    .setValues(rows);

  autoResize_(sheet);

  return rows;
}

function OP_getStatus() {
  return {
    version:
      OP.VERSION,

    cutoverState:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",

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

    intake:
      typeof LI_getDistributionQueueStatus === "function"
        ? LI_getDistributionQueueStatus()
        : (
            typeof LI_getQueueStatus === "function"
              ? LI_getQueueStatus()
              : {}
          ),

    distribution:
      typeof AE_getAssignmentDistributionStatus === "function"
        ? AE_getAssignmentDistributionStatus()
        : {},

    lifecycle:
      typeof LC_getOperationsStatus === "function"
        ? LC_getOperationsStatus()
        : {},

    notifications:
      typeof NF_getSendEngineStatus === "function"
        ? NF_getSendEngineStatus()
        : {},

    appointments:
      typeof AP_getCoreStatus === "function"
        ? AP_getCoreStatus()
        : {}
  };
}

/*
 * Explicit SHADOW cycle only.
 * Use this only when intentionally testing in SHADOW mode.
 */
function OP_runShadowCycle() {
  if (
    typeof CO_forceShadowMode ===
    "function"
  ) {
    CO_forceShadowMode();
  }

  return OP_runOperationsCycle();
}

/*
 * Safe orchestrator test.
 * Preserves the system's current state instead of forcing SHADOW.
 */
function OP_testOrchestrator() {
  OP_initializeCore();

  const stateBefore =
    typeof CO_getState === "function"
      ? CO_getState()
      : "UNKNOWN";

  const result =
    OP_runOperationsCycle({
      intakeLimit: 5,
      notificationLimit: 5,
      appointmentLimit: 5
    });

  if (!result.runId) {
    throw new Error(
      "Operations Orchestrator self-test failed."
    );
  }

  const stateAfter =
    typeof CO_getState === "function"
      ? CO_getState()
      : "UNKNOWN";

  Logger.log(
    JSON.stringify(
      {
        result: result,
        stateBefore: stateBefore,
        stateAfter: stateAfter
      }
    )
  );

  Logger.log(
    JSON.stringify(
      OP_getStatus()
    )
  );

  return true;
}
