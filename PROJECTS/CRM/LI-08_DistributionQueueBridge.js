/******************************************************************************
 * MelroseOS Enterprise
 * Lead Intake + Assignment Distribution
 * File: LI-08_DistributionQueueBridge.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Processes NEW Lead Intake records through LIVE assignment and automatically
 *   distributes successfully assigned leads into the assigned agent's personal
 *   lead workbook.
 *
 * Requires:
 *   LI-01 through LI-07
 *   AE-01 through AE-13
 ******************************************************************************/

function LI_processIntakeQueueAndDistribute(limit) {
  LI_initializeDedupeEngine();
  AE_initializeAgentLeadDistributionBridge();

  const max = Math.max(
    1,
    Number(limit || 25)
  );

  const rows = LI_sheetObjects_(
    LI.SHEETS.INTAKE
  )
    .filter(function(row) {
      return (
        String(
          row.Status || ""
        ).toUpperCase() === "NEW" &&
        String(
          row.ValidationStatus || ""
        ).toUpperCase() === "VALID"
      );
    })
    .slice(0, max);

  const results = [];

  rows.forEach(function(intake) {
    try {
      results.push(
        LI_processIntakeRecordAndDistribute_(
          intake
        )
      );
    } catch (error) {
      LI_updateIntakeStatus_(
        intake._row,
        "ERROR",
        "VALID",
        error.message || String(error),
        "",
        ""
      );

      LI_log_(
        "QUEUE_DISTRIBUTION_ERROR",
        intake.IntakeID,
        error.message || String(error),
        intake.LeadID
      );

      results.push({
        success: false,
        intakeId:
          intake.IntakeID || "",
        leadId:
          intake.LeadID || "",
        error:
          error.message ||
          String(error)
      });
    }
  });

  return {
    success:
      results.every(function(result) {
        return result.success;
      }),

    processed:
      results.length,

    successful:
      results.filter(function(result) {
        return result.success;
      }).length,

    failed:
      results.filter(function(result) {
        return !result.success;
      }).length,

    mode:
      AE_getMode(),

    results:
      results
  };
}

function LI_processIntakeRecordAndDistribute_(
  intake
) {
  const lead = {
    LeadID:
      String(
        intake.LeadID || ""
      ).trim() ||
      LI_uuid_("LEAD"),

    CreatedAt:
      intake.ReceivedAt ||
      timestamp_(),

    FirstName:
      String(
        intake.FirstName || ""
      ).trim(),

    LastName:
      String(
        intake.LastName || ""
      ).trim(),

    Email:
      AE_normalizeEmail_(
        intake.Email || ""
      ),

    Phone:
      AE_normalizePhone_(
        intake.Phone || ""
      ),

    LeadType:
      String(
        intake.LeadType || ""
      ).trim().toUpperCase(),

    Parish:
      String(
        intake.Parish || ""
      ).trim().toUpperCase(),

    Source:
      String(
        intake.Source || ""
      ).trim(),

    Status:
      "NEW"
  };

  LI_upsertAELead_(lead);

  const assignment =
    AE_assignLeadAndDistribute(
      lead
    );

  const assignmentResult =
    assignment.assignment || {};

  const distributionResult =
    assignment.distribution || {};

  const assignedAgentId =
    assignmentResult.success
      ? String(
          assignmentResult.agentId || ""
        )
      : "";

  let finalStatus = "UNASSIGNED";

  if (assignment.success) {
    finalStatus =
      assignmentResult.mode === "LIVE"
        ? "PROCESSED"
        : "SHADOW_PROCESSED";
  }

  let message = "";

  if (!assignmentResult.success) {
    message =
      assignmentResult.reason ||
      "No assignment available.";
  } else if (
    assignmentResult.mode === "LIVE" &&
    !distributionResult.success
  ) {
    message =
      distributionResult.reason ||
      distributionResult.error ||
      "Lead assignment succeeded but agent workbook distribution failed.";
  } else {
    message =
      assignmentResult.reason || "";
  }

  LI_updateIntakeStatus_(
    intake._row,
    finalStatus,
    "VALID",
    message,
    assignedAgentId,
    timestamp_()
  );

  LI_log_(
    assignment.success
      ? "QUEUE_ASSIGNED_DISTRIBUTED"
      : "QUEUE_ASSIGN_DISTRIBUTE_FAILED",

    intake.IntakeID,

    assignment.success
      ? "Lead processed through Assignment Engine and distribution bridge."
      : message,

    lead.LeadID
  );

  return {
    success:
      assignment.success,

    intakeId:
      intake.IntakeID,

    leadId:
      lead.LeadID,

    mode:
      assignmentResult.mode ||
      AE_getMode(),

    agentId:
      assignedAgentId,

    agentName:
      assignmentResult.agentName || "",

    assignmentMethod:
      assignmentResult.method || "",

    assignmentReason:
      assignmentResult.reason || "",

    distribution:
      distributionResult,

    status:
      finalStatus
  };
}

function LI_retryFailedQueueAndDistribute(
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

  return LI_processIntakeQueueAndDistribute(
    max
  );
}

function LI_getDistributionQueueStatus() {
  const queue =
    LI_getQueueStatus();

  const distribution =
    typeof AE_getAssignmentDistributionStatus ===
      "function"
      ? AE_getAssignmentDistributionStatus()
      : {};

  return {
    assignmentMode:
      AE_getMode(),

    queue:
      queue,

    distribution:
      distribution
  };
}

function LI_testDistributionQueueBridge() {
  AE_syncAgentLeadSheetIds();

  const status =
    LI_getDistributionQueueStatus();

  Logger.log(
    JSON.stringify(status)
  );

  if (
    status.assignmentMode !== "LIVE" &&
    status.assignmentMode !== "SHADOW"
  ) {
    throw new Error(
      "Invalid Assignment Engine mode."
    );
  }

  return true;
}
