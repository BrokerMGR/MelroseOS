/******************************************************************************
 * MelroseOS Enterprise
 * Lead Intake Migration
 * File: LI-04_QueueProcessor.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Moves validated NEW intake records into AE_LEADS and runs the Assignment
 *   Engine. SHADOW mode remains non-destructive to production routing.
 *
 * Requires:
 *   LI-01 through LI-03
 *   AE-01 through AE-10
 ******************************************************************************/

function LI_checkQueueGuard_(){
  if(typeof MOS5D32_checkRoutingGate_ === "function"){
    return MOS5D32_checkRoutingGate_();
  }

  return {
    success:true,
    gate:"QUEUE_PROCESSING",
    status:"OPEN",
    checkedAt:timestamp_()
  };
}

function LI_processIntakeQueue(limit) {
  LI_initializeDedupeEngine();
  LI_checkQueueGuard_();
  AE_initializeConfig();

  const max = Math.max(1, Number(limit || 25));
  const rows = LI_sheetObjects_(LI.SHEETS.INTAKE)
    .filter(function(row) {
      return String(row.Status || "").toUpperCase() === "NEW" &&
        String(row.ValidationStatus || "").toUpperCase() === "VALID";
    })
    .slice(0, max);

  const results = [];

  rows.forEach(function(intake) {
    try {
      results.push(LI_processIntakeRecord_(intake));
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
        "QUEUE_PROCESSING_ERROR",
        intake.IntakeID,
        error.message || String(error),
        intake.LeadID
      );

      results.push({
        success: false,
        intakeId: intake.IntakeID,
        leadId: intake.LeadID,
        error: error.message || String(error)
      });
    }
  });

  return {
    success: true,
    processed: results.length,
    successful: results.filter(function(r) {
      return r.success;
    }).length,
    failed: results.filter(function(r) {
      return !r.success;
    }).length,
    mode: AE_getMode(),
    results: results
  };
}

function LI_processIntakeRecord_(intake) {
  LI_checkQueueGuard_();

  const lead = {
    LeadID: String(intake.LeadID || "").trim() || LI_uuid_("LEAD"),
    CreatedAt: intake.ReceivedAt || timestamp_(),
    FirstName: String(intake.FirstName || "").trim(),
    LastName: String(intake.LastName || "").trim(),
    Email: AE_normalizeEmail_(intake.Email || ""),
    Phone: AE_normalizePhone_(intake.Phone || ""),
    LeadType: String(intake.LeadType || "").trim().toUpperCase(),
    Parish: String(intake.Parish || "").trim().toUpperCase(),
    Source: String(intake.Source || "").trim(),
    Status: "NEW"
  };

  LI_upsertAELead_(lead);

  const assignment = AE_assignLead(lead);

  const assignedAgentId = assignment.success
    ? String(assignment.agentId || "")
    : "";

  LI_updateIntakeStatus_(
    intake._row,
    assignment.success ? "PROCESSED" : "UNASSIGNED",
    "VALID",
    assignment.reason || "",
    assignedAgentId,
    timestamp_()
  );

  LI_log_(
    assignment.success ? "QUEUE_PROCESSED" : "QUEUE_UNASSIGNED",
    intake.IntakeID,
    assignment.success
      ? "Lead processed through Assignment Engine in " +
        assignment.mode + " mode."
      : assignment.reason || "No assignment available.",
    lead.LeadID
  );

  return {
    success: assignment.success,
    intakeId: intake.IntakeID,
    leadId: lead.LeadID,
    mode: assignment.mode || AE_getMode(),
    agentId: assignedAgentId,
    agentName: assignment.agentName || "",
    method: assignment.method || "",
    reason: assignment.reason || ""
  };
}

