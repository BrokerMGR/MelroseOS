/******************************************************************************
 * MelroseOS Enterprise
 * Lead Notification & Follow-Up Migration
 * File: NF-05_FollowUpEngine.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Schedules and queues follow-up notifications for leads that have not yet
 *   been completed, while respecting configured business-hour windows.
 *
 * Requires:
 *   NF-01 through NF-04
 *   AE-01 through AE-10
 ******************************************************************************/

const NF_FOLLOWUP_CONFIG = {
  TIMEZONE: "America/Chicago",
  START_HOUR: 10,
  END_HOUR: 18,
  DEFAULT_SEQUENCE_DAYS: [1, 2, 3, 5, 7]
};

function NF_scheduleLeadFollowUps(leadId) {
  NF_initializeTemplateEngine();

  const lead = NF_findLead_(leadId);

  if (!lead) {
    throw new Error("Lead not found: " + leadId);
  }

  const agent = lead.AssignedAgentID
    ? AE_getAgent(lead.AssignedAgentID)
    : null;

  const sequence = NF_FOLLOWUP_CONFIG.DEFAULT_SEQUENCE_DAYS.slice();
  const created = [];

  sequence.forEach(function(dayOffset, index) {
    const scheduledAt = NF_nextBusinessWindowDate_(dayOffset);

    const templateId = lead.LeadType === "RECRUITING"
      ? "TPL-RECRUITING-CONFIRMATION"
      : "TPL-LEAD-CONFIRMATION";

    const rendered = NF_renderTemplate(
      templateId,
      NF_buildMergeData_(lead, agent || {})
    );

    created.push(
      NF_queueNotification({
        LeadID: lead.LeadID,
        AgentID: agent ? agent.AgentID : "",
        NotificationType: "FOLLOW_UP_" + (index + 1),
        RecipientType: "LEAD",
        RecipientEmail: lead.Email,
        RecipientName: [
          lead.FirstName,
          lead.LastName
        ].filter(Boolean).join(" "),
        TemplateID: templateId,
        Subject: rendered.subject,
        ScheduledAt: scheduledAt
      })
    );
  });

  NF_log_(
    "FOLLOW_UP_SEQUENCE_SCHEDULED",
    "",
    lead.LeadID,
    agent ? agent.AgentID : "",
    created.length + " follow-up notification(s) scheduled."
  );

  return {
    success: true,
    leadId: lead.LeadID,
    scheduled: created.length,
    notifications: created
  };
}

function NF_nextBusinessWindowDate_(dayOffset) {
  const now = new Date();
  const target = new Date(
    now.getTime() + Number(dayOffset || 0) * 24 * 60 * 60 * 1000
  );

  const tz = NF_FOLLOWUP_CONFIG.TIMEZONE;
  const formattedDate = Utilities.formatDate(
    target,
    tz,
    "yyyy-MM-dd"
  );

  const hour = NF_FOLLOWUP_CONFIG.START_HOUR;

  return formattedDate +
    "T" +
    String(hour).padStart(2, "0") +
    ":00:00";
}

function NF_scheduleFollowUpsForAssignedLeads(limit) {
  const max = Math.max(
    1,
    Number(limit || 25)
  );

  const leads = AE_sheetObjects_(AE.SHEETS.LEADS)
    .filter(function(lead) {
      const status = String(
        lead.Status || ""
      ).toUpperCase();

      return (
        String(lead.AssignedAgentID || "").trim() !== "" &&
        ["CLOSED", "LOST", "COMPLETED"].indexOf(status) === -1
      );
    })
    .slice(0, max);

  const results = [];

  leads.forEach(function(lead) {
    try {
      results.push(
        NF_scheduleLeadFollowUps(
          lead.LeadID
        )
      );
    } catch (error) {
      NF_log_(
        "FOLLOW_UP_SCHEDULE_ERROR",
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
    successful: results.filter(function(result) {
      return result.success;
    }).length,
    failed: results.filter(function(result) {
      return !result.success;
    }).length,
    results: results
  };
}

function NF_cancelLeadFollowUps(leadId) {
  const queue = NF_sheetObjects_(
    NF.SHEETS.QUEUE
  );

  let cancelled = 0;

  queue.forEach(function(item) {
    const type = String(
      item.NotificationType || ""
    ).toUpperCase();

    const status = String(
      item.Status || ""
    ).toUpperCase();

    if (
      String(item.LeadID || "") === String(leadId || "") &&
      type.indexOf("FOLLOW_UP_") === 0 &&
      status === "QUEUED"
    ) {
      NF_updateQueueRecord_(
        item._row,
        {
          Status: "CANCELLED"
        }
      );

      cancelled++;
    }
  });

  NF_log_(
    "FOLLOW_UPS_CANCELLED",
    "",
    leadId,
    "",
    cancelled + " queued follow-up(s) cancelled."
  );

  return cancelled;
}

function NF_processFollowUpQueue(limit) {
  return NF_processSendQueue(
    Math.max(1, Number(limit || 25))
  );
}

function NF_getFollowUpStatus() {
  const rows = NF_sheetObjects_(
    NF.SHEETS.QUEUE
  ).filter(function(item) {
    return String(
      item.NotificationType || ""
    ).toUpperCase().indexOf("FOLLOW_UP_") === 0;
  });

  const count = function(status) {
    return rows.filter(function(item) {
      return String(
        item.Status || ""
      ).toUpperCase() === status;
    }).length;
  };

  return {
    total: rows.length,
    queued: count("QUEUED"),
    shadowSent: count("SHADOW_SENT"),
    sent: count("SENT"),
    cancelled: count("CANCELLED"),
    errors: count("ERROR")
  };
}

function NF_testFollowUpEngine() {
  NF_initializeTemplateEngine();
  NF_setShadowMode();

  AE_upsertAgent({
    AgentID: "AGT-NF-FOLLOWUP-TEST",
    AgentName: "Follow Up Test Agent",
    Email: "nf-followup-agent@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "ALL",
    LeadTypes: "ALL",
    Priority: 999,
    DailyCap: 999
  });

  const sheet = workbook_().getSheetByName(
    AE.SHEETS.LEADS
  );

  const leadId = "LEAD-NF-FOLLOWUP-TEST";

  const existingRow = AE_findRowByValue_(
    AE.SHEETS.LEADS,
    "LeadID",
    leadId
  );

  const payload = [
    leadId,
    timestamp_(),
    "Follow",
    "Up Test",
    "nf-followup-lead@example.com",
    "9855550122",
    "BUYER",
    "ST. TAMMANY",
    "SELF_TEST",
    "ASSIGNED",
    "AGT-NF-FOLLOWUP-TEST",
    "Follow Up Test Agent",
    timestamp_(),
    "Self test assignment.",
    timestamp_()
  ];

  if (existingRow) {
    sheet
      .getRange(
        existingRow,
        1,
        1,
        payload.length
      )
      .setValues([payload]);
  } else {
    sheet.appendRow(payload);
  }

  const result = NF_scheduleLeadFollowUps(
    leadId
  );

  if (
    !result.success ||
    result.scheduled !==
      NF_FOLLOWUP_CONFIG.DEFAULT_SEQUENCE_DAYS.length
  ) {
    throw new Error(
      "Follow-Up Engine self-test failed."
    );
  }

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      NF_getFollowUpStatus()
    )
  );

  return true;
}
