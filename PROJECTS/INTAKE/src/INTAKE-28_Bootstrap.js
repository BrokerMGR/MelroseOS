function INTAKE_bootstrap() {

  return {

    success: true,

    project: INTAKE.PROJECT,

    release: INTAKE.RELEASE,

    version: INTAKE.VERSION,

    manifest: INTAKE_getManifest(),

    build: INTAKE_getBuildInfo(),

    registry: INTAKE_getRegistry(),

    configuration: INTAKE_getConfiguration(),

    health: INTAKE_healthMonitor(),

    timestamp: new Date().toISOString()

  };

}

function INTAKE_startup() {

  return INTAKE_bootstrap();

}