function LI_upsertAELead_(lead) {
  const sheet = workbook_().getSheetByName(AE.SHEETS.LEADS);

  if (!sheet) {
    throw new Error("AE_LEADS sheet is missing.");
  }

  const row = AE_findRowByValue_(
    AE.SHEETS.LEADS,
    "LeadID",
    lead.LeadID
  );

  if (row) {
    return row;
  }

  sheet.appendRow([
    lead.LeadID,
    lead.CreatedAt,
    lead.FirstName,
    lead.LastName,
    lead.Email,
    lead.Phone,
    lead.LeadType,
    lead.Parish,
    lead.Source,
    "NEW",
    "",
    "",
    "",
    "",
    timestamp_()
  ]);

  return sheet.getLastRow();
}

function LI_updateIntakeStatus_(
  row,
  status,
  validationStatus,
  message,
  assignedAgentId,
  processedAt
) {
  const sheet = workbook_().getSheetByName(LI.SHEETS.INTAKE);

  if (!sheet || !row) {
    throw new Error("Intake row could not be updated.");
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  LI_setIntakeCell_(sheet, headers, row, "Status", status);
  LI_setIntakeCell_(sheet, headers, row, "ValidationStatus", validationStatus);
  LI_setIntakeCell_(sheet, headers, row, "ValidationMessage", message);
  LI_setIntakeCell_(sheet, headers, row, "AssignedAgentID", assignedAgentId);
  LI_setIntakeCell_(sheet, headers, row, "ProcessedAt", processedAt);
  LI_setIntakeCell_(sheet, headers, row, "UpdatedAt", timestamp_());

  return true;
}

function LI_setIntakeCell_(sheet, headers, row, headerName, value) {
  const col = headers.indexOf(headerName) + 1;

  if (!col) {
    throw new Error(
      "Header '" + headerName + "' not found in " + LI.SHEETS.INTAKE + "."
    );
  }

  sheet.getRange(row, col).setValue(value);
}

function LI_retryFailedQueue(limit) {
  LI_checkQueueGuard_();

  const max = Math.max(1, Number(limit || 25));

  const candidates = LI_sheetObjects_(LI.SHEETS.INTAKE)
    .filter(function(row) {
      const status = String(row.Status || "").toUpperCase();

      return status === "ERROR" || status === "UNASSIGNED";
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

  return LI_processIntakeQueue(max);
}

function LI_getQueueStatus() {
  const rows = LI_sheetObjects_(LI.SHEETS.INTAKE);

  const count = function(status) {
    return rows.filter(function(row) {
      return String(row.Status || "").toUpperCase() === status;
    }).length;
  };

  return {
    total: rows.length,
    new: count("NEW"),
    processed: count("PROCESSED"),
    duplicate: count("DUPLICATE"),
    rejected: count("REJECTED"),
    unassigned: count("UNASSIGNED"),
    error: count("ERROR"),
    assignmentMode: AE_getMode()
  };
}

function LI_testQueueProcessor() {
  LI_initializeDedupeEngine();
  AE_initializeConfig();
  AE_setShadowMode();

  AE_upsertAgent({
    AgentID: "AGT-LI-QUEUE-TEST",
    AgentName: "Lead Intake Queue Test Agent",
    Email: "li-queue-agent@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "QUEUE TEST PARISH",
    LeadTypes: "BUYER",
    Priority: 1,
    DailyCap: 999
  });

  const unique = Utilities.getUuid().substring(0, 8);

  const intake = LI_receiveLeadWithDedupe({
    FirstName: "Queue",
    LastName: "Test",
    Email: "li-queue-" + unique + "@example.com",
    Phone: "",
    LeadType: "BUYER",
    Parish: "QUEUE TEST PARISH",
    Source: "SELF_TEST"
  });

  if (!intake.success) {
    throw new Error("Queue Processor test intake failed.");
  }

  const result = LI_processIntakeQueue(100);

  const processed = result.results.some(function(row) {
    return row.leadId === intake.leadId && row.success;
  });

  if (!processed) {
    throw new Error("Lead Intake Queue Processor self-test failed.");
  }

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(LI_getQueueStatus()));

  return true;
}
