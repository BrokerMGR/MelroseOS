/******************************************************************************
 * MelroseOS Enterprise
 * File: EB-03_LeadLifecycleEventBridge.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Canonical bridge between lead lifecycle operations and event publishers.
 *
 * Safety:
 *   - Does not alter intake, routing, assignment, or communications.
 *   - Event publication failures do not roll back lead processing.
 *   - Returns publication results for audit and diagnostics.
 ******************************************************************************/

const MOS5_LEAD_EVENT_BRIDGE_VERSION = "1.0.0";

/**
 * Publishes LEAD_QUEUED.
 *
 * @param {Object} payload
 * @param {Object=} context
 * @return {Object}
 */
function MOS5EB_publishLeadQueued(
  payload,
  context
) {
  return MOS5EB_publishLifecycleEvent_(
    "MOS5_publishLeadQueued_",
    "LEAD_QUEUED",
    payload,
    context
  );
}

/**
 * Publishes LEAD_PROCESSING.
 *
 * @param {Object} payload
 * @param {Object=} context
 * @return {Object}
 */
function MOS5EB_publishLeadProcessing(
  payload,
  context
) {
  return MOS5EB_publishLifecycleEvent_(
    "MOS5_publishLeadProcessing_",
    "LEAD_PROCESSING",
    payload,
    context
  );
}

/**
 * Publishes LEAD_ASSIGNED.
 *
 * @param {Object} payload
 * @param {Object=} context
 * @return {Object}
 */
function MOS5EB_publishLeadAssigned(
  payload,
  context
) {
  return MOS5EB_publishLifecycleEvent_(
    "MOS5_publishLeadAssigned_",
    "LEAD_ASSIGNED",
    payload,
    context
  );
}

/**
 * Publishes LEAD_UNASSIGNED.
 *
 * @param {Object} payload
 * @param {Object=} context
 * @return {Object}
 */
function MOS5EB_publishLeadUnassigned(
  payload,
  context
) {
  return MOS5EB_publishLifecycleEvent_(
    "MOS5_publishLeadUnassigned_",
    "LEAD_UNASSIGNED",
    payload,
    context
  );
}

/**
 * Publishes LEAD_BROKER_FALLBACK.
 *
 * @param {Object} payload
 * @param {Object=} context
 * @return {Object}
 */
function MOS5EB_publishBrokerFallback(
  payload,
  context
) {
  return MOS5EB_publishLifecycleEvent_(
    "MOS5_publishBrokerFallback_",
    "LEAD_BROKER_FALLBACK",
    payload,
    context
  );
}

/**
 * Publishes LEAD_ERROR.
 *
 * @param {Object} payload
 * @param {Object=} context
 * @return {Object}
 */
function MOS5EB_publishLeadError(
  payload,
  context
) {
  return MOS5EB_publishLifecycleEvent_(
    "MOS5_publishLeadError_",
    "LEAD_ERROR",
    payload,
    context
  );
}

/**
 * Publishes a finalized queue-processing result.
 *
 * @param {Object} result
 * @param {Object=} context
 * @return {Object}
 */
function MOS5EB_publishQueueResult(
  result,
  context
) {
  const input = result || {};
  const settings = context || {};

  const payload = {
    intakeId:
      String(
        input.intakeId ||
        settings.intakeId ||
        ""
      ).trim(),

    leadId:
      String(
        input.leadId ||
        settings.leadId ||
        ""
      ).trim(),

    agentId:
      String(
        input.agentId || ""
      ).trim(),

    agentName:
      String(
        input.agentName || ""
      ).trim(),

    agentEmail:
      String(
        input.agentEmail || ""
      )
        .trim()
        .toLowerCase(),

    method:
      String(
        input.method || ""
      )
        .trim()
        .toUpperCase(),

    mode:
      String(
        input.mode || ""
      )
        .trim()
        .toUpperCase(),

    reason:
      String(
        input.reason || ""
      ).trim(),

    status:
      String(
        input.status || ""
      )
        .trim()
        .toUpperCase(),

    brokerFallback:
      input.brokerFallback === true,

    executionId:
      String(
        settings.executionId || ""
      ).trim()
  };

  if (
    input.success === true &&
    payload.brokerFallback
  ) {
    return MOS5EB_publishBrokerFallback(
      payload,
      settings
    );
  }

  if (input.success === true) {
    return MOS5EB_publishLeadAssigned(
      payload,
      settings
    );
  }

  return MOS5EB_publishLeadUnassigned(
    payload,
    settings
  );
}

