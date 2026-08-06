/******************************************************************************
 * MelroseOS Enterprise
 * File: OPS-01_SubsystemCollectors.js
 * Version: 1.0.0
 *
 * Enterprise Operations
 * Subsystem Health Collectors
 *
 * PART 1 OF 5
 ******************************************************************************/

/* ========================================================================== */
/* COLLECT ALL */
/* ========================================================================== */

function OPS_collectAllSubsystemHealth() {

  OPS_initializeHealth();

  var results = [];

  results.push(OPS_collectSchedulerHealth());
  results.push(OPS_collectNotificationHealth());
  results.push(OPS_collectEventBusHealth());
  results.push(OPS_collectLeadIntakeHealth());
  results.push(OPS_collectAssignmentHealth());
  results.push(OPS_collectRuntimeHealth());

  return results;

}

/* ========================================================================== */
/* SCHEDULER */
/* ========================================================================== */

function OPS_collectSchedulerHealth() {

  var health = OPS_createHealthObject({

    id: "SCH",

    name: "Enterprise Scheduler",

    category: OPS.CATEGORY.SCHEDULER,

    status: OPS.STATUS.UNKNOWN,

    severity: OPS.SEVERITY.INFO,

    score: 0

  });

  if (typeof MOS5SCH_getRuntimeHealth === "function") {

    var runtime = MOS5SCH_getRuntimeHealth();

    health.status =
      runtime.overallStatus || OPS.STATUS.UNKNOWN;

    health.score =
      runtime.ready ? 100 : 75;

    health.metadata = runtime;

  }

  OPS_registerOrUpdate_(health);

  return health;

}

/* ========================================================================== */
/* NOTIFICATIONS */
/* ========================================================================== */

function OPS_collectNotificationHealth() {

  var health = OPS_createHealthObject({

    id: "NF",

    name: "Notification Runtime",

    category: OPS.CATEGORY.NOTIFICATIONS,

    status: OPS.STATUS.UNKNOWN,

    severity: OPS.SEVERITY.INFO,

    score: 0

  });

health.metadata = {
  runtimeAvailable:
    typeof NF_getMode === "function",
  sendEngineAvailable:
    typeof NF_processSendQueue === "function"
};

health.status =
  (health.metadata.runtimeAvailable &&
   health.metadata.sendEngineAvailable)
    ? OPS.STATUS.PASS
    : OPS.STATUS.WARNING;

health.score =
  health.status === OPS.STATUS.PASS
    ? 100
    : 75;

  OPS_registerOrUpdate_(health);

  return health;

}

/* ========================================================================== */
/* EVENT BUS */
/* ========================================================================== */

function OPS_collectEventBusHealth() {

  var health = OPS_createHealthObject({

    id: "EB",

    name: "Enterprise Event Bus",

    category: OPS.CATEGORY.EVENTS,

    status: OPS.STATUS.UNKNOWN,

    severity: OPS.SEVERITY.INFO,

    score: 0

  });

health.metadata = {
  publish:
    typeof MOS5EB_publish === "function",
  dispatch:
    typeof MOS5SUB_dispatchEvent === "function"
};

health.status =
  health.metadata.publish
    ? OPS.STATUS.PASS
    : OPS.STATUS.WARNING;

health.score =
  health.metadata.publish
    ? 100
    : 75;

  OPS_registerOrUpdate_(health);

  return health;

}

/* ========================================================================== */
/* INTERNAL */
/* ========================================================================== */

function OPS_registerOrUpdate_(health) {

  if (OPS_hasSubsystem(health.id)) {

    OPS_updateSubsystem(
      health.id,
      health
    );

  } else {

    OPS_registerSubsystem(
      health
    );

  }

  return true;

}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* LEAD INTAKE */
/* ========================================================================== */

function OPS_collectLeadIntakeHealth() {

  var health = OPS_createHealthObject({

    id: "LI",

    name: "Lead Intake",

    category: OPS.CATEGORY.CRM,

    status: OPS.STATUS.UNKNOWN,

    severity: OPS.SEVERITY.INFO,

    score: 0

  });

  try {

    if (typeof LI_getQueueStatus === "function") {

      var queue = LI_getQueueStatus();

      var failed =
        Number(queue.error || 0);

      var pending =
        Number(queue.new || 0);

      health.metadata = queue;

      if (failed > 0) {

        health.status =
          OPS.STATUS.FAIL;

        health.severity =
          OPS.SEVERITY.HIGH;

        health.score = 40;

      } else if (pending > 100) {

        health.status =
          OPS.STATUS.WARNING;

        health.severity =
          OPS.SEVERITY.MEDIUM;

        health.score = 75;

      } else {

        health.status =
          OPS.STATUS.PASS;

        health.score = 100;

      }

    }

  } catch (e) {

    health.status =
      OPS.STATUS.FAIL;

    health.severity =
      OPS.SEVERITY.CRITICAL;

    health.score = 0;

    health.metadata = {
      error: String(e)
    };

  }

  OPS_registerOrUpdate_(health);

  return health;

}

