const INTAKE_CRM_INSERT = Object.freeze({

  VERSION: '1.0.0',

  ENABLED: false,

  REQUIRE_PRODUCTION_MODE: true,

  REQUIRE_SAFETY_UNLOCK: true,

  REQUIRE_VALID_LEAD: true

});

function INTAKE_prepareCRMInsert(lead) {

  if (!lead) {

    throw new Error(
      'Lead is required.'
    );

  }

  return {

    ready:
      INTAKE_validateLeadModel(lead),

    lead:
      lead,

    assignment:
      INTAKE_assignmentSummary(lead),

    preparedAt:
      new Date().toISOString()

  };

}

function INTAKE_canInsertToCRM(lead) {

  return (

    INTAKE_CRM_INSERT.ENABLED === true &&

    INTAKE_isProduction() === true &&

    INTAKE_isSafetyLocked() === false &&

    INTAKE_validateLeadModel(lead) === true

  );

}

function INTAKE_insertToCRM(lead) {

  const prepared =
    INTAKE_prepareCRMInsert(
      lead
    );

  if (
    !INTAKE_canInsertToCRM(
      lead
    )
  ) {

    return {

      inserted:
        false,

      blocked:
        true,

      reason:
        'CRM insertion blocked by development/safety gate.',

      prepared:
        prepared,

      timestamp:
        new Date().toISOString()

    };

  }

  return {

    inserted:
      false,

    blocked:
      false,

    reason:
      'CRM production adapter not activated yet.',

    prepared:
      prepared,

    timestamp:
      new Date().toISOString()

  };

}