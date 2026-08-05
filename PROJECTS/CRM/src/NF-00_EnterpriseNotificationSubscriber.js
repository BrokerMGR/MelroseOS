/******************************************************************************
 * MelroseOS Enterprise
 * File: NF-00_EnterpriseNotificationSubscriber.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Converts lifecycle events into controlled notification jobs.
 *
 * Safety:
 *   - Queues only; does not send email directly.
 *   - Honors the canonical communications safety gate.
 *   - Prevents duplicate notification jobs.
 *   - Supports agent, broker, and internal notifications.
 ******************************************************************************/

const MOS5_NOTIFICATION_SUBSCRIBER_VERSION = "1.0.0";

const MOS5_NOTIFICATION_SUBSCRIBER = Object.freeze({
  SHEET: "SYS_NOTIFICATION_QUEUE",

  STATUS: Object.freeze({
    PENDING: "PENDING",
    HELD: "HELD",
    PROCESSING: "PROCESSING",
    SENT: "SENT",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED"
  }),

  HEADERS: Object.freeze([
    "NotificationID",
    "EventID",
    "EventType",
    "LeadID",
    "IntakeID",
    "RecipientType",
    "RecipientID",
    "RecipientName",
    "RecipientEmail",
    "TemplateCode",
    "Subject",
    "PayloadJSON",
    "Status",
    "Priority",
    "Attempts",
    "MaxAttempts",
    "AvailableAt",
    "SentAt",
    "LastError",
    "CreatedAt",
    "UpdatedAt"
  ]),

  DEFAULT_MAX_ATTEMPTS: 5,
  BROKER_EMAIL: "melrosegroupbroker@gmail.com",
  BROKER_NAME: "Ulysses A. Barnes, Jr."
});

/**
 * Handles a LEAD_ASSIGNED event.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5NF_handleLeadAssignedEvent(event) {
  const normalized = MOS5NF_normalizeEvent_(event);
  const payload = normalized.payload;

  const agentEmail = String(
    payload.agentEmail ||
    payload.AssignedAgentEmail ||
    payload.Email ||
    ""
  )
    .trim()
    .toLowerCase();

  const agentId = String(
    payload.agentId ||
    payload.AssignedAgentID ||
    ""
  ).trim();

  const agentName = String(
    payload.agentName ||
    payload.AssignedAgentName ||
    ""
  ).trim();

  const results = [];

  if (agentEmail) {
    results.push(
      MOS5NF_queueNotification({
        eventId: normalized.eventId,
        eventType: "LEAD_ASSIGNED",
        leadId: normalized.leadId,
        intakeId: normalized.intakeId,
        recipientType: "AGENT",
        recipientId: agentId,
        recipientName: agentName,
        recipientEmail: agentEmail,
        templateCode: "LEAD_ASSIGNED_AGENT",
        subject: "New lead assigned",
        priority: 1,
        payload: payload
      })
    );
  }

  if (
    MOS5NF_isBrokerFallback_(payload)
  ) {
    results.push(
      MOS5NF_queueBrokerNotification_(
        normalized,
        "LEAD_BROKER_FALLBACK",
        "Lead routed to broker fallback",
        payload
      )
    );
  }

  return MOS5NF_subscriberResult_(
    "LEAD_ASSIGNED",
    normalized,
    results
  );
}

/**
 * Handles a LEAD_UNASSIGNED event.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5NF_handleLeadUnassignedEvent(event) {
  const normalized = MOS5NF_normalizeEvent_(event);

  const result =
    MOS5NF_queueBrokerNotification_(
      normalized,
      "LEAD_UNASSIGNED_BROKER",
      "Lead requires broker assignment review",
      normalized.payload
    );

  return MOS5NF_subscriberResult_(
    "LEAD_UNASSIGNED",
    normalized,
    [result]
  );
}

/**
 * Handles a LEAD_ERROR event.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5NF_handleLeadErrorEvent(event) {
  const normalized = MOS5NF_normalizeEvent_(event);

  const result =
    MOS5NF_queueBrokerNotification_(
      normalized,
      "LEAD_ERROR_BROKER",
      "MelroseOS lead-processing error",
      normalized.payload
    );

  return MOS5NF_subscriberResult_(
    "LEAD_ERROR",
    normalized,
    [result]
  );
}

/**
 * Handles a broker-fallback event.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5NF_handleBrokerFallbackEvent(event) {
  const normalized = MOS5NF_normalizeEvent_(event);

  const result =
    MOS5NF_queueBrokerNotification_(
      normalized,
      "LEAD_BROKER_FALLBACK",
      "Lead assigned to broker fallback",
      normalized.payload
    );

  return MOS5NF_subscriberResult_(
    "LEAD_BROKER_FALLBACK",
    normalized,
    [result]
  );
}

/**
 * Generic Event Bus subscriber.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5NF_handleEnterpriseEvent(event) {
  const normalized = MOS5NF_normalizeEvent_(event);

  switch (normalized.eventType) {
    case "LEAD_ASSIGNED":
      return MOS5NF_handleLeadAssignedEvent(event);

    case "LEAD_UNASSIGNED":
      return MOS5NF_handleLeadUnassignedEvent(event);

    case "LEAD_ERROR":
      return MOS5NF_handleLeadErrorEvent(event);

    case "LEAD_BROKER_FALLBACK":
      return MOS5NF_handleBrokerFallbackEvent(event);

    default:
      return {
        success: true,
        status: "IGNORED",
        eventId: normalized.eventId,
        eventType: normalized.eventType,
        queued: 0,
        productionChanged: false
      };
  }
}

/**
 * Queues one notification job.
 *
 * @param {Object} job
 * @return {Object}
 */