/* ========================================================================== */
/* ASSIGNMENT ENGINE */
/* ========================================================================== */

function OPS_collectAssignmentHealth() {

  var health = OPS_createHealthObject({

    id: "AE",

    name: "Assignment Engine",

    category: OPS.CATEGORY.CRM,

    status: OPS.STATUS.UNKNOWN,

    severity: OPS.SEVERITY.INFO,

    score: 0

  });

  try {

    if (typeof AE_getMode === "function") {

      var mode =
        AE_getMode();

      health.metadata = {

        mode: mode

      };

      health.status =
        OPS.STATUS.PASS;

      health.score = 100;

    }

  } catch (e) {

    health.status =
      OPS.STATUS.FAIL;

    health.severity =
      OPS.SEVERITY.CRITICAL;

    health.score = 0;

    health.metadata = {

      error: String(e)

    };

  }

  OPS_registerOrUpdate_(health);

  return health;

}

/* ========================================================================== */
/* RUNTIME */
/* ========================================================================== */

function OPS_collectRuntimeHealth() {

  var health = OPS_createHealthObject({

    id: "RT",

    name: "Enterprise Runtime",

    category: OPS.CATEGORY.RUNTIME,

    status: OPS.STATUS.PASS,

    severity: OPS.SEVERITY.INFO,

    score: 100

  });

  var checks = {

    scheduler:
      typeof MOS5SCH_getRuntimeHealth ===
      "function",

    notifications:
      typeof MOS5NF_getRuntimeHealth ===
      "function",

    eventBus:
      typeof MOS5EB_publish ===
      "function",

    assignment:
      typeof AE_assignLead ===
      "function",

    intake:
      typeof LI_processIntakeQueue ===
      "function"

  };

  health.metadata = checks;

  var available =
    Object.keys(checks)
      .filter(function(key){

        return checks[key];

      }).length;

  var total =
    Object.keys(checks).length;

  health.score =
    Math.round(
      (available / total) * 100
    );

  if (available !== total) {

    health.status =
      OPS.STATUS.WARNING;

    health.severity =
      OPS.SEVERITY.MEDIUM;

  }

  OPS_registerOrUpdate_(health);

  return health;

}

/* ========================================================================== */
/* REFRESH */
/* ========================================================================== */

function OPS_refreshCollectors() {

  return OPS_collectAllSubsystemHealth();

}

/* ========================================================================== */
/* END PART 2 */
/* ========================================================================== */
/* ========================================================================== */
/* TRIGGER HEALTH */
/* ========================================================================== */

function OPS_collectTriggerHealth() {

  var health = OPS_createHealthObject({

    id: "TRG",

    name: "Managed Trigger Runtime",

    category: OPS.CATEGORY.RUNTIME,

    status: OPS.STATUS.UNKNOWN,

    severity: OPS.SEVERITY.INFO,

    score: 0

  });

  try {

    var installed = 0;
    var duplicates = 0;

    if (typeof MOS5SCH_getSchedulerTriggerStatus === "function") {

      var scheduler =
        MOS5SCH_getSchedulerTriggerStatus();

      installed += scheduler.installed ? 1 : 0;
      duplicates += Number(
        scheduler.duplicateTriggers || 0
      );

      health.metadata.scheduler =
        scheduler;

    }

if (typeof ScriptApp === "object") {

  var triggers =
    ScriptApp.getProjectTriggers();

  health.metadata.notificationTriggers =
    triggers.filter(function(t){

      return t.getHandlerFunction()
        .indexOf("NF_") === 0;

    }).length;

}

    health.score =
      duplicates > 0
        ? 40
        : installed > 0
          ? 100
          : 75;

    if (duplicates > 0) {

      health.status =
        OPS.STATUS.FAIL;

      health.severity =
        OPS.SEVERITY.HIGH;

    } else {

      health.status =
        OPS.STATUS.PASS;

    }

  } catch (e) {

    health.status =
      OPS.STATUS.FAIL;

    health.severity =
      OPS.SEVERITY.CRITICAL;

    health.score = 0;

    health.metadata.error =
      String(e);

  }

  OPS_registerOrUpdate_(health);

  return health;

}

