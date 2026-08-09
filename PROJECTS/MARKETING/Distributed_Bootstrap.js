/** Auto-generated one-time workbook bootstrap. */
function installMelroseWorkbookBootstrap() {
  var definitions = [["processAdvertisingRenderQueue","MINUTES",5],["processSocialPublishQueue","MINUTES",5],["processEmailQueue","MINUTES",5],["processNotificationQueue","MINUTES",5]];
  var existing = ScriptApp.getProjectTriggers();
  var installed = 0;
  var skipped = 0;
  var missingHandlers = [];

  definitions.forEach(function (definition) {
    var handler = definition[0];
    var unit = definition[1];
    var interval = Number(definition[2]);

    if (typeof this[handler] !== "function") {
      missingHandlers.push(handler);
      return;
    }

    var alreadyExists = existing.some(function (trigger) {
      return trigger.getHandlerFunction() === handler;
    });

    if (alreadyExists) {
      skipped++;
      return;
    }

    var builder = ScriptApp.newTrigger(handler).timeBased();

    if (unit === "MINUTES") {
      builder.everyMinutes(interval);
    } else if (unit === "HOURS") {
      builder.everyHours(interval);
    } else if (unit === "DAYS") {
      builder.everyDays(interval);
    } else {
      missingHandlers.push(handler + " [invalid schedule]");
      return;
    }

    builder.create();
    installed++;
  });

  PropertiesService.getScriptProperties().setProperty(
    "MELROSEOS_WORKBOOK_BOOTSTRAP_VERSION",
    M4_DISTRIBUTED_CONFIG.VERSION
  );

  return {
    success: missingHandlers.length === 0,
    workbookKey: M4_DISTRIBUTED_CONFIG.WORKBOOK_KEY,
    installed: installed,
    skipped: skipped,
    missingHandlers: missingHandlers,
    version: M4_DISTRIBUTED_CONFIG.VERSION
  };
}

function getMelroseWorkbookBootstrapStatus() {
  return {
    success: true,
    workbookKey: M4_DISTRIBUTED_CONFIG.WORKBOOK_KEY,
    version: PropertiesService.getScriptProperties().getProperty(
      "MELROSEOS_WORKBOOK_BOOTSTRAP_VERSION"
    ) || "",
    triggers: ScriptApp.getProjectTriggers().map(function (trigger) {
      return {
        handler: trigger.getHandlerFunction(),
        eventType: String(trigger.getEventType())
      };
    })
  };
}