function MOS5NF_queueNotification(job) {
  const input = job || {};

  const recipientEmail = String(
    input.recipientEmail || ""
  )
    .trim()
    .toLowerCase();

  if (!recipientEmail) {
    return {
      success: false,
      status: "MISSING_RECIPIENT",
      notificationId: "",
      productionChanged: false
    };
  }

  const templateCode = String(
    input.templateCode || ""
  )
    .trim()
    .toUpperCase();

  if (!templateCode) {
    throw new Error(
      "templateCode is required."
    );
  }

  const sheet =
    MOS5NF_ensureNotificationQueue_();

  const duplicate =
    MOS5NF_findDuplicateNotification_(
      sheet,
      {
        eventId: input.eventId,
        recipientEmail: recipientEmail,
        templateCode: templateCode
      }
    );

  if (duplicate) {
    return {
      success: true,
      status: "DUPLICATE_SKIPPED",
      notificationId:
        String(
          duplicate.NotificationID || ""
        ),
      eventId:
        String(input.eventId || ""),
      productionChanged: false
    };
  }

  const gate =
    MOS5NF_getCommunicationsGate_();

  const now = new Date();

  const record = {
    NotificationID:
      MOS5NF_id_("NTF"),

    EventID:
      String(input.eventId || "").trim(),

    EventType:
      String(input.eventType || "")
        .trim()
        .toUpperCase(),

    LeadID:
      String(input.leadId || "").trim(),

    IntakeID:
      String(input.intakeId || "").trim(),

    RecipientType:
      String(input.recipientType || "INTERNAL")
        .trim()
        .toUpperCase(),

    RecipientID:
      String(input.recipientId || "").trim(),

    RecipientName:
      String(input.recipientName || "").trim(),

    RecipientEmail:
      recipientEmail,

    TemplateCode:
      templateCode,

    Subject:
      String(input.subject || "").trim(),

    PayloadJSON:
      MOS5NF_safeJson_(input.payload || {}),

    Status:
      gate.open
        ? MOS5_NOTIFICATION_SUBSCRIBER.STATUS.PENDING
        : MOS5_NOTIFICATION_SUBSCRIBER.STATUS.HELD,

    Priority:
      Math.max(
        1,
        Number(input.priority || 5)
      ),

    Attempts: 0,

    MaxAttempts:
      Math.max(
        1,
        Number(
          input.maxAttempts ||
          MOS5_NOTIFICATION_SUBSCRIBER
            .DEFAULT_MAX_ATTEMPTS
        )
      ),

    AvailableAt:
      input.availableAt
        ? new Date(input.availableAt)
        : now,

    SentAt: "",
    LastError:
      gate.open
        ? ""
        : gate.reason,

    CreatedAt: now,
    UpdatedAt: now
  };

  MOS5NF_appendObjectRow_(
    sheet,
    record
  );

  if (
    typeof MOS5_publishNotificationQueued_ ===
    "function"
  ) {
    try {
      MOS5_publishNotificationQueued_(
        {
          notificationId:
            record.NotificationID,
          eventId:
            record.EventID,
          leadId:
            record.LeadID,
          recipientType:
            record.RecipientType,
          recipientEmail:
            record.RecipientEmail,
          templateCode:
            record.TemplateCode,
          status:
            record.Status
        },
        {
          aggregateType: "LEAD",
          aggregateId:
            record.LeadID,
          causationId:
            record.EventID,
          source:
            "NOTIFICATION_SUBSCRIBER"
        }
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          module:
            "MOS5_NOTIFICATION_SUBSCRIBER",
          warning:
            "NOTIFICATION_EVENT_PUBLISH_FAILED",
          notificationId:
            record.NotificationID,
          error:
            error.message ||
            String(error)
        })
      );
    }
  }

  return {
    success: true,
    status: record.Status,
    notificationId:
      record.NotificationID,
    eventId:
      record.EventID,
    recipientEmail:
      record.RecipientEmail,
    templateCode:
      record.TemplateCode,
    communicationsGate:
      gate,
    productionChanged: false,
    queuedAt:
      now.toISOString()
  };
}

