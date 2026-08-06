/******************************************************************************
 * MelroseOS Enterprise
 * File: OPS-00_Core.js
 * Version: 1.0.0
 *
 * Enterprise Operations Health Registry
 *
 * PART 1 OF 5
 ******************************************************************************/

/* ========================================================================== */
/* VERSION */
/* ========================================================================== */

const OPS_VERSION = "1.0.0";

/* ========================================================================== */
/* CONSTANTS */
/* ========================================================================== */

const OPS = Object.freeze({

  STATUS: Object.freeze({
    PASS: "PASS",
    WARNING: "WARNING",
    FAIL: "FAIL",
    UNKNOWN: "UNKNOWN"
  }),

  SEVERITY: Object.freeze({
    INFO: "INFO",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL"
  }),

  CATEGORY: Object.freeze({
    CORE: "CORE",
    RUNTIME: "RUNTIME",
    CRM: "CRM",
    EVENTS: "EVENTS",
    NOTIFICATIONS: "NOTIFICATIONS",
    SCHEDULER: "SCHEDULER",
    METRICS: "METRICS",
    SECURITY: "SECURITY",
    DEPLOYMENT: "DEPLOYMENT",
    AI: "AI",
    DASHBOARD: "DASHBOARD",
    OTHER: "OTHER"
  })

});

/* ========================================================================== */
/* PRIVATE REGISTRY */
/* ========================================================================== */

var OPS_REGISTRY = OPS_REGISTRY || {};

var OPS_INITIALIZED = OPS_INITIALIZED || false;

/* ========================================================================== */
/* INITIALIZATION */
/* ========================================================================== */

function OPS_initializeHealth() {

  if (OPS_INITIALIZED) {
    return true;
  }

  OPS_REGISTRY = {};

  OPS_INITIALIZED = true;

  return true;

}

/* ========================================================================== */
/* RESET */
/* ========================================================================== */

function OPS_resetHealth() {

  OPS_REGISTRY = {};

  OPS_INITIALIZED = true;

  return true;

}

/* ========================================================================== */
/* CREATE HEALTH OBJECT */
/* ========================================================================== */

