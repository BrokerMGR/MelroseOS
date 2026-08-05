/******************************************************************************
 * MelroseOS CRM Universal Intake Processor
 * CRM-01_UniversalIntakeProcessor.gs
 * Version 2.0.1
 ******************************************************************************/

const UIX = {
  VERSION: "2.0.1",
  INTAKE_SHEET: "LI_INTAKE",
  SOURCE_EVENTS_SHEET: "UI_SOURCE_EVENTS",
  LEADS_SHEET: "AE_LEADS",
  AGENTS_SHEET: "AE_AGENTS",
  MAX_ROWS_PER_RUN: 25
};

function UIX_runUniversalIntakeProcessor() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const intakeSheet = ss.getSheetByName(UIX.INTAKE_SHEET);

  if (!intakeSheet) {
    throw new Error("Missing sheet: " + UIX.INTAKE_SHEET);
  }

  const stats = {
    success: true,
    version: UIX.VERSION,
    candidates: 0,
    processed: 0,
    acknowledged: 0,
    pendingAssignment: 0,
    pendingDistribution: 0,
    errors: 0
  };

  const rows = UIX_objects_(intakeSheet)
    .filter(function(row) {
      const status = String(
        row.ProcessingStatus ||
        row.QueueStatus ||
        row.IntakeStatus ||
        row.Status ||
        ""
      ).toUpperCase();

      return [
        "QUEUED",
        "NEW",
        "PENDING",
        "RETRY",
        "PENDING_ASSIGNMENT",
        "PENDING_DISTRIBUTION"
      ].indexOf(status) !== -1;
    })
    .slice(0, UIX.MAX_ROWS_PER_RUN);

  rows.forEach(function(intake) {
    stats.candidates++;

    try {
      const result = UIX_processIntakeRow_(intake);

      if (result.status === "ACKNOWLEDGED") {
        stats.processed++;
        stats.acknowledged++;
      } else if (result.status === "PENDING_ASSIGNMENT") {
        stats.pendingAssignment++;
      } else if (result.status === "PENDING_DISTRIBUTION") {
        stats.pendingDistribution++;
      }
    } catch (error) {
      stats.errors++;

      UIX_updateRow_(intakeSheet, intake.__rowNumber, {
        ProcessingStatus: "ERROR",
        QueueStatus: "ERROR",
        IntakeStatus: "ERROR",
        Error: String(error && error.stack ? error.stack : error),
        UpdatedAt: new Date()
      });

      UIX_updateSourceEvent_(intake.SourceEventID, {
        Status: "CRM_ERROR",
        CommunicationStatus: "BLOCKED_CRM_ERROR",
        Error: String(error && error.stack ? error.stack : error),
        UpdatedAt: new Date()
      });
    }
  });

  Logger.log(JSON.stringify(stats, null, 2));
  return stats;
}

