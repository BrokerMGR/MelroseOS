function INTAKE_initialize() {

  const bootstrap =
    INTAKE_bootstrap();

  return {

    success: true,

    project:
      INTAKE.PROJECT,

    release:
      INTAKE.RELEASE,

    version:
      INTAKE.VERSION,

    mode:
      INTAKE.MODE,

    safetyLock:
      INTAKE_isSafetyLocked(),

    outboundBlocked:
      INTAKE_isOutboundBlocked(),

    bootstrap:
      bootstrap,

    initializedAt:
      new Date().toISOString()

  };

}

function INTAKE_getStartupStatus() {

  return {

    initialized: true,

    developmentMode:
      INTAKE_isDevelopment(),

    productionMode:
      INTAKE_isProduction(),

    safetyLock:
      INTAKE_isSafetyLocked(),

    outboundBlocked:
      INTAKE_isOutboundBlocked(),

    runtime:
      typeof INTAKE_getRuntimeHealth === 'function'
        ? INTAKE_getRuntimeHealth()
        : null,

    checkedAt:
      new Date().toISOString()

  };

}