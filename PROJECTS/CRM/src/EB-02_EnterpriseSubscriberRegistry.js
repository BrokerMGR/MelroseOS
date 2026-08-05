/******************************************************************************
 * MelroseOS Enterprise
 * File: EB-02_EnterpriseSubscriberRegistry.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Canonical registry and dispatcher for Enterprise Event Bus subscribers.
 *
 * Safety:
 *   - One subscriber failure does not stop other subscribers.
 *   - Subscriber functions are resolved dynamically.
 *   - Disabled subscribers are skipped.
 *   - Execution results are returned for audit and retry handling.
 ******************************************************************************/

const MOS5_SUBSCRIBER_REGISTRY_VERSION = "1.0.0";

const MOS5_SUBSCRIBER_REGISTRY = Object.freeze({
  SHEET: "SYS_EVENT_SUBSCRIBERS",

  HEADERS: Object.freeze([
    "SubscriberID",
    "EventType",
    "SubscriberName",
    "HandlerFunction",
    "Enabled",
    "Priority",
    "Critical",
    "Description",
    "LastRunAt",
    "LastStatus",
    "LastDurationMs",
    "LastError",
    "CreatedAt",
    "UpdatedAt"
  ]),

  LOCK_TIMEOUT_MS: 10000
});

/**
 * Initializes the registry and installs default subscribers.
 *
 * @return {Object}
 */
function MOS5SUB_initializeRegistry() {
  const sheet = MOS5SUB_ensureRegistrySheet_();

  const defaults = MOS5SUB_defaultSubscribers_();

  defaults.forEach(function(subscriber) {
    MOS5SUB_registerSubscriber(subscriber);
  });

  return {
    success: true,
    release: "MOS5-ENTERPRISE-SUBSCRIBER-REGISTRY",
    version: MOS5_SUBSCRIBER_REGISTRY_VERSION,
    sheet: MOS5_SUBSCRIBER_REGISTRY.SHEET,
    defaultSubscribers: defaults.length,
    totalSubscribers:
      MOS5SUB_sheetObjects_(sheet).length,
    productionChanged: false,
    completedAt: new Date().toISOString()
  };
}

/**
 * Registers or updates one subscriber.
 *
 * @param {Object} subscriber
 * @return {Object}
 */
function MOS5SUB_registerSubscriber(subscriber) {
  const input = subscriber || {};

  const eventType = String(
    input.EventType ||
    input.eventType ||
    ""
  )
    .trim()
    .toUpperCase();

  const handlerFunction = String(
    input.HandlerFunction ||
    input.handlerFunction ||
    ""
  ).trim();

  if (!eventType) {
    throw new Error("EventType is required.");
  }

  if (!handlerFunction) {
    throw new Error(
      "HandlerFunction is required."
    );
  }

  const sheet =
    MOS5SUB_ensureRegistrySheet_();

  const existing =
    MOS5SUB_findSubscriber_(
      sheet,
      eventType,
      handlerFunction
    );

  const now = new Date();

  const record = {
    SubscriberID:
      existing
        ? existing.SubscriberID
        : MOS5SUB_id_("SUB"),

    EventType:
      eventType,

    SubscriberName:
      String(
        input.SubscriberName ||
        input.subscriberName ||
        handlerFunction
      ).trim(),

    HandlerFunction:
      handlerFunction,

    Enabled:
      input.Enabled !== undefined
        ? MOS5SUB_isTrue_(input.Enabled)
        : input.enabled !== undefined
          ? MOS5SUB_isTrue_(input.enabled)
          : true,

    Priority:
      Number(
        input.Priority !== undefined
          ? input.Priority
          : input.priority !== undefined
            ? input.priority
            : 100
      ),

    Critical:
      input.Critical !== undefined
        ? MOS5SUB_isTrue_(input.Critical)
        : input.critical !== undefined
          ? MOS5SUB_isTrue_(input.critical)
          : false,

    Description:
      String(
        input.Description ||
        input.description ||
        ""
      ).trim(),

    LastRunAt:
      existing
        ? existing.LastRunAt
        : "",

    LastStatus:
      existing
        ? existing.LastStatus
        : "",

    LastDurationMs:
      existing
        ? existing.LastDurationMs
        : "",

    LastError:
      existing
        ? existing.LastError
        : "",

    CreatedAt:
      existing
        ? existing.CreatedAt
        : now,

    UpdatedAt:
      now
  };

  if (existing) {
    MOS5SUB_updateRow_(
      sheet,
      existing._row,
      record
    );
  } else {
    MOS5SUB_appendRow_(
      sheet,
      record
    );
  }

  return {
    success: true,
    status:
      existing
        ? "UPDATED"
        : "REGISTERED",
    subscriberId:
      record.SubscriberID,
    eventType:
      record.EventType,
    handlerFunction:
      record.HandlerFunction,
    enabled:
      record.Enabled,
    critical:
      record.Critical,
    productionChanged: false
  };
}

