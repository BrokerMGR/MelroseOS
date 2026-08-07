const INTAKE_REGISTRY = Object.freeze({

  PROJECT_ID: 'MOS5-010',

  PROJECT_NAME: 'Enterprise Intake Intelligence',

  VERSION: INTAKE.VERSION,

  RELEASE: INTAKE.RELEASE,

  STATUS: 'DEVELOPMENT',

  REGISTERED_MODULES: [

    'CORE',

    'SETTINGS'

  ]

});

function INTAKE_getRegistry() {

  return JSON.parse(

    JSON.stringify(INTAKE_REGISTRY)

  );

}

function INTAKE_hasModule(name) {

  return INTAKE_REGISTRY.REGISTERED_MODULES.indexOf(name) >= 0;

}

function INTAKE_registerModule(name) {

  throw new Error(

    'Modules are registered through deployment only.'

  );

}