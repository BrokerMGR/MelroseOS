/******************************************************************************
 * MelroseOS CRM Assignment + Distribution Patch
 * AE-04_HeaderCompatibilityPatch.gs
 * Version 1.0.1
 *
 * Fixes compatibility with current AE_AGENTS headers:
 * - AcceptingLeads
 * - LeadsSheetId
 * - Priority
 * - DailyCap
 * - CurrentDailyCount
 ******************************************************************************/

function AE_getAgentWorkbookId_(agent) {
  return String(
    AE_getFirst_(agent, [
      "LeadsSheetId",
      "AgentLeadsSheetId",
      "AgentLeadsWorkbookId",
      "LeadWorkbookId",
      "LeadsWorkbookId",
      "LeadSheetId",
      "WorkbookID",
      "WorkbookId",
      "SpreadsheetID",
      "SpreadsheetId"
    ]) || ""
  ).trim();
}

function AE_isAgentActive_(agent) {
  const activeRaw = AE_getFirst_(agent, [
    "Active",
    "IsActive",
    "Status",
    "AgentStatus",
    "Enabled",
    "Available"
  ]);

  if (activeRaw !== "") {
    const value = AE_upper_(activeRaw);

    if (
      ["PAUSED","INACTIVE","NO","FALSE","DISABLED","0"].indexOf(value) !== -1 ||
      /PAUS|INACTIVE|DISABLED|OFFBOARD|TERMINATED/.test(value)
    ) {
      return false;
    }
  }

  const acceptingRaw = AE_getFirst_(agent, [
    "AcceptingLeads",
    "AcceptLeads",
    "TakingLeads"
  ]);

  if (acceptingRaw !== "") {
    const accepting = AE_upper_(acceptingRaw);

    if (
      ["NO","FALSE","0","PAUSED","INACTIVE","DISABLED"].indexOf(accepting) !== -1
    ) {
      return false;
    }
  }

  const dailyCap = Number(
    AE_getFirst_(agent, ["DailyCap", "DailyLeadCap"]) || 0
  );

  const currentDailyCount = Number(
    AE_getFirst_(agent, ["CurrentDailyCount", "DailyCount"]) || 0
  );

  if (
    dailyCap > 0 &&
    currentDailyCount >= dailyCap
  ) {
    return false;
  }

  return true;
}

function AE_selectRoundRobinAgent_(eligible, leadType, parish) {
  const sorted = eligible.slice().sort(function(a, b) {
    const priorityA = Number(AE_getFirst_(a, ["Priority"]) || 9999);
    const priorityB = Number(AE_getFirst_(b, ["Priority"]) || 9999);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const lastA = AE_dateValue_(
      AE_getFirst_(a, ["LastAssignedAt"])
    );

    const lastB = AE_dateValue_(
      AE_getFirst_(b, ["LastAssignedAt"])
    );

    if (lastA !== lastB) {
      return lastA - lastB;
    }

    return String(
      AE_getFirst_(a, ["AgentID","ID","Agent Id"]) || ""
    ).localeCompare(
      String(
        AE_getFirst_(b, ["AgentID","ID","Agent Id"]) || ""
      )
    );
  });

  const state = AE_getRoutingState_(leadType, parish);

  if (!state || !state.LastAgentID) {
    return sorted[0];
  }

  const lastIndex = sorted.findIndex(function(agent) {
    return String(
      AE_getFirst_(agent, ["AgentID","ID","Agent Id"]) || ""
    ) === String(state.LastAgentID || "");
  });

  if (lastIndex === -1) {
    return sorted[0];
  }

  return sorted[(lastIndex + 1) % sorted.length];
}

function AE_incrementAgentDailyCount_(agentId) {
  if (agentId === null || agentId === undefined || agentId === "") {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AE.AGENTS_SHEET);

  if (!sheet) return;

  const rows = AE_objects_(sheet);

  const agent = rows.find(function(row) {
    return String(
      AE_getFirst_(row, ["AgentID","ID","Agent Id"]) || ""
    ) === String(agentId);
  });

  if (!agent) return;

  const current = Number(
    AE_getFirst_(agent, ["CurrentDailyCount","DailyCount"]) || 0
  );

  AE_updateRow_(sheet, agent.__rowNumber, {
    CurrentDailyCount: current + 1,
    LastAssignedAt: new Date(),
    UpdatedAt: new Date()
  });
}

function AE_applyAssignment_(
  leadsSheet,
  rowNumber,
  agentId,
  agentName,
  agentEmail,
  method
) {
  AE_updateRow_(leadsSheet, rowNumber, {
    AssignedAgentID: agentId || "",
    AssignedAgentName: agentName || "",
    AssignedAgentEmail: agentEmail || "",
    AssignmentStatus: "ASSIGNED",
    AssignmentMethod: method || "",
    AssignedAt: new Date(),
    AssignmentError: "",
    UpdatedAt: new Date()
  });

  if (method === "ROUND_ROBIN") {
    AE_incrementAgentDailyCount_(agentId);
  }
}

function AE_previewEligibilityForTestLead() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const leadsSheet = ss.getSheetByName(AE.LEADS_SHEET);
  const agentsSheet = ss.getSheetByName(AE.AGENTS_SHEET);

  const lead = AE_objects_(leadsSheet)
    .filter(function(row) {
      return String(row.LeadID || "").indexOf("TESTLEAD_") === 0;
    })
    .sort(function(a, b) {
      return AE_dateValue_(b.CreatedAt || b.UpdatedAt) -
             AE_dateValue_(a.CreatedAt || a.UpdatedAt);
    })[0];

  if (!lead) {
    throw new Error("No TESTLEAD_ record found in AE_LEADS.");
  }

  const leadType = AE_upper_(
    lead.LeadType || lead.Type || lead.Category
  );

  const parish = AE_normalizeParish_(
    lead.Parish || lead.ParishNeeded || lead.CityOrArea
  );

  const agents = AE_objects_(agentsSheet).map(function(agent) {
    return {
      agentId: AE_getFirst_(agent, ["AgentID","ID","Agent Id"]),
      name: AE_getAgentName_(agent),
      email: AE_getAgentEmail_(agent),
      active: AE_isAgentActive_(agent),
      acceptingLeads: AE_getFirst_(agent, ["AcceptingLeads"]),
      priority: AE_getFirst_(agent, ["Priority"]),
      dailyCap: AE_getFirst_(agent, ["DailyCap"]),
      currentDailyCount: AE_getFirst_(agent, ["CurrentDailyCount"]),
      leadTypeEligible: AE_agentSupportsLeadType_(agent, leadType),
      parishEligible: AE_agentSupportsParish_(agent, parish),
      eligible: AE_isAgentEligible_(agent, leadType, parish),
      workbookId: AE_getAgentWorkbookId_(agent)
    };
  });

  const result = {
    success: true,
    version: "1.0.1",
    leadId: lead.LeadID,
    leadType: leadType,
    parish: parish,
    agents: agents
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