/**
 * Enables or disables one subscriber.
 *
 * @param {string} subscriberId
 * @param {boolean} enabled
 * @return {Object}
 */
function MOS5SUB_setSubscriberEnabled(
  subscriberId,
  enabled
) {
  const sheet =
    MOS5SUB_ensureRegistrySheet_();

  const target = String(
    subscriberId || ""
  ).trim();

  const subscriber =
    MOS5SUB_sheetObjects_(sheet)
      .find(function(record) {
        return String(
          record.SubscriberID || ""
        ).trim() === target;
      });

  if (!subscriber) {
    throw new Error(
      "Subscriber not found: " +
      subscriberId
    );
  }

  const normalizedEnabled =
    MOS5SUB_isTrue_(enabled);

  MOS5SUB_updateRow_(
    sheet,
    subscriber._row,
    {
      Enabled:
        normalizedEnabled,
      UpdatedAt:
        new Date()
    }
  );

  return {
    success: true,
    subscriberId:
      target,
    enabled:
      normalizedEnabled,
    productionChanged:
      true
  };
}

/**
 * Returns active subscribers for an event.
 *
 * @param {string} eventType
 * @return {Array<Object>}
 */
function MOS5SUB_getSubscribers(eventType) {
  const target = String(
    eventType || ""
  )
    .trim()
    .toUpperCase();

  return MOS5SUB_sheetObjects_(
    MOS5SUB_ensureRegistrySheet_()
  )
    .filter(function(subscriber) {
      const registeredType =
        String(
          subscriber.EventType || ""
        )
          .trim()
          .toUpperCase();

      return (
        MOS5SUB_isTrue_(
          subscriber.Enabled
        ) &&
        (
          registeredType === target ||
          registeredType === "*"
        )
      );
    })
    .sort(function(a, b) {
      return (
        Number(a.Priority || 100) -
        Number(b.Priority || 100)
      );
    });
}

/**
 * Dispatches one event to all registered subscribers.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5SUB_dispatchEvent(event) {
  const input = event || {};

  const eventType = String(
    input.eventType ||
    input.EventType ||
    ""
  )
    .trim()
    .toUpperCase();

  if (!eventType) {
    throw new Error(
      "Event type is required for subscriber dispatch."
    );
  }

  const subscribers =
    MOS5SUB_getSubscribers(
      eventType
    );

  const results = [];
  let criticalFailure = false;

  subscribers.forEach(function(subscriber) {
    const result =
      MOS5SUB_executeSubscriber_(
        subscriber,
        input
      );

    results.push(result);

    if (
      result.success !== true &&
      MOS5SUB_isTrue_(
        subscriber.Critical
      )
    ) {
      criticalFailure = true;
    }
  });

  const completed =
    results.filter(function(result) {
      return result.success === true;
    }).length;

  const failed =
    results.length - completed;

  return {
    success:
      !criticalFailure,

    status:
      subscribers.length === 0
        ? "NO_SUBSCRIBERS"
        : failed === 0
          ? "COMPLETE"
          : criticalFailure
            ? "CRITICAL_FAILURE"
            : "PARTIAL",

    release:
      "MOS5-ENTERPRISE-SUBSCRIBER-REGISTRY",

    version:
      MOS5_SUBSCRIBER_REGISTRY_VERSION,

    eventId:
      String(
        input.eventId ||
        input.EventID ||
        ""
      ).trim(),

    eventType:
      eventType,

    subscriberCount:
      subscribers.length,

    completed:
      completed,

    failed:
      failed,

    criticalFailure:
      criticalFailure,

    results:
      results,

    completedAt:
      new Date().toISOString()
  };
}

/**
 * Executes one subscriber safely.
 *
 * @param {Object} subscriber
 * @param {Object} event
 * @return {Object}
 */
