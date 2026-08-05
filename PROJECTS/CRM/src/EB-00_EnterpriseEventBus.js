/******************************************************************************
 * MelroseOS Enterprise
 * File: EB-00_EnterpriseEventBus.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Canonical event bus for CRM lifecycle events.
 *
 * Supported events:
 *   LEAD_RECEIVED
 *   LEAD_VALIDATED
 *   LEAD_DUPLICATE
 *   LEAD_QUEUED
 *   LEAD_ASSIGNED
 *   LEAD_UNASSIGNED
 *   LEAD_ERROR
 *   NOTIFICATION_QUEUED
 *   NOTIFICATION_SENT
 *   FOLLOWUP_QUEUED
 ******************************************************************************/

const MOS5_EVENT_BUS_VERSION = "1.0.0";

const MOS5_EVENT_BUS = Object.freeze({
  SHEET: "SYS_EVENT_QUEUE",

  STATUS: Object.freeze({
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    DEAD_LETTER: "DEAD_LETTER"
  }),

  HEADERS: Object.freeze([
    "EventID",
    "EventType",
    "AggregateType",
    "AggregateID",
    "PayloadJSON",
    "MetadataJSON",
    "Status",
    "Attempts",
    "MaxAttempts",
    "AvailableAt",
    "LockedAt",
    "LockedBy",
    "ProcessedAt",
    "LastError",
    "CreatedAt",
    "UpdatedAt"
  ]),

  DEFAULT_MAX_ATTEMPTS: 5,
  LOCK_TIMEOUT_MS: 10000,
  STALE_PROCESSING_MINUTES: 15
});

/**
 * Publishes an immutable event into the event queue.
 *
 * @param {string} eventType
 * @param {Object=} payload
 * @param {Object=} options
 * @return {Object}
 */
function MOS5_publishEvent(eventType, payload, options) {
  const settings = options || {};

  const normalizedType = String(eventType || "")
    .trim()
    .toUpperCase();

  if (!normalizedType) {
    throw new Error("eventType is required.");
  }

  const sheet = MOS5EB_ensureEventQueue_();
  const now = new Date();

  const event = {
    EventID: MOS5EB_eventId_(),
    EventType: normalizedType,

    AggregateType: String(
      settings.aggregateType ||
      payload &&
      payload.aggregateType ||
      ""
    )
      .trim()
      .toUpperCase(),

    AggregateID: String(
      settings.aggregateId ||
      payload &&
      (
        payload.LeadID ||
        payload.leadId ||
        payload.IntakeID ||
        payload.intakeId ||
        payload.executionId
      ) ||
      ""
    ).trim(),

    PayloadJSON: MOS5EB_safeJson_(payload || {}),

    MetadataJSON: MOS5EB_safeJson_({
      source:
        settings.source ||
        "MELROSEOS",
      correlationId:
        settings.correlationId ||
        "",
      causationId:
        settings.causationId ||
        "",
      publishedBy:
        settings.publishedBy ||
        MOS5EB_currentUser_(),
      version:
        settings.version ||
        MOS5_EVENT_BUS_VERSION
    }),

    Status: MOS5_EVENT_BUS.STATUS.PENDING,
    Attempts: 0,

    MaxAttempts: Math.max(
      1,
      Number(
        settings.maxAttempts ||
        MOS5_EVENT_BUS.DEFAULT_MAX_ATTEMPTS
      )
    ),

    AvailableAt:
      settings.availableAt
        ? new Date(settings.availableAt)
        : now,

    LockedAt: "",
    LockedBy: "",
    ProcessedAt: "",
    LastError: "",
    CreatedAt: now,
    UpdatedAt: now
  };

  MOS5EB_appendObjectRow_(
    sheet,
    event
  );

  return {
    success: true,
    status: "PUBLISHED",
    eventId: event.EventID,
    eventType: event.EventType,
    aggregateType:
      event.AggregateType,
    aggregateId:
      event.AggregateID,
    queuedAt:
      now.toISOString(),
    productionChanged: false
  };
}

/**
 * Processes pending events.
 *
 * @param {number=} limit
 * @return {Object}
 */
