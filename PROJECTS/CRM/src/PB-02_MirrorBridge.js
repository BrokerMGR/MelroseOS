/******************************************************************************
 * MelroseOS Enterprise
 * Production Lead Intake Bridge
 * File: PB-02_MirrorBridge.gs
 * Version: 1.2.0
 *
 * COMPLETE FULL OVERWRITE
 *
 * Purpose:
 *   Mirror leads already delivered by the working production system from each
 *   active agent's linked Leads sheet into LI_INTAKE and AE_LEADS.
 *
 * Header mapping:
 *   FullName       -> FirstName + LastName
 *   ParishNeeded   -> Parish
 *   SourceCampaign -> Source
 *
 * Safety:
 *   - Does NOT send email.
 *   - Does NOT assign/reassign agents.
 *   - Does NOT modify /book-now.
 *   - Does NOT modify the master lead sheet.
 *   - Does NOT modify agent lead delivery.
 ******************************************************************************/

function PB_runProductionMirrorCycle() {
  PB_initialize();

  const ss = workbook_();
  const agentsSheet = ss.getSheetByName(PB.AGENT_SHEET);

  if (!agentsSheet) {
    throw new Error("Missing required sheet: " + PB.AGENT_SHEET);
  }

  const agents = PB_objects_(agentsSheet).filter(function(agent) {
    const active =
      String(agent.Active || "").trim().toUpperCase() === "TRUE";

    const accepting =
      String(agent.AcceptingLeads || "").trim().toUpperCase() === "TRUE";

    const linkedId = PB_firstValue_(agent, [
      "AgentLeadsSheetId",
      "LeadsSheetId",
      "LeadSheetId"
    ]);

    return active && accepting && String(linkedId || "").trim() !== "";
  });

  const summary = {
    success: true,
    agentsScanned: 0,
    sourceRowsScanned: 0,
    mirrored: 0,
    duplicatesSkipped: 0,
    errors: 0,
    errorDetails: []
  };

  agents.forEach(function(agent) {
    summary.agentsScanned++;

    try {
      const result = PB_scanAgentWorkbook_(agent);

      summary.sourceRowsScanned += result.rowsScanned;
      summary.mirrored += result.mirrored;
      summary.duplicatesSkipped += result.duplicatesSkipped;

    } catch (error) {
      summary.errors++;
      summary.success = false;

      const details = error.message || String(error);
      summary.errorDetails.push(
        String(agent.AgentName || agent.AgentID || "Unknown Agent") +
        ": " +
        details
      );

      PB_log_(
        {LeadID: ""},
        agent,
        PB_firstValue_(agent, [
          "AgentLeadsSheetId",
          "LeadsSheetId",
          "LeadSheetId"
        ]),
        "",
        "ERROR",
        details
      );
    }
  });

  return summary;
}

function PB_scanAgentWorkbook_(agent) {
  const sourceId = String(
    PB_firstValue_(agent, [
      "AgentLeadsSheetId",
      "LeadsSheetId",
      "LeadSheetId"
    ]) || ""
  ).trim();

  if (!sourceId) {
    return {
      rowsScanned: 0,
      mirrored: 0,
      duplicatesSkipped: 0
    };
  }

  const sourceSS = SpreadsheetApp.openById(sourceId);

  const sourceSheet =
    sourceSS.getSheetByName("Leads") ||
    sourceSS.getSheetByName("LEADS") ||
    sourceSS.getSheets()[0];

  if (!sourceSheet) {
    throw new Error(
      "No lead sheet found in linked agent workbook " + sourceId
    );
  }

  if (sourceSheet.getLastRow() < 2) {
    return {
      rowsScanned: 0,
      mirrored: 0,
      duplicatesSkipped: 0
    };
  }

  const state = PB_getState_(
    agent.AgentID,
    sourceId,
    sourceSheet.getName()
  );

  const startRow = Math.max(
    2,
    Number(state.LastProcessedRow || 1) + 1
  );

  const lastRow = sourceSheet.getLastRow();

  if (startRow > lastRow) {
    return {
      rowsScanned: 0,
      mirrored: 0,
      duplicatesSkipped: 0
    };
  }

  const lastColumn = sourceSheet.getLastColumn();

  const headers = sourceSheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function(value) {
      return String(value || "").trim();
    });

  const values = sourceSheet
    .getRange(
      startRow,
      1,
      lastRow - startRow + 1,
      lastColumn
    )
    .getValues();

  let mirrored = 0;
  let duplicatesSkipped = 0;

  values.forEach(function(row, offset) {
    const sourceRowNumber = startRow + offset;
    const obj = {};

    headers.forEach(function(header, i) {
      obj[header] = row[i];
    });

    const lead = PB_normalizeSourceLead_(obj, agent);

    if (!lead.Email && !lead.Phone && !lead.LeadID) {
      PB_setState_(
        agent.AgentID,
        sourceId,
        sourceSheet.getName(),
        sourceRowNumber
      );
      return;
    }

    const result = PB_mirrorProductionLead(lead);

    if (result.duplicate) {
      duplicatesSkipped++;
    } else if (result.success) {
      mirrored++;
    }

    PB_setState_(
      agent.AgentID,
      sourceId,
      sourceSheet.getName(),
      sourceRowNumber
    );
  });

  return {
    rowsScanned: values.length,
    mirrored: mirrored,
    duplicatesSkipped: duplicatesSkipped
  };
}

