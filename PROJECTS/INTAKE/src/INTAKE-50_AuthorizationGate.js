const INTAKE_AUTH_VERSION = '1.0.0';

function INTAKE_getAuthorizationStatus() {

  const info =
    ScriptApp.getAuthorizationInfo(
      ScriptApp.AuthMode.FULL
    );

  return {

    project: 'MOS5-010',

    version: INTAKE_AUTH_VERSION,

    status:
      String(
        info.getAuthorizationStatus()
      ),

    authorizedScopes:
      info.getAuthorizedScopes() || [],

    authorizationUrl:
      info.getAuthorizationUrl() || '',

    safetyLock:
      INTAKE_isSafetyLocked(),

    outboundBlocked:
      INTAKE_isOutboundBlocked(),

    checkedAt:
      new Date().toISOString()

  };

}

function INTAKE_requestAllPermissions() {

  if (
    !INTAKE_isDevelopment() ||
    !INTAKE_isSafetyLocked() ||
    !INTAKE_isOutboundBlocked()
  ) {

    throw new Error(
      'Permission bootstrap requires DEVELOPMENT mode with Safety Lock and outbound blocking enabled.'
    );

  }

  ScriptApp.requireAllScopes(
    ScriptApp.AuthMode.FULL
  );

  return INTAKE_getAuthorizationStatus();

}

function INTAKE_permissionSafetyCheck() {

  return {

    safe:
      INTAKE_isDevelopment() &&
      INTAKE_isSafetyLocked() &&
      INTAKE_isOutboundBlocked(),

    developmentMode:
      INTAKE_isDevelopment(),

    safetyLock:
      INTAKE_isSafetyLocked(),

    outboundBlocked:
      INTAKE_isOutboundBlocked(),

    liveMonitoring:
      INTAKE_SETTINGS
        .LIVE_MONITORING_ENABLED === true,

    checkedAt:
      new Date().toISOString()

  };

}