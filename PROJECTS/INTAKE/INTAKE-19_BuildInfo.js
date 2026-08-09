const INTAKE_BUILD = Object.freeze({

  BUILD: 'S1-021',

  PROJECT: 'MOS5-010',

  VERSION: INTAKE.VERSION,

  RELEASE: INTAKE.RELEASE,

  STAGE: 'Sprint 1',

  STATUS: 'DEVELOPMENT',

  GIT_REQUIRED: true,

  DIAGNOSTICS_REQUIRED: true,

  PRODUCTION_LOCKED: true

});

function INTAKE_getBuildInfo() {

  return JSON.parse(

    JSON.stringify(INTAKE_BUILD)

  );

}

function INTAKE_buildSummary() {

  return {

    build: INTAKE_BUILD.BUILD,

    project: INTAKE_BUILD.PROJECT,

    version: INTAKE_BUILD.VERSION,

    release: INTAKE_BUILD.RELEASE,

    stage: INTAKE_BUILD.STAGE,

    status: INTAKE_BUILD.STATUS

  };

}