function PB_normalizeSourceLead_(obj, agent) {
  const fullName = String(
    PB_firstValue_(obj, [
      "FullName",
      "LeadName",
      "Name",
      "ClientName"
    ]) || ""
  ).trim();

  const nameParts = PB_splitFullName_(fullName);

  const createdAt =
    PB_firstValue_(obj, [
      "CreatedAt",
      "ReceivedAt",
      "Timestamp"
    ]) || new Date();

  const lead = {
    LeadID: PB_firstValue_(obj, [
      "LeadID",
      "Lead Id",
      "Lead ID",
      "ID"
    ]),

    FullName: fullName,

    FirstName:
      PB_firstValue_(obj, [
        "FirstName",
        "First Name"
      ]) || nameParts.firstName,

    LastName:
      PB_firstValue_(obj, [
        "LastName",
        "Last Name"
      ]) || nameParts.lastName,

    Email: PB_firstValue_(obj, [
      "Email",
      "LeadEmail",
      "ClientEmail"
    ]),

    Phone: PB_firstValue_(obj, [
      "Phone",
      "LeadPhone",
      "ClientPhone"
    ]),

    LeadType: PB_firstValue_(obj, [
      "LeadType",
      "Type",
      "Category"
    ]),

    Parish: PB_firstValue_(obj, [
      "Parish",
      "ParishNeeded",
      "Area",
      "County"
    ]),

    Source: PB_firstValue_(obj, [
      "Source",
      "SourceCampaign",
      "LeadSource"
    ]) || "PRODUCTION_AGENT_WORKBOOK",

    Status: PB_firstValue_(obj, [
      "Status",
      "LeadStatus"
    ]) || "ASSIGNED",

    AssignmentReason: PB_firstValue_(obj, [
      "AssignmentReason"
    ]),

    AssignedAgentID:
      PB_firstValue_(obj, [
        "AssignedAgentID"
      ]) ||
      agent.AgentID ||
      "",

    AssignedAgentName:
      PB_firstValue_(obj, [
        "AssignedAgentName"
      ]) ||
      agent.AgentName ||
      "",

    AssignedAgentEmail:
      PB_firstValue_(obj, [
        "AssignedAgentEmail"
      ]) ||
      agent.Email ||
      agent.AgentEmail ||
      "",

    CreatedAt: createdAt,

    AssignedAt:
      PB_firstValue_(obj, [
        "AssignedAt"
      ]) ||
      createdAt
  };

  if (!lead.LeadID) {
    lead.LeadID = PB_makeLeadID_({
      Email: lead.Email,
      Phone: lead.Phone,
      Name: lead.FullName
    });
  }

  return lead;
}

function PB_splitFullName_(fullName) {
  const clean = String(fullName || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!clean) {
    return {
      firstName: "",
      lastName: ""
    };
  }

  const parts = clean.split(" ");

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: ""
    };
  }

  return {
    firstName: parts.shift(),
    lastName: parts.join(" ")
  };
}

function PB_mirrorProductionLead(payload) {
  PB_initialize();

  const lead = Object.assign({}, payload || {});

  lead.Email = PB_normalizeEmail_(lead.Email);
  lead.Phone = PB_normalizePhone_(lead.Phone);

  if (!lead.LeadID) {
    lead.LeadID = PB_makeLeadID_({
      Email: lead.Email,
      Phone: lead.Phone,
      Name:
        lead.FullName ||
        (
          String(lead.FirstName || "") +
          " " +
          String(lead.LastName || "")
        ).trim()
    });
  }

  const duplicate = PB_findExistingLead_(lead);

  if (duplicate) {
    PB_log_(
      lead,
      {
        AgentID: lead.AssignedAgentID,
        AgentName: lead.AssignedAgentName
      },
      "",
      "",
      "DUPLICATE_SKIPPED",
      "Lead already exists in LI_INTAKE or AE_LEADS."
    );

    return {
      success: true,
      duplicate: true,
      leadId: lead.LeadID
    };
  }

  const now = new Date();

  const systemValues = {
    LeadID: lead.LeadID,
    CreatedAt: lead.CreatedAt || now,
    FirstName: lead.FirstName || "",
    LastName: lead.LastName || "",
    Email: lead.Email,
    Phone: lead.Phone,
    LeadType: lead.LeadType,
    Parish: lead.Parish,
    Source: lead.Source,
    Status: lead.Status || "ASSIGNED",
    AssignedAgentID: lead.AssignedAgentID,
    AssignedAgentName: lead.AssignedAgentName,
    AssignedAt: lead.AssignedAt || now,
    AssignmentReason: lead.AssignmentReason || "",
    UpdatedAt: now
  };

  const intakeValues = Object.assign(
    {},
    systemValues,
    {
      Status: "PROCESSED"
    }
  );

  PB_appendMapped_(
    workbook_().getSheetByName(PB.INTAKE_SHEET),
    intakeValues
  );

  PB_appendMapped_(
    workbook_().getSheetByName(PB.LEADS_SHEET),
    systemValues
  );

  PB_log_(
    lead,
    {
      AgentID: lead.AssignedAgentID,
      AgentName: lead.AssignedAgentName
    },
    "",
    "",
    "MIRRORED",
    "Production lead mirrored to LI_INTAKE and AE_LEADS with corrected header mapping."
  );

  return {
    success: true,
    duplicate: false,
    leadId: lead.LeadID
  };
}

