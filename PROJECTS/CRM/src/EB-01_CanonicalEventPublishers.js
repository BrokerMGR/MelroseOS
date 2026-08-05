/******************************************************************************
 * MelroseOS Enterprise
 * File: EB-01_CanonicalEventPublishers.js
 * Version: 1.1.0
 *
 * Canonical event publishing and automatic audit recording.
 ******************************************************************************/

const MOS5_EVENT_PUBLISHER_VERSION = "1.1.0";

/**
 * Publishes a canonical event and automatically records it in the
 * Enterprise Audit Timeline.
 *
 * @param {string} eventType
 * @param {Object=} payload
 * @param {Object=} options
 * @return {Object}
 */
function MOS5EB_publish_(eventType, payload, options) {
  if (typeof MOS5_publishEvent !== "function") {
    throw new Error(
      "Enterprise Event Bus is unavailable."
    );
  }

  const normalizedType = String(
    eventType || ""
  )
    .trim()
    .toUpperCase();

  if (!normalizedType) {
    throw new Error(
      "eventType is required."
    );
  }

  const eventPayload = payload || {};
  const settings = options || {};

  const published = MOS5_publishEvent(
    normalizedType,
    eventPayload,
    settings
  );

  const audit = MOS5EB_recordPublishedEvent_(
    normalizedType,
    eventPayload,
    settings,
    published
  );

  return {
    success:
      Boolean(
        published &&
        published.success === true
      ),

    status:
      published &&
      published.status ||
      "UNKNOWN",

    eventId:
      published &&
      published.eventId ||
      "",

    eventType:
      normalizedType,

    aggregateType:
      published &&
      published.aggregateType ||
      settings.aggregateType ||
      "",

    aggregateId:
      published &&
      published.aggregateId ||
      settings.aggregateId ||
      "",

    eventBus:
      published,

    audit:
      audit,

    version:
      MOS5_EVENT_PUBLISHER_VERSION,

    completedAt:
      new Date().toISOString()
  };
}

/**
 * Records the published event in the Audit Timeline.
 *
 * Audit failure does not delete or roll back the queued event. The response
 * clearly reports the audit failure for recovery and investigation.
 *
 * @param {string} eventType
 * @param {Object} payload
 * @param {Object} options
 * @param {Object} published
 * @return {Object}
 */
function MOS5EB_recordPublishedEvent_(
  eventType,
  payload,
  options,
  published
) {
  if (
    typeof MOS5AUD_recordEvent !==
    "function"
  ) {
    return {
      success: false,
      status:
        "AUDIT_TIMELINE_UNAVAILABLE",
      productionChanged: false
    };
  }

  try {
    const metadata = {
      source:
        options.source ||
        "CANONICAL_EVENT_PUBLISHER",

      correlationId:
        options.correlationId ||
        "",

      causationId:
        options.causationId ||
        "",

      executionId:
        options.executionId ||
        payload.executionId ||
        "",

      actorType:
        options.actorType ||
        "AUTOMATION",

      actorId:
        options.actorId ||
        "",

      actorEmail:
        options.actorEmail ||
        "",

      publisherVersion:
        MOS5_EVENT_PUBLISHER_VERSION
    };

    return MOS5AUD_recordEvent(
      {
        eventId:
          published &&
          published.eventId ||
          "",

        eventType:
          eventType,

        aggregateType:
          published &&
          published.aggregateType ||
          options.aggregateType ||
          payload.aggregateType ||
          "LEAD",

        aggregateId:
          published &&
          published.aggregateId ||
          options.aggregateId ||
          payload.LeadID ||
          payload.leadId ||
          payload.IntakeID ||
          payload.intakeId ||
          "",

        correlationId:
          metadata.correlationId,

        causationId:
          metadata.causationId,

        executionId:
          metadata.executionId,

        payload:
          payload,

        metadata:
          metadata,

        occurredAt:
          new Date()
      },
      {
        source:
          "ENTERPRISE_EVENT_BUS",

        actorType:
          metadata.actorType,

        actorId:
          metadata.actorId,

        actorEmail:
          metadata.actorEmail,

        correlationId:
          metadata.correlationId,

        causationId:
          metadata.causationId,

        executionId:
          metadata.executionId,

        summary:
          eventType
      }
    );
  } catch (error) {
    return {
      success: false,
      status:
        "AUDIT_RECORDING_FAILED",
      error:
        String(
          error && error.message
            ? error.message
            : error
        ),
      productionChanged: false
    };
  }
}

/******************************************************************************
 * LEAD EVENTS
 ******************************************************************************/

function MOS5_publishLeadReceived_(lead, options) {
  return MOS5EB_publish_(
    "LEAD_RECEIVED",
    lead,
    options
  );
}

