function INTAKE_runAllTests() {

  return {

    diagnostics: INTAKE_runDiagnostics(),

    install: INTAKE_validateInstallation(),

    health: INTAKE_projectHealth(),

    production: INTAKE_productionGate(),

    completed: new Date().toISOString()

  };

}

function INTAKE_smokeTest() {

  return {

    success: true,

    project: INTAKE.PROJECT,

    version: INTAKE.VERSION,

    release: INTAKE.RELEASE,

    moduleCount: INTAKE_moduleCount(),

    timestamp: new Date().toISOString()

  };

}