/******************************************************************************
 * MelroseOS Enterprise
 * Lead Notification & Follow-Up Migration
 * File: NF-01_Core.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Core notification queue for lead/agent communications.
 *   Defaults to SHADOW mode so no email is sent during migration testing.
 *
 * Requires:
 *   INV-01_Core.gs
 *   AE-01 through AE-10
 *   LI-01 through LI-07
 ******************************************************************************/

const NF = {
  VERSION: "1.0.0",
  MODE_PROPERTY: "M5_NOTIFICATION_MODE",
  DEFAULT_MODE: "SHADOW",
  SHEETS: {
    QUEUE: "NF_QUEUE",
    TEMPLATES: "NF_TEMPLATES",
    AUDIT: "NF_AUDIT_LOG"
  }
};

function NF_initializeCore() {
  const ss = workbook_();

  Object.keys(NF.SHEETS).forEach(function(key) {
    createSheetIfMissing_(ss, NF.SHEETS[key]);
  });

  NF_setHeadersIfEmpty_(
    ss.getSheetByName(NF.SHEETS.QUEUE),
    [
      "NotificationID",
      "LeadID",
      "AgentID",
      "NotificationType",
      "RecipientType",
      "RecipientEmail",
      "RecipientName",
      "TemplateID",
      "Subject",
      "Status",
      "ScheduledAt",
      "SentAt",
      "AttemptCount",
      "LastError",
      "CreatedAt",
      "UpdatedAt"
    ]
  );

  NF_setHeadersIfEmpty_(
    ss.getSheetByName(NF.SHEETS.TEMPLATES),
    [
      "TemplateID",
      "TemplateName",
      "NotificationType",
      "Subject",
      "BodyHTML",
      "Active",
      "UpdatedAt"
    ]
  );

  NF_setHeadersIfEmpty_(
    ss.getSheetByName(NF.SHEETS.AUDIT),
    [
      "AuditID",
      "EventType",
      "NotificationID",
      "LeadID",
      "AgentID",
      "Details",
      "Mode",
      "CreatedAt"
    ]
  );

  if (!getDocProperty_(NF.MODE_PROPERTY)) {
    setDocProperty_(NF.MODE_PROPERTY, NF.DEFAULT_MODE);
  }

  NF_log_("CORE_INITIALIZED", "", "", "",
    "Notification core initialized in " + NF_getMode() + " mode.");

  return {
    success: true,
    version: NF.VERSION,
    mode: NF_getMode()
  };
}

function NF_setHeadersIfEmpty_(sheet, headers) {
  if (!sheet) {
    throw new Error("Required Notification sheet is missing.");
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    autoResize_(sheet);
    return;
  }

  const width = Math.max(sheet.getLastColumn(), headers.length);
  const existing = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];

  const hasHeaders = existing.some(function(value) {
    return String(value || "").trim() !== "";
  });

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    autoResize_(sheet);
  }
}

function NF_getMode() {
  return String(
    getDocProperty_(NF.MODE_PROPERTY) || NF.DEFAULT_MODE
  ).toUpperCase();
}

function NF_setMode(mode) {
  const normalized = String(mode || "").trim().toUpperCase();

  if (["SHADOW", "LIVE", "PAUSED"].indexOf(normalized) === -1) {
    throw new Error("Notification mode must be SHADOW, LIVE, or PAUSED.");
  }

  setDocProperty_(NF.MODE_PROPERTY, normalized);

  NF_log_("MODE_CHANGED", "", "", "",
    "Notification mode changed to " + normalized + ".");

  return normalized;
}

function NF_setShadowMode() {
  return NF_setMode("SHADOW");
}

function NF_setLiveMode() {
  return NF_setMode("LIVE");
}

function NF_pause() {
  return NF_setMode("PAUSED");
}

