/******************************************************************************
 * MelroseOS Client Intelligence Platform
 * CIP-09_RealtimeSyncBridge.gs
 * Version 2.0.0
 *
 * Agent linked Leads sheets are the primary HUMAN EDIT source for client data.
 * CRM AE_LEADS remains system-of-record for routing/assignment fields.
 * PORTAL_PROFILES remains the client-facing profile store.
 ******************************************************************************/

const CIP_RT = {
  VERSION: "2.0.0",
  AGENT_SHEET_NAMES: ["Leads","LEADS","Agent Leads","AGENT LEADS"],
  AGENT_EDITABLE_FIELDS: [
    "FullName","Email","Phone","PreferredContactMethod","LeadType",
    "ParishNeeded","CityOrArea","Timeline","PriceRangeOrRentBudget",
    "Bedrooms","Bathrooms","FinancingStatus","PropertyToSellAddress",
    "ReasonForMoveOrSell","NotesFromLead","SourceCampaign",
    "BookingStatus","BookingLink","Status","LastTouchAt"
  ],
  PROTECTED_CRM_FIELDS: [
    "LeadID","CreatedAt","AssignedAgentID","AssignedAgentName",
    "AssignedAt","AssignmentReason"
  ]
};

function CIP_RT_installRealtimeSyncBridge() {
  CIP_initializePlatform();
  return CIP_RT_reconcileRealtimeTriggers();
}

function CIP_RT_onSourceEdit(e) {
  try {
    if (!e || !e.range || !e.source || e.range.getRow() < 2) return;

    const sheet = e.range.getSheet();
    const sourceId = e.source.getId();

    if (sourceId === CIP.WORKBOOKS.CRM) {
      CIP_RT_handleCrmEdit_(e);
      return;
    }

    if (CIP_RT.AGENT_SHEET_NAMES.indexOf(sheet.getName()) !== -1) {
      CIP_RT_handleAgentLeadEdit_(e);
    }
  } catch (error) {
    console.error("CIP_RT_onSourceEdit: " + error);
  }
}

function CIP_RT_handleCrmEdit_(e) {
  const sheet = e.range.getSheet();

  if (sheet.getName() === "AE_AGENTS") {
    CIP_RT_reconcileRealtimeTriggers();
    return;
  }

  if (sheet.getName() !== "AE_LEADS") return;

  const lead = CIP_RT_rowObject_(sheet, e.range.getRow());
  if (!lead || !lead.LeadID) return;

  CIP_RT_syncLeadNow_(String(lead.LeadID), {
    source: "CRM_AE_LEADS",
    directDetail: null
  });
}

function CIP_RT_handleAgentLeadEdit_(e) {
  const sheet = e.range.getSheet();
  const editedField = CIP_RT_headerAtColumn_(sheet, e.range.getColumn());

  if (
    editedField &&
    CIP_RT.AGENT_EDITABLE_FIELDS.indexOf(editedField) === -1
  ) return;

  const detail = CIP_RT_rowObject_(sheet, e.range.getRow());
  if (!detail) return;

  const lead = CIP_RT_findMasterLeadForDetail_(detail);

  if (!lead || !lead.LeadID) {
    CIP_RT_logSystemEvent_(
      detail.LeadID || "",
      "UNMATCHED_AGENT_EDIT",
      {
        sourceSpreadsheetId: e.source.getId(),
        sourceSheet: sheet.getName(),
        email: detail.Email || "",
        phone: detail.Phone || ""
      }
    );
    return;
  }

  CIP_RT_pushAgentEditToCrm_(lead, detail, editedField);

  CIP_RT_syncLeadNow_(String(lead.LeadID), {
    source: "AGENT_MASTER_AUTHORITATIVE",
    editedField: editedField || "",
    sourceSpreadsheetId: e.source.getId(),
    sourceSheet: sheet.getName(),
    directDetail: detail
  });
}

