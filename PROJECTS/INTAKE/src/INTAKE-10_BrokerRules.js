const INTAKE_BROKER_RULES = Object.freeze({

  ALWAYS_BROKER: [

    'RECRUITING',

    'CLEVER',

    'POPTIN',

    'UNKNOWN',

    'INTERNAL',

    'VENDOR',

    'SPAM'

  ],

  LOCK_EXISTING_OWNER: true,

  LOCK_MANUAL_ASSIGNMENTS: true,

  ALLOW_PARISH_ROUTING: true,

  REQUIRE_BROKER_APPROVAL_FOR_UNKNOWN: true

});

function INTAKE_isBrokerOnly(source) {

  return INTAKE_BROKER_RULES.ALWAYS_BROKER.includes(source);

}

function INTAKE_shouldLockExistingOwner() {

  return INTAKE_BROKER_RULES.LOCK_EXISTING_OWNER;

}

function INTAKE_shouldLockManualAssignments() {

  return INTAKE_BROKER_RULES.LOCK_MANUAL_ASSIGNMENTS;

}

function INTAKE_requiresBrokerApproval(source) {

  return (

    INTAKE_BROKER_RULES.REQUIRE_BROKER_APPROVAL_FOR_UNKNOWN &&

    source === 'UNKNOWN'

  );

}