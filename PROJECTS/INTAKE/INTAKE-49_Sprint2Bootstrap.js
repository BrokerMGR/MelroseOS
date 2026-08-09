function INTAKE_sprint2Bootstrap() {

  return {

    success: true,

    project: INTAKE.PROJECT,

    release: INTAKE.RELEASE,

    version: INTAKE.VERSION,

    accounts: INTAKE_getEnabledAccounts(),

    backfill: INTAKE_previewBackfill(),

    runtime: INTAKE_getRuntimeHealth(),

    safetyLock: INTAKE_isSafetyLocked(),

    outboundBlocked: INTAKE_isOutboundBlocked(),

    completedAt: new Date().toISOString()

  };

}

function INTAKE_sprint2Ready() {

  const runtime =
    INTAKE_getRuntimeHealth();

  return {

    ready:
      runtime.status === 'PASS' &&
      runtime.safetyLock === true &&
      runtime.outboundBlocked === true,

    runtime: runtime

  };

}