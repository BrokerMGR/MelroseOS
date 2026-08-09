const INTAKE_ENTERPRISE = Object.freeze({

  PROJECT_ID: 'MOS5-010',

  PROJECT_NAME: 'Enterprise Intake Intelligence',

  CATEGORY: 'ENTERPRISE',

  REGISTER_WITH_BCC: true,

  REGISTER_WITH_DEVTOOLS: true,

  REGISTER_WITH_NAVIGATOR: true,

  REGISTER_WITH_PRODUCTION_GATE: true

});

function INTAKE_getEnterpriseRegistration() {

  return JSON.parse(

    JSON.stringify(INTAKE_ENTERPRISE)

  );

}

function INTAKE_registrationStatus() {

  return {

    project: INTAKE_ENTERPRISE.PROJECT_ID,

    name: INTAKE_ENTERPRISE.PROJECT_NAME,

    bcc: INTAKE_ENTERPRISE.REGISTER_WITH_BCC,

    devtools: INTAKE_ENTERPRISE.REGISTER_WITH_DEVTOOLS,

    navigator: INTAKE_ENTERPRISE.REGISTER_WITH_NAVIGATOR,

    productionGate: INTAKE_ENTERPRISE.REGISTER_WITH_PRODUCTION_GATE

  };

}