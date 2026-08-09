function INTAKE_validateInstallation() {

  const checks = [

    typeof INTAKE_getStatus === 'function',

    typeof INTAKE_getSettings === 'function',

    typeof INTAKE_getRegistry === 'function',

    typeof INTAKE_getConfiguration === 'function',

    typeof INTAKE_getSheetDefinitions === 'function',

    typeof INTAKE_projectHealth === 'function'

  ];

  return {

    success: checks.every(Boolean),

    total: checks.length,

    passed: checks.filter(Boolean).length,

    failed: checks.filter(v => !v).length,

    timestamp: new Date().toISOString()

  };

}