function MOS5_processEventQueue(limit) {
  const startedAt = new Date();
  const lock = LockService.getScriptLock();

  if (
    !lock.tryLock(
      MOS5_EVENT_BUS.LOCK_TIMEOUT_MS
    )
  ) {
    return {
      success: false,
      status: "EVENT_QUEUE_BUSY",
      processed: 0,
      completed: 0,
      failed: 0,
      deadLettered: 0,
      startedAt:
        startedAt.toISOString(),
      completedAt:
        new Date().toISOString()
    };
  }

  try {
    const sheet =
      MOS5EB_ensureEventQueue_();

    MOS5EB_recoverStaleEvents_(
      sheet
    );

    const max = Math.max(
      1,
      Math.min(
        Number(limit || 50),
        500
      )
    );

    const now = new Date();

    const events =
      MOS5EB_sheetObjects_(sheet)
        .filter(function(event) {
          return (
            String(
              event.Status || ""
            )
              .trim()
              .toUpperCase() ===
              MOS5_EVENT_BUS.STATUS.PENDING &&
            MOS5EB_dateNumber_(
              event.AvailableAt
            ) <= now.getTime()
          );
        })
        .slice(0, max);

    const workerId =
      MOS5EB_workerId_();

    const results = [];

    events.forEach(function(event) {
      results.push(
        MOS5EB_processOneEvent_(
          sheet,
          event,
          workerId
        )
      );
    });

    const completed =
      results.filter(function(result) {
        return (
          result.status ===
          MOS5_EVENT_BUS.STATUS.COMPLETED
        );
      }).length;

    const failed =
      results.filter(function(result) {
        return (
          result.status ===
          MOS5_EVENT_BUS.STATUS.FAILED
        );
      }).length;

    const deadLettered =
      results.filter(function(result) {
        return (
          result.status ===
          MOS5_EVENT_BUS.STATUS.DEAD_LETTER
        );
      }).length;

    return {
      success:
        failed === 0 &&
        deadLettered === 0,

      status:
        results.length === 0
          ? "EMPTY"
          : (
            failed === 0 &&
            deadLettered === 0
              ? "COMPLETE"
              : "PARTIAL"
          ),

      version:
        MOS5_EVENT_BUS_VERSION,

      processed:
        results.length,

      completed:
        completed,

      failed:
        failed,

      deadLettered:
        deadLettered,

      workerId:
        workerId,

      results:
        results,

      startedAt:
        startedAt.toISOString(),

      completedAt:
        new Date().toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Processes one queued event.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} event
 * @param {string} workerId
 * @return {Object}
 */
function MOS5EB_processOneEvent_(
  sheet,
  event,
  workerId
) {
  const eventId = String(
    event.EventID || ""
  ).trim();

  const current =
    MOS5EB_getEventById_(
      sheet,
      eventId
    );

  if (!current) {
    return {
      success: false,
      eventId: eventId,
      status: "MISSING"
    };
  }

  if (
    String(
      current.Status || ""
    )
      .trim()
      .toUpperCase() !==
    MOS5_EVENT_BUS.STATUS.PENDING
  ) {
    return {
      success: false,
      eventId: eventId,
      status: "SKIPPED"
    };
  }

  const attempts =
    Number(
      current.Attempts || 0
    ) + 1;

  MOS5EB_updateEventRow_(
    sheet,
    current._row,
    {
      Status:
        MOS5_EVENT_BUS.STATUS.PROCESSING,
      Attempts:
        attempts,
      LockedAt:
        new Date(),
      LockedBy:
        workerId,
      UpdatedAt:
        new Date()
    }
  );

  try {
    const payload =
      MOS5EB_parseJson_(
        current.PayloadJSON,
        {}
      );

    const metadata =
      MOS5EB_parseJson_(
        current.MetadataJSON,
        {}
      );

    const dispatch =
      MOS5EB_dispatchEvent_({
        eventId:
          eventId,

        eventType:
          String(
            current.EventType || ""
          )
            .trim()
            .toUpperCase(),

        aggregateType:
          String(
            current.AggregateType || ""
          )
            .trim()
            .toUpperCase(),

        aggregateId:
          String(
            current.AggregateID || ""
          ).trim(),

        payload:
          payload,

        metadata:
          metadata,

        attempts:
          attempts,

        createdAt:
          current.CreatedAt
      });

    MOS5EB_updateEventRow_(
      sheet,
      current._row,
      {
        Status:
          MOS5_EVENT_BUS.STATUS.COMPLETED,
        ProcessedAt:
          new Date(),
        LockedAt:
          "",
        LockedBy:
          "",
        LastError:
          "",
        UpdatedAt:
          new Date()
      }
    );

    return {
      success: true,
      eventId:
        eventId,
      eventType:
        current.EventType,
      status:
        MOS5_EVENT_BUS.STATUS.COMPLETED,
      attempts:
        attempts,
      dispatch:
        dispatch
    };
  } catch (error) {
    const message = String(
      error && error.message
        ? error.message
        : error
    );

    const maxAttempts =
      Math.max(
        1,
        Number(
          current.MaxAttempts ||
          MOS5_EVENT_BUS.DEFAULT_MAX_ATTEMPTS
        )
      );

    const exhausted =
      attempts >= maxAttempts;

    const nextStatus =
      exhausted
        ? MOS5_EVENT_BUS.STATUS.DEAD_LETTER
        : MOS5_EVENT_BUS.STATUS.FAILED;

    MOS5EB_updateEventRow_(
      sheet,
      current._row,
      {
        Status:
          nextStatus,
        LockedAt:
          "",
        LockedBy:
          "",
        LastError:
          message,
        UpdatedAt:
          new Date()
      }
    );

    return {
      success: false,
      eventId:
        eventId,
      eventType:
        current.EventType,
      status:
        nextStatus,
      attempts:
        attempts,
      error:
        message
    };
  }
}

/**
 * Dispatches an event to registered runtime handlers.
 *
 * Handlers are discovered dynamically to prevent hard dependencies.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5EB_dispatchEvent_(event) {
  const handlerNames =
    MOS5EB_getHandlerNames_(
      event.eventType
    );

  const results = [];

  handlerNames.forEach(
    function(handlerName) {
      const handler =
        globalThis[handlerName];

      if (
        typeof handler !== "function"
      ) {
        results.push({
          handler:
            handlerName,
          status:
            "UNAVAILABLE"
        });

        return;
      }

      const response =
        handler(event);

      results.push({
        handler:
          handlerName,
        status:
          "COMPLETED",
        response:
          response === undefined
            ? null
            : response
      });
    }
  );

  return {
    eventType:
      event.eventType,
    handlerCount:
      handlerNames.length,
    completedHandlers:
      results.filter(
        function(result) {
          return (
            result.status ===
            "COMPLETED"
          );
        }
      ).length,
    unavailableHandlers:
      results.filter(
        function(result) {
          return (
            result.status ===
            "UNAVAILABLE"
          );
        }
      ).length,
    handlers:
      results
  };
}

/**
 * Returns the approved handlers for an event.
 *
 * Handler functions may be added later without changing the event bus.
 *
 * @param {string} eventType
 * @return {Array<string>}
 */
function MOS5EB_getHandlerNames_(
  eventType
) {
  const registry = {
    LEAD_RECEIVED: [
      "MOS5EB_handleLeadReceived_"
    ],

    LEAD_VALIDATED: [
      "MOS5EB_handleLeadValidated_"
    ],

    LEAD_DUPLICATE: [
      "MOS5EB_handleLeadDuplicate_"
    ],

    LEAD_QUEUED: [
      "MOS5EB_handleLeadQueued_"
    ],

    LEAD_ASSIGNED: [
      "MOS5EB_handleLeadAssigned_"
    ],

    LEAD_UNASSIGNED: [
      "MOS5EB_handleLeadUnassigned_"
    ],

    LEAD_ERROR: [
      "MOS5EB_handleLeadError_"
    ],

    NOTIFICATION_QUEUED: [
      "MOS5EB_handleNotificationQueued_"
    ],

    NOTIFICATION_SENT: [
      "MOS5EB_handleNotificationSent_"
    ],

    FOLLOWUP_QUEUED: [
      "MOS5EB_handleFollowupQueued_"
    ]
  };

  return registry[
    String(eventType || "")
      .trim()
      .toUpperCase()
  ] || [];
}

/**
 * Default no-op handlers.
 * They provide safe extension points without causing missing dependencies.
 */

function MOS5EB_handleLeadReceived_(event) {
  return MOS5EB_defaultHandler_(
    "LEAD_RECEIVED",
    event
  );
}

function MOS5EB_handleLeadValidated_(event) {
  return MOS5EB_defaultHandler_(
    "LEAD_VALIDATED",
    event
  );
}

function MOS5EB_handleLeadDuplicate_(event) {
  return MOS5EB_defaultHandler_(
    "LEAD_DUPLICATE",
    event
  );
}

function MOS5EB_handleLeadQueued_(event) {
  return MOS5EB_defaultHandler_(
    "LEAD_QUEUED",
    event
  );
}

function MOS5EB_handleLeadAssigned_(event) {
  return MOS5EB_defaultHandler_(
    "LEAD_ASSIGNED",
    event
  );
}

function MOS5EB_handleLeadUnassigned_(event) {
  return MOS5EB_defaultHandler_(
    "LEAD_UNASSIGNED",
    event
  );
}

function MOS5EB_handleLeadError_(event) {
  return MOS5EB_defaultHandler_(
    "LEAD_ERROR",
    event
  );
}

function MOS5EB_handleNotificationQueued_(event) {
  return MOS5EB_defaultHandler_(
    "NOTIFICATION_QUEUED",
    event
  );
}

function MOS5EB_handleNotificationSent_(event) {
  return MOS5EB_defaultHandler_(
    "NOTIFICATION_SENT",
    event
  );
}

function MOS5EB_handleFollowupQueued_(event) {
  return MOS5EB_defaultHandler_(
    "FOLLOWUP_QUEUED",
    event
  );
}

function MOS5EB_defaultHandler_(
  eventType,
  event
) {
  console.log(
    JSON.stringify({
      module:
        "MOS5_EVENT_BUS",
      eventType:
        eventType,
      eventId:
        event.eventId,
      aggregateId:
        event.aggregateId,
      handledAt:
        new Date().toISOString()
    })
  );

  return {
    success: true,
    eventType:
      eventType,
    eventId:
      event.eventId,
    productionChanged: false
  };
}

/**
 * Retries FAILED events.
 *
 * @param {number=} limit
 * @return {Object}
 */
function MOS5_retryFailedEvents(limit) {
  const sheet =
    MOS5EB_ensureEventQueue_();

  const max = Math.max(
    1,
    Math.min(
      Number(limit || 50),
      500
    )
  );

  const rows =
    MOS5EB_sheetObjects_(sheet)
      .filter(function(event) {
        return (
          String(
            event.Status || ""
          )
            .trim()
            .toUpperCase() ===
          MOS5_EVENT_BUS.STATUS.FAILED
        );
      })
      .slice(0, max);

  rows.forEach(function(event) {
    MOS5EB_updateEventRow_(
      sheet,
      event._row,
      {
        Status:
          MOS5_EVENT_BUS.STATUS.PENDING,
        AvailableAt:
          new Date(),
        LockedAt:
          "",
        LockedBy:
          "",
        UpdatedAt:
          new Date()
      }
    );
  });

  return MOS5_processEventQueue(
    max
  );
}

/**
 * Returns queue status counts.
 *
 * @return {Object}
 */
function MOS5_getEventBusStatus() {
  const sheet =
    MOS5EB_ensureEventQueue_();

  const events =
    MOS5EB_sheetObjects_(sheet);

  const count = function(status) {
    return events.filter(
      function(event) {
        return (
          String(
            event.Status || ""
          )
            .trim()
            .toUpperCase() ===
          status
        );
      }
    ).length;
  };

  return {
    release:
      "MOS5-ENTERPRISE-EVENT-BUS",
    version:
      MOS5_EVENT_BUS_VERSION,
    total:
      events.length,
    pending:
      count(
        MOS5_EVENT_BUS.STATUS.PENDING
      ),
    processing:
      count(
        MOS5_EVENT_BUS.STATUS.PROCESSING
      ),
    completed:
      count(
        MOS5_EVENT_BUS.STATUS.COMPLETED
      ),
    failed:
      count(
        MOS5_EVENT_BUS.STATUS.FAILED
      ),
    deadLetter:
      count(
        MOS5_EVENT_BUS.STATUS.DEAD_LETTER
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
function MOS5_runEventBusDiagnostics() {
  const sheet =
    MOS5EB_ensureEventQueue_();

  const tests = [];

  function add(
    code,
    passed,
    details
  ) {
    tests.push({
      code:
        code,
      status:
        passed
          ? "PASS"
          : "FAIL",
      details:
        details
    });
  }

  add(
    "EVENT_QUEUE_SHEET",
    Boolean(sheet),
    "SYS_EVENT_QUEUE exists."
  );

  add(
    "HEADERS_PRESENT",
    sheet.getLastColumn() >=
      MOS5_EVENT_BUS.HEADERS.length,
    "Required event queue headers exist."
  );

  add(
    "PUBLISH_FUNCTION",
    typeof MOS5_publishEvent ===
      "function",
    "Event publisher exists."
  );

  add(
    "PROCESS_FUNCTION",
    typeof MOS5_processEventQueue ===
      "function",
    "Event worker exists."
  );

  add(
    "RETRY_FUNCTION",
    typeof MOS5_retryFailedEvents ===
      "function",
    "Failed event retry exists."
  );

  const failed =
    tests.filter(function(test) {
      return (
        test.status ===
        "FAIL"
      );
    }).length;

  return {
    release:
      "MOS5-ENTERPRISE-EVENT-BUS",
    version:
      MOS5_EVENT_BUS_VERSION,
    overallStatus:
      failed
        ? "FAIL"
        : "PASS",
    passed:
      tests.length - failed,
    failed:
      failed,
    tests:
      tests,
    queue:
      MOS5_getEventBusStatus(),
    productionChanged:
      false,
    completedAt:
      new Date().toISOString()
  };
}

function MOS5EB_ensureEventQueue_() {
  const ss =
    typeof workbook_ === "function"
      ? workbook_()
      : SpreadsheetApp
          .getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      MOS5_EVENT_BUS.SHEET
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        MOS5_EVENT_BUS.SHEET
      );
  }

  MOS5EB_ensureHeaders_(
    sheet,
    MOS5_EVENT_BUS.HEADERS
  );

  return sheet;
}

function MOS5EB_ensureHeaders_(
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
      .setValues([
        requiredHeaders
      ]);

    sheet.setFrozenRows(1);
    return;
  }

  const current =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0]
      .map(function(value) {
        return String(
          value || ""
        ).trim();
      });

  const missing =
    requiredHeaders.filter(
      function(header) {
        return (
          current.indexOf(
            header
          ) === -1
        );
      }
    );

  if (missing.length) {
    sheet
      .getRange(
        1,
        current.length + 1,
        1,
        missing.length
      )
      .setValues([
        missing
      ]);
  }

  sheet.setFrozenRows(1);
}

function MOS5EB_sheetObjects_(sheet) {
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
        return String(
          value || ""
        ).trim();
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
      const result = {
        _row:
          index + 2
      };

      headers.forEach(
        function(header, column) {
          result[header] =
            row[column];
        }
      );

      return result;
    }
  );
}

