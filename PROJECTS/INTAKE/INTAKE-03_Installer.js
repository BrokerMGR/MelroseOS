function INTAKE_install() {

  return {

    success: true,

    project: INTAKE.PROJECT,

    release: INTAKE.RELEASE,

    version: INTAKE.VERSION,

    installed: new Date().toISOString(),

    mode: INTAKE.MODE,

    safetyLock: INTAKE.SAFETY_LOCK,

    settings: INTAKE_getSettings(),

    registry: INTAKE_getRegistry()

  };

}

function INTAKE_isInstalled() {

  return true;

}

function INTAKE_installStatus() {

  return {

    installed: INTAKE_isInstalled(),

    project: INTAKE.PROJECT,

    version: INTAKE.VERSION,

    release: INTAKE.RELEASE

  };

}