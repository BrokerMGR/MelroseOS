const INTAKE_ASSIGNMENT_PREVIEW = Object.freeze({

  VERSION: '1.0.0',

  DEFAULT_STATUS: 'PREVIEW',

  NEVER_ASSIGN_IN_DEVELOPMENT: true

});

function INTAKE_previewAssignment(lead) {

  const source = lead.source || 'UNKNOWN';

  if (INTAKE_isBrokerOnly(source)) {

    return {

      status: 'PREVIEW',

      assignedTo: 'BROKER',

      reason: 'Broker-only source',

      commit: false

    };

  }

  return {

    status: 'PREVIEW',

    assignedTo: 'ROUND_ROBIN',

    reason: 'Awaiting routing engine',

    commit: false

  };

}

function INTAKE_canCommitAssignment() {

  return (

    !INTAKE_isDevelopment() &&

    !INTAKE_isSafetyLocked()

  );

}

function INTAKE_assignmentSummary(lead) {

  return {

    preview: INTAKE_previewAssignment(lead),

    commitAllowed: INTAKE_canCommitAssignment(),

    timestamp: new Date().toISOString()

  };

}