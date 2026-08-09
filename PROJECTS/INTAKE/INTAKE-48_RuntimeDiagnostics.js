function INTAKE_runRuntimeDiagnostics() {

  const checks = {

    core:
      typeof INTAKE_getStatus === 'function',

    settings:
      typeof INTAKE_getSettings === 'function',

    gmailRegistry:
      typeof INTAKE_getAccounts === 'function',

    collector:
      typeof INTAKE_collectAllMailboxes === 'function',

    backfill:
      typeof INTAKE_startBackfill === 'function',

    normalizer:
      typeof INTAKE_normalizeMessage === 'function',

    sourceDetection:
      typeof INTAKE_detectSource === 'function',

    knowledge:
      typeof INTAKE_buildKnowledgeResult === 'function',

    dedup:
      typeof INTAKE_buildDedupResult === 'function',

    crmBridge:
      typeof INTAKE_previewCRMBridge === 'function',

    leadLocks:
      typeof INTAKE_resolveLeadLock === 'function',

    routing:
      typeof INTAKE_previewRouting === 'function',

    brokerReview:
      typeof INTAKE_createReviewItem === 'function',

    safety:
      INTAKE_isSafetyLocked(),

    development:
      INTAKE_isDevelopment(),

    outboundBlocked:
      INTAKE_isOutboundBlocked()

  };

  const values =
    Object.values(checks);

  const passed =
    values.filter(Boolean).length;

  return {

    success:
      passed === values.length,

    project:
      INTAKE.PROJECT,

    release:
      INTAKE.RELEASE,

    version:
      INTAKE.VERSION,

    total:
      values.length,

    passed:
      passed,

    failed:
      values.length - passed,

    checks:
      checks,

    checkedAt:
      new Date().toISOString()

  };

}

function INTAKE_getRuntimeHealth() {

  const diagnostics =
    INTAKE_runRuntimeDiagnostics();

  return {

    subsystem:
      'INTAKE',

    subsystemName:
      'Enterprise Intake Intelligence',

    status:
      diagnostics.success
        ? 'PASS'
        : 'FAIL',

    score:
      Math.round(
        (
          diagnostics.passed /
          diagnostics.total
        ) * 100
      ),

    safetyLock:
      INTAKE_isSafetyLocked(),

    developmentMode:
      INTAKE_isDevelopment(),

    outboundBlocked:
      INTAKE_isOutboundBlocked(),

    liveMonitoring:
      INTAKE_SETTINGS
        .LIVE_MONITORING_ENABLED === true,

    checkedAt:
      new Date().toISOString()

  };

}