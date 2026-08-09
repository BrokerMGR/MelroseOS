/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-05_TriggerCutover.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Safely consolidates known legacy operational triggers into the single
 *   MelroseOS operations trigger.
 *
 * Safety:
 *   - Requires a completed trigger audit.
 *   - Requires the system to remain in SHADOW mode.
 *   - Removes ONLY explicitly recognized legacy operational handlers.
 *   - Does not remove unrelated project triggers.
 *
 * Requires:
 *   OP-01 through OP-04
 ******************************************************************************/

function OP_previewTriggerCutover() {
  OP_initializeTriggerMigration();

  const triggers = ScriptApp.getProjectTriggers();
  const preview = [];

  triggers.forEach(function(trigger) {
    const handler = trigger.getHandlerFunction() || "";
    const classification = OP_classifyLegacyTrigger_(handler);

    preview.push({
      triggerId: OP_safeTriggerId_(trigger),
      handler: handler,
      classification: classification,
      action:
        classification === "LEGACY_OPERATIONAL"
          ? "REMOVE_ON_CUTOVER"
          : handler === OP_TRIGGER_HANDLER
            ? "KEEP_MANAGED"
            : "KEEP_UNCHANGED"
    });
  });

  return {
    success: true,
    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",
    triggerCount: preview.length,
    removeCount: preview.filter(function(item) {
      return item.action === "REMOVE_ON_CUTOVER";
    }).length,
    preview: preview
  };
}

function OP_executeTriggerCutover(confirmationPhrase) {
  const requiredPhrase =
    "CONSOLIDATE MELROSEOS TRIGGERS";

  if (
    String(confirmationPhrase || "")
      .trim()
      .toUpperCase() !== requiredPhrase
  ) {
    throw new Error(
      "Trigger cutover blocked. Required confirmation phrase: " +
      requiredPhrase
    );
  }

  if (
    typeof CO_getState !== "function" ||
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "Trigger cutover blocked. System must be in SHADOW mode."
    );
  }

  if (
    getDocProperty_(
      "OP_TRIGGER_AUDIT_COMPLETE"
    ) !== "TRUE"
  ) {
    throw new Error(
      "Trigger cutover blocked. Run OP_testTriggerMigration() first."
    );
  }

  const triggers =
    ScriptApp.getProjectTriggers();

  let removed = 0;
  let preserved = 0;

  triggers.forEach(function(trigger) {
    const handler =
      trigger.getHandlerFunction() || "";

    const classification =
      OP_classifyLegacyTrigger_(handler);

    if (
      classification ===
      "LEGACY_OPERATIONAL"
    ) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    } else {
      preserved++;
    }
  });

  const install =
    OP_installOperationsTrigger();

  OP_refreshTriggerStatus();
  OP_auditTriggersForMigration();

  setDocProperty_(
    "OP_TRIGGER_CUTOVER_COMPLETE",
    "TRUE"
  );

  setDocProperty_(
    "OP_TRIGGER_CUTOVER_AT",
    new Date().toISOString()
  );

  return {
    success: true,
    state: CO_getState(),
    removedLegacyTriggers: removed,
    preservedTriggers: preserved,
    operationsTriggerCount:
      install.triggerCount
  };
}

function OP_getTriggerCutoverStatus() {
  return {
    complete:
      getDocProperty_(
        "OP_TRIGGER_CUTOVER_COMPLETE"
      ) || "FALSE",

    completedAt:
      getDocProperty_(
        "OP_TRIGGER_CUTOVER_AT"
      ) || "",

    state:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",

    managedOperationsTriggers:
      OP_getOperationsTriggers_().length
  };
}

function OP_testTriggerCutover() {
  if (
    typeof CO_forceShadowMode === "function"
  ) {
    CO_forceShadowMode();
  }

  const audit =
    OP_auditTriggersForMigration();

  const preview =
    OP_previewTriggerCutover();

  if (
    typeof CO_getState === "function" &&
    CO_getState() !== "SHADOW"
  ) {
    throw new Error(
      "Trigger Cutover self-test failed: system is not in SHADOW mode."
    );
  }

  Logger.log(JSON.stringify(audit));
  Logger.log(JSON.stringify(preview));
  Logger.log(JSON.stringify(
    OP_getTriggerCutoverStatus()
  ));

  return true;
}
