const INTAKE_ASSIGNMENT_ENGINE = Object.freeze({

  VERSION: '1.0.0',

  ENABLED: false,

  REQUIRE_PRODUCTION_MODE: true,

  REQUIRE_SAFETY_UNLOCK: true,

  PRESERVE_EXISTING_OWNER: true,

  BROKER_FALLBACK: 'BROKER'

});

function INTAKE_buildAssignmentDecision(
  lead,
  existingLead
) {

  const ownership =
    INTAKE_resolveOwnership(
      lead,
      existingLead
    );

  if (ownership.locked) {

    return {

      assignable: false,

      assignedTo:
        ownership.owner,

      reason:
        ownership.reason,

      locked:
        true

    };

  }

  if (
    INTAKE_isBrokerOnly(
      lead.source
    )
  ) {

    return {

      assignable: false,

      assignedTo:
        INTAKE_ASSIGNMENT_ENGINE
          .BROKER_FALLBACK,

      reason:
        'BROKER_ONLY_SOURCE',

      locked:
        true

    };

  }

  const location =
    INTAKE_resolveLocation(
      lead
    );

  if (!location.resolved) {

    return {

      assignable: false,

      assignedTo:
        INTAKE_ASSIGNMENT_ENGINE
          .BROKER_FALLBACK,

      reason:
        'LOCATION_REVIEW_REQUIRED',

      locked:
        false

    };

  }

  return {

    assignable: true,

    assignedTo:
      'ROUND_ROBIN',

    reason:
      'PARISH_ROUTING',

    parish:
      location.parish,

    locked:
      false

  };

}

function INTAKE_canCommitRouting() {

  return (

    INTAKE_ASSIGNMENT_ENGINE
      .ENABLED === true &&

    INTAKE_isProduction() === true &&

    INTAKE_isSafetyLocked() === false

  );

}

function INTAKE_previewAssignmentDecision(
  lead,
  existingLead
) {

  return {

    decision:
      INTAKE_buildAssignmentDecision(
        lead,
        existingLead
      ),

    commitAllowed:
      INTAKE_canCommitRouting(),

    previewOnly:
      true,

    checkedAt:
      new Date().toISOString()

  };

}