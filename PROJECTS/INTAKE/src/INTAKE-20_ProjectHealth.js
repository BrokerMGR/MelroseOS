const INTAKE_PROJECT_HEALTH = Object.freeze({

  REQUIRED_MODULES: 20,

  REQUIRED_SAFETY_LOCK: true,

  REQUIRED_DEVELOPMENT_MODE: true,

  REQUIRED_DIAGNOSTICS: true,

  REQUIRED_PRODUCTION_GATE: true

});

function INTAKE_projectHealth() {

  const diagnostics = INTAKE_runDiagnostics();

  const production = INTAKE_productionGate();

  return {

    success:
      diagnostics.success &&
      production.productionReady,

    project: INTAKE.PROJECT,

    release: INTAKE.RELEASE,

    version: INTAKE.VERSION,

    moduleCount: INTAKE_moduleCount(),

    expectedModules:
      INTAKE_PROJECT_HEALTH.REQUIRED_MODULES,

    diagnosticsPassed:
      diagnostics.success,

    productionGatePassed:
      production.productionReady,

    developmentMode:
      INTAKE_isDevelopment(),

    safetyLock:
      INTAKE_isSafetyLocked(),

    outboundBlocked:
      INTAKE_isOutboundBlocked(),

    checkedAt:
      new Date().toISOString()

  };

}