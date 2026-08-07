function INTAKE_assertSafeOperation(operation) {

  if (!INTAKE_isDevelopment()) {
    return true;
  }

  if (!INTAKE_isSafetyLocked()) {
    return true;
  }

  throw new Error(
    '[SAFETY LOCK] Operation blocked: ' + operation
  );

}

function INTAKE_canSendEmail() {

  return !INTAKE_SETTINGS.BLOCK_EMAIL;

}

function INTAKE_canAssignLeads() {

  return !INTAKE_SETTINGS.BLOCK_ROUND_ROBIN;

}

function INTAKE_canRunCampaigns() {

  return !INTAKE_SETTINGS.BLOCK_CAMPAIGNS;

}

function INTAKE_canNotifyAgents() {

  return !INTAKE_SETTINGS.BLOCK_NOTIFICATIONS;

}

function INTAKE_canProcessLiveIntake() {

  return !INTAKE_SETTINGS.LIVE_MONITORING_ENABLED;

}