/**
 * Releases HELD notifications when communications are permitted.
 *
 * @param {number=} limit
 * @return {Object}
 */
function MOS5NF_releaseHeldNotifications(limit) {
  const gate =
    MOS5NF_getCommunicationsGate_();

  if (!gate.open) {
    return {
      success: false,
      status: "COMMUNICATIONS_HELD",
      released: 0,
      reason: gate.reason,
      productionChanged: false
    };
  }

  const max = Math.max(
    1,
    Math.min(
      Number(limit || 100),
      500
    )
  );

  const sheet =
    MOS5NF_ensureNotificationQueue_();

  const records =
    MOS5NF_sheetObjects_(sheet)
      .filter(function(record) {
        return (
          String(record.Status || "")
            .trim()
            .toUpperCase() ===
          MOS5_NOTIFICATION_SUBSCRIBER
            .STATUS.HELD
        );
      })
      .slice(0, max);

  records.forEach(function(record) {
    MOS5NF_updateNotificationRow_(
      sheet,
      record._row,
      {
        Status:
          MOS5_NOTIFICATION_SUBSCRIBER
            .STATUS.PENDING,
        LastError: "",
        UpdatedAt: new Date()
      }
    );
  });

  return {
    success: true,
    status: "RELEASED",
    released: records.length,
    productionChanged:
      records.length > 0,
    completedAt:
      new Date().toISOString()
  };
}

/**
 * Returns notification queue counts.
 *
 * @return {Object}
 */
