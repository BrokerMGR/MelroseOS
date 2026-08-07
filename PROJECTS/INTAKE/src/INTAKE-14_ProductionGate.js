const INTAKE_PRODUCTION_GATE = Object.freeze({

  DEVELOPMENT_REQUIRED: true,

  SAFETY_LOCK_REQUIRED: true,

  DIAGNOSTICS_REQUIRED: true,

  KNOWLEDGE_ENGINE_REQUIRED: true,

  BROKER_APPROVAL_REQUIRED: true

});

function INTAKE_productionGate() {

  const diagnostics = INTAKE_runDiagnostics();

  return {

    project: INTAKE.PROJECT,

    release: INTAKE.RELEASE,

    version: INTAKE.VERSION,

    developmentMode: INTAKE_isDevelopment(),

    safetyLock: INTAKE_isSafetyLocked(),

    diagnosticsPassed: diagnostics.success,

    outboundBlocked: INTAKE_isOutboundBlocked(),

    productionReady:

      diagnostics.success &&

      INTAKE_isDevelopment() &&

      INTAKE_isSafetyLocked() &&

      INTAKE_isOutboundBlocked(),

    checkedAt: new Date().toISOString()

  };

}