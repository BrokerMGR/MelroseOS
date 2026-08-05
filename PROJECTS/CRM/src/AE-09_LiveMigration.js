/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine Migration
 * File: AE-09_LiveMigration.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Controlled activation of LIVE assignment routing with safety gates.
 *
 * Requires:
 *   AE-01_Core.gs through AE-08_ShadowMigration.gs
 ******************************************************************************/

const AE_LIVE_MIGRATION_LOG_SHEET = "AE_LIVE_MIGRATION_LOG";

function AE_validateLiveMigration() {
  AE_initializeConfig();

  const checks = [];
  const shadow = AE_getShadowMigrationStatus();
  const agents = AE_getAllAgents();
  const activeAgents = agents.filter(function(agent) {
    return AE_isTrue_(agent.Active) && AE_isTrue_(agent.AcceptingLeads);
  });

  AE_liveCheck_(checks, "Assignment Engine Core", true, "Core initialized.");
  AE_liveCheck_(checks, "Active Eligible Agents", activeAgents.length > 0,
    activeAgents.length + " active agent(s) accepting leads.");

  AE_liveCheck_(checks, "Shadow Results Available", shadow.totalResults > 0,
    shadow.totalResults + " shadow result(s) available.");

  const readinessAllowed =
    shadow.readiness === "READY" ||
    shadow.readiness === "REVIEW";

  AE_liveCheck_(checks, "Shadow Readiness", readinessAllowed,
    "Shadow readiness: " + (shadow.readiness || "NOT RUN") + ".");

  AE_liveCheck_(checks, "Lead Lock Enabled",
    AE_getBooleanConfig_("LEAD_LOCK_ENABLED", true),
    "Lead lock protects repeat-lead ownership.");

  const failed = checks.filter(function(check) {
    return !check.passed;
  });

  return {
    success: failed.length === 0,
    checks: checks,
    failed: failed.length,
    shadow: shadow,
    activeAgents: activeAgents.length
  };
}

function AE_liveCheck_(checks, name, passed, details) {
  checks.push({
    name: name,
    passed: !!passed,
    status: passed ? "PASSED" : "FAILED",
    details: details
  });
}

function AE_enableLiveMigration() {
  const validation = AE_validateLiveMigration();

  if (!validation.success) {
    AE_writeLiveMigrationLog_(
      "LIVE_ACTIVATION_BLOCKED",
      "FAILED",
      JSON.stringify(validation.checks)
    );

    throw new Error(
      "Live migration blocked. Review AE_validateLiveMigration() results."
    );
  }

  AE_setLiveMode();

  AE_writeLiveMigrationLog_(
    "LIVE_ACTIVATED",
    "SUCCESS",
    "Assignment Engine changed to LIVE mode."
  );

  AE_log_(
    "LIVE_MIGRATION_ACTIVATED",
    "Assignment Engine activated in LIVE mode."
  );

  return {
    success: true,
    mode: AE_getMode(),
    validation: validation
  };
}

function AE_disableLiveMigration() {
  AE_setShadowMode();

  AE_writeLiveMigrationLog_(
    "LIVE_DISABLED",
    "SUCCESS",
    "Assignment Engine returned to SHADOW mode."
  );

  AE_log_(
    "LIVE_MIGRATION_DISABLED",
    "Assignment Engine returned to SHADOW mode."
  );

  return {
    success: true,
    mode: AE_getMode()
  };
}

function AE_emergencyPause() {
  AE_setPausedMode();

  AE_writeLiveMigrationLog_(
    "EMERGENCY_PAUSE",
    "SUCCESS",
    "Assignment Engine paused."
  );

  AE_log_(
    "EMERGENCY_PAUSE",
    "Assignment Engine paused."
  );

  return {
    success: true,
    mode: AE_getMode()
  };
}

function AE_processLiveQueue(limit) {
  if (!AE_isLiveMode_()) {
    throw new Error(
      "Live queue processing requires Assignment Engine LIVE mode."
    );
  }

  const validation = AE_validateLiveMigration();

  if (!validation.success) {
    AE_emergencyPause();

    throw new Error(
      "Live safety validation failed. Engine has been paused."
    );
  }

  const result = AE_processUnassignedLeads(
    Math.max(1, Number(limit || 25))
  );

  AE_writeLiveMigrationLog_(
    "LIVE_QUEUE_PROCESSED",
    result.failed ? "WARNING" : "SUCCESS",
    JSON.stringify({
      processed: result.processed,
      assigned: result.assigned,
      failed: result.failed
    })
  );

  return result;
}

function AE_writeLiveMigrationLog_(eventType, status, details) {
  const ss = workbook_();
  const sheet = createSheetIfMissing_(
    ss,
    AE_LIVE_MIGRATION_LOG_SHEET
  );

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "LogID",
      "EventType",
      "Status",
      "Details",
      "EngineMode",
      "CreatedAt"
    ]);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    AE_uuid_("LIV"),
    eventType,
    status,
    details,
    AE_getMode(),
    timestamp_()
  ]);
}

function AE_getLiveMigrationStatus() {
  const validation = AE_validateLiveMigration();

  return {
    mode: AE_getMode(),
    readyForLive: validation.success,
    failedChecks: validation.failed,
    shadowReadiness: validation.shadow.readiness,
    shadowMatchRate: validation.shadow.matchRate,
    activeAgents: validation.activeAgents
  };
}

function AE_testLiveMigration() {
  AE_initializeConfig();

  const validation = AE_validateLiveMigration();

  Logger.log(
    JSON.stringify(validation)
  );

  Logger.log(
    JSON.stringify(
      AE_getLiveMigrationStatus()
    )
  );

  /*
   * IMPORTANT:
   * Self-test intentionally does NOT activate LIVE mode.
   * Production activation must be explicit using:
   *
   * AE_enableLiveMigration()
   */

  return true;
}
