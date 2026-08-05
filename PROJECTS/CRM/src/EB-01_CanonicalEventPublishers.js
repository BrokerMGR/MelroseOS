/******************************************************************************
 * MelroseOS Enterprise
 * File: EB-01_CanonicalEventPublishers.js
 * Version: 1.0.0
 *
 * Canonical Event Publisher Layer
 *
 * This module isolates business events from the Event Bus implementation.
 ******************************************************************************/

const MOS5_EVENT_PUBLISHER_VERSION = "1.0.0";

/******************************************************************************
 * INTERNAL
 ******************************************************************************/

function MOS5EB_publish_(eventType, payload, options) {
  if (typeof MOS5_publishEvent !== "function") {
    throw new Error(
      "Enterprise Event Bus is unavailable."
    );
  }

  return MOS5_publishEvent(
    eventType,
    payload || {},
    options || {}
  );
}

/******************************************************************************
 * LEAD EVENTS
 ******************************************************************************/

function MOS5_publishLeadReceived_(lead) {
  return MOS5EB_publish_("LEAD_RECEIVED", lead);
}

function MOS5_publishLeadValidated_(lead) {
  return MOS5EB_publish_("LEAD_VALIDATED", lead);
}

function MOS5_publishLeadDuplicate_(lead) {
  return MOS5EB_publish_("LEAD_DUPLICATE", lead);
}

function MOS5_publishLeadRejected_(lead) {
  return MOS5EB_publish_("LEAD_REJECTED", lead);
}

function MOS5_publishLeadQueued_(lead) {
  return MOS5EB_publish_("LEAD_QUEUED", lead);
}

function MOS5_publishLeadProcessing_(lead) {
  return MOS5EB_publish_("LEAD_PROCESSING", lead);
}

function MOS5_publishLeadAssigned_(assignment) {
  return MOS5EB_publish_("LEAD_ASSIGNED", assignment);
}

function MOS5_publishLeadUnassigned_(assignment) {
  return MOS5EB_publish_("LEAD_UNASSIGNED", assignment);
}

function MOS5_publishBrokerFallback_(assignment) {
  return MOS5EB_publish_("LEAD_BROKER_FALLBACK", assignment);
}

function MOS5_publishLeadError_(payload) {
  return MOS5EB_publish_("LEAD_ERROR", payload);
}

/******************************************************************************
 * NOTIFICATION EVENTS
 ******************************************************************************/

function MOS5_publishNotificationQueued_(payload) {
  return MOS5EB_publish_("NOTIFICATION_QUEUED", payload);
}

function MOS5_publishNotificationSent_(payload) {
  return MOS5EB_publish_("NOTIFICATION_SENT", payload);
}

function MOS5_publishNotificationFailed_(payload) {
  return MOS5EB_publish_("NOTIFICATION_FAILED", payload);
}

/******************************************************************************
 * FOLLOW-UP EVENTS
 ******************************************************************************/

function MOS5_publishFollowupQueued_(payload) {
  return MOS5EB_publish_("FOLLOWUP_QUEUED", payload);
}

function MOS5_publishFollowupSent_(payload) {
  return MOS5EB_publish_("FOLLOWUP_SENT", payload);
}

/******************************************************************************
 * AUDIT
 ******************************************************************************/

function MOS5_publishAuditEvent_(payload) {
  return MOS5EB_publish_("AUDIT_EVENT", payload);
}

/******************************************************************************
 * CRM
 ******************************************************************************/

function MOS5_publishCRMUpdated_(payload) {
  return MOS5EB_publish_("CRM_UPDATED", payload);
}

/******************************************************************************
 * AGENTS
 ******************************************************************************/

function MOS5_publishAgentAssigned_(payload) {
  return MOS5EB_publish_("AGENT_ASSIGNED", payload);
}

function MOS5_publishRoundRobinSkipped_(payload) {
  return MOS5EB_publish_("ROUND_ROBIN_SKIPPED", payload);
}

/******************************************************************************
 * SAFETY
 ******************************************************************************/

function MOS5_publishSafetyGateOpen_(payload) {
  return MOS5EB_publish_("SAFETY_GATE_OPEN", payload);
}

function MOS5_publishSafetyGateBlocked_(payload) {
  return MOS5EB_publish_("SAFETY_GATE_BLOCKED", payload);
}

/******************************************************************************
 * DIAGNOSTICS
 ******************************************************************************/

function MOS5_runCanonicalPublisherDiagnostics() {

  const required = [
    "MOS5_publishEvent"
  ];

  const tests = required.map(function(name) {
    return {
      code: name,
      status:
        typeof globalThis[name] === "function"
          ? "PASS"
          : "FAIL"
    };
  });

  const failed = tests.filter(function(test) {
    return test.status === "FAIL";
  }).length;

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

    productionChanged:
      false,

    completedAt:
      new Date().toISOString()
  };
}