const INTAKE_VERSION = '1.0.0';
const INTAKE_RELEASE = 'MOS5-010-S1-002';

const INTAKE = Object.freeze({

  VERSION: INTAKE_VERSION,

  RELEASE: INTAKE_RELEASE,

  MODE: 'DEVELOPMENT',

  SAFETY_LOCK: true,

  PROJECT: 'INTAKE',

  CREATED: new Date().toISOString()

});

function INTAKE_getVersion() {
  return {
    success: true,
    project: INTAKE.PROJECT,
    release: INTAKE.RELEASE,
    version: INTAKE.VERSION,
    mode: INTAKE.MODE,
    safetyLock: INTAKE.SAFETY_LOCK
  };
}

function INTAKE_isDevelopment() {
  return INTAKE.MODE === 'DEVELOPMENT';
}

function INTAKE_isProduction() {
  return INTAKE.MODE === 'PRODUCTION';
}

function INTAKE_isSafetyLocked() {
  return INTAKE.SAFETY_LOCK === true;
}

function INTAKE_getStatus() {

  return {

    project: INTAKE.PROJECT,

    release: INTAKE.RELEASE,

    version: INTAKE.VERSION,

    mode: INTAKE.MODE,

    safetyLock: INTAKE.SAFETY_LOCK,

    timestamp: new Date().toISOString()

  };

}