function UIX_processIntakeRow_(intake) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const intakeSheet = ss.getSheetByName(UIX.INTAKE_SHEET);

  UIX_updateRow_(intakeSheet, intake.__rowNumber, {
    ProcessingStatus: "PROCESSING",
    QueueStatus: "PROCESSING",
    IntakeStatus: "PROCESSING",
    Error: "",
    UpdatedAt: new Date()
  });

  UIX_updateSourceEvent_(intake.SourceEventID, {
    Status: "CRM_PROCESSING",
    CommunicationStatus: "BLOCKED_PENDING_CRM_ACK",
    Error: "",
    UpdatedAt: new Date()
  });

  const leadId = UIX_createOrUpdateLead_(intake);

  UIX_runAvailableFunctions_([
    "AE_processPendingAssignments",
    "AE_runAssignmentEngine",
    "AE_processAssignmentQueue",
    "LI_processAssignmentQueue",
    "OP_runOperationsCycle"
  ]);

  const verification = UIX_verifyLeadState_(leadId);

  if (!verification.assigned) {
    UIX_setPending_(
      intakeSheet,
      intake,
      leadId,
      "PENDING_ASSIGNMENT",
      "Lead exists in AE_LEADS but assignment is incomplete."
    );

    return { success: true, status: "PENDING_ASSIGNMENT", leadId: leadId };
  }

  UIX_runAvailableFunctions_([
    "LI_processDistributionQueue",
    "AE_processDistributionQueue",
    "LI_processAgentDistributionQueue",
    "PORTAL_processQueue",
    "LC_runLifecycleCycle",
    "CG_runCommunicationGovernor"
  ]);

  const afterDistribution = UIX_verifyLeadState_(leadId);

  if (!afterDistribution.distributed) {
    UIX_setPending_(
      intakeSheet,
      intake,
      leadId,
      "PENDING_DISTRIBUTION",
      "Lead is assigned but assigned-agent distribution is not verified."
    );

    return { success: true, status: "PENDING_DISTRIBUTION", leadId: leadId };
  }

  UIX_updateRow_(intakeSheet, intake.__rowNumber, {
    LeadID: leadId,
    ProcessingStatus: "COMPLETED",
    QueueStatus: "COMPLETED",
    IntakeStatus: "COMPLETED",
    AcknowledgementStatus: "ACKNOWLEDGED",
    ProcessedAt: new Date(),
    Error: "",
    UpdatedAt: new Date()
  });

  UIX_updateSourceEvent_(intake.SourceEventID, {
    Status: "CRM_ACKNOWLEDGED",
    LeadID: leadId,
    AssignmentStatus: "ASSIGNED",
    AgentSheetStatus: "VERIFIED",
    CommunicationStatus: "GOVERNOR_REQUIRED",
    ProcessedAt: new Date(),
    Error: "",
    UpdatedAt: new Date()
  });

  return { success: true, status: "ACKNOWLEDGED", leadId: leadId };
}

function UIX_createOrUpdateLead_(intake) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const leadsSheet = ss.getSheetByName(UIX.LEADS_SHEET);

  if (!leadsSheet) {
    throw new Error("Missing sheet: " + UIX.LEADS_SHEET);
  }

  const rows = UIX_objects_(leadsSheet);
  const email = UIX_normalizeEmail_(intake.Email);
  const phone = UIX_normalizePhone_(intake.Phone);

  let existing = null;

  for (let i = rows.length - 1; i >= 0; i--) {
    const rowEmail = UIX_normalizeEmail_(rows[i].Email);
    const rowPhone = UIX_normalizePhone_(rows[i].Phone);

    if (
      (intake.LeadID &&
       String(rows[i].LeadID || "") === String(intake.LeadID)) ||
      (email && rowEmail === email) ||
      (phone && rowPhone === phone)
    ) {
      existing = rows[i];
      break;
    }
  }

  const leadId =
    existing && existing.LeadID
      ? String(existing.LeadID)
      : String(intake.LeadID || UIX_uuid_("L"));

  const payload = {
    LeadID: leadId,
    LeadType: intake.LeadType || intake.Type || intake.Category || "",
    FullName: intake.FullName || "",
    FirstName: intake.FirstName || "",
    LastName: intake.LastName || "",
    Email: intake.Email || "",
    Phone: intake.Phone || "",
    Parish: intake.Parish || intake.ParishNeeded || "",
    CityOrArea: intake.CityOrArea || "",
    Timeline: intake.Timeline || "",
    PriceRangeOrRentBudget: intake.PriceRangeOrRentBudget || "",
    Bedrooms: intake.Bedrooms || "",
    Bathrooms: intake.Bathrooms || "",
    FinancingStatus: intake.FinancingStatus || "",
    PropertyToSellAddress: intake.PropertyToSellAddress || "",
    NotesFromLead: intake.NotesFromLead || "",
    Source: intake.Source || "GMAIL_MGR_NEW_LEADS",
    SourceCampaign: intake.SourceCampaign || "GMAIL_MGR_NEW_LEADS",
    SourceEventID: intake.SourceEventID || "",
    Status: existing ? (existing.Status || "NEW") : "NEW",
    CreatedAt: existing ? existing.CreatedAt : new Date(),
    UpdatedAt: new Date(),
    RawJson: intake.RawJson || ""
  };

  if (existing) {
    UIX_updateRow_(leadsSheet, existing.__rowNumber, payload);
  } else {
    UIX_appendRow_(leadsSheet, payload);
  }

  return leadId;
}