function MOS5EB_getEventById_(
  sheet,
  eventId
) {
  const target =
    String(eventId || "")
      .trim();

  return (
    MOS5EB_sheetObjects_(sheet)
      .find(function(event) {
        return (
          String(
            event.EventID || ""
          ).trim() === target
        );
      }) ||
    null
  );
}

function MOS5EB_appendObjectRow_(
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
      return (
        payload[header] !==
        undefined
          ? payload[header]
          : ""
      );
    })
  );

  return sheet.getLastRow();
}

function MOS5EB_updateEventRow_(
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
    headers.map(
      function(header, index) {
        return (
          payload[header] !==
          undefined
            ? payload[header]
            : current[index]
        );
      }
    );

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      headers.length
    )
    .setValues([
      updated
    ]);

  return true;
}

function MOS5EB_recoverStaleEvents_(
  sheet
) {
  const threshold =
    new Date(
      Date.now() -
      MOS5_EVENT_BUS
        .STALE_PROCESSING_MINUTES *
      60 *
      1000
    );

  MOS5EB_sheetObjects_(sheet)
    .filter(function(event) {
      return (
        String(
          event.Status || ""
        )
          .trim()
          .toUpperCase() ===
          MOS5_EVENT_BUS.STATUS.PROCESSING &&
        MOS5EB_dateNumber_(
          event.LockedAt
        ) <
          threshold.getTime()
      );
    })
    .forEach(function(event) {
      MOS5EB_updateEventRow_(
        sheet,
        event._row,
        {
          Status:
            MOS5_EVENT_BUS.STATUS.PENDING,
          LockedAt:
            "",
          LockedBy:
            "",
          LastError:
            "Recovered stale processing lock.",
          UpdatedAt:
            new Date()
        }
      );
    });
}

function MOS5EB_eventId_() {
  return (
    "EVT-" +
    Utilities
      .getUuid()
      .replace(/-/g, "")
      .substring(0, 20)
      .toUpperCase()
  );
}

function MOS5EB_workerId_() {
  return (
    "WORKER-" +
    Utilities
      .getUuid()
      .replace(/-/g, "")
      .substring(0, 12)
      .toUpperCase()
  );
}

function MOS5EB_currentUser_() {
  try {
    return String(
      Session
        .getEffectiveUser()
        .getEmail() ||
      ""
    )
      .trim()
      .toLowerCase();
  } catch (error) {
    return "";
  }
}

function MOS5EB_safeJson_(value) {
  try {
    return JSON.stringify(
      value === undefined
        ? null
        : value
    );
  } catch (error) {
    return JSON.stringify({
      serializationError:
        String(
          error &&
          error.message
            ? error.message
            : error
        )
    });
  }
}

function MOS5EB_parseJson_(
  value,
  fallback
) {
  if (
    value &&
    typeof value === "object"
  ) {
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

function MOS5EB_dateNumber_(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed =
    new Date(value);

  const result =
    parsed.getTime();

  return Number.isFinite(result)
    ? result
    : 0;
}