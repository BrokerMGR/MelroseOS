const INTAKE_LOCK = Object.freeze({

  PRESERVE_MANUAL_ASSIGNMENTS: true,

  PRESERVE_EXISTING_OWNER: true,

  PRESERVE_BROKER_OVERRIDE: true

});

function INTAKE_resolveLeadLock(existingLead) {

  if (!existingLead) {

    return {

      locked: false,

      owner: null,

      reason: 'NEW_LEAD'

    };

  }

  return {

    locked: true,

    owner: existingLead.owner || 'BROKER',

    manualAssignment: existingLead.manualAssignment === true,

    brokerOverride: existingLead.brokerOverride === true,

    preserveOwnership: true

  };

}

function INTAKE_canReassignLead(existingLead) {

  const lock = INTAKE_resolveLeadLock(existingLead);

  return !lock.locked;

}