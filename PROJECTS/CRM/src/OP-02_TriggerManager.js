/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-02_TriggerManager.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Creates, audits, and removes consolidated MelroseOS operations triggers.
 *
 * Requires:
 *   OP-01_Orchestrator.gs
 ******************************************************************************/

const OP_TRIGGER_HANDLER = "OP_runOperationsCycle";
const OP_TRIGGER_STATUS_SHEET = "OP_TRIGGER_STATUS";

function OP_initializeTriggerManager() {
  OP_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_TRIGGER_STATUS_SHEET
  );

  OP_setHeadersIfEmpty_(sheet, [
    "TriggerID",
    "Handler",
    "EventType",
    "Source",
    "Status",
    "Details",
    "UpdatedAt"
  ]);

  return true;
}

function OP_installOperationsTrigger() {
  OP_initializeTriggerManager();

  const existing = OP_getOperationsTriggers_();

  if (existing.length > 1) {
    existing.slice(1).forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
  }

  if (existing.length === 0) {
    ScriptApp
      .newTrigger(OP_TRIGGER_HANDLER)
      .timeBased()
      .everyMinutes(15)
      .create();
  }

  OP_refreshTriggerStatus();

  return {
    success: true,
    handler: OP_TRIGGER_HANDLER,
    triggerCount: OP_getOperationsTriggers_().length
  };
}

function OP_removeOperationsTriggers() {
  const triggers = OP_getOperationsTriggers_();

  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  OP_refreshTriggerStatus();

  return {
    success: true,
    removed: triggers.length
  };
}

function OP_getOperationsTriggers_() {
  return ScriptApp
    .getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === OP_TRIGGER_HANDLER;
    });
}

function OP_refreshTriggerStatus() {
  OP_initializeTriggerManager();

  const sheet = workbook_().getSheetByName(
    OP_TRIGGER_STATUS_SHEET
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

  const triggers = ScriptApp.getProjectTriggers();

  const rows = triggers.map(function(trigger) {
    return [
      OP_safeTriggerId_(trigger),
      trigger.getHandlerFunction() || "",
      String(trigger.getEventType() || ""),
      String(trigger.getTriggerSource() || ""),
      trigger.getHandlerFunction() === OP_TRIGGER_HANDLER
        ? "OPERATIONS"
        : "EXISTING",
      trigger.getHandlerFunction() === OP_TRIGGER_HANDLER
        ? "Managed by MelroseOS Operations."
        : "Existing project trigger.",
      timestamp_()
    ];
  });

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, 7)
      .setValues(rows);
  }

  autoResize_(sheet);

  return {
    success: true,
    totalTriggers: triggers.length,
    operationsTriggers: OP_getOperationsTriggers_().length
  };
}

function OP_safeTriggerId_(trigger) {
  try {
    return trigger.getUniqueId() || "";
  } catch (error) {
    return "";
  }
}

function OP_auditDuplicateTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const counts = {};
  const duplicates = [];

  triggers.forEach(function(trigger) {
    const key = [
      trigger.getHandlerFunction() || "",
      String(trigger.getEventType() || ""),
      String(trigger.getTriggerSource() || "")
    ].join("|");

    counts[key] = (counts[key] || 0) + 1;
  });

  Object.keys(counts).forEach(function(key) {
    if (counts[key] > 1) {
      duplicates.push({
        key: key,
        count: counts[key]
      });
    }
  });

  return {
    success: true,
    duplicateGroups: duplicates.length,
    duplicates: duplicates
  };
}

function OP_getTriggerManagerStatus() {
  const triggers = OP_getOperationsTriggers_();

  return {
    installed: triggers.length > 0,
    operationsTriggerCount: triggers.length,
    duplicateAudit: OP_auditDuplicateTriggers()
  };
}

function OP_testTriggerManager() {
  OP_initializeTriggerManager();

  const status = OP_refreshTriggerStatus();

  Logger.log(JSON.stringify(status));
  Logger.log(JSON.stringify(OP_getTriggerManagerStatus()));

  return true;
}
