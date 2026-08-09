const INTAKE_SHEET_DEFINITIONS = Object.freeze({

  INTAKE_MESSAGES: [],

  INTAKE_RAW: [],

  INTAKE_RULES: [],

  INTAKE_RULE_HISTORY: [],

  INTAKE_SOURCE_SIGNATURES: [],

  INTAKE_CONFIDENCE: [],

  INTAKE_BROKER_REVIEW: [],

  INTAKE_EVENT_LOG: [],

  INTAKE_DEDUP: [],

  INTAKE_ASSIGNMENT_PREVIEW: [],

  INTAKE_SETTINGS: []

});

function INTAKE_getSheetDefinitions() {

  return JSON.parse(

    JSON.stringify(INTAKE_SHEET_DEFINITIONS)

  );

}

function INTAKE_sheetDefinitionExists(name) {

  return Object.prototype.hasOwnProperty.call(

    INTAKE_SHEET_DEFINITIONS,

    name

  );

}