function CIP_RT_pushAgentEditToCrm_(masterLead, detail, editedField) {
  const sheet = CIP_crmWorkbook_().getSheetByName("AE_LEADS");
  if (!sheet) throw new Error("Missing CRM sheet AE_LEADS.");

  const headers = sheet
    .getRange(1,1,1,sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(function(v){ return String(v || "").trim(); });

  const live = CIP_objects_(sheet).find(function(row) {
    return String(row.LeadID || "") === String(masterLead.LeadID || "");
  });

  if (!live) {
    return {success:false, reason:"CRM_LEAD_NOT_FOUND"};
  }

  const updates = {};

  if (!editedField || editedField === "FullName") {
    const name = CIP_RT_splitFullName_(detail.FullName || "");
    updates.FirstName = name.firstName;
    updates.LastName = name.lastName;
  }

  if (!editedField || editedField === "Email") {
    updates.Email = detail.Email || "";
  }

  if (!editedField || editedField === "Phone") {
    updates.Phone = detail.Phone || "";
  }

  if (!editedField || editedField === "LeadType") {
    updates.LeadType = detail.LeadType || "";
  }

  if (!editedField || editedField === "ParishNeeded") {
    updates.Parish = detail.ParishNeeded || "";
  }

  if (!editedField || editedField === "SourceCampaign") {
    updates.Source = detail.SourceCampaign || "";
  }

  if (!editedField || editedField === "Status") {
    updates.Status = detail.Status || "";
  }

  updates.UpdatedAt = new Date();

  Object.keys(updates).forEach(function(field) {
    if (CIP_RT.PROTECTED_CRM_FIELDS.indexOf(field) !== -1) return;

    const column = headers.indexOf(field) + 1;
    if (column > 0) {
      sheet.getRange(live._row, column).setValue(updates[field]);
    }
  });

  return {
    success:true,
    leadId:masterLead.LeadID,
    fieldsWritten:Object.keys(updates)
  };
}

function CIP_RT_syncLeadNow_(leadId, context) {
  const crm = CIP_crmWorkbook_();
  const site = CIP_websiteWorkbook_();

  const lead = CIP_objects_(crm.getSheetByName("AE_LEADS")).find(function(row) {
    return String(row.LeadID || "") === String(leadId || "");
  });

  if (!lead) {
    return {success:false, leadId:leadId, reason:"MASTER_LEAD_NOT_FOUND"};
  }

  const agent = CIP_objects_(crm.getSheetByName("AE_AGENTS")).find(function(row) {
    return String(row.AgentID || "") === String(lead.AssignedAgentID || "");
  }) || {};

  let registry = CIP_objects_(
    site.getSheetByName(CIP.SHEETS.REGISTRY)
  ).find(function(row) {
    return String(row.LeadID || "") === String(leadId || "");
  });

  if (!registry) {
    site.getSheetByName(CIP.SHEETS.REGISTRY).appendRow([
      CIP_uuid_("PORTAL"),
      leadId,
      CIP_generateToken_(),
      "ACTIVE",
      lead.LeadType || "",
      lead.AssignedAgentID || "",
      lead.AssignedAgentName || agent.AgentName || "",
      lead.AssignedAgentEmail || agent.Email || agent.AgentEmail || "",
      0,
      "NEW",
      "OPEN_DASHBOARD",
      "",
      new Date(),
      new Date()
    ]);
  }

  const detail =
    context && context.directDetail
      ? context.directDetail
      : (CIP_findDetailedLead_(lead, agent) || {});

  const profileSheet = site.getSheetByName(CIP.SHEETS.PROFILES);

  const existing = CIP_objects_(profileSheet).find(function(row) {
    return String(row.LeadID || "") === String(leadId || "");
  });

  CIP_upsertProfile_(profileSheet, existing, lead, detail, agent);

  CIP_RT_logSystemEvent_(
    leadId,
    "REALTIME_PROFILE_SYNC",
    context || {}
  );

  return {
    success:true,
    leadId:leadId,
    source:context && context.source ? context.source : "MANUAL"
  };
}

function CIP_RT_findMasterLeadForDetail_(detail) {
  const leads = CIP_objects_(
    CIP_crmWorkbook_().getSheetByName("AE_LEADS")
  );

  const id = String(detail.LeadID || "").trim();
  const email = CIP_normalizeEmail_(detail.Email);
  const phone = CIP_normalizePhone_(detail.Phone);

  return leads.find(function(lead) {
    return (
      (id && String(lead.LeadID || "") === id) ||
      (email && CIP_normalizeEmail_(lead.Email) === email) ||
      (phone && CIP_normalizePhone_(lead.Phone) === phone)
    );
  }) || null;
}

function CIP_RT_reconcileRealtimeTriggers() {
  const desired = CIP_RT_discoverSourceWorkbooks_();
  const desiredIds = {};

  desired.forEach(function(src) {
    desiredIds[src.spreadsheetId] = src;
  });

  const existingIds = {};

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() !== "CIP_RT_onSourceEdit") return;

    const sourceId = trigger.getTriggerSourceId();

    if (!sourceId || !desiredIds[sourceId]) {
      ScriptApp.deleteTrigger(trigger);
      return;
    }

    existingIds[sourceId] = true;
  });

  let created = 0;

  desired.forEach(function(src) {
    if (existingIds[src.spreadsheetId]) return;

    ScriptApp
      .newTrigger("CIP_RT_onSourceEdit")
      .forSpreadsheet(src.spreadsheetId)
      .onEdit()
      .create();

    created++;
  });

  const result = {
    success:true,
    version:CIP_RT.VERSION,
    desiredSources:desired.length,
    created:created,
    realtimeTriggers:
      ScriptApp.getProjectTriggers().filter(function(trigger) {
        return trigger.getHandlerFunction() === "CIP_RT_onSourceEdit";
      }).length
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function CIP_RT_discoverSourceWorkbooks_() {
  const sources = [{
    spreadsheetId:CIP.WORKBOOKS.CRM,
    type:"CRM_MASTER",
    name:"MelroseOS CRM"
  }];

  const agentSheet = CIP_crmWorkbook_().getSheetByName("AE_AGENTS");
  if (!agentSheet) return sources;

  const seen = {};
  seen[CIP.WORKBOOKS.CRM] = true;

  CIP_objects_(agentSheet).forEach(function(agent) {
    const activeValue = String(
      CIP_first_(agent, ["Active","IsActive","Status"]) || ""
    ).trim().toUpperCase();

    const active =
      activeValue === "TRUE" ||
      activeValue === "ACTIVE" ||
      activeValue === "YES" ||
      activeValue === "1";

    if (!active) return;

    const workbookId = String(
      CIP_first_(agent, [
        "AgentLeadsSheetId",
        "LeadsSheetId",
        "LeadSheetId"
      ]) || ""
    ).trim();

    if (!workbookId || seen[workbookId]) return;

    seen[workbookId] = true;

    sources.push({
      spreadsheetId:workbookId,
      type:"AGENT_LEADS",
      agentId:String(agent.AgentID || ""),
      name:String(
        CIP_first_(agent, ["AgentName","Name","FullName"]) ||
        "Agent Lead Workbook"
      )
    });
  });

  return sources;
}

function CIP_RT_getRealtimeSyncStatus() {
  const sources = CIP_RT_discoverSourceWorkbooks_();

  const result = {
    success:true,
    version:CIP_RT.VERSION,
    mode:"AGENT_MASTER_AUTHORITATIVE_HYBRID",
    primaryHumanEditSource:"AGENT_LINKED_LEADS_SHEETS",
    crmSystemOfRecord:"AE_LEADS",
    portalDestination:"PORTAL_PROFILES",
    sourceWorkbooksExpected:sources.length,
    realtimeTriggersInstalled:
      ScriptApp.getProjectTriggers().filter(function(trigger) {
        return trigger.getHandlerFunction() === "CIP_RT_onSourceEdit";
      }).length,
    protectedCrmFields:CIP_RT.PROTECTED_CRM_FIELDS,
    recoveryFunction:"CIP_syncLeadPortals",
    recoveryIntervalMinutes:5
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function CIP_RT_splitFullName_(fullName) {
  const clean = String(fullName || "").trim().replace(/\s+/g, " ");

  if (!clean) {
    return {firstName:"", lastName:""};
  }

  const parts = clean.split(" ");

  if (parts.length === 1) {
    return {firstName:parts[0], lastName:""};
  }

  return {
    firstName:parts.shift(),
    lastName:parts.join(" ")
  };
}

function CIP_RT_rowObject_(sheet, rowNumber) {
  if (!sheet || rowNumber < 2) return null;

  const headers = sheet
    .getRange(1,1,1,sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(function(v){ return String(v || "").trim(); });

  const values = sheet
    .getRange(rowNumber,1,1,sheet.getLastColumn())
    .getValues()[0];

  const obj = {};

  headers.forEach(function(header, index) {
    if (header) obj[header] = values[index];
  });

  return obj;
}

function CIP_RT_headerAtColumn_(sheet, column) {
  return String(
    sheet.getRange(1,column).getDisplayValue() || ""
  ).trim();
}

function CIP_RT_logSystemEvent_(leadId, type, metadata) {
  const site = CIP_websiteWorkbook_();
  const activity = site.getSheetByName(CIP.SHEETS.ACTIVITY);

  const registry = CIP_objects_(
    site.getSheetByName(CIP.SHEETS.REGISTRY)
  ).find(function(row) {
    return String(row.LeadID || "") === String(leadId || "");
  });

  activity.appendRow([
    CIP_uuid_("ACT"),
    leadId || "",
    registry ? registry.PortalToken : "",
    type,
    "",
    "SYSTEM",
    JSON.stringify(metadata || {}),
    new Date()
  ]);
}
