const INTAKE_VERSION_HISTORY = Object.freeze({

  CURRENT: INTAKE.VERSION,

  RELEASE: INTAKE.RELEASE,

  HISTORY: [

    {
      version: '1.0.0',
      release: 'MOS5-010-S1',
      status: 'DEVELOPMENT'
    }

  ]

});

function INTAKE_getVersionHistory() {

  return JSON.parse(

    JSON.stringify(INTAKE_VERSION_HISTORY)

  );

}

function INTAKE_getCurrentVersion() {

  return INTAKE_VERSION_HISTORY.CURRENT;

}

function INTAKE_getCurrentRelease() {

  return INTAKE_VERSION_HISTORY.RELEASE;

}