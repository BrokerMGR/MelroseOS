const INTAKE_CRM_BRIDGE = Object.freeze({

  VERSION: '1.0.0',

  ENABLED: false,

  PUSH_TO_CRM: false,

  REQUIRE_PRODUCTION_GATE: true,

  REQUIRE_ASSIGNMENT_COMMIT: true

});

function INTAKE_buildCRMRecord(normalizedLead) {

  return {

    leadId: Utilities.getUuid(),

    status: 'READY_FOR_CRM',

    source: normalizedLead.source,

    created: new Date().toISOString(),

    payload: normalizedLead

  };

}

function INTAKE_canPushToCRM() {

  return (

    INTAKE_CRM_BRIDGE.ENABLED &&

    INTAKE_CRM_BRIDGE.PUSH_TO_CRM &&

    !INTAKE_isDevelopment() &&

    !INTAKE_isSafetyLocked()

  );

}

function INTAKE_previewCRMBridge(normalizedLead) {

  return {

    pushAllowed: INTAKE_canPushToCRM(),

    record: INTAKE_buildCRMRecord(normalizedLead)

  };

}