function NF_queueNotification(notification) {
  NF_initializeCore();

  if (!notification) {
    throw new Error("Notification payload is required.");
  }

  const recipientEmail = AE_normalizeEmail_(
    notification.RecipientEmail ||
    notification.recipientEmail ||
    ""
  );

  if (!recipientEmail) {
    throw new Error("RecipientEmail is required.");
  }

  const notificationId = NF_uuid_("NTF");
  const scheduledAt =
    notification.ScheduledAt ||
    notification.scheduledAt ||
    timestamp_();

  const sheet = workbook_().getSheetByName(NF.SHEETS.QUEUE);

  sheet.appendRow([
    notificationId,
    String(notification.LeadID || notification.leadId || ""),
    String(notification.AgentID || notification.agentId || ""),
    String(
      notification.NotificationType ||
      notification.notificationType ||
      "GENERAL"
    ).toUpperCase(),
    String(
      notification.RecipientType ||
      notification.recipientType ||
      "LEAD"
    ).toUpperCase(),
    recipientEmail,
    String(
      notification.RecipientName ||
      notification.recipientName ||
      ""
    ),
    String(notification.TemplateID || notification.templateId || ""),
    String(notification.Subject || notification.subject || ""),
    "QUEUED",
    scheduledAt,
    "",
    0,
    "",
    timestamp_(),
    timestamp_()
  ]);

  NF_log_(
    "NOTIFICATION_QUEUED",
    notificationId,
    notification.LeadID || notification.leadId || "",
    notification.AgentID || notification.agentId || "",
    "Notification queued for " + recipientEmail + "."
  );

  return {
    success: true,
    notificationId: notificationId,
    mode: NF_getMode(),
    status: "QUEUED"
  };
}

function NF_getQueuedNotifications(limit) {
  const max = Math.max(1, Number(limit || 50));

  return NF_sheetObjects_(NF.SHEETS.QUEUE)
    .filter(function(row) {
      return String(row.Status || "").toUpperCase() === "QUEUED";
    })
    .slice(0, max);
}

function NF_log_(eventType, notificationId, leadId, agentId, details) {
  const sheet = workbook_().getSheetByName(NF.SHEETS.AUDIT);

  if (!sheet) return;

  sheet.appendRow([
    NF_uuid_("AUD"),
    String(eventType || ""),
    String(notificationId || ""),
    String(leadId || ""),
    String(agentId || ""),
    String(details || ""),
    NF_getMode(),
    timestamp_()
  ]);
}

function NF_uuid_(prefix) {
  return String(prefix || "NF") + "-" +
    Utilities.getUuid().substring(0, 8).toUpperCase();
}

function NF_sheetObjects_(sheetName) {
  const sheet = workbook_().getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(function(header) {
    return String(header || "").trim();
  });

  return values
    .filter(function(row) {
      return row.some(function(value) {
        return String(value || "").trim() !== "";
      });
    })
    .map(function(row, index) {
      const obj = {_row: index + 2};

      headers.forEach(function(header, i) {
        obj[header] = row[i];
      });

      return obj;
    });
}

function NF_getCoreStatus() {
  return {
    version: NF.VERSION,
    mode: NF_getMode(),
    queued: NF_getQueuedNotifications(10000).length,
    templates: NF_sheetObjects_(NF.SHEETS.TEMPLATES).length,
    auditEvents: NF_sheetObjects_(NF.SHEETS.AUDIT).length
  };
}

function NF_testCore() {
  NF_initializeCore();
  NF_setShadowMode();

  const result = NF_queueNotification({
    LeadID: "LEAD-NF-TEST",
    AgentID: "AGT-NF-TEST",
    NotificationType: "LEAD_CONFIRMATION",
    RecipientType: "LEAD",
    RecipientEmail: "notification-test@example.com",
    RecipientName: "Notification Test",
    Subject: "MelroseOS Notification Self Test"
  });

  if (!result.success || result.mode !== "SHADOW") {
    throw new Error("Notification Core self-test failed.");
  }

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(NF_getCoreStatus()));

  return true;
}
