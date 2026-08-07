function INTAKE_sprint3Bootstrap() {

  const diagnostics =
    INTAKE_runEndToEndDiagnostics();

  const runtime =
    INTAKE_getRuntimeHealth();

  return {

    success:
      diagnostics.success,

    project:
      INTAKE.PROJECT,

    release:
      INTAKE.RELEASE,

    version:
      INTAKE.VERSION,

    diagnostics:
      diagnostics,

    runtime:
      runtime,

    dashboard:
      INTAKE_getBrokerDashboardPayload(),

    authorization:
      typeof INTAKE_getAuthorizationStatus === 'function'
        ? INTAKE_getAuthorizationStatus()
        : null,

    developmentMode:
      INTAKE_isDevelopment(),

    safetyLock:
      INTAKE_isSafetyLocked(),

    outboundBlocked:
      INTAKE_isOutboundBlocked(),

    crmInsertEnabled:
      INTAKE_CRM_INSERT.ENABLED === true,

    liveMonitoringEnabled:
      INTAKE_SETTINGS
        .LIVE_MONITORING_ENABLED === true,

    productionActionsBlocked:
      true,

    completedAt:
      new Date().toISOString()

  };

}

function INTAKE_sprint3Ready() {

  const bootstrap =
    INTAKE_sprint3Bootstrap();

  return {

    ready:
      bootstrap.success === true &&
      bootstrap.developmentMode === true &&
      bootstrap.safetyLock === true &&
      bootstrap.outboundBlocked === true &&
      bootstrap.crmInsertEnabled === false &&
      bootstrap.liveMonitoringEnabled === false,

    bootstrap:
      bootstrap

  };

}