function MOS5SUB_executeSubscriber_(
  subscriber,
  event
) {
  const startedAt = new Date();

  const handlerName = String(
    subscriber.HandlerFunction || ""
  ).trim();

  const handler =
    globalThis[handlerName];

  let result;

  if (typeof handler !== "function") {
    result = {
      success: false,
      status:
        "HANDLER_UNAVAILABLE",
      subscriberId:
        subscriber.SubscriberID,
      subscriberName:
        subscriber.SubscriberName,
      handlerFunction:
        handlerName,
      critical:
        MOS5SUB_isTrue_(
          subscriber.Critical
        ),
      error:
        "Subscriber handler is unavailable."
    };
  } else {
    try {
      const response =
        handler(event);

      result = {
        success: true,
        status: "COMPLETED",
        subscriberId:
          subscriber.SubscriberID,
        subscriberName:
          subscriber.SubscriberName,
        handlerFunction:
          handlerName,
        critical:
          MOS5SUB_isTrue_(
            subscriber.Critical
          ),
        response:
          response === undefined
            ? null
            : response
      };
    } catch (error) {
      result = {
        success: false,
        status: "FAILED",
        subscriberId:
          subscriber.SubscriberID,
        subscriberName:
          subscriber.SubscriberName,
        handlerFunction:
          handlerName,
        critical:
          MOS5SUB_isTrue_(
            subscriber.Critical
          ),
        error:
          String(
            error && error.message
              ? error.message
              : error
          )
      };
    }
  }

  const durationMs =
    new Date().getTime() -
    startedAt.getTime();

  result.durationMs =
    durationMs;

  MOS5SUB_recordExecution_(
    subscriber,
    result,
    durationMs
  );

  return result;
}

/**
 * Records subscriber execution status.
 *
 * @param {Object} subscriber
 * @param {Object} result
 * @param {number} durationMs
 */
function MOS5SUB_recordExecution_(
  subscriber,
  result,
  durationMs
) {
  const sheet =
    MOS5SUB_ensureRegistrySheet_();

  MOS5SUB_updateRow_(
    sheet,
    subscriber._row,
    {
      LastRunAt:
        new Date(),
      LastStatus:
        result.status,
      LastDurationMs:
        durationMs,
      LastError:
        result.success
          ? ""
          : String(
              result.error || ""
            ),
      UpdatedAt:
        new Date()
    }
  );
}

/**
 * Default subscriber configuration.
 *
 * @return {Array<Object>}
 */
function MOS5SUB_defaultSubscribers_() {
  return [
    {
      EventType: "*",
      SubscriberName:
        "Enterprise Audit Timeline",
      HandlerFunction:
        "MOS5AUD_handleEnterpriseEvent",
      Enabled: true,
      Priority: 10,
      Critical: true,
      Description:
        "Records every enterprise event in the immutable audit timeline."
    },

    {
      EventType: "LEAD_ASSIGNED",
      SubscriberName:
        "Lead Assignment Notifications",
      HandlerFunction:
        "MOS5NF_handleLeadAssignedEvent",
      Enabled: true,
      Priority: 20,
      Critical: false,
      Description:
        "Queues agent or broker notifications after assignment."
    },

    {
      EventType: "LEAD_UNASSIGNED",
      SubscriberName:
        "Unassigned Lead Notifications",
      HandlerFunction:
        "MOS5NF_handleLeadUnassignedEvent",
      Enabled: true,
      Priority: 20,
      Critical: false,
      Description:
        "Alerts the broker when a lead remains unassigned."
    },

    {
      EventType: "LEAD_ERROR",
      SubscriberName:
        "Lead Error Notifications",
      HandlerFunction:
        "MOS5NF_handleLeadErrorEvent",
      Enabled: true,
      Priority: 20,
      Critical: false,
      Description:
        "Queues a broker alert for lead-processing errors."
    },

    {
      EventType:
        "LEAD_BROKER_FALLBACK",
      SubscriberName:
        "Broker Fallback Notifications",
      HandlerFunction:
        "MOS5NF_handleBrokerFallbackEvent",
      Enabled: true,
      Priority: 20,
      Critical: false,
      Description:
        "Queues a broker notice when fallback routing is used."
    }
  ];
}

