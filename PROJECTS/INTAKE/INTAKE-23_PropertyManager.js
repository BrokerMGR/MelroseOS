const INTAKE_PROPERTIES = Object.freeze({

  PREFIX: 'INTAKE_',

  KEYS: [

    'MODE',

    'SAFETY_LOCK',

    'VERSION',

    'RELEASE',

    'LAST_INSTALL',

    'LAST_HEALTH_CHECK',

    'LAST_BACKFILL',

    'LIVE_MONITORING',

    'KNOWLEDGE_VERSION',

    'RULE_VERSION'

  ]

});

function INTAKE_getPropertyKeys() {

  return INTAKE_PROPERTIES.KEYS.slice();

}

function INTAKE_propertyExists(key) {

  return INTAKE_PROPERTIES.KEYS.includes(key);

}

function INTAKE_getPropertyPrefix() {

  return INTAKE_PROPERTIES.PREFIX;

}