function OPS_createHealthObject(config) {

  config = config || {};

  return {

    id:
      String(config.id || "").trim(),

    name:
      String(config.name || "").trim(),

    category:
      String(
        config.category ||
        OPS.CATEGORY.OTHER
      ),

    status:
      String(
        config.status ||
        OPS.STATUS.UNKNOWN
      ),

    severity:
      String(
        config.severity ||
        OPS.SEVERITY.INFO
      ),

    score:
      Number(config.score || 0),

    issues:
      Array.isArray(config.issues)
        ? config.issues
        : [],

    metadata:
      config.metadata || {},

    createdAt:
      config.createdAt ||
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* REGISTER */
/* ========================================================================== */

function OPS_registerSubsystem(config) {

  OPS_initializeHealth();

  var health =
    OPS_createHealthObject(config);

  if (!health.id) {
    throw new Error(
      "Subsystem id is required."
    );
  }

  OPS_REGISTRY[
    health.id
  ] = health;

  return health;

}

/* ========================================================================== */
/* EXISTS */
/* ========================================================================== */

function OPS_hasSubsystem(id) {

  OPS_initializeHealth();

  id = String(id || "").trim();

  return !!OPS_REGISTRY[id];

}

/* ========================================================================== */
/* GET */
/* ========================================================================== */

function OPS_getSubsystem(id) {

  OPS_initializeHealth();

  id = String(id || "").trim();

  if (!OPS_REGISTRY[id]) {
    return null;
  }

  return JSON.parse(
    JSON.stringify(
      OPS_REGISTRY[id]
    )
  );

}

/* ========================================================================== */
/* GET ALL */
/* ========================================================================== */

function OPS_getSubsystems() {

  OPS_initializeHealth();

  return Object
    .keys(OPS_REGISTRY)
    .sort()
    .map(function(id){

      return OPS_getSubsystem(id);

    });

}

/* ========================================================================== */
/* REMOVE */
/* ========================================================================== */

function OPS_unregisterSubsystem(id) {

  OPS_initializeHealth();

  id = String(id || "").trim();

  delete OPS_REGISTRY[id];

  return true;

}

/* ========================================================================== */
/* COUNT */
/* ========================================================================== */

function OPS_subsystemCount() {

  OPS_initializeHealth();

  return Object.keys(
    OPS_REGISTRY
  ).length;

}

/* ========================================================================== */
/* IDS */
/* ========================================================================== */

function OPS_getSubsystemIds() {

  OPS_initializeHealth();

  return Object.keys(
    OPS_REGISTRY
  ).sort();

}

/* ========================================================================== */
/* CATEGORY LOOKUP */
/* ========================================================================== */

function OPS_getSubsystemsByCategory(category) {

  category =
    String(category || "")
      .trim()
      .toUpperCase();

  return OPS_getSubsystems()
    .filter(function(item){

      return (
        String(item.category)
          .toUpperCase() ===
        category
      );

    });

}

/* ========================================================================== */
/* STATUS LOOKUP */
/* ========================================================================== */

function OPS_getSubsystemsByStatus(status) {

  status =
    String(status || "")
      .trim()
      .toUpperCase();

  return OPS_getSubsystems()
    .filter(function(item){

      return (
        String(item.status)
          .toUpperCase() ===
        status
      );

    });

}

/* ========================================================================== */
/* UPDATE */
/* ========================================================================== */

function OPS_updateSubsystem(id, updates) {

  OPS_initializeHealth();

  id = String(id || "").trim();

  if (!OPS_REGISTRY[id]) {

    throw new Error(
      "Unknown subsystem: " + id
    );

  }

  updates = updates || {};

  Object.keys(updates)
    .forEach(function(key){

      OPS_REGISTRY[id][key] =
        updates[key];

    });

  OPS_REGISTRY[id]
    .updatedAt =
      new Date().toISOString();

  return OPS_getSubsystem(id);

}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* HEALTH SUMMARY */
/* ========================================================================== */

function OPS_healthSummary() {

  OPS_initializeHealth();

  var subsystems =
    OPS_getSubsystems();

  var summary = {

    total: subsystems.length,

    pass: 0,

    warning: 0,

    fail: 0,

    unknown: 0,

    averageScore: 0,

    overallStatus:
      OPS.STATUS.UNKNOWN,

    generatedAt:
      new Date().toISOString()

  };

  if (!subsystems.length) {
    return summary;
  }

  var totalScore = 0;

  subsystems.forEach(function(item){

    totalScore +=
      Number(item.score || 0);

    switch(
      String(item.status)
        .toUpperCase()
    ){

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

  summary.averageScore =
    Math.round(
      totalScore /
      subsystems.length
    );

  summary.overallStatus =
    OPS_healthStatus_(
      summary
    );

  return summary;

}

/* ========================================================================== */
/* SCORE */
/* ========================================================================== */

function OPS_healthScore(){

  return OPS_healthSummary()
    .averageScore;

}

/* ========================================================================== */
/* OVERALL STATUS */
/* ========================================================================== */

function OPS_overallStatus(){

  return OPS_healthSummary()
    .overallStatus;

}

/* ========================================================================== */
/* IS HEALTHY */
/* ========================================================================== */

function OPS_isHealthy(){

  return (
    OPS_overallStatus() ===
    OPS.STATUS.PASS
  );

}

/* ========================================================================== */
/* ISSUE MANAGEMENT */
/* ========================================================================== */

function OPS_addIssue(
  id,
  issue
){

  OPS_initializeHealth();

  if(!OPS_hasSubsystem(id)){
    throw new Error(
      "Unknown subsystem: " +
      id
    );
  }

  issue = issue || {};

  OPS_REGISTRY[id]
    .issues
    .push({

      severity:
        String(
          issue.severity ||
          OPS.SEVERITY.INFO
        ),

      code:
        String(
          issue.code || ""
        ),

      message:
        String(
          issue.message || ""
        ),

      createdAt:
        new Date()
          .toISOString()

    });

  OPS_REGISTRY[id]
    .updatedAt =
      new Date()
        .toISOString();

  return OPS_getSubsystem(id);

}

/* ========================================================================== */
/* CLEAR ISSUES */
/* ========================================================================== */

function OPS_clearIssues(id){

  OPS_initializeHealth();

  if(!OPS_hasSubsystem(id)){
    return false;
  }

  OPS_REGISTRY[id]
    .issues = [];

  OPS_REGISTRY[id]
    .updatedAt =
      new Date()
        .toISOString();

  return true;

}

/* ========================================================================== */
/* ISSUE COUNT */
/* ========================================================================== */

function OPS_issueCount(id){

  if(!OPS_hasSubsystem(id)){
    return 0;
  }

  return OPS_REGISTRY[id]
    .issues
    .length;

}

/* ========================================================================== */
/* ALL ISSUES */
/* ========================================================================== */

function OPS_allIssues(){

  var issues = [];

  OPS_getSubsystems()
    .forEach(function(system){

      (system.issues || [])
        .forEach(function(issue){

          issue.subsystem =
            system.id;

          issues.push(issue);

        });

    });

  return issues;

}

/* ========================================================================== */
/* EXPORT */
/* ========================================================================== */

function OPS_exportHealth(){

  return {

    version:
      OPS_VERSION,

    summary:
      OPS_healthSummary(),

    score:
      OPS_healthScore(),

    healthy:
      OPS_isHealthy(),

    subsystems:
      OPS_getSubsystems()

  };

}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function OPS_runDiagnostics(){

  var results = [];

  results.push({

    test:
      "Registry Initialized",

    status:
      OPS_INITIALIZED
        ? "PASS"
        : "FAIL"

  });

  results.push({

    test:
      "Subsystem Count",

    status:
      OPS_subsystemCount() >= 0
        ? "PASS"
        : "FAIL"

  });

  results.push({

    test:
      "Health Export",

    status:
      typeof OPS_exportHealth ===
      "function"
        ? "PASS"
        : "FAIL"

  });

  return {

    release:
      "OPS-00",

    version:
      OPS_VERSION,

    overall:
      results.every(function(r){

        return r.status ===
          "PASS";

      })
        ? "PASS"
        : "FAIL",

    tests:
      results,

    generatedAt:
      new Date()
        .toISOString()

  };

}

/* ========================================================================== */
/* PRIVATE */
/* ========================================================================== */

function OPS_healthStatus_(summary){

  if(summary.fail > 0){
    return OPS.STATUS.FAIL;
  }

  if(summary.warning > 0){
    return OPS.STATUS.WARNING;
  }

  if(summary.pass > 0){
    return OPS.STATUS.PASS;
  }

  return OPS.STATUS.UNKNOWN;

}

/* ========================================================================== */
/* END PART 2 */
/* ========================================================================== */
/* ========================================================================== */
/* SCORE MANAGEMENT */
/* ========================================================================== */

function OPS_setScore(id, score) {

  OPS_initializeHealth();

  if (!OPS_hasSubsystem(id)) {
    throw new Error("Unknown subsystem: " + id);
  }

  score = Number(score);

  if (!isFinite(score)) {
    score = 0;
  }

  score = Math.max(0, Math.min(100, score));

  OPS_REGISTRY[id].score = score;
  OPS_REGISTRY[id].updatedAt = new Date().toISOString();

  return OPS_getSubsystem(id);

}

/* ========================================================================== */
/* STATUS MANAGEMENT */
/* ========================================================================== */

function OPS_setStatus(id, status) {

  OPS_initializeHealth();

  if (!OPS_hasSubsystem(id)) {
    throw new Error("Unknown subsystem: " + id);
  }

  status = String(status || "")
    .trim()
    .toUpperCase();

  if (
    status !== OPS.STATUS.PASS &&
    status !== OPS.STATUS.WARNING &&
    status !== OPS.STATUS.FAIL &&
    status !== OPS.STATUS.UNKNOWN
  ) {
    status = OPS.STATUS.UNKNOWN;
  }

  OPS_REGISTRY[id].status = status;
  OPS_REGISTRY[id].updatedAt = new Date().toISOString();

  return OPS_getSubsystem(id);

}

/* ========================================================================== */
/* SEVERITY */
/* ========================================================================== */

function OPS_setSeverity(id, severity) {

  OPS_initializeHealth();

  if (!OPS_hasSubsystem(id)) {
    throw new Error("Unknown subsystem: " + id);
  }

  severity = String(severity || "")
    .trim()
    .toUpperCase();

  OPS_REGISTRY[id].severity = severity;
  OPS_REGISTRY[id].updatedAt = new Date().toISOString();

  return OPS_getSubsystem(id);

}

/* ========================================================================== */
/* METADATA */
/* ========================================================================== */

function OPS_setMetadata(id, metadata) {

  OPS_initializeHealth();

  if (!OPS_hasSubsystem(id)) {
    throw new Error("Unknown subsystem: " + id);
  }

  OPS_REGISTRY[id].metadata = metadata || {};
  OPS_REGISTRY[id].updatedAt = new Date().toISOString();

  return OPS_getSubsystem(id);

}

function OPS_mergeMetadata(id, values) {

  OPS_initializeHealth();

  if (!OPS_hasSubsystem(id)) {
    throw new Error("Unknown subsystem: " + id);
  }

  values = values || {};

  Object.keys(values).forEach(function(key) {
    OPS_REGISTRY[id].metadata[key] = values[key];
  });

  OPS_REGISTRY[id].updatedAt = new Date().toISOString();

  return OPS_getSubsystem(id);

}

/* ========================================================================== */
/* TIMESTAMPS */
/* ========================================================================== */

function OPS_touchSubsystem(id) {

  OPS_initializeHealth();

  if (!OPS_hasSubsystem(id)) {
    throw new Error("Unknown subsystem: " + id);
  }

  OPS_REGISTRY[id].updatedAt =
    new Date().toISOString();

  return OPS_REGISTRY[id].updatedAt;

}

/* ========================================================================== */
/* HEALTH COUNTS */
/* ========================================================================== */

function OPS_passCount() {

  return OPS_getSubsystemsByStatus(
    OPS.STATUS.PASS
  ).length;

}

function OPS_warningCount() {

  return OPS_getSubsystemsByStatus(
    OPS.STATUS.WARNING
  ).length;

}

function OPS_failCount() {

  return OPS_getSubsystemsByStatus(
    OPS.STATUS.FAIL
  ).length;

}

function OPS_unknownCount() {

  return OPS_getSubsystemsByStatus(
    OPS.STATUS.UNKNOWN
  ).length;

}

/* ========================================================================== */
/* REGISTRY INFO */
/* ========================================================================== */

function OPS_registryInfo() {

  return {

    version: OPS_VERSION,

    initialized: OPS_INITIALIZED,

    subsystemCount:
      OPS_subsystemCount(),

    categories:
      OPS_categorySummary(),

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* CATEGORY SUMMARY */
/* ========================================================================== */

function OPS_categorySummary() {

  var summary = {};

  OPS_getSubsystems()
    .forEach(function(item) {

      var category =
        item.category || "OTHER";

      summary[category] =
        (summary[category] || 0) + 1;

    });

  return summary;

}

/* ========================================================================== */
/* HEALTH SNAPSHOT */
/* ========================================================================== */

function OPS_snapshot() {

  return JSON.parse(
    JSON.stringify(
      OPS_REGISTRY
    )
  );

}

/* ========================================================================== */
/* IMPORT SNAPSHOT */
/* ========================================================================== */

function OPS_restoreSnapshot(snapshot) {

  snapshot = snapshot || {};

  OPS_REGISTRY =
    JSON.parse(
      JSON.stringify(snapshot)
    );

  OPS_INITIALIZED = true;

  return OPS_subsystemCount();

}

/* ========================================================================== */
/* END PART 3 */
/* ========================================================================== */
/* ========================================================================== */
/* BROKER COMMAND CENTER EXPORT */
/* ========================================================================== */

function OPS_exportBrokerPayload() {

  OPS_initializeHealth();

  return {

    release: "OPS-00",

    version: OPS_VERSION,

    healthy: OPS_isHealthy(),

    overallStatus:
      OPS_overallStatus(),

    score:
      OPS_healthScore(),

    summary:
      OPS_healthSummary(),

    registry:
      OPS_getSubsystems(),

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* REGISTRY VALIDATION */
/* ========================================================================== */

function OPS_validateRegistry() {

  OPS_initializeHealth();

  var errors = [];

  OPS_getSubsystems()
    .forEach(function(system){

      if(!system.id){

        errors.push(
          "Subsystem missing id."
        );

      }

      if(!system.name){

        errors.push(
          "Subsystem " +
          system.id +
          " missing name."
        );

      }

      if(
        Number(system.score) < 0 ||
        Number(system.score) > 100
      ){

        errors.push(
          system.id +
          " score out of range."
        );

      }

      if(
        !Array.isArray(
          system.issues
        )
      ){

        errors.push(
          system.id +
          " issues is not an array."
        );

      }

    });

  return {

    success:
      errors.length === 0,

    errors:
      errors,

    checked:
      OPS_subsystemCount(),

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* HEALTH CHECK */
/* ========================================================================== */

function OPS_healthCheck() {

  var validation =
    OPS_validateRegistry();

  return {

    healthy:
      validation.success,

    overallStatus:
      validation.success
        ? OPS.STATUS.PASS
        : OPS.STATUS.FAIL,

    score:
      OPS_healthScore(),

    subsystemCount:
      OPS_subsystemCount(),

    generatedAt:
      new Date().toISOString()

  };

}

/* ========================================================================== */
/* SELF TEST */
/* ========================================================================== */

function OPS_testCore() {

  OPS_resetHealth();

  OPS_registerSubsystem({

    id: "TEST",

    name:
      "OPS Self Test",

    category:
      OPS.CATEGORY.CORE,

    status:
      OPS.STATUS.PASS,

    severity:
      OPS.SEVERITY.INFO,

    score: 100

  });

  OPS_addIssue(

    "TEST",

    {

      code:
        "SELF_TEST",

      severity:
        OPS.SEVERITY.INFO,

      message:
        "Registry self-test."

    }

  );

  var diagnostics =
    OPS_runDiagnostics();

  var validation =
    OPS_validateRegistry();

  if(
    !validation.success
  ){

    throw new Error(
      "OPS registry validation failed."
    );

  }

  if(
    diagnostics.overall !==
    "PASS"
  ){

    throw new Error(
      "OPS diagnostics failed."
    );

  }

  return {

    success: true,

    release:
      "OPS-00",

    version:
      OPS_VERSION,

    diagnostics:
      diagnostics,

    validation:
      validation,

    summary:
      OPS_healthSummary(),

    payload:
      OPS_exportBrokerPayload()

  };

}

/* ========================================================================== */
/* INSTALL DEFAULT REGISTRY */
/* ========================================================================== */

function OPS_installDefaults() {

  OPS_initializeHealth();

  if(
    OPS_subsystemCount() > 0
  ){

    return false;

  }

  OPS_registerSubsystem({

    id: "CORE",

    name:
      "Operations Core",

    category:
      OPS.CATEGORY.CORE,

    status:
      OPS.STATUS.PASS,

    severity:
      OPS.SEVERITY.INFO,

    score: 100

  });

  return true;

}

/* ========================================================================== */
/* VERSION */
/* ========================================================================== */

function OPS_version() {

  return {

    release:
      "OPS-00",

    version:
      OPS_VERSION

  };

}

/* ========================================================================== */
/* END PART 4 */
/* ========================================================================== */