function MOS5NF_getNotificationQueueStatus() {
  const records =
    MOS5NF_sheetObjects_(
      MOS5NF_ensureNotificationQueue_()
    );

  const count = function(status) {
    return records.filter(function(record) {
      return (
        String(record.Status || "")
          .trim()
          .toUpperCase() === status
      );
    }).length;
  };

  return {
    release:
      "MOS5-ENTERPRISE-NOTIFICATION-SUBSCRIBER",

    version:
      MOS5_NOTIFICATION_SUBSCRIBER_VERSION,

    total: records.length,

    pending:
      count(
        MOS5_NOTIFICATION_SUBSCRIBER
          .STATUS.PENDING
      ),

    held:
      count(
        MOS5_NOTIFICATION_SUBSCRIBER
          .STATUS.HELD
      ),

    processing:
      count(
        MOS5_NOTIFICATION_SUBSCRIBER
          .STATUS.PROCESSING
      ),

    sent:
      count(
        MOS5_NOTIFICATION_SUBSCRIBER
          .STATUS.SENT
      ),

    failed:
      count(
        MOS5_NOTIFICATION_SUBSCRIBER
          .STATUS.FAILED
      ),

    cancelled:
      count(
        MOS5_NOTIFICATION_SUBSCRIBER
          .STATUS.CANCELLED
      ),

    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function MOS5NF_runSubscriberDiagnostics() {
  const sheet =
    MOS5NF_ensureNotificationQueue_();

  const requirements = [
    "MOS5M1B_checkCommunicationsGate_",
    "MOS5_publishNotificationQueued_"
  ];

  const tests = requirements.map(
    function(name) {
      return {
        code: name,
        status:
          typeof globalThis[name] ===
          "function"
            ? "PASS"
            : "FAIL"
      };
    }
  );

  tests.push({
    code: "NOTIFICATION_QUEUE_SHEET",
    status:
      Boolean(sheet)
        ? "PASS"
        : "FAIL"
  });

  const failed =
    tests.filter(function(test) {
      return test.status === "FAIL";
    }).length;

  return {
    release:
      "MOS5-ENTERPRISE-NOTIFICATION-SUBSCRIBER",

    version:
      MOS5_NOTIFICATION_SUBSCRIBER_VERSION,

    overallStatus:
      failed ? "FAIL" : "PASS",

    passed:
      tests.length - failed,

    failed: failed,

    tests: tests,

    queue:
      MOS5NF_getNotificationQueueStatus(),

    productionChanged: false,

    completedAt:
      new Date().toISOString()
  };
}

function MOS5NF_queueBrokerNotification_(
  normalized,
  templateCode,
  subject,
  payload
) {
  const broker =
    MOS5NF_getBroker_();

  return MOS5NF_queueNotification({
    eventId:
      normalized.eventId,
    eventType:
      normalized.eventType,
    leadId:
      normalized.leadId,
    intakeId:
      normalized.intakeId,
    recipientType: "BROKER",
    recipientId:
      broker.agentId,
    recipientName:
      broker.agentName,
    recipientEmail:
      broker.email,
    templateCode:
      templateCode,
    subject:
      subject,
    priority: 1,
    payload:
      payload || normalized.payload
  });
}

function MOS5NF_getBroker_() {
  let broker = null;

  if (
    typeof AE_getAgent === "function"
  ) {
    broker =
      AE_getAgent(
        MOS5_NOTIFICATION_SUBSCRIBER
          .BROKER_EMAIL
      ) ||
      AE_getAgent("BROKER-001");
  }

  return {
    agentId:
      String(
        broker &&
        broker.AgentID ||
        "BROKER-001"
      ),

    agentName:
      String(
        broker &&
        broker.AgentName ||
        MOS5_NOTIFICATION_SUBSCRIBER
          .BROKER_NAME
      ),

    email:
      String(
        broker &&
        broker.Email ||
        MOS5_NOTIFICATION_SUBSCRIBER
          .BROKER_EMAIL
      )
        .trim()
        .toLowerCase()
  };
}

function MOS5NF_getCommunicationsGate_() {
  if (
    typeof MOS5M1B_checkCommunicationsGate_ !==
    "function"
  ) {
    return {
      open: false,
      reason:
        "Canonical communications safety gate is unavailable."
    };
  }

  try {
    const gate =
      MOS5M1B_checkCommunicationsGate_();

    return {
      open:
        Boolean(
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
      reason:
        error.message ||
        String(error)
    };
  }
}

function MOS5NF_normalizeEvent_(event) {
  const input = event || {};

  const payload =
    input.payload &&
    typeof input.payload === "object"
      ? input.payload
      : input;

  return {
    eventId:
      String(
        input.eventId ||
        input.EventID ||
        ""
      ).trim(),

    eventType:
      String(
        input.eventType ||
        input.EventType ||
        ""
      )
        .trim()
        .toUpperCase(),

    leadId:
      String(
        input.aggregateId ||
        payload.LeadID ||
        payload.leadId ||
        ""
      ).trim(),

    intakeId:
      String(
        payload.IntakeID ||
        payload.intakeId ||
        ""
      ).trim(),

    payload:
      payload
  };
}

function MOS5NF_isBrokerFallback_(payload) {
  return (
    payload &&
    (
      payload.brokerFallback === true ||
      String(
        payload.method ||
        payload.AssignmentMethod ||
        ""
      )
        .trim()
        .toUpperCase() ===
        "BROKER_FALLBACK"
    )
  );
}

function MOS5NF_subscriberResult_(
  eventType,
  normalized,
  results
) {
  const successful =
    results.filter(function(result) {
      return result &&
        result.success === true;
    }).length;

  return {
    success:
      successful === results.length,

    status:
      results.length === 0
        ? "NO_NOTIFICATION_REQUIRED"
        : successful === results.length
          ? "QUEUED"
          : "PARTIAL",

    eventId:
      normalized.eventId,

    eventType:
      eventType,

    queued:
      successful,

    results:
      results,

    productionChanged: false,

    completedAt:
      new Date().toISOString()
  };
}

function MOS5NF_ensureNotificationQueue_() {
  const ss =
    typeof workbook_ === "function"
      ? workbook_()
      : SpreadsheetApp
          .getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      MOS5_NOTIFICATION_SUBSCRIBER.SHEET
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        MOS5_NOTIFICATION_SUBSCRIBER.SHEET
      );
  }

  MOS5NF_ensureHeaders_(
    sheet,
    MOS5_NOTIFICATION_SUBSCRIBER.HEADERS
  );

  return sheet;
}

function MOS5NF_ensureHeaders_(
  sheet,
  requiredHeaders
) {
  if (
    sheet.getLastRow() === 0 ||
    sheet.getLastColumn() === 0
  ) {
    sheet
      .getRange(
        1,
        1,
        1,
        requiredHeaders.length
      )
      .setValues([requiredHeaders]);

    sheet.setFrozenRows(1);
    return;
  }

  const existing =
    sheet
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

  const missing =
    requiredHeaders.filter(
      function(header) {
        return (
          existing.indexOf(header) === -1
        );
      }
    );

  if (missing.length) {
    sheet
      .getRange(
        1,
        existing.length + 1,
        1,
        missing.length
      )
      .setValues([missing]);
  }

  sheet.setFrozenRows(1);
}

function MOS5NF_sheetObjects_(sheet) {
  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return [];
  }

  const headers =
    sheet
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

  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        headers.length
      )
      .getValues();

  return values.map(
    function(row, index) {
      const record = {
        _row: index + 2
      };

      headers.forEach(
        function(header, column) {
          record[header] = row[column];
        }
      );

      return record;
    }
  );
}