/* ========================================================================== */
/* QUEUE HEALTH */
/* ========================================================================== */

function OPS_collectQueueHealth() {

  var health = OPS_createHealthObject({

    id: "QUEUE",

    name: "Enterprise Queue",

    category: OPS.CATEGORY.RUNTIME,

    status: OPS.STATUS.UNKNOWN,

    severity: OPS.SEVERITY.INFO,

    score: 0

  });

  try {

    if (typeof LI_getQueueStatus === "function") {

      var queue =
        LI_getQueueStatus();

      var pending =
        Number(queue.new || 0);

      var errors =
        Number(queue.error || 0);

      health.metadata = queue;

      if (errors > 0) {

        health.status =
          OPS.STATUS.FAIL;

        health.severity =
          OPS.SEVERITY.HIGH;

        health.score = 30;

      } else if (pending > 250) {

        health.status =
          OPS.STATUS.WARNING;

        health.severity =
          OPS.SEVERITY.MEDIUM;

        health.score = 70;

      } else {

        health.status =
          OPS.STATUS.PASS;

        health.score = 100;

      }

    }

  } catch (e) {

    health.status =
      OPS.STATUS.FAIL;

    health.severity =
      OPS.SEVERITY.CRITICAL;

    health.score = 0;

    health.metadata = {

      error: String(e)

    };

  }

  OPS_registerOrUpdate_(health);

  return health;

}

/* ========================================================================== */
/* COLLECT INFRASTRUCTURE */
/* ========================================================================== */

function OPS_collectInfrastructureHealth() {

  return [

    OPS_collectRuntimeHealth(),

    OPS_collectTriggerHealth(),

    OPS_collectQueueHealth()

  ];

}

/* ========================================================================== */
/* FULL REFRESH */
/* ========================================================================== */

function OPS_refreshEnterpriseHealth() {

  OPS_collectAllSubsystemHealth();

  OPS_collectInfrastructureHealth();

  return OPS_exportHealth();

}

/* ========================================================================== */
/* REGISTRY READY */
/* ========================================================================== */

function OPS_registryReady() {

  return OPS_subsystemCount() >= 8;

}

/* ========================================================================== */
/* END PART 3 */
/* ========================================================================== */
/* ========================================================================== */
/* COLLECTOR SUMMARY */
/* ========================================================================== */

function OPS_getCollectorSummary() {

  var systems =
    OPS_getSubsystems();

  var summary = {

    total:
      systems.length,

    collected:
      0,

    pass:
      0,

    warning:
      0,

    fail:
      0,

    unknown:
      0,

    score:
      0,

    generatedAt:
      new Date().toISOString()

  };

  if (!systems.length) {
    return summary;
  }

  var totalScore = 0;

  systems.forEach(function(system){

    summary.collected++;

    totalScore +=
      Number(system.score || 0);

    switch (
      String(system.status)
        .toUpperCase()
    ) {

      case OPS.STATUS.PASS:
        summary.pass++;
        break;

      case OPS.STATUS.WARNING:
        summary.warning++;
        break;

      case OPS.STATUS.FAIL:
        summary.fail++;
        break;

      default:
        summary.unknown++;
        break;

    }

  });

  summary.score =
    Math.round(
      totalScore /
      systems.length
    );

  return summary;

}

/* ========================================================================== */
/* VERIFY COLLECTORS */
/* ========================================================================== */

function OPS_verifyCollectors() {

  var required = [

    "OPS_collectSchedulerHealth",
    "OPS_collectNotificationHealth",
    "OPS_collectEventBusHealth",
    "OPS_collectLeadIntakeHealth",
    "OPS_collectAssignmentHealth",
    "OPS_collectRuntimeHealth",
    "OPS_collectTriggerHealth",
    "OPS_collectQueueHealth"

  ];

  var results = [];

  required.forEach(function(name){

    results.push({

      collector:
        name,

      available:
        typeof globalThis[name] ===
        "function"

    });

  });

  return results;

}

/* ========================================================================== */
/* RUN COLLECTOR DIAGNOSTICS */
/* ========================================================================== */

