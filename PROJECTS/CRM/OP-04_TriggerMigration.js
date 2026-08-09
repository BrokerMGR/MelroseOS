/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-04_TriggerMigration.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Audits existing Apps Script triggers before consolidation.
 *   This module DOES NOT delete, replace, or create triggers.
 *
 * Requires:
 *   OP-01 through OP-03
 ******************************************************************************/

const OP_TRIGGER_MIGRATION_SHEET = "OP_TRIGGER_MIGRATION";

function OP_initializeTriggerMigration() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_TRIGGER_MIGRATION_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "TriggerID",
    "Handler",
    "EventType",
    "TriggerSource",
    "Classification",
    "Recommendation",
    "DuplicateCount",
    "Status",
    "AuditedAt"
  ]);

  return true;
}

function OP_auditTriggersForMigration() {
  OP_initializeTriggerMigration();

  const triggers = ScriptApp.getProjectTriggers();
  const grouped = {};

  triggers.forEach(function(trigger) {
    const handler = trigger.getHandlerFunction() || "";
    const eventType = String(trigger.getEventType() || "");
    const source = String(trigger.getTriggerSource() || "");
    const key = handler + "|" + eventType + "|" + source;

    grouped[key] = (grouped[key] || 0) + 1;
  });

  const audit = triggers.map(function(trigger) {
    const handler = trigger.getHandlerFunction() || "";
    const eventType = String(trigger.getEventType() || "");
    const source = String(trigger.getTriggerSource() || "");
    const key = handler + "|" + eventType + "|" + source;

    const classification =
      OP_classifyLegacyTrigger_(handler);

    return {
      triggerId: OP_safeTriggerId_(trigger),
      handler: handler,
      eventType: eventType,
      source: source,
      classification: classification,
      recommendation:
        OP_triggerRecommendation_(
          handler,
          classification,
          grouped[key]
        ),
      duplicateCount: grouped[key],
      status: "AUDITED"
    };
  });

  OP_writeTriggerMigrationAudit_(audit);

  const duplicates = audit.filter(function(item) {
    return item.duplicateCount > 1;
  }).length;

  const legacy = audit.filter(function(item) {
    return item.classification === "LEGACY_OPERATIONAL";
  }).length;

  setDocProperty_(
    "OP_TRIGGER_AUDIT_COMPLETE",
    "TRUE"
  );

  setDocProperty_(
    "OP_TRIGGER_AUDIT_AT",
    new Date().toISOString()
  );

  return {
    success: true,
    totalTriggers: audit.length,
    legacyOperational: legacy,
    duplicateTriggerRows: duplicates,
    audit: audit
  };
}

function OP_classifyLegacyTrigger_(handler) {
  const name = String(handler || "");

  const legacyOperationalHandlers = [
    "runLeadImport",
    "runCampaignQueue",
    "monitorLeadReplies",
    "syncBookedConsultations",
    "runHealthMonitor",
    "runLeadIntake",
    "runFollowUps",
    "processLeadQueue",
    "processNotifications"
  ];

  if (name === OP_TRIGGER_HANDLER) {
    return "MELROSEOS_OPERATIONS";
  }

  if (
    legacyOperationalHandlers.indexOf(name) !== -1
  ) {
    return "LEGACY_OPERATIONAL";
  }

  return "OTHER";
}

function OP_triggerRecommendation_(
  handler,
  classification,
  duplicateCount
) {
  if (duplicateCount > 1) {
    return "REVIEW_DUPLICATE";
  }

  if (
    classification ===
    "MELROSEOS_OPERATIONS"
  ) {
    return "KEEP_MANAGED";
  }

  if (
    classification ===
    "LEGACY_OPERATIONAL"
  ) {
    return "REVIEW_BEFORE_CONSOLIDATION";
  }

  return "KEEP_UNLESS_REPLACED";
}

function OP_writeTriggerMigrationAudit_(audit) {
  const sheet = workbook_().getSheetByName(
    OP_TRIGGER_MIGRATION_SHEET
  );

  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        sheet.getLastColumn()
      )
      .clearContent();
  }

  const rows = audit.map(function(item) {
    return [
      item.triggerId,
      item.handler,
      item.eventType,
      item.source,
      item.classification,
      item.recommendation,
      item.duplicateCount,
      item.status,
      timestamp_()
    ];
  });

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, 9)
      .setValues(rows);
  }

  autoResize_(sheet);
}

function OP_getTriggerMigrationStatus() {
  return {
    auditComplete:
      getDocProperty_(
        "OP_TRIGGER_AUDIT_COMPLETE"
      ) || "FALSE",

    auditedAt:
      getDocProperty_(
        "OP_TRIGGER_AUDIT_AT"
      ) || "",

    currentTriggerCount:
      ScriptApp.getProjectTriggers().length
  };
}

function OP_testTriggerMigration() {
  const result =
    OP_auditTriggersForMigration();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(
    OP_getTriggerMigrationStatus()
  ));

  return true;
}
