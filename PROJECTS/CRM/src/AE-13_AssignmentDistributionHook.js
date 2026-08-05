/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine
 * File: AE-13_AssignmentDistributionHook.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Automatically distributes a newly assigned lead into the assigned agent's
 *   personal lead workbook after a successful LIVE assignment.
 *
 * Requires:
 *   AE-01 through AE-12
 ******************************************************************************/

function AE_assignLeadAndDistribute(lead) {
  const assignment = AE_assignLead(lead);

  if (!assignment || !assignment.success) {
    return {
      success: false,
      assignment: assignment,
      distribution: null
    };
  }

  if (assignment.mode !== "LIVE") {
    return {
      success: true,
      assignment: assignment,
      distribution: {
        success: true,
        skipped: true,
        reason: "Assignment Engine is not in LIVE mode."
      }
    };
  }

  const distribution = AE_distributeAssignedLead(
    assignment.leadId
  );

  return {
    success:
      assignment.success &&
      distribution.success,
    assignment: assignment,
    distribution: distribution
  };
}

function AE_processUnassignedLeadsAndDistribute(
  limit
) {
  AE_assertNotPaused_();

  const max = Math.max(
    1,
    Number(limit || 25)
  );

  const leads = AE_sheetObjects_(
    AE.SHEETS.LEADS
  )
    .filter(function(lead) {
      const status = String(
        lead.Status || ""
      ).toUpperCase();

      const assigned = String(
        lead.AssignedAgentID || ""
      ).trim();

      return (
        !assigned &&
        [
          "",
          "NEW",
          "UNASSIGNED",
          "PENDING"
        ].indexOf(status) !== -1
      );
    })
    .slice(0, max);

  const results = [];

  leads.forEach(function(lead) {
    try {
      results.push(
        AE_assignLeadAndDistribute(
          lead
        )
      );
    } catch (error) {
      AE_log_(
        "ASSIGN_DISTRIBUTE_ERROR",
        error.message || String(error),
        lead.LeadID || "",
        ""
      );

      results.push({
        success: false,
        leadId:
          lead.LeadID || "",
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

    results:
      results
  };
}

function AE_distributeRecentAssignedLeads(
  limit
) {
  const max = Math.max(
    1,
    Number(limit || 50)
  );

  const leads = AE_sheetObjects_(
    AE.SHEETS.LEADS
  )
    .filter(function(lead) {
      return String(
        lead.AssignedAgentID || ""
      ).trim() !== "";
    })
    .sort(function(a, b) {
      return (
        AE_dateNumber_(b.AssignedAt) -
        AE_dateNumber_(a.AssignedAt)
      );
    })
    .slice(0, max);

  const results = [];

  leads.forEach(function(lead) {
    try {
      results.push(
        AE_distributeAssignedLead(
          lead.LeadID
        )
      );
    } catch (error) {
      results.push({
        success: false,
        leadId:
          lead.LeadID || "",
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

    results:
      results
  };
}

function AE_getAssignmentDistributionStatus() {
  const distributionRows =
    AE_sheetObjects_(
      AE_AGENT_DISTRIBUTION_LOG
    );

  return {
    totalDistributionEvents:
      distributionRows.length,

    successful:
      distributionRows.filter(
        function(row) {
          return String(
            row.Status || ""
          ).toUpperCase() ===
            "SUCCESS";
        }
      ).length,

    errors:
      distributionRows.filter(
        function(row) {
          return String(
            row.Status || ""
          ).toUpperCase() ===
            "ERROR";
        }
      ).length,

    agentLeadSheets:
      AE_getAgentLeadDistributionStatus()
  };
}

function AE_testAssignmentDistributionHook() {
  AE_initializeAgentLeadDistributionBridge();

  const sync =
    AE_syncAgentLeadSheetIds();

  const status =
    AE_getAssignmentDistributionStatus();

  Logger.log(
    JSON.stringify(sync)
  );

  Logger.log(
    JSON.stringify(status)
  );

  return true;
}
