function INTAKE_healthMonitor() {

  const report = {

    project: INTAKE.PROJECT,

    release: INTAKE.RELEASE,

    version: INTAKE.VERSION,

    modules: INTAKE_moduleCount(),

    diagnostics: INTAKE_runDiagnostics().success,

    productionGate: INTAKE_productionGate().productionReady,

    developmentMode: INTAKE_isDevelopment(),

    safetyLock: INTAKE_isSafetyLocked(),

    outboundBlocked: INTAKE_isOutboundBlocked(),

    knowledgeEngine: INTAKE_isLearningEnabled(),

    timestamp: new Date().toISOString()

  };

  report.healthScore = [

    report.diagnostics,

    report.developmentMode,

    report.safetyLock,

    report.outboundBlocked,

    report.knowledgeEngine

  ].filter(Boolean).length * 20;

  report.status = report.healthScore === 100 ? 'PASS' : 'WARNING';

  return report;

}