function UIX_verifyLeadState_(leadId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const leadsSheet = ss.getSheetByName(UIX.LEADS_SHEET);

  const lead = UIX_objects_(leadsSheet).find(function(row) {
    return String(row.LeadID || "") === String(leadId || "");
  });

  if (!lead) {
    return { assigned: false, distributed: false };
  }

  const assignedAgentId = String(lead.AssignedAgentID || "").trim();
  const assignedAgentName = String(lead.AssignedAgentName || "").trim();
  const assigned = !!assignedAgentId || !!assignedAgentName;

  const directSignals = [
    lead.AgentSheetStatus,
    lead.DistributionStatus,
    lead.AssignedSheetStatus,
    lead.AgentWorkbookStatus
  ].map(function(value) {
    return String(value || "").toUpperCase();
  });

  const distributed =
    directSignals.some(function(value) {
      return [
        "VERIFIED",
        "COMPLETED",
        "DISTRIBUTED",
        "SYNCED",
        "SUCCESS"
      ].indexOf(value) !== -1;
    }) ||
    !!lead.DistributedAt ||
    !!lead.AgentSheetUpdatedAt ||
    !!lead.AssignedWorkbookUpdatedAt;

  return { assigned: assigned, distributed: distributed, lead: lead };
}

function UIX_setPending_(intakeSheet, intake, leadId, status, message) {
  UIX_updateRow_(intakeSheet, intake.__rowNumber, {
    LeadID: leadId,
    ProcessingStatus: status,
    QueueStatus: status,
    IntakeStatus: status,
    AcknowledgementStatus: "PENDING",
    Error: message,
    UpdatedAt: new Date()
  });

  UIX_updateSourceEvent_(intake.SourceEventID, {
    Status: "CRM_PROCESSING",
    LeadID: leadId,
    AssignmentStatus:
      status === "PENDING_ASSIGNMENT" ? "PENDING" : "ASSIGNED",
    AgentSheetStatus:
      status === "PENDING_DISTRIBUTION" ? "PENDING" : "",
    CommunicationStatus: "BLOCKED_PENDING_CRM_ACK",
    Error: message,
    UpdatedAt: new Date()
  });
}

function UIX_runAvailableFunctions_(names) {
  names.forEach(function(name) {
    try {
      const fn = globalThis[name];
      if (typeof fn === "function") {
        fn();
      }
    } catch (error) {
      console.warn(name + " skipped: " + error);
    }
  });
}

function UIX_updateSourceEvent_(sourceEventId, payload) {
  if (!sourceEventId) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(UIX.SOURCE_EVENTS_SHEET);

  if (!sheet) return;

  const existing = UIX_objects_(sheet).find(function(row) {
    return String(row.SourceEventID || "") === String(sourceEventId);
  });

  if (!existing) return;

  UIX_updateRow_(sheet, existing.__rowNumber, payload);
}

function UIX_headers_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];

  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(function(value) {
      return String(value || "").trim();
    });
}

function UIX_objects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const headers = UIX_headers_(sheet);
  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues();

  return values.map(function(row, rowIndex) {
    const object = { __rowNumber: rowIndex + 2 };

    headers.forEach(function(header, columnIndex) {
      object[header] = row[columnIndex];
    });

    return object;
  });
}

function UIX_appendRow_(sheet, payload) {
  const headers = UIX_headers_(sheet);

  sheet.appendRow(
    headers.map(function(header) {
      return payload[header] !== undefined ? payload[header] : "";
    })
  );
}

function UIX_updateRow_(sheet, rowNumber, payload) {
  const headers = UIX_headers_(sheet);
  const current = sheet
    .getRange(rowNumber, 1, 1, headers.length)
    .getValues()[0];

  const updated = headers.map(function(header, index) {
    return payload[header] !== undefined
      ? payload[header]
      : current[index];
  });

  sheet
    .getRange(rowNumber, 1, 1, headers.length)
    .setValues([updated]);
}

function UIX_normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function UIX_normalizePhone_(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function UIX_uuid_(prefix) {
  return String(prefix || "ID") + "_" +
    Utilities.getUuid()
      .replace(/-/g, "")
      .substring(0, 20)
      .toUpperCase();
}
