/******************************************************************************
 * MelroseOS Enterprise
 * File: NF-01_EnterpriseNotificationSendWorker.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Processes SYS_NOTIFICATION_QUEUE safely.
 *
 * Safety:
 *   - Fails closed when the communications gate is unavailable or closed.
 *   - Uses a script lock to prevent concurrent workers.
 *   - Retries failed jobs up to MaxAttempts.
 *   - Publishes NOTIFICATION_SENT and NOTIFICATION_FAILED events.
 *   - Never sends HELD, CANCELLED, or already SENT records.
 ******************************************************************************/

const MOS5_NOTIFICATION_SEND_WORKER_VERSION = "1.0.0";

const MOS5_NOTIFICATION_SEND_WORKER = Object.freeze({
  SHEET: "SYS_NOTIFICATION_QUEUE",
  LOCK_TIMEOUT_MS: 10000,
  STALE_PROCESSING_MINUTES: 15,
  MAX_BATCH: 100
});

/**
 * Processes pending notification jobs.
 *
 * @param {number=} limit
 * @return {Object}
 */
function MOS5NF_processNotificationQueue(limit) {
  const startedAt = new Date();
  const gate = MOS5NF_assertCommunicationsOpen_();

  if (!gate.open) {
    return {
      success: false,
      status: "COMMUNICATIONS_HELD",
      processed: 0,
      sent: 0,
      failed: 0,
      reason: gate.reason,
      productionChanged: false,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString()
    };
  }

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(MOS5_NOTIFICATION_SEND_WORKER.LOCK_TIMEOUT_MS)) {
    return {
      success: false,
      status: "NOTIFICATION_QUEUE_BUSY",
      processed: 0,
      sent: 0,
      failed: 0,
      productionChanged: false,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString()
    };
  }

  try {
    const sheet = MOS5NF_sendWorkerSheet_();

    MOS5NF_recoverStaleNotificationJobs_(sheet);

    const max = Math.max(
      1,
      Math.min(
        Number(limit || 25),
        MOS5_NOTIFICATION_SEND_WORKER.MAX_BATCH
      )
    );

    const now = new Date();

    const jobs = MOS5NF_sendWorkerRows_(sheet)
      .filter(function(job) {
        return (
          String(job.Status || "").trim().toUpperCase() === "PENDING" &&
          MOS5NF_sendWorkerDateNumber_(job.AvailableAt) <= now.getTime()
        );
      })
      .sort(function(a, b) {
        const priorityDifference =
          Number(a.Priority || 5) -
          Number(b.Priority || 5);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return (
          MOS5NF_sendWorkerDateNumber_(a.CreatedAt) -
          MOS5NF_sendWorkerDateNumber_(b.CreatedAt)
        );
      })
      .slice(0, max);

    const results = jobs.map(function(job) {
      return MOS5NF_processNotificationJob_(sheet, job);
    });

    const sent = results.filter(function(result) {
      return result.status === "SENT";
    }).length;

    const failed = results.filter(function(result) {
      return result.status === "FAILED";
    }).length;

    return {
      success: failed === 0,
      status:
        results.length === 0
          ? "EMPTY"
          : failed === 0
            ? "COMPLETE"
            : sent > 0
              ? "PARTIAL"
              : "FAILED",
      release: "MOS5-ENTERPRISE-NOTIFICATION-SEND-WORKER",
      version: MOS5_NOTIFICATION_SEND_WORKER_VERSION,
      processed: results.length,
      sent: sent,
      failed: failed,
      results: results,
      productionChanged: sent > 0,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Processes one notification job.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} job
 * @return {Object}
 */
function MOS5NF_processNotificationJob_(sheet, job) {
  const notificationId = String(
    job.NotificationID || ""
  ).trim();

  const current = MOS5NF_getNotificationById_(
    sheet,
    notificationId
  );

  if (!current) {
    return {
      success: false,
      status: "MISSING",
      notificationId: notificationId
    };
  }

  if (
    String(current.Status || "").trim().toUpperCase() !==
    "PENDING"
  ) {
    return {
      success: false,
      status: "SKIPPED",
      notificationId: notificationId
    };
  }

  const gate = MOS5NF_assertCommunicationsOpen_();

  if (!gate.open) {
    MOS5NF_updateSendWorkerRow_(
      sheet,
      current._row,
      {
        Status: "HELD",
        LastError: gate.reason,
        UpdatedAt: new Date()
      }
    );

    return {
      success: false,
      status: "HELD",
      notificationId: notificationId,
      reason: gate.reason
    };
  }

  const attempts = Number(current.Attempts || 0) + 1;

  MOS5NF_updateSendWorkerRow_(
    sheet,
    current._row,
    {
      Status: "PROCESSING",
      Attempts: attempts,
      LastError: "",
      UpdatedAt: new Date()
    }
  );

  try {
    const payload = MOS5NF_sendWorkerParseJson_(
      current.PayloadJSON,
      {}
    );

    const message = MOS5NF_buildNotificationMessage_(
      current,
      payload
    );

    GmailApp.sendEmail(
      String(current.RecipientEmail || "").trim(),
      message.subject,
      message.textBody,
      {
        htmlBody: message.htmlBody,
        name: message.senderName,
        replyTo: message.replyTo
      }
    );

    const sentAt = new Date();

    MOS5NF_updateSendWorkerRow_(
      sheet,
      current._row,
      {
        Status: "SENT",
        SentAt: sentAt,
        LastError: "",
        UpdatedAt: sentAt
      }
    );

    MOS5NF_publishSendWorkerEvent_(
      "MOS5_publishNotificationSent_",
      {
        notificationId: notificationId,
        eventId: String(current.EventID || ""),
        eventType: String(current.EventType || ""),
        leadId: String(current.LeadID || ""),
        intakeId: String(current.IntakeID || ""),
        recipientType: String(current.RecipientType || ""),
        recipientEmail: String(current.RecipientEmail || ""),
        templateCode: String(current.TemplateCode || ""),
        subject: message.subject,
        attempts: attempts,
        sentAt: sentAt.toISOString()
      },
      {
        aggregateType: "LEAD",
        aggregateId: String(current.LeadID || ""),
        causationId: String(current.EventID || ""),
        source: "NOTIFICATION_SEND_WORKER"
      }
    );

    return {
      success: true,
      status: "SENT",
      notificationId: notificationId,
      recipientEmail: String(current.RecipientEmail || ""),
      templateCode: String(current.TemplateCode || ""),
      attempts: attempts,
      sentAt: sentAt.toISOString()
    };
  } catch (error) {
    const message = String(
      error && error.message
        ? error.message
        : error
    );

    const maxAttempts = Math.max(
      1,
      Number(current.MaxAttempts || 5)
    );

    const exhausted = attempts >= maxAttempts;
    const nextStatus = exhausted ? "FAILED" : "PENDING";

    const availableAt = exhausted
      ? current.AvailableAt
      : new Date(
          Date.now() +
          MOS5NF_retryDelayMinutes_(attempts) *
          60 *
          1000
        );

    MOS5NF_updateSendWorkerRow_(
      sheet,
      current._row,
      {
        Status: nextStatus,
        AvailableAt: availableAt,
        LastError: message,
        UpdatedAt: new Date()
      }
    );

    MOS5NF_publishSendWorkerEvent_(
      "MOS5_publishNotificationFailed_",
      {
        notificationId: notificationId,
        eventId: String(current.EventID || ""),
        eventType: String(current.EventType || ""),
        leadId: String(current.LeadID || ""),
        intakeId: String(current.IntakeID || ""),
        recipientType: String(current.RecipientType || ""),
        recipientEmail: String(current.RecipientEmail || ""),
        templateCode: String(current.TemplateCode || ""),
        attempts: attempts,
        maxAttempts: maxAttempts,
        exhausted: exhausted,
        error: message
      },
      {
        aggregateType: "LEAD",
        aggregateId: String(current.LeadID || ""),
        causationId: String(current.EventID || ""),
        source: "NOTIFICATION_SEND_WORKER"
      }
    );

    return {
      success: false,
      status: exhausted ? "FAILED" : "RETRY_QUEUED",
      notificationId: notificationId,
      attempts: attempts,
      maxAttempts: maxAttempts,
      error: message
    };
  }
}

/**
 * Builds a notification message from the queued template code.
 *
 * @param {Object} job
 * @param {Object} payload
 * @return {Object}
 */
function MOS5NF_buildNotificationMessage_(job, payload) {
  const templateCode = String(
    job.TemplateCode || ""
  )
    .trim()
    .toUpperCase();

  const leadName = [
    payload.FirstName || payload.firstName || "",
    payload.LastName || payload.lastName || ""
  ]
    .join(" ")
    .trim() || "Lead";

  const leadType = String(
    payload.LeadType ||
    payload.leadType ||
    ""
  ).trim();

  const parish = String(
    payload.Parish ||
    payload.parish ||
    ""
  ).trim();

  const leadEmail = String(
    payload.Email ||
    payload.email ||
    ""
  ).trim();

  const leadPhone = String(
    payload.Phone ||
    payload.phone ||
    ""
  ).trim();

  const assignedAgentName = String(
    payload.agentName ||
    payload.AssignedAgentName ||
    job.RecipientName ||
    ""
  ).trim();

  const reason = String(
    payload.reason ||
    payload.error ||
    ""
  ).trim();

  let subject = String(
    job.Subject || ""
  ).trim();

  let heading = "MelroseOS Notification";
  let intro = "A MelroseOS notification requires your attention.";

  switch (templateCode) {
    case "LEAD_ASSIGNED_AGENT":
      subject = subject || "New lead assigned";
      heading = "New Lead Assigned";
      intro =
        "A new lead has been assigned to " +
        (assignedAgentName || "you") +
        ".";
      break;

    case "LEAD_BROKER_FALLBACK":
      subject = subject || "Lead routed to broker fallback";
      heading = "Broker Fallback Assignment";
      intro =
        "A lead was routed to the broker fallback authority.";
      break;

    case "LEAD_UNASSIGNED_BROKER":
      subject = subject || "Lead requires broker assignment review";
      heading = "Unassigned Lead";
      intro =
        "A lead remains unassigned and requires broker review.";
      break;

    case "LEAD_ERROR_BROKER":
      subject = subject || "MelroseOS lead-processing error";
      heading = "Lead Processing Error";
      intro =
        "MelroseOS encountered an error while processing a lead.";
      break;

    default:
      subject = subject || "MelroseOS notification";
  }

  const details = [
    ["Lead", leadName],
    ["Lead type", leadType],
    ["Parish", parish],
    ["Email", leadEmail],
    ["Phone", leadPhone],
    ["Lead ID", String(job.LeadID || "")],
    ["Intake ID", String(job.IntakeID || "")],
    ["Reason", reason]
  ].filter(function(item) {
    return String(item[1] || "").trim() !== "";
  });

  const textBody = [
    heading,
    "",
    intro,
    "",
    details
      .map(function(item) {
        return item[0] + ": " + item[1];
      })
      .join("\n"),
    "",
    "This message was generated by MelroseOS."
  ].join("\n");

  const rows = details
    .map(function(item) {
      return (
        "<tr>" +
        "<td style=\"padding:6px 12px 6px 0;font-weight:700;vertical-align:top;\">" +
        MOS5NF_escapeHtml_(item[0]) +
        "</td>" +
        "<td style=\"padding:6px 0;\">" +
        MOS5NF_escapeHtml_(item[1]) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  const htmlBody =
    "<div style=\"font-family:Arial,sans-serif;max-width:640px;margin:auto;\">" +
    "<h2 style=\"margin-bottom:8px;\">" +
    MOS5NF_escapeHtml_(heading) +
    "</h2>" +
    "<p>" +
    MOS5NF_escapeHtml_(intro) +
    "</p>" +
    "<table style=\"border-collapse:collapse;width:100%;\">" +
    rows +
    "</table>" +
    "<p style=\"margin-top:24px;font-size:12px;color:#666;\">" +
    "Generated by MelroseOS." +
    "</p>" +
    "</div>";

  return {
    subject: subject,
    textBody: textBody,
    htmlBody: htmlBody,
    senderName: "Melrose Group Realty",
    replyTo: "melrosegroupbroker@gmail.com"
  };
}

/**
 * Retries failed notification jobs.
 *
 * @param {number=} limit
 * @return {Object}
 */
function MOS5NF_retryFailedNotifications(limit) {
  const gate = MOS5NF_assertCommunicationsOpen_();

  if (!gate.open) {
    return {
      success: false,
      status: "COMMUNICATIONS_HELD",
      reset: 0,
      reason: gate.reason,
      productionChanged: false
    };
  }

  const max = Math.max(
    1,
    Math.min(
      Number(limit || 50),
      MOS5_NOTIFICATION_SEND_WORKER.MAX_BATCH
    )
  );

  const sheet = MOS5NF_sendWorkerSheet_();

  const failed = MOS5NF_sendWorkerRows_(sheet)
    .filter(function(job) {
      return (
        String(job.Status || "").trim().toUpperCase() === "FAILED" &&
        Number(job.Attempts || 0) < Number(job.MaxAttempts || 5)
      );
    })
    .slice(0, max);

  failed.forEach(function(job) {
    MOS5NF_updateSendWorkerRow_(
      sheet,
      job._row,
      {
        Status: "PENDING",
        AvailableAt: new Date(),
        LastError: "",
        UpdatedAt: new Date()
      }
    );
  });

  return {
    success: true,
    status: "RESET",
    reset: failed.length,
    productionChanged: failed.length > 0,
    completedAt: new Date().toISOString()
  };
}

/**
 * Returns send-worker status.
 *
 * @return {Object}
 */
function MOS5NF_getSendWorkerStatus() {
  const jobs = MOS5NF_sendWorkerRows_(
    MOS5NF_sendWorkerSheet_()
  );

  const count = function(status) {
    return jobs.filter(function(job) {
      return (
        String(job.Status || "").trim().toUpperCase() === status
      );
    }).length;
  };

  return {
    release: "MOS5-ENTERPRISE-NOTIFICATION-SEND-WORKER",
    version: MOS5_NOTIFICATION_SEND_WORKER_VERSION,
    total: jobs.length,
    pending: count("PENDING"),
    held: count("HELD"),
    processing: count("PROCESSING"),
    sent: count("SENT"),
    failed: count("FAILED"),
    cancelled: count("CANCELLED"),
    generatedAt: new Date().toISOString()
  };
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function MOS5NF_runSendWorkerDiagnostics() {
  const requirements = [
    "MOS5M1B_checkCommunicationsGate_",
    "MOS5_publishNotificationSent_",
    "MOS5_publishNotificationFailed_"
  ];

  const tests = requirements.map(function(name) {
    return {
      code: name,
      status:
        typeof globalThis[name] === "function"
          ? "PASS"
          : "FAIL"
    };
  });

  const sheet = MOS5NF_sendWorkerSheet_();

  tests.push({
    code: "NOTIFICATION_QUEUE_SHEET",
    status: sheet ? "PASS" : "FAIL"
  });

  const failed = tests.filter(function(test) {
    return test.status === "FAIL";
  }).length;

  return {
    release: "MOS5-ENTERPRISE-NOTIFICATION-SEND-WORKER",
    version: MOS5_NOTIFICATION_SEND_WORKER_VERSION,
    overallStatus: failed ? "FAIL" : "PASS",
    passed: tests.length - failed,
    failed: failed,
    tests: tests,
    queue: MOS5NF_getSendWorkerStatus(),
    productionChanged: false,
    completedAt: new Date().toISOString()
  };
}

function MOS5NF_assertCommunicationsOpen_() {
  if (
    typeof MOS5M1B_checkCommunicationsGate_ !== "function"
  ) {
    return {
      open: false,
      reason:
        "Canonical communications safety gate is unavailable."
    };
  }

  try {
    const gate = MOS5M1B_checkCommunicationsGate_();

    return {
      open: Boolean(
        gate &&
        gate.success === true &&
        gate.status === "OPEN"
      ),
      reason:
        gate &&
        gate.status === "OPEN"
          ? ""
          : "Communications are paused."
    };
  } catch (error) {
    return {
      open: false,
      reason: String(
        error && error.message
          ? error.message
          : error
      )
    };
  }
}

function MOS5NF_sendWorkerSheet_() {
  const ss =
    typeof workbook_ === "function"
      ? workbook_()
      : SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName(
    MOS5_NOTIFICATION_SEND_WORKER.SHEET
  );

  if (!sheet) {
    throw new Error(
      "SYS_NOTIFICATION_QUEUE is missing. Install NF-00 first."
    );
  }

  return sheet;
}

function MOS5NF_sendWorkerRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(function(value) {
      return String(value || "").trim();
    });

  const values = sheet
    .getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      headers.length
    )
    .getValues();

  return values.map(function(row, index) {
    const record = {
      _row: index + 2
    };

    headers.forEach(function(header, column) {
      record[header] = row[column];
    });

    return record;
  });
}

function MOS5NF_getNotificationById_(
  sheet,
  notificationId
) {
  const target = String(
    notificationId || ""
  ).trim();

  return (
    MOS5NF_sendWorkerRows_(sheet)
      .find(function(job) {
        return (
          String(job.NotificationID || "").trim() === target
        );
      }) ||
    null
  );
}

function MOS5NF_updateSendWorkerRow_(
  sheet,
  rowNumber,
  payload
) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const current = sheet
    .getRange(
      rowNumber,
      1,
      1,
      headers.length
    )
    .getValues()[0];

  const updated = headers.map(function(header, index) {
    return payload[header] !== undefined
      ? payload[header]
      : current[index];
  });

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      headers.length
    )
    .setValues([updated]);

  return true;
}

function MOS5NF_recoverStaleNotificationJobs_(sheet) {
  const threshold = new Date(
    Date.now() -
    MOS5_NOTIFICATION_SEND_WORKER
      .STALE_PROCESSING_MINUTES *
    60 *
    1000
  );

  MOS5NF_sendWorkerRows_(sheet)
    .filter(function(job) {
      return (
        String(job.Status || "").trim().toUpperCase() ===
          "PROCESSING" &&
        MOS5NF_sendWorkerDateNumber_(job.UpdatedAt) <
          threshold.getTime()
      );
    })
    .forEach(function(job) {
      MOS5NF_updateSendWorkerRow_(
        sheet,
        job._row,
        {
          Status: "PENDING",
          LastError:
            "Recovered stale notification-processing lock.",
          UpdatedAt: new Date()
        }
      );
    });
}

function MOS5NF_publishSendWorkerEvent_(
  functionName,
  payload,
  options
) {
  const handler = globalThis[functionName];

  if (typeof handler !== "function") {
    return {
      success: false,
      status: "PUBLISHER_UNAVAILABLE",
      functionName: functionName
    };
  }

  try {
    return handler(
      payload || {},
      options || {}
    );
  } catch (error) {
    return {
      success: false,
      status: "PUBLICATION_FAILED",
      functionName: functionName,
      error: String(
        error && error.message
          ? error.message
          : error
      )
    };
  }
}

function MOS5NF_retryDelayMinutes_(attempts) {
  const schedule = [5, 15, 30, 60, 180];
  const index = Math.max(
    0,
    Math.min(
      Number(attempts || 1) - 1,
      schedule.length - 1
    )
  );

  return schedule[index];
}

function MOS5NF_sendWorkerParseJson_(
  value,
  fallback
) {
  if (value && typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(
      String(value || "")
    );
  } catch (error) {
    return fallback;
  }
}

function MOS5NF_sendWorkerDateNumber_(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value);
  const result = parsed.getTime();

  return Number.isFinite(result)
    ? result
    : 0;
}

function MOS5NF_escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
