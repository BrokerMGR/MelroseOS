/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine Migration
 * File: AE-07_AssignmentEngine.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Executes Assignment Engine decisions in SHADOW or LIVE mode.
 *
 * Requires:
 *   AE-01_Core.gs
 *   AE-02_Config.gs
 *   AE-03_AgentRegistry.gs
 *   AE-04_LeadLock.gs
 *   AE-05_EligibilityEngine.gs
 *   AE-06_RoundRobinEngine.gs
 ******************************************************************************/

function AE_assignLead(lead) {
  AE_assertNotPaused_();

  if (!lead) {
    throw new Error("Lead record is required.");
  }

  const normalized = AE_normalizeAssignmentLead_(lead);
  const selection = AE_selectAgentForLead(normalized);

  if (!selection.success || !selection.agent) {
    AE_log_(
      "ASSIGNMENT_FAILED",
      selection.reason || "No assignment available.",
      normalized.LeadID,
      ""
    );

    return {
      success: false,
      mode: AE_getMode(),
      leadId: normalized.LeadID,
      agentId: "",
      agentName: "",
      method: selection.method || "NO_ASSIGNMENT",
      reason: selection.reason || "No eligible agent found."
    };
  }

  if (AE_isShadowMode_()) {
    return AE_recordShadowAssignment_(normalized, selection);
  }

  if (!AE_isLiveMode_()) {
    throw new Error("Assignment Engine must be in SHADOW or LIVE mode.");
  }

  return AE_commitLiveAssignment_(normalized, selection);
}

function AE_recordShadowAssignment_(lead, selection) {
  const sheet = workbook_().getSheetByName(AE.SHEETS.SHADOW);

  if (!sheet) {
    throw new Error("AE_SHADOW_RESULTS sheet is missing.");
  }

  const currentAgentId = String(
    lead.AssignedAgentID ||
    lead.assignedAgentId ||
    ""
  ).trim();

  const recommendedId = String(selection.agent.AgentID || "");
  const matchStatus = !currentAgentId
    ? "NO_CURRENT_ASSIGNMENT"
    : currentAgentId === recommendedId
      ? "MATCH"
      : "DIFFERENT";

  const shadowId = AE_uuid_("SHD");

  sheet.appendRow([
    shadowId,
    lead.LeadID,
    recommendedId,
    selection.agent.AgentName || "",
    lead.LeadType,
    lead.Parish,
    selection.reason,
    currentAgentId,
    matchStatus,
    timestamp_()
  ]);

  AE_log_(
    "SHADOW_ASSIGNMENT",
    "Recommended " + (selection.agent.AgentName || recommendedId) +
      " using " + selection.method + ". Match status: " + matchStatus + ".",
    lead.LeadID,
    recommendedId
  );

  return {
    success: true,
    mode: "SHADOW",
    shadowId: shadowId,
    leadId: lead.LeadID,
    agentId: recommendedId,
    agentName: selection.agent.AgentName || "",
    method: selection.method,
    routeType: selection.routeType,
    reason: selection.reason,
    matchStatus: matchStatus,
    committed: false
  };
}

function AE_commitLiveAssignment_(lead, selection) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const assignmentId = AE_uuid_("ASN");
    const now = timestamp_();

    AE_upsertLeadAssignment_(lead, selection, now);

    const assignmentSheet = workbook_().getSheetByName(
      AE.SHEETS.ASSIGNMENTS
    );

    assignmentSheet.appendRow([
      assignmentId,
      lead.LeadID,
      selection.agent.AgentID,
      selection.agent.AgentName || "",
      lead.LeadType,
      lead.Parish,
      "LIVE",
      selection.method,
      selection.reason,
      now
    ]);

    AE_markAgentAssigned(selection.agent.AgentID);

    AE_createOrUpdateLeadLock(
      lead,
      selection.agent
    );

    AE_log_(
      "LIVE_ASSIGNMENT",
      "Lead assigned to " +
        (selection.agent.AgentName || selection.agent.AgentID) +
        " using " + selection.method + ".",
      lead.LeadID,
      selection.agent.AgentID
    );

    return {
      success: true,
      mode: "LIVE",
      assignmentId: assignmentId,
      leadId: lead.LeadID,
      agentId: selection.agent.AgentID,
      agentName: selection.agent.AgentName || "",
      method: selection.method,
      routeType: selection.routeType,
      reason: selection.reason,
      committed: true
    };
  } finally {
    lock.releaseLock();
  }
}

