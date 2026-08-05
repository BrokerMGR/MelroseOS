/******************************************************************************
 * MelroseOS Enterprise
 * Lead Notification & Follow-Up Migration
 * File: NF-04_SendEngine.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Processes queued notifications. SHADOW mode records simulated sends only.
 *   LIVE mode sends email through GmailApp.
 *
 * Requires:
 *   NF-01 through NF-03
 ******************************************************************************/

function NF_processSendQueue(limit) {
  NF_initializeTemplateEngine();

  const mode = NF_getMode();

  if (mode === "PAUSED") {
    throw new Error("Notification Engine is PAUSED.");
  }

  const max = Math.max(1, Number(limit || 25));
  const now = new Date();

  const queue = NF_getQueuedNotifications(10000)
    .filter(function(item) {
      if (!item.ScheduledAt) return true;

      const scheduled = new Date(item.ScheduledAt);

      return isNaN(scheduled.getTime()) ||
        scheduled.getTime() <= now.getTime();
    })
    .slice(0, max);

  const results = [];

  queue.forEach(function(item) {
    try {
      if (mode === "SHADOW") {
        results.push(
          NF_recordShadowSend_(item)
        );
      } else if (mode === "LIVE") {
        results.push(
          NF_sendLiveNotification_(item)
        );
      }
    } catch (error) {
      NF_markNotificationError_(
        item,
        error.message || String(error)
      );

      results.push({
        success: false,
        notificationId: item.NotificationID,
        error: error.message || String(error)
      });
    }
  });

  return {
    success: true,
    mode: mode,
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

function NF_recordShadowSend_(item) {
  const body = NF_renderQueuedBody_(item);

  NF_updateQueueRecord_(
    item._row,
    {
      Status: "SHADOW_SENT",
      SentAt: timestamp_(),
      AttemptCount: Number(item.AttemptCount || 0) + 1,
      LastError: ""
    }
  );

  NF_log_(
    "SHADOW_SEND",
    item.NotificationID,
    item.LeadID,
    item.AgentID,
    "Simulated notification to " +
      item.RecipientEmail +
      ". Subject: " +
      item.Subject
  );

  return {
    success: true,
    mode: "SHADOW",
    notificationId: item.NotificationID,
    recipient: item.RecipientEmail,
    subject: item.Subject,
    bodyGenerated: !!body
  };
}

function NF_sendLiveNotification_(item) {
  const recipient = AE_normalizeEmail_(
    item.RecipientEmail || ""
  );

  if (!recipient) {
    throw new Error("Recipient email is missing.");
  }

  const bodyHtml = NF_renderQueuedBody_(item);

  if (!bodyHtml) {
    throw new Error(
      "Notification body could not be rendered."
    );
  }

  GmailApp.sendEmail(
    recipient,
    String(item.Subject || ""),
    NF_stripHtml_(bodyHtml),
    {
      htmlBody: bodyHtml,
      name: "Melrose Group Realty"
    }
  );

  NF_updateQueueRecord_(
    item._row,
    {
      Status: "SENT",
      SentAt: timestamp_(),
      AttemptCount: Number(item.AttemptCount || 0) + 1,
      LastError: ""
    }
  );

  NF_log_(
    "LIVE_SEND",
    item.NotificationID,
    item.LeadID,
    item.AgentID,
    "Notification sent to " + recipient + "."
  );

  return {
    success: true,
    mode: "LIVE",
    notificationId: item.NotificationID,
    recipient: recipient,
    subject: item.Subject
  };
}

function NF_renderQueuedBody_(item) {
  const templateId = String(
    item.TemplateID || ""
  ).trim();

  if (!templateId) {
    return "<p>" +
      NF_escapeHtml_(item.Subject || "Melrose Group Realty") +
      "</p>";
  }

  const lead = item.LeadID
    ? NF_findLead_(item.LeadID)
    : null;

  const agent = item.AgentID &&
    typeof AE_getAgent === "function"
      ? AE_getAgent(item.AgentID)
      : null;

  const data = NF_buildMergeData_(
    lead || {},
    agent || {}
  );

  const rendered = NF_renderTemplate(
    templateId,
    data
  );

  return rendered.bodyHtml;
}

function NF_updateQueueRecord_(row, updates) {
  const sheet = workbook_().getSheetByName(
    NF.SHEETS.QUEUE
  );

  if (!sheet || !row) {
    throw new Error(
      "Notification queue row could not be updated."
    );
  }

  const headers = sheet
    .getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    )
    .getDisplayValues()[0];

  Object.keys(updates).forEach(function(key) {
    const col = headers.indexOf(key) + 1;

    if (col) {
      sheet
        .getRange(row, col)
        .setValue(updates[key]);
    }
  });

  const updatedCol =
    headers.indexOf("UpdatedAt") + 1;

  if (updatedCol) {
    sheet
      .getRange(row, updatedCol)
      .setValue(timestamp_());
  }
}

function NF_markNotificationError_(item, errorMessage) {
  NF_updateQueueRecord_(
    item._row,
    {
      Status: "ERROR",
      AttemptCount:
        Number(item.AttemptCount || 0) + 1,
      LastError: errorMessage
    }
  );

  NF_log_(
    "SEND_ERROR",
    item.NotificationID,
    item.LeadID,
    item.AgentID,
    errorMessage
  );
}

function NF_retrySendErrors(limit) {
  const max = Math.max(
    1,
    Number(limit || 25)
  );

  const errors = NF_sheetObjects_(
    NF.SHEETS.QUEUE
  )
    .filter(function(item) {
      return String(
        item.Status || ""
      ).toUpperCase() === "ERROR";
    })
    .slice(0, max);

  errors.forEach(function(item) {
    NF_updateQueueRecord_(
      item._row,
      {
        Status: "QUEUED",
        LastError: ""
      }
    );
  });

  return NF_processSendQueue(max);
}

function NF_stripHtml_(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function NF_escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function NF_getSendEngineStatus() {
  const rows = NF_sheetObjects_(
    NF.SHEETS.QUEUE
  );

  const count = function(status) {
    return rows.filter(function(row) {
      return String(
        row.Status || ""
      ).toUpperCase() === status;
    }).length;
  };

  return {
    mode: NF_getMode(),
    total: rows.length,
    queued: count("QUEUED"),
    shadowSent: count("SHADOW_SENT"),
    sent: count("SENT"),
    errors: count("ERROR")
  };
}

function NF_testSendEngine() {
  NF_initializeTemplateEngine();
  NF_setShadowMode();

  const unique = Utilities.getUuid().substring(0, 8);

  const queued = NF_queueNotification({
    LeadID: "",
    AgentID: "",
    NotificationType: "GENERAL",
    RecipientType: "LEAD",
    RecipientEmail:
      "nf-send-" +
      unique +
      "@example.com",
    RecipientName: "Send Test",
    Subject: "MelroseOS Send Engine Self Test"
  });

  if (!queued.success) {
    throw new Error(
      "Send Engine test notification could not be queued."
    );
  }

  const queueItems = NF_sheetObjects_(
    NF.SHEETS.QUEUE
  );

  const testItem = queueItems.find(function(item) {
    return String(item.NotificationID || "") ===
      String(queued.notificationId || "");
  });

  if (!testItem) {
    throw new Error(
      "Send Engine self-test could not locate the queued test notification."
    );
  }

  const result = NF_recordShadowSend_(
    testItem
  );

  if (
    !result ||
    !result.success ||
    result.notificationId !== queued.notificationId
  ) {
    throw new Error(
      "Notification Send Engine self-test failed."
    );
  }

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      NF_getSendEngineStatus()
    )
  );

  return true;
}