function MOS5NF_findDuplicateNotification_(
  sheet,
  criteria
) {
  const eventId =
    String(criteria.eventId || "").trim();

  const email =
    String(criteria.recipientEmail || "")
      .trim()
      .toLowerCase();

  const template =
    String(criteria.templateCode || "")
      .trim()
      .toUpperCase();

  return (
    MOS5NF_sheetObjects_(sheet)
      .find(function(record) {
        return (
          String(record.EventID || "")
            .trim() === eventId &&
          String(record.RecipientEmail || "")
            .trim()
            .toLowerCase() === email &&
          String(record.TemplateCode || "")
            .trim()
            .toUpperCase() === template &&
          String(record.Status || "")
            .trim()
            .toUpperCase() !==
            MOS5_NOTIFICATION_SUBSCRIBER
              .STATUS.CANCELLED
        );
      }) ||
    null
  );
}

function MOS5NF_appendObjectRow_(
  sheet,
  payload
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  sheet.appendRow(
    headers.map(function(header) {
      return payload[header] !== undefined
        ? payload[header]
        : "";
    })
  );

  return sheet.getLastRow();
}

function MOS5NF_updateNotificationRow_(
  sheet,
  rowNumber,
  payload
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  const current =
    sheet
      .getRange(
        rowNumber,
        1,
        1,
        headers.length
      )
      .getValues()[0];

  const updated =
    headers.map(function(header, index) {
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

function MOS5NF_safeJson_(value) {
  try {
    return JSON.stringify(
      value === undefined
        ? null
        : value
    );
  } catch (error) {
    return JSON.stringify({
      serializationError:
        error.message ||
        String(error)
    });
  }
}

function MOS5NF_id_(prefix) {
  return (
    String(prefix || "NTF")
      .trim()
      .toUpperCase() +
    "-" +
    Utilities
      .getUuid()
      .replace(/-/g, "")
      .substring(0, 20)
      .toUpperCase()
  );
}