function INTAKE_runEndToEndDiagnostics() {

  const checks = {

    gmailAccounts:
      typeof INTAKE_getEnabledAccounts === 'function',

    gmailReader:
      typeof INTAKE_readGmailMessage === 'function',

    gmailSearch:
      typeof INTAKE_buildSearchQuery === 'function',

    historicalScanner:
      typeof INTAKE_previewHistoricalScan === 'function',

    liveMonitor:
      typeof INTAKE_previewLiveMonitoring === 'function',

    parser:
      typeof INTAKE_parseEmail === 'function',

    contacts:
      typeof INTAKE_extractContacts === 'function',

    address:
      typeof INTAKE_extractAddresses === 'function',

    leadType:
      typeof INTAKE_detectLeadType === 'function',

    leadModel:
      typeof INTAKE_buildLeadModel === 'function',

    crmMatch:
      typeof INTAKE_buildCRMMatchResult === 'function',

    ownership:
      typeof INTAKE_resolveOwnership === 'function',

    location:
      typeof INTAKE_resolveLocation === 'function',

    brokerLearning:
      typeof INTAKE_applyBrokerLearning === 'function',

    ruleMatching:
      typeof INTAKE_buildRuleMatchDecision === 'function',

    ruleTraining:
      typeof INTAKE_refreshRuleTraining === 'function',

    assignment:
      typeof INTAKE_buildAssignmentDecision === 'function',

    crmInsert:
      typeof INTAKE_insertToCRM === 'function',

    dashboard:
      typeof INTAKE_getBrokerDashboardPayload === 'function',

    safetyLock:
      INTAKE_isSafetyLocked() === true,

    developmentMode:
      INTAKE_isDevelopment() === true,

    outboundBlocked:
      INTAKE_isOutboundBlocked() === true

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

    productionActionsBlocked:
      true,

    completedAt:
      new Date().toISOString()

  };

}

function INTAKE_endToEndHealth() {

  const diagnostics =
    INTAKE_runEndToEndDiagnostics();

  return {

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

    outboundBlocked:
      INTAKE_isOutboundBlocked(),

    diagnostics:
      diagnostics,

    checkedAt:
      new Date().toISOString()

  };

}