function OPS_runCollectorDiagnostics() {

  var verification =
    OPS_verifyCollectors();

  var passed =
    verification.filter(function(item){

      return item.available;

    }).length;

  return {

    release:
      "OPS-01",

    version:
      OPS_VERSION,

    status:
      passed === verification.length
        ? "PASS"
        : "FAIL",

    passed:
      passed,

    failed:
      verification.length -
      passed,

    verification:
      verification,

    summary:
      OPS_getCollectorSummary(),

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* SELF TEST */
/* ========================================================================== */

function OPS_testCollectors() {

  OPS_refreshEnterpriseHealth();

  var diagnostics =
    OPS_runCollectorDiagnostics();

  if (
    diagnostics.status !==
    "PASS"
  ) {

    throw new Error(
      "Collector diagnostics failed."
    );

  }

  return {

    success: true,

    release:
      "OPS-01",

    summary:
      OPS_getCollectorSummary(),

    diagnostics:
      diagnostics,

    registry:
      OPS_exportHealth()

  };

}

/* ========================================================================== */
/* VERSION */
/* ========================================================================== */

function OPS_collectorsVersion() {

  return {

    release:
      "OPS-01",

    version:
      OPS_VERSION

  };

}

/* ========================================================================== */
/* END PART 4 */
/* ========================================================================== */
/* ========================================================================== */
/* STARTUP */
/* ========================================================================== */

function OPS_initializeCollectors() {

  OPS_initializeHealth();

  OPS_collectAllSubsystemHealth();

  OPS_collectInfrastructureHealth();

  return OPS_registryReady();

}

/* ========================================================================== */
/* REGISTRY INTEGRITY */
/* ========================================================================== */

function OPS_validateCollectorRegistry() {

  OPS_initializeHealth();

  var systems =
    OPS_getSubsystems();

  var errors = [];

  var ids = {};

  systems.forEach(function(system){

    if (!system.id) {

      errors.push(
        "Subsystem missing id."
      );

      return;

    }

    if (ids[system.id]) {

      errors.push(
        "Duplicate subsystem id: " +
        system.id
      );

    }

    ids[system.id] = true;

    if (
      Number(system.score) < 0 ||
      Number(system.score) > 100
    ) {

      errors.push(
        system.id +
        " score outside valid range."
      );

    }

    if (
      !Array.isArray(system.issues)
    ) {

      errors.push(
        system.id +
        " issues must be an array."
      );

    }

  });

  return {

    success:
      errors.length === 0,

    subsystemCount:
      systems.length,

    errors:
      errors,

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* COMPATIBILITY */
/* ========================================================================== */

function OPS_refreshHealth() {

  return OPS_refreshEnterpriseHealth();

}

function OPS_collectHealth() {

  return OPS_refreshEnterpriseHealth();

}

function OPS_getEnterpriseHealth() {

  return OPS_exportHealth();

}

function OPS_getEnterpriseStatus() {

  return OPS_healthSummary();

}

/* ========================================================================== */
/* INSTALL */
/* ========================================================================== */

function OPS_installEnterpriseHealth() {

  OPS_initializeHealth();

  OPS_installDefaults();

  OPS_initializeCollectors();

  return {

    success: true,

    release: "OPS-01",

    registryReady:
      OPS_registryReady(),

    subsystemCount:
      OPS_subsystemCount(),

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* COMPLETE SELF TEST */
/* ========================================================================== */

function OPS_selfTestEnterpriseHealth() {

  var install =
    OPS_installEnterpriseHealth();

  var registry =
    OPS_validateCollectorRegistry();

  var diagnostics =
    OPS_runCollectorDiagnostics();

  if (!registry.success) {

    throw new Error(
      "Collector registry validation failed."
    );

  }

  if (
    diagnostics.status !==
    "PASS"
  ) {

    throw new Error(
      "Collector diagnostics failed."
    );

  }

  return {

    success: true,

    release: "OPS-01",

    install:
      install,

    registry:
      registry,

    diagnostics:
      diagnostics,

    health:
      OPS_exportHealth()

  };

}

/* ========================================================================== */
/* VERSION */
/* ========================================================================== */

function OPS_enterpriseHealthVersion() {

  return {

    release:
      "OPS-01",

    version:
      OPS_VERSION,

    module:
      "Enterprise Subsystem Collectors"

  };

}

/* ========================================================================== */
/* END OF FILE */
/* ========================================================================== */