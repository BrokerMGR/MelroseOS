/******************************************************************************
 * MelroseOS Enterprise
 * Lead Intake Completion Bridge
 * File: LI-09_AssignmentNotificationBridge.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Completes the LIVE lead workflow:
 *   Intake -> Assignment -> Agent Workbook -> Notification Queue
 *
 * Requires:
 *   LI-01 through LI-08
 *   AE-01 through AE-13
 *   NF-01 through NF-06
 ******************************************************************************/

function LI_processIntakeQueueComplete(limit) {
  const max = Math.max(
    1,
    Number(limit || 25)
  );

  const intakeResult =
    LI_processIntakeQueueAndDistribute(
      max
    );

  const notificationResults = [];

  (intakeResult.results || [])
    .forEach(function(result) {
      if (
        !result.success ||
        !result.leadId
      ) {
        return;
      }

      if (
        String(
          result.mode || ""
        ).toUpperCase() !== "LIVE"
      ) {
        notificationResults.push({
          success: true,
          leadId: result.leadId,
          skipped: true,
          reason:
            "Assignment was not processed in LIVE mode."
        });

        return;
      }

      try {
        const queued =
          NF_buildAssignmentNotifications(
            result.leadId
          );

        notificationResults.push({
          success: true,
          leadId:
            result.leadId,
          queued:
            queued.queued || 0,
          notifications:
            queued.notifications || []
        });

        LI_log_(
          "ASSIGNMENT_NOTIFICATIONS_QUEUED",
          result.intakeId || "",
          (queued.queued || 0) +
            " assignment notification(s) queued.",
          result.leadId
        );

      } catch (error) {
        notificationResults.push({
          success: false,
          leadId:
            result.leadId,
          error:
            error.message ||
            String(error)
        });

        LI_log_(
          "ASSIGNMENT_NOTIFICATION_ERROR",
          result.intakeId || "",
          error.message ||
            String(error),
          result.leadId
        );
      }
    });

  const notificationFailures =
    notificationResults.filter(
      function(result) {
        return !result.success;
      }
    ).length;

  return {
    success:
      intakeResult.success &&
      notificationFailures === 0,

    processed:
      intakeResult.processed || 0,

    successful:
      intakeResult.successful || 0,

    failed:
      (intakeResult.failed || 0) +
      notificationFailures,

    mode:
      AE_getMode(),

    intake:
      intakeResult,

    notifications:
      {
        processed:
          notificationResults.length,

        successful:
          notificationResults.filter(
            function(result) {
              return result.success;
            }
          ).length,

        failed:
          notificationFailures,

        results:
          notificationResults
      }
  };
}

function LI_retryFailedQueueComplete(
  limit
) {
  const max = Math.max(
    1,
    Number(limit || 25)
  );

  const candidates =
    LI_sheetObjects_(
      LI.SHEETS.INTAKE
    )
      .filter(function(row) {
        const status =
          String(
            row.Status || ""
          ).toUpperCase();

        return (
          status === "ERROR" ||
          status === "UNASSIGNED"
        );
      })
      .slice(0, max);

  candidates.forEach(function(row) {
    LI_updateIntakeStatus_(
      row._row,
      "NEW",
      "VALID",
      "",
      "",
      ""
    );
  });

  return LI_processIntakeQueueComplete(
    max
  );
}

function LI_getCompletePipelineStatus() {
  return {
    assignmentMode:
      typeof AE_getMode === "function"
        ? AE_getMode()
        : "UNKNOWN",

    notificationMode:
      typeof NF_getMode === "function"
        ? NF_getMode()
        : "UNKNOWN",

    intake:
      typeof LI_getQueueStatus === "function"
        ? LI_getQueueStatus()
        : {},

    distribution:
      typeof AE_getAssignmentDistributionStatus === "function"
        ? AE_getAssignmentDistributionStatus()
        : {},

    notifications:
      typeof NF_getSendEngineStatus === "function"
        ? NF_getSendEngineStatus()
        : {}
  };
}

function LI_testAssignmentNotificationBridge() {
  const status =
    LI_getCompletePipelineStatus();

  Logger.log(
    JSON.stringify(
      status
    )
  );

  if (
    typeof NF_buildAssignmentNotifications !==
    "function"
  ) {
    throw new Error(
      "Notification Builder is unavailable."
    );
  }

  if (
    typeof AE_distributeAssignedLead !==
    "function"
  ) {
    throw new Error(
      "Agent Lead Distribution Bridge is unavailable."
    );
  }

  return true;
}
