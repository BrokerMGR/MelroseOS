const INTAKE_EVENT_BUS = Object.freeze({

  VERSION: '1.0.0',

  EVENTS: [

    'MESSAGE_RECEIVED',

    'MESSAGE_NORMALIZED',

    'MESSAGE_CLASSIFIED',

    'BROKER_REVIEW_REQUIRED',

    'RULE_CREATED',

    'RULE_UPDATED',

    'LEAD_LOCK_DETECTED',

    'READY_FOR_CRM'

  ]

});

function INTAKE_getEventBus() {

  return JSON.parse(

    JSON.stringify(INTAKE_EVENT_BUS)

  );

}

function INTAKE_eventExists(name) {

  return INTAKE_EVENT_BUS.EVENTS.includes(name);

}

function INTAKE_publishEvent(name, payload) {

  return {

    success: true,

    event: name,

    timestamp: new Date().toISOString(),

    payload: payload || {}

  };

}