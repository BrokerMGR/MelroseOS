/******************************************************************************
 * MelroseOS Enterprise
 * Project : Broker Command Center
 * File    : BCC-00_Core.js
 * Version : 1.0.0
 *
 * Enterprise Broker Command Center
 * Core Runtime
 ******************************************************************************/

/* ========================================================================== */
/* VERSION */
/* ========================================================================== */

const BCC_VERSION = "1.0.0";

/* ========================================================================== */
/* STATE */
/* ========================================================================== */

var BCC_INITIALIZED =
  BCC_INITIALIZED || false;

/* ========================================================================== */
/* INITIALIZE */
/* ========================================================================== */

function BCC_initialize() {

  if (BCC_INITIALIZED) {
    return true;
  }

  BCC_INITIALIZED = true;

  return true;

}

/* ========================================================================== */
/* SYSTEM STATUS */
/* ========================================================================== */

function BCC_getSystemStatus() {

  BCC_initialize();

  return {

    initialized:
      BCC_INITIALIZED,

    version:
      BCC_VERSION,

    productionReady:
      true,

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* HEALTH */
/* ========================================================================== */

function BCC_getHealth() {

  BCC_initialize();

  if (
    typeof OPS_exportHealth ===
    "function"
  ) {

    return OPS_exportHealth();

  }

  return {

    status: "UNKNOWN",

    score: 0,

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* BROKER SNAPSHOT */
/* ========================================================================== */

function BCC_getBrokerSnapshot() {

  var health =
    BCC_getHealth();

  return {

    brokerHealth:
      health.healthy === true,

    score:
      health.score || 0,

    subsystemCount:
      health.subsystems
        ? health.subsystems.length
        : 0,

    summary:
      health.summary || {},

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* DASHBOARD */
/* ========================================================================== */

function BCC_getDashboardData() {

  BCC_initialize();

  return {

    release:
      "BCC-00",

    version:
      BCC_VERSION,

    system:
      BCC_getSystemStatus(),

    broker:
      BCC_getBrokerSnapshot(),

    operations:
      BCC_getHealth(),

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* VERSION */
/* ========================================================================== */

function BCC_version() {

  return {

    release:
      "BCC-00",

    version:
      BCC_VERSION

  };

}

/* ========================================================================== */
/* SELF TEST */
/* ========================================================================== */

function BCC_testCore() {

  var dashboard =
    BCC_getDashboardData();

  return {

    success: true,

    release:
      "BCC-00",

    version:
      BCC_VERSION,

    dashboard:
      dashboard

  };

}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* SCHEDULER */
/* ========================================================================== */

function BCC_getSchedulerStatus() {

  if (
    typeof OPS_getSubsystem ===
    "function"
  ) {

    var scheduler =
      OPS_getSubsystem("SCH");

    if (scheduler) {
      return scheduler;
    }

  }

  return {

    id: "SCH",

    status: "UNKNOWN",

    score: 0

  };

}

/* ========================================================================== */
/* NOTIFICATIONS */
/* ========================================================================== */

function BCC_getNotificationStatus() {

  if (
    typeof OPS_getSubsystem ===
    "function"
  ) {

    var notification =
      OPS_getSubsystem("NF");

    if (notification) {
      return notification;
    }

  }

  return {

    id: "NF",

    status: "UNKNOWN",

    score: 0

  };

}

/* ========================================================================== */
/* EVENT BUS */
/* ========================================================================== */

function BCC_getEventBusStatus() {

  if (
    typeof OPS_getSubsystem ===
    "function"
  ) {

    var eventBus =
      OPS_getSubsystem("EB");

    if (eventBus) {
      return eventBus;
    }

  }

  return {

    id: "EB",

    status: "UNKNOWN",

    score: 0

  };

}

/* ========================================================================== */
/* ASSIGNMENT ENGINE */
/* ========================================================================== */

function BCC_getAssignmentStatus() {

  if (
    typeof OPS_getSubsystem ===
    "function"
  ) {

    var assignment =
      OPS_getSubsystem("AE");

    if (assignment) {
      return assignment;
    }

  }

  return {

    id: "AE",

    status: "UNKNOWN",

    score: 0

  };

}

/* ========================================================================== */
/* LEAD INTAKE */
/* ========================================================================== */

function BCC_getLeadIntakeStatus() {

  if (
    typeof OPS_getSubsystem ===
    "function"
  ) {

    var intake =
      OPS_getSubsystem("LI");

    if (intake) {
      return intake;
    }

  }

  return {

    id: "LI",

    status: "UNKNOWN",

    score: 0

  };

}

/* ========================================================================== */
/* RUNTIME */
/* ========================================================================== */

function BCC_getRuntimeStatus() {

  if (
    typeof OPS_getSubsystem ===
    "function"
  ) {

    var runtime =
      OPS_getSubsystem("RT");

    if (runtime) {
      return runtime;
    }

  }

  return {

    id: "RT",

    status: "UNKNOWN",

    score: 0

  };

}

/* ========================================================================== */
/* DASHBOARD MODULES */
/* ========================================================================== */

function BCC_getDashboardModules() {

  return {

    scheduler:
      BCC_getSchedulerStatus(),

    notifications:
      BCC_getNotificationStatus(),

    eventBus:
      BCC_getEventBusStatus(),

    assignment:
      BCC_getAssignmentStatus(),

    leadIntake:
      BCC_getLeadIntakeStatus(),

    runtime:
      BCC_getRuntimeStatus()

  };

}

/* ========================================================================== */
/* UPDATE DASHBOARD */
/* ========================================================================== */

function BCC_refreshDashboard() {

  if (
    typeof OPS_refreshEnterpriseHealth ===
    "function"
  ) {

    OPS_refreshEnterpriseHealth();

  }

  return BCC_getDashboardData();

}

/* ========================================================================== */
/* END PART 2 */
/* ========================================================================== */
/* ========================================================================== */
/* LIVE DASHBOARD METRICS */
/* ========================================================================== */

function BCC_getLiveMetrics() {

  var health =
    BCC_getHealth();

  var summary =
    health.summary || {};

  return {

    enterpriseScore:
      health.score || 0,

    overallStatus:
      summary.overallStatus || "UNKNOWN",

    subsystemCount:
      summary.total || 0,

    passing:
      summary.pass || 0,

    warnings:
      summary.warning || 0,

    failures:
      summary.fail || 0,

    unknown:
      summary.unknown || 0,

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* ALERTS */
/* ========================================================================== */

function BCC_getAlerts() {

  if (
    typeof OPS_allIssues !==
    "function"
  ) {

    return [];

  }

  return OPS_allIssues();

}

/* ========================================================================== */
/* EXECUTIVE SUMMARY */
/* ========================================================================== */

function BCC_getExecutiveSummary() {

  var metrics =
    BCC_getLiveMetrics();

  return {

    score:
      metrics.enterpriseScore,

    status:
      metrics.overallStatus,

    healthy:
      metrics.failures === 0,

    generatedAt:
      metrics.generatedAt

  };

}

/* ========================================================================== */
/* DASHBOARD PAYLOAD */
/* ========================================================================== */

function BCC_buildDashboardPayload() {

  return {

    release:
      "BCC-00",

    version:
      BCC_VERSION,

    executive:
      BCC_getExecutiveSummary(),

    metrics:
      BCC_getLiveMetrics(),

    systems:
      BCC_getDashboardModules(),

    alerts:
      BCC_getAlerts(),

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* JSON */
/* ========================================================================== */

function BCC_getDashboardJSON() {

  return JSON.stringify(

    BCC_buildDashboardPayload(),

    null,

    2

  );

}

/* ========================================================================== */
/* HEALTH CARD */
/* ========================================================================== */

function BCC_getHealthCard() {

  var metrics =
    BCC_getLiveMetrics();

  return {

    title:
      "Enterprise Health",

    value:
      metrics.enterpriseScore,

    status:
      metrics.overallStatus,

    healthy:
      metrics.failures === 0

  };

}

/* ========================================================================== */
/* ALERT CARD */
/* ========================================================================== */

function BCC_getAlertCard() {

  var alerts =
    BCC_getAlerts();

  return {

    title:
      "Enterprise Alerts",

    count:
      alerts.length,

    alerts:
      alerts

  };

}

/* ========================================================================== */
/* SYSTEM CARD */
/* ========================================================================== */

function BCC_getSystemCard() {

  return {

    title:
      "Subsystems",

    systems:
      BCC_getDashboardModules()

  };

}

/* ========================================================================== */
/* END PART 3 */
/* ========================================================================== */
/* ========================================================================== */
/* DASHBOARD WIDGETS */
/* ========================================================================== */

function BCC_getWidgets() {

  return {

    health:
      BCC_getHealthCard(),

    alerts:
      BCC_getAlertCard(),

    systems:
      BCC_getSystemCard(),

    metrics:
      BCC_getLiveMetrics()

  };

}

/* ========================================================================== */
/* REFRESH */
/* ========================================================================== */

function BCC_refresh() {

  BCC_initialize();

  if (
    typeof OPS_refreshEnterpriseHealth ===
    "function"
  ) {

    OPS_refreshEnterpriseHealth();

  }

  return BCC_buildDashboardPayload();

}

/* ========================================================================== */
/* REGISTRY VALIDATION */
/* ========================================================================== */

function BCC_validate() {

  var errors = [];

  if (
    typeof OPS_exportHealth !==
    "function"
  ) {

    errors.push(
      "OPS_exportHealth() missing."
    );

  }

  if (
    typeof OPS_getSubsystem !==
    "function"
  ) {

    errors.push(
      "OPS_getSubsystem() missing."
    );

  }

  if (
    typeof OPS_healthSummary !==
    "function"
  ) {

    errors.push(
      "OPS_healthSummary() missing."
    );

  }

  return {

    success:
      errors.length === 0,

    errors:
      errors,

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function BCC_runDiagnostics() {

  var validation =
    BCC_validate();

  var payload =
    BCC_buildDashboardPayload();

  return {

    release:
      "BCC-00",

    version:
      BCC_VERSION,

    status:
      validation.success
        ? "PASS"
        : "FAIL",

    validation:
      validation,

    payloadSummary: {

      score:
        payload.metrics.enterpriseScore,

      status:
        payload.metrics.overallStatus,

      alerts:
        payload.alerts.length,

      subsystems:
        payload.metrics.subsystemCount

    },

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* SELF TEST */
/* ========================================================================== */

function BCC_selfTest() {

  BCC_initialize();

  var diagnostics =
    BCC_runDiagnostics();

  if (
    diagnostics.status !==
    "PASS"
  ) {

    throw new Error(
      "Broker Command Center validation failed."
    );

  }

  return {

    success: true,

    release:
      "BCC-00",

    version:
      BCC_VERSION,

    diagnostics:
      diagnostics,

    dashboard:
      BCC_buildDashboardPayload()

  };

}

/* ========================================================================== */
/* VERSION */
/* ========================================================================== */

function BCC_getVersion() {

  return {

    project:
      "Broker Command Center",

    release:
      "BCC-00",

    version:
      BCC_VERSION

  };

}

/* ========================================================================== */
/* END OF FILE */
/* ========================================================================== */