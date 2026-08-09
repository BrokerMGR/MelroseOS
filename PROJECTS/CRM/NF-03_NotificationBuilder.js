/******************************************************************************
 * MelroseOS Enterprise
 * Lead Notification & Follow-Up Migration
 * File: NF-03_NotificationBuilder.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Builds notification queue records from lead assignments and templates.
 *
 * Requires:
 *   NF-01_Core.gs
 *   NF-02_TemplateEngine.gs
 *   AE-01 through AE-10
 ******************************************************************************/

function NF_buildAssignmentNotifications(leadId) {
  NF_initializeTemplateEngine();

  const lead = NF_findLead_(leadId);
  if (!lead) throw new Error("Lead not found: " + leadId);

  const agentId = String(lead.AssignedAgentID || "").trim();
  const agent = agentId ? AE_getAgent(agentId) : null;

  if (!agent) {
    throw new Error("Assigned agent not found for lead: " + leadId);
  }

  const data = NF_buildMergeData_(lead, agent);
  const results = [];

  if (lead.Email) {
    const leadTemplateId =
      String(lead.LeadType || "").toUpperCase() === "RECRUITING"
        ? "TPL-RECRUITING-CONFIRMATION"
        : "TPL-LEAD-AGENT-INTRO";

    results.push(
      NF_queueRenderedNotification_(
        lead,
        agent,
        leadTemplateId,
        "LEAD",
        lead.Email,
        [lead.FirstName, lead.LastName].filter(Boolean).join(" "),
        data
      )
    );
  }

  if (agent.Email) {
    results.push(
      NF_queueRenderedNotification_(
        lead,
        agent,
        "TPL-AGENT-NEW-LEAD",
        "AGENT",
        agent.Email,
        agent.AgentName || "",
        data
      )
    );
  }

  return {
    success: true,
    leadId: leadId,
    queued: results.length,
    notifications: results
  };
}

function NF_queueLeadConfirmation(leadId) {
  NF_initializeTemplateEngine();

  const lead = NF_findLead_(leadId);
  if (!lead) throw new Error("Lead not found: " + leadId);
  if (!lead.Email) throw new Error("Lead email is missing.");

  const agent = lead.AssignedAgentID
    ? AE_getAgent(lead.AssignedAgentID)
    : null;

  const data = NF_buildMergeData_(lead, agent || {});

  return NF_queueRenderedNotification_(
    lead,
    agent || {},
    "TPL-LEAD-CONFIRMATION",
    "LEAD",
    lead.Email,
    [lead.FirstName, lead.LastName].filter(Boolean).join(" "),
    data
  );
}

function NF_queueRenderedNotification_(
  lead,
  agent,
  templateId,
  recipientType,
  recipientEmail,
  recipientName,
  data
) {
  const rendered = NF_renderTemplate(templateId, data);

  return NF_queueNotification({
    LeadID: lead.LeadID,
    AgentID: agent.AgentID || "",
    NotificationType: rendered.notificationType,
    RecipientType: recipientType,
    RecipientEmail: recipientEmail,
    RecipientName: recipientName,
    TemplateID: templateId,
    Subject: rendered.subject,
    ScheduledAt: timestamp_()
  });
}

function NF_buildMergeData_(lead, agent) {
  return {
    LeadID: lead.LeadID || "",
    FirstName: lead.FirstName || "",
    LastName: lead.LastName || "",
    Email: lead.Email || "",
    Phone: lead.Phone || "",
    LeadType: NF_titleCase_(lead.LeadType || ""),
    Parish: lead.Parish || "",
    Source: lead.Source || "",
    AgentID: agent.AgentID || "",
    AgentName: agent.AgentName || "",
    AgentEmail: agent.Email || "",
    AgentPhone: agent.Phone || ""
  };
}

function NF_findLead_(leadId) {
  const leads = AE_sheetObjects_(AE.SHEETS.LEADS);
  const target = String(leadId || "").trim();

  for (let i = 0; i < leads.length; i++) {
    if (String(leads[i].LeadID || "").trim() === target) {
      return leads[i];
    }
  }

  return null;
}

function NF_titleCase_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, function(char) {
      return char.toUpperCase();
    });
}

function NF_buildNotificationsForAssignedLeads(limit) {
  const max = Math.max(1, Number(limit || 25));

  const leads = AE_sheetObjects_(AE.SHEETS.LEADS)
    .filter(function(lead) {
      return String(lead.AssignedAgentID || "").trim() !== "";
    })
    .slice(0, max);

  const results = [];

  leads.forEach(function(lead) {
    try {
      results.push(NF_buildAssignmentNotifications(lead.LeadID));
    } catch (error) {
      NF_log_(
        "NOTIFICATION_BUILD_ERROR",
        "",
        lead.LeadID || "",
        lead.AssignedAgentID || "",
        error.message || String(error)
      );

      results.push({
        success: false,
        leadId: lead.LeadID || "",
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
    results: results
  };
}

function NF_testNotificationBuilder() {
  NF_initializeTemplateEngine();

  AE_upsertAgent({
    AgentID: "AGT-NF-BUILDER-TEST",
    AgentName: "Notification Builder Test Agent",
    Email: "nf-builder-agent@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "ALL",
    LeadTypes: "ALL",
    Priority: 999,
    DailyCap: 999
  });

  const sheet = workbook_().getSheetByName(AE.SHEETS.LEADS);
  const leadId = "LEAD-NF-BUILDER-TEST";
  const row = AE_findRowByValue_(AE.SHEETS.LEADS, "LeadID", leadId);

  const payload = [
    leadId,
    timestamp_(),
    "Builder",
    "Test",
    "nf-builder-lead@example.com",
    "9855550111",
    "BUYER",
    "ST. TAMMANY",
    "SELF_TEST",
    "ASSIGNED",
    "AGT-NF-BUILDER-TEST",
    "Notification Builder Test Agent",
    timestamp_(),
    "Self test assignment.",
    timestamp_()
  ];

  if (row) {
    sheet.getRange(row, 1, 1, payload.length).setValues([payload]);
  } else {
    sheet.appendRow(payload);
  }

  const result = NF_buildAssignmentNotifications(leadId);

  if (!result.success || result.queued < 2) {
    throw new Error("Notification Builder self-test failed.");
  }

  Logger.log(JSON.stringify(result));
  return true;
}