function PB_findExistingLead_(lead) {
  const targets = [
    workbook_().getSheetByName(PB.INTAKE_SHEET),
    workbook_().getSheetByName(PB.LEADS_SHEET)
  ];

  return targets.some(function(sheet) {
    if (!sheet || sheet.getLastRow() < 2) {
      return false;
    }

    const rows = PB_objects_(sheet);

    return rows.some(function(row) {
      const rowId = String(
        PB_firstValue_(row, [
          "LeadID",
          "Lead Id",
          "Lead ID",
          "ID"
        ]) || ""
      ).trim();

      const email = PB_normalizeEmail_(
        PB_firstValue_(row, [
          "Email",
          "LeadEmail"
        ])
      );

      const phone = PB_normalizePhone_(
        PB_firstValue_(row, [
          "Phone",
          "LeadPhone"
        ])
      );

      return (
        (
          rowId &&
          rowId === String(lead.LeadID || "").trim()
        ) ||
        (
          lead.Email &&
          email === lead.Email
        ) ||
        (
          lead.Phone &&
          phone === lead.Phone
        )
      );
    });
  });
}

function PB_appendMapped_(sheet, values) {
  if (!sheet) {
    throw new Error(
      "Required destination sheet is missing."
    );
  }

  const headers = sheet
    .getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    )
    .getDisplayValues()[0]
    .map(function(value) {
      return String(value || "").trim();
    });

  const row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(
      values,
      header
    )
      ? values[header]
      : "";
  });

  sheet.appendRow(row);
}

function PB_getState_(agentId, sourceId, sourceSheet) {
  const sheet = workbook_().getSheetByName(PB.SHEETS.STATE);
  const rows = PB_objects_(sheet);

  const match = rows.find(function(row) {
    return (
      String(row.AgentID || "") === String(agentId || "") &&
      String(row.SourceWorkbookID || "") === String(sourceId || "") &&
      String(row.SourceSheet || "") === String(sourceSheet || "")
    );
  });

  return match || {
    AgentID: agentId,
    SourceWorkbookID: sourceId,
    SourceSheet: sourceSheet,
    LastProcessedRow: 1
  };
}

function PB_setState_(agentId, sourceId, sourceSheet, rowNumber) {
  const sheet = workbook_().getSheetByName(PB.SHEETS.STATE);
  const rows = PB_objects_(sheet);

  const match = rows.find(function(row) {
    return (
      String(row.AgentID || "") === String(agentId || "") &&
      String(row.SourceWorkbookID || "") === String(sourceId || "") &&
      String(row.SourceSheet || "") === String(sourceSheet || "")
    );
  });

  if (match) {
    sheet.getRange(match._row, 4).setValue(rowNumber);
    sheet.getRange(match._row, 5).setValue(new Date());
  } else {
    sheet.appendRow([
      agentId,
      sourceId,
      sourceSheet,
      rowNumber,
      new Date()
    ]);
  }
}

/**
 * Repair helper:
 * Move the mirror cursor backward by one row for each active linked agent.
 * Use only after deploying v1.2 if the most recent test lead was written to
 * the agent sheet while the mirror bridge was broken.
 */
function PB_rewindOneRowForActiveAgents() {
  PB_initialize();

  const agentsSheet = workbook_().getSheetByName(PB.AGENT_SHEET);

  const agents = PB_objects_(agentsSheet).filter(function(agent) {
    return (
      String(agent.Active || "").trim().toUpperCase() === "TRUE" &&
      String(agent.AcceptingLeads || "").trim().toUpperCase() === "TRUE"
    );
  });

  const stateSheet = workbook_().getSheetByName(PB.SHEETS.STATE);
  const states = PB_objects_(stateSheet);
  let changed = 0;

  agents.forEach(function(agent) {
    const linkedId = String(
      PB_firstValue_(agent, [
        "AgentLeadsSheetId",
        "LeadsSheetId",
        "LeadSheetId"
      ]) || ""
    ).trim();

    if (!linkedId) {
      return;
    }

    states.forEach(function(state) {
      if (
        String(state.AgentID || "") === String(agent.AgentID || "") &&
        String(state.SourceWorkbookID || "") === linkedId
      ) {
        const current = Math.max(
          1,
          Number(state.LastProcessedRow || 1)
        );

        stateSheet
          .getRange(state._row, 4)
          .setValue(
            Math.max(1, current - 1)
          );

        stateSheet
          .getRange(state._row, 5)
          .setValue(new Date());

        changed++;
      }
    });
  });

  return {
    success: true,
    statesRewound: changed
  };
}