function MOS5_publishLeadValidated_(lead, options) {
  return MOS5EB_publish_(
    "LEAD_VALIDATED",
    lead,
    options
  );
}

function MOS5_publishLeadDuplicate_(lead, options) {
  return MOS5EB_publish_(
    "LEAD_DUPLICATE",
    lead,
    options
  );
}

function MOS5_publishLeadRejected_(lead, options) {
  return MOS5EB_publish_(
    "LEAD_REJECTED",
    lead,
    options
  );
}

function MOS5_publishLeadQueued_(lead, options) {
  return MOS5EB_publish_(
    "LEAD_QUEUED",
    lead,
    options
  );
}

function MOS5_publishLeadProcessing_(lead, options) {
  return MOS5EB_publish_(
    "LEAD_PROCESSING",
    lead,
    options
  );
}

function MOS5_publishLeadAssigned_(assignment, options) {
  return MOS5EB_publish_(
    "LEAD_ASSIGNED",
    assignment,
    options
  );
}

function MOS5_publishLeadUnassigned_(assignment, options) {
  return MOS5EB_publish_(
    "LEAD_UNASSIGNED",
    assignment,
    options
  );
}

function MOS5_publishBrokerFallback_(assignment, options) {
  return MOS5EB_publish_(
    "LEAD_BROKER_FALLBACK",
    assignment,
    options
  );
}

function MOS5_publishLeadError_(payload, options) {
  return MOS5EB_publish_(
    "LEAD_ERROR",
    payload,
    options
  );
}

/******************************************************************************
 * NOTIFICATION EVENTS
 ******************************************************************************/

function MOS5_publishNotificationQueued_(payload, options) {
  return MOS5EB_publish_(
    "NOTIFICATION_QUEUED",
    payload,
    options
  );
}

function MOS5_publishNotificationSent_(payload, options) {
  return MOS5EB_publish_(
    "NOTIFICATION_SENT",
    payload,
    options
  );
}

function MOS5_publishNotificationFailed_(payload, options) {
  return MOS5EB_publish_(
    "NOTIFICATION_FAILED",
    payload,
    options
  );
}

/******************************************************************************
 * FOLLOW-UP EVENTS
 ******************************************************************************/

function MOS5_publishFollowupQueued_(payload, options) {
  return MOS5EB_publish_(
    "FOLLOWUP_QUEUED",
    payload,
    options
  );
}

function MOS5_publishFollowupSent_(payload, options) {
  return MOS5EB_publish_(
    "FOLLOWUP_SENT",
    payload,
    options
  );
}

/******************************************************************************
 * AUDIT AND CRM EVENTS
 ******************************************************************************/

function MOS5_publishAuditEvent_(payload, options) {
  return MOS5EB_publish_(
    "AUDIT_EVENT",
    payload,
    options
  );
}

function MOS5_publishCRMUpdated_(payload, options) {
  return MOS5EB_publish_(
    "CRM_UPDATED",
    payload,
    options
  );
}

/******************************************************************************
 * AGENT EVENTS
 ******************************************************************************/

function MOS5_publishAgentAssigned_(payload, options) {
  return MOS5EB_publish_(
    "AGENT_ASSIGNED",
    payload,
    options
  );
}

function MOS5_publishRoundRobinSkipped_(payload, options) {
  return MOS5EB_publish_(
    "ROUND_ROBIN_SKIPPED",
    payload,
    options
  );
}

/******************************************************************************
 * SAFETY EVENTS
 ******************************************************************************/

function MOS5_publishSafetyGateOpen_(payload, options) {
  return MOS5EB_publish_(
    "SAFETY_GATE_OPEN",
    payload,
    options
  );
}

function MOS5_publishSafetyGateBlocked_(payload, options) {
  return MOS5EB_publish_(
    "SAFETY_GATE_BLOCKED",
    payload,
    options
  );
}

/******************************************************************************
 * DIAGNOSTICS
 ******************************************************************************/

function MOS5_runCanonicalPublisherDiagnostics() {
  const requirements = [
    "MOS5_publishEvent",
    "MOS5AUD_recordEvent"
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

  const failed = tests.filter(
    function(test) {
      return test.status === "FAIL";
    }
  ).length;

  return {
    release:
      "MOS5-CANONICAL-PUBLISHERS",

    version:
      MOS5_EVENT_PUBLISHER_VERSION,

    overallStatus:
      failed ? "FAIL" : "PASS",

    passed:
      tests.length - failed,

    failed:
      failed,

    tests:
      tests,

    automaticAudit:
      failed === 0,

    productionChanged:
      false,

    completedAt:
      new Date().toISOString()
  };
}