function AE_upsertLeadAssignment_(lead, selection, assignedAt) {
  const sheet = workbook_().getSheetByName(AE.SHEETS.LEADS);

  if (!sheet) {
    throw new Error("AE_LEADS sheet is missing.");
  }

  let row = AE_findRowByValue_(
    AE.SHEETS.LEADS,
    "LeadID",
    lead.LeadID
  );

  const payload = [
    lead.LeadID,
    lead.CreatedAt || timestamp_(),
    lead.FirstName,
    lead.LastName,
    lead.Email,
    lead.Phone,
    lead.LeadType,
    lead.Parish,
    lead.Source,
    "ASSIGNED",
    selection.agent.AgentID,
    selection.agent.AgentName || "",
    assignedAt,
    selection.reason,
    timestamp_()
  ];

  if (row) {
    sheet.getRange(row, 1, 1, payload.length).setValues([payload]);
  } else {
    sheet.appendRow(payload);
  }

  return true;
}

function AE_normalizeAssignmentLead_(lead) {
  const leadId = String(
    lead.LeadID ||
    lead.leadId ||
    ""
  ).trim() || AE_uuid_("LEAD");

  return {
    LeadID: leadId,
    CreatedAt: lead.CreatedAt || lead.createdAt || timestamp_(),
    FirstName: String(lead.FirstName || lead.firstName || "").trim(),
    LastName: String(lead.LastName || lead.lastName || "").trim(),
    Email: AE_normalizeEmail_(lead.Email || lead.email),
    Phone: AE_normalizePhone_(lead.Phone || lead.phone),
    LeadType: String(
      lead.LeadType ||
      lead.leadType ||
      ""
    ).trim().toUpperCase(),
    Parish: String(
      lead.Parish ||
      lead.parish ||
      ""
    ).trim().toUpperCase(),
    Source: String(lead.Source || lead.source || "").trim(),
    AssignedAgentID: String(
      lead.AssignedAgentID ||
      lead.assignedAgentId ||
      ""
    ).trim()
  };
}

function AE_assignLeadById(leadId) {
  const row = AE_findRowByValue_(
    AE.SHEETS.LEADS,
    "LeadID",
    leadId
  );

  if (!row) {
    throw new Error("Lead not found: " + leadId);
  }

  const sheet = workbook_().getSheetByName(AE.SHEETS.LEADS);
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const values = sheet
    .getRange(row, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const lead = {};

  headers.forEach(function(header, index) {
    lead[header] = values[index];
  });

  return AE_assignLead(lead);
}

function AE_processUnassignedLeads(limit) {
  AE_assertNotPaused_();

  const max = Math.max(1, Number(limit || 25));
  const leads = AE_sheetObjects_(AE.SHEETS.LEADS);

  const candidates = leads.filter(function(lead) {
    const status = String(lead.Status || "").toUpperCase();
    const assigned = String(lead.AssignedAgentID || "").trim();

    return !assigned &&
      ["", "NEW", "UNASSIGNED", "PENDING"].indexOf(status) !== -1;
  }).slice(0, max);

  const results = [];

  candidates.forEach(function(lead) {
    try {
      results.push(AE_assignLead(lead));
    } catch (error) {
      AE_log_(
        "BATCH_ASSIGNMENT_ERROR",
        error.message || String(error),
        lead.LeadID,
        ""
      );

      results.push({
        success: false,
        leadId: lead.LeadID,
        error: error.message || String(error)
      });
    }
  });

  return {
    success: true,
    processed: results.length,
    assigned: results.filter(function(r) {
      return r.success;
    }).length,
    failed: results.filter(function(r) {
      return !r.success;
    }).length,
    results: results
  };
}

function AE_getAssignmentSummary() {
  return {
    mode: AE_getMode(),
    leads: AE_sheetObjects_(AE.SHEETS.LEADS).length,
    assignments: AE_sheetObjects_(AE.SHEETS.ASSIGNMENTS).length,
    shadowResults: AE_sheetObjects_(AE.SHEETS.SHADOW).length,
    locks: AE_getLeadLockSummary()
  };
}

function AE_testAssignmentEngine() {
  AE_initializeConfig();
  AE_setShadowMode();

  AE_upsertAgent({
    AgentID: "AGT-ASSIGNMENT-TEST",
    AgentName: "Assignment Test Agent",
    Email: "assignment-test@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "ASSIGNMENT TEST PARISH",
    LeadTypes: "BUYER",
    Priority: 1,
    DailyCap: 999
  });

  const result = AE_assignLead({
    LeadID: "LEAD-ASSIGNMENT-TEST",
    FirstName: "Assignment",
    LastName: "Test",
    Email: "assignment-lead-test@example.com",
    Phone: "(985) 555-0166",
    LeadType: "BUYER",
    Parish: "ASSIGNMENT TEST PARISH",
    Source: "SELF_TEST"
  });

  if (
    !result.success ||
    result.mode !== "SHADOW" ||
    result.committed !== false
  ) {
    throw new Error("Assignment Engine self-test failed.");
  }

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(AE_getAssignmentSummary()));

  return true;
}
