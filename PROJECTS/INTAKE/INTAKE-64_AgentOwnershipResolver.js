const INTAKE_OWNERSHIP = Object.freeze({

  VERSION: '1.0.0',

  PRESERVE_EXISTING_OWNER: true,

  PRESERVE_MANUAL_ASSIGNMENTS: true,

  PRESERVE_BROKER_OVERRIDES: true,

  BROKER_FALLBACK: 'BROKER'

});

function INTAKE_resolveOwnership(candidate, existingLead) {

  if (!existingLead) {

    return {

      locked: false,

      owner: '',

      reason: 'NO_EXISTING_OWNER'

    };

  }

  if (
    existingLead.brokerOverride === true &&
    INTAKE_OWNERSHIP.PRESERVE_BROKER_OVERRIDES
  ) {

    return {

      locked: true,

      owner:
        existingLead.owner ||
        INTAKE_OWNERSHIP.BROKER_FALLBACK,

      reason:
        'BROKER_OVERRIDE'

    };

  }

  if (
    existingLead.manualAssignment === true &&
    INTAKE_OWNERSHIP.PRESERVE_MANUAL_ASSIGNMENTS
  ) {

    return {

      locked: true,

      owner:
        existingLead.owner ||
        INTAKE_OWNERSHIP.BROKER_FALLBACK,

      reason:
        'MANUAL_ASSIGNMENT'

    };

  }

  if (
    existingLead.owner &&
    INTAKE_OWNERSHIP.PRESERVE_EXISTING_OWNER
  ) {

    return {

      locked: true,

      owner: existingLead.owner,

      reason:
        'EXISTING_OWNER'

    };

  }

  return {

    locked: false,

    owner: '',

    reason:
      'NO_PRESERVED_OWNER'

  };

}

function INTAKE_applyOwnershipLock(candidate, existingLead) {

  const resolution =
    INTAKE_resolveOwnership(
      candidate,
      existingLead
    );

  if (resolution.locked) {

    candidate.locked = true;

    candidate.assignedTo =
      resolution.owner;

  }

  return {

    candidate: candidate,

    ownership: resolution,

    resolvedAt:
      new Date().toISOString()

  };

}