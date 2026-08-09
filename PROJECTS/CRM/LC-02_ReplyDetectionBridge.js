/******************************************************************************
 * MelroseOS Enterprise
 * Lead Lifecycle Management
 * File: LC-02_ReplyDetectionBridge.gs
 * Version: 1.0.0
 ******************************************************************************/

function LC_scanLeadReplies(limit) {
  LC_initializeCore();

  const max = Math.max(1, Number(limit || 50));
  const leads = AE_sheetObjects_(AE.SHEETS.LEADS)
    .filter(function(lead) {
      return String(lead.Email || "").trim() !== "" &&
        String(lead.AssignedAgentID || "").trim() !== "";
    })
    .slice(0, max);

  const results = [];

  leads.forEach(function(lead) {
    try {
      results.push(LC_checkLeadReply_(lead));
    } catch (error) {
      results.push({
        success: false,
        leadId: lead.LeadID || "",
        error: error.message || String(error)
      });
    }
  });

  return {
    success: results.every(function(r) { return r.success; }),
    processed: results.length,
    repliesDetected: results.filter(function(r) { return r.replyDetected; }).length,
    results: results
  };
}

function LC_checkLeadReply_(lead) {
  const email = AE_normalizeEmail_(lead.Email || "");

  if (!email) {
    return {
      success: true,
      leadId: lead.LeadID,
      replyDetected: false,
      skipped: true
    };
  }

  const threads = GmailApp.search(
    'from:' + email + ' newer_than:90d',
    0,
    10
  );

  if (!threads.length) {
    return {
      success: true,
      leadId: lead.LeadID,
      replyDetected: false
    };
  }

  let newest = null;

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      const from = String(message.getFrom() || "").toLowerCase();
      if (from.indexOf(email.toLowerCase()) === -1) return;

      const date = message.getDate();

      if (!newest || date.getTime() > newest.getTime()) {
        newest = date;
      }
    });
  });

  if (!newest) {
    return {
      success: true,
      leadId: lead.LeadID,
      replyDetected: false
    };
  }

  const lifecycle = LC_createOrUpdateLifecycle(lead.LeadID);
  const row = LC_findLifecycleRow_(lead.LeadID);
  const current = LC_getLifecycleByRow_(row);
  const lastContact = current.LastContactAt
    ? new Date(current.LastContactAt)
    : null;

  if (
    lastContact &&
    !isNaN(lastContact.getTime()) &&
    newest.getTime() <= lastContact.getTime()
  ) {
    return {
      success: true,
      leadId: lead.LeadID,
      replyDetected: false,
      alreadyProcessed: true
    };
  }

  LC_logActivity(
    lead.LeadID,
    "REPLY",
    "EMAIL",
    "INBOUND",
    "Lead email reply detected by Gmail scan.",
    lead.AssignedAgentID || ""
  );

  LC_updateLeadStatus(
    lead.LeadID,
    "CONTACTED",
    "REPLY_DETECTION",
    "Inbound email reply detected."
  );

  if (typeof NF_cancelLeadFollowUps === "function") {
    NF_cancelLeadFollowUps(lead.LeadID);
  }

  return {
    success: true,
    leadId: lead.LeadID,
    replyDetected: true,
    replyAt: newest
  };
}

function LC_testReplyDetectionBridge() {
  LC_initializeCore();

  if (typeof GmailApp === "undefined") {
    throw new Error("GmailApp service is unavailable.");
  }

  Logger.log(JSON.stringify({
    success: true,
    gmailAvailable: true
  }));

  return true;
}