/**
 * Returns registry status.
 *
 * @return {Object}
 */
function MOS5SUB_getRegistryStatus() {
  const subscribers =
    MOS5SUB_sheetObjects_(
      MOS5SUB_ensureRegistrySheet_()
    );

  return {
    release:
      "MOS5-ENTERPRISE-SUBSCRIBER-REGISTRY",

    version:
      MOS5_SUBSCRIBER_REGISTRY_VERSION,

    total:
      subscribers.length,

    enabled:
      subscribers.filter(function(record) {
        return MOS5SUB_isTrue_(
          record.Enabled
        );
      }).length,

    disabled:
      subscribers.filter(function(record) {
        return !MOS5SUB_isTrue_(
          record.Enabled
        );
      }).length,

    critical:
      subscribers.filter(function(record) {
        return MOS5SUB_isTrue_(
          record.Critical
        );
      }).length,

    failedLastRun:
      subscribers.filter(function(record) {
        return String(
          record.LastStatus || ""
        )
          .trim()
          .toUpperCase() === "FAILED";
      }).length,

    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function MOS5SUB_runDiagnostics() {
  const sheet =
    MOS5SUB_ensureRegistrySheet_();

  const requirements = [
    "MOS5AUD_handleEnterpriseEvent",
    "MOS5NF_handleLeadAssignedEvent",
    "MOS5NF_handleLeadUnassignedEvent",
    "MOS5NF_handleLeadErrorEvent",
    "MOS5NF_handleBrokerFallbackEvent"
  ];

  const tests =
    requirements.map(function(name) {
      return {
        code:
          name,
        status:
          typeof globalThis[name] ===
          "function"
            ? "PASS"
            : "FAIL"
      };
    });

  tests.push({
    code:
      "SUBSCRIBER_REGISTRY_SHEET",
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
      "MOS5-ENTERPRISE-SUBSCRIBER-REGISTRY",

    version:
      MOS5_SUBSCRIBER_REGISTRY_VERSION,

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

    registry:
      MOS5SUB_getRegistryStatus(),

    productionChanged:
      false,

    completedAt:
      new Date().toISOString()
  };
}

function MOS5SUB_ensureRegistrySheet_() {
  const ss =
    typeof workbook_ === "function"
      ? workbook_()
      : SpreadsheetApp
          .getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      MOS5_SUBSCRIBER_REGISTRY.SHEET
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        MOS5_SUBSCRIBER_REGISTRY.SHEET
      );
  }

  MOS5SUB_ensureHeaders_(
    sheet,
    MOS5_SUBSCRIBER_REGISTRY.HEADERS
  );

  return sheet;
}

function MOS5SUB_ensureHeaders_(
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
        return String(
          value || ""
        ).trim();
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

function MOS5SUB_sheetObjects_(sheet) {
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
      const record = {
        _row: index + 2
      };

      headers.forEach(
        function(header, column) {
          record[header] =
            row[column];
        }
      );

      return record;
    }
  );
}

function MOS5SUB_findSubscriber_(
  sheet,
  eventType,
  handlerFunction
) {
  return (
    MOS5SUB_sheetObjects_(sheet)
      .find(function(record) {
        return (
          String(
            record.EventType || ""
          )
            .trim()
            .toUpperCase() ===
            eventType &&
          String(
            record.HandlerFunction || ""
          ).trim() ===
            handlerFunction
        );
      }) ||
    null
  );
}

function MOS5SUB_appendRow_(
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

function MOS5SUB_updateRow_(
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

function MOS5SUB_isTrue_(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  return [
    "TRUE",
    "YES",
    "Y",
    "1",
    "ON",
    "ENABLED",
    "ACTIVE"
  ].indexOf(
    String(value || "")
      .trim()
      .toUpperCase()
  ) !== -1;
}

function MOS5SUB_id_(prefix) {
  return (
    String(prefix || "SUB")
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