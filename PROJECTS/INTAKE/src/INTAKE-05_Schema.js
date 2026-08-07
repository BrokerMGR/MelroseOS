const INTAKE_SCHEMA = Object.freeze({

  SHEETS: [

    'INTAKE_MESSAGES',

    'INTAKE_RAW',

    'INTAKE_RULES',

    'INTAKE_RULE_HISTORY',

    'INTAKE_SOURCE_SIGNATURES',

    'INTAKE_CONFIDENCE',

    'INTAKE_BROKER_REVIEW',

    'INTAKE_EVENT_LOG',

    'INTAKE_DEDUP',

    'INTAKE_ASSIGNMENT_PREVIEW',

    'INTAKE_SETTINGS'

  ]

});

function INTAKE_getSchema() {

  return JSON.parse(

    JSON.stringify(INTAKE_SCHEMA)

  );

}

function INTAKE_sheetExists(name) {

  return INTAKE_SCHEMA.SHEETS.indexOf(name) >= 0;

}