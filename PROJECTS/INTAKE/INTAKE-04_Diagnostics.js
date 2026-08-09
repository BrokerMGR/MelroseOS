function INTAKE_runDiagnostics() {

  const tests = [

    {
      name: 'CORE',
      pass: typeof INTAKE_getStatus === 'function'
    },

    {
      name: 'SETTINGS',
      pass: typeof INTAKE_getSettings === 'function'
    },

    {
      name: 'REGISTRY',
      pass: typeof INTAKE_getRegistry === 'function'
    },

    {
      name: 'INSTALLER',
      pass: typeof INTAKE_install === 'function'
    }

  ];

  const passed = tests.filter(t => t.pass).length;

  return {

    success: passed === tests.length,

    project: INTAKE.PROJECT,

    release: INTAKE.RELEASE,

    version: INTAKE.VERSION,

    totalTests: tests.length,

    passed: passed,

    failed: tests.length - passed,

    tests: tests,

    completed: new Date().toISOString()

  };

}

function INTAKE_productionReadiness() {

  const d = INTAKE_runDiagnostics();

  return {

    ready: d.success,

    score: Math.round((d.passed / d.totalTests) * 100),

    safetyLock: INTAKE_isSafetyLocked(),

    developmentMode: INTAKE_isDevelopment()

  };

}