/**
 * Publishes one lifecycle event without interrupting lead processing.
 *
 * @param {string} publisherName
 * @param {string} eventType
 * @param {Object=} payload
 * @param {Object=} context
 * @return {Object}
 */
function MOS5EB_publishLifecycleEvent_(
  publisherName,
  eventType,
  payload,
  context
) {
  const input = payload || {};
  const settings = context || {};
  const handler =
    globalThis[publisherName];

  if (typeof handler !== "function") {
    return {
      success: false,
      status:
        "PUBLISHER_UNAVAILABLE",
      publisher:
        publisherName,
      eventType:
        eventType,
      productionChanged: false,
      completedAt:
        new Date().toISOString()
    };
  }

  const leadId = String(
    input.leadId ||
    input.LeadID ||
    settings.leadId ||
    ""
  ).trim();

  const intakeId = String(
    input.intakeId ||
    input.IntakeID ||
    settings.intakeId ||
    ""
  ).trim();

  const executionId = String(
    input.executionId ||
    settings.executionId ||
    ""
  ).trim();

  const eventPayload =
    Object.assign(
      {},
      input,
      {
        leadId:
          leadId,
        intakeId:
          intakeId,
        executionId:
          executionId
      }
    );

  const options = {
    aggregateType:
      settings.aggregateType ||
      "LEAD",

    aggregateId:
      settings.aggregateId ||
      leadId ||
      intakeId,

    correlationId:
      settings.correlationId ||
      executionId ||
      leadId ||
      intakeId,

    causationId:
      settings.causationId ||
      "",

    executionId:
      executionId,

    source:
      settings.source ||
      "LEAD_LIFECYCLE_EVENT_BRIDGE",

    actorType:
      settings.actorType ||
      "AUTOMATION",

    actorId:
      settings.actorId ||
      "",

    actorEmail:
      settings.actorEmail ||
      ""
  };

  try {
    const response =
      handler(
        eventPayload,
        options
      );

    return {
      success:
        Boolean(
          response &&
          response.success === true
        ),

      status:
        response &&
        response.status ||
        "PUBLISHED",

      eventType:
        eventType,

      eventId:
        response &&
        response.eventId ||
        "",

      leadId:
        leadId,

      intakeId:
        intakeId,

      publisher:
        publisherName,

      response:
        response,

      productionChanged:
        false,

      completedAt:
        new Date().toISOString()
    };
  } catch (error) {
    const failure = {
      success: false,

      status:
        "PUBLICATION_FAILED",

      eventType:
        eventType,

      publisher:
        publisherName,

      leadId:
        leadId,

      intakeId:
        intakeId,

      error:
        String(
          error &&
          error.message
            ? error.message
            : error
        ),

      productionChanged:
        false,

      completedAt:
        new Date().toISOString()
    };

    console.log(
      JSON.stringify({
        module:
          "MOS5_LEAD_EVENT_BRIDGE",
        failure:
          failure
      })
    );

    return failure;
  }
}

/**
 * Returns bridge availability.
 *
 * @return {Object}
 */
function MOS5EB_getLeadEventBridgeStatus() {
  const publishers = [
    "MOS5_publishLeadQueued_",
    "MOS5_publishLeadProcessing_",
    "MOS5_publishLeadAssigned_",
    "MOS5_publishLeadUnassigned_",
    "MOS5_publishBrokerFallback_",
    "MOS5_publishLeadError_"
  ];

  const available =
    publishers.filter(
      function(name) {
        return (
          typeof globalThis[name] ===
          "function"
        );
      }
    );

  return {
    release:
      "MOS5-LEAD-LIFECYCLE-EVENT-BRIDGE",

    version:
      MOS5_LEAD_EVENT_BRIDGE_VERSION,

    required:
      publishers.length,

    available:
      available.length,

    missing:
      publishers.filter(
        function(name) {
          return (
            available.indexOf(name) ===
            -1
          );
        }
      ),

    ready:
      available.length ===
      publishers.length,

    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function MOS5EB_runLeadEventBridgeDiagnostics() {
  const status =
    MOS5EB_getLeadEventBridgeStatus();

  return {
    release:
      "MOS5-LEAD-LIFECYCLE-EVENT-BRIDGE",

    version:
      MOS5_LEAD_EVENT_BRIDGE_VERSION,

    overallStatus:
      status.ready
        ? "PASS"
        : "FAIL",

    passed:
      status.available,

    failed:
      status.required -
      status.available,

    status:
      status,

    productionChanged:
      false,

    completedAt:
      new Date().toISOString()
  };
}