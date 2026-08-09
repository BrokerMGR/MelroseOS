/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-016_LaunchControl
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Explicit two-key production launch control.
 */

function REC_getLaunchStatus() {
  const props = PropertiesService.getScriptProperties();

  return {
    release: REC_RELEASE,
    productionEnabled:
      String(props.getProperty('REC_PRODUCTION_ENABLED') || '').toUpperCase() === 'TRUE',
    productionApproved:
      String(props.getProperty('REC_PRODUCTION_APPROVED') || '').toUpperCase() === 'TRUE',
    effectiveUser: Session.getEffectiveUser().getEmail(),
    requiredSender: REC_CONFIG.senderAccount,
    sendWindow: 'Monday-Saturday 10:00 AM-4:00 PM America/Chicago',
    skipHolidays: true
  };
}

function REC_armProductionAfterApproval() {
  const effective = REC_normalizeEmail(Session.getEffectiveUser().getEmail());
  const required = REC_normalizeEmail(REC_CONFIG.senderAccount);

  if (effective && effective !== required) {
    throw new Error('Production may only be armed while executing as ' + required + '.');
  }

  PropertiesService.getScriptProperties().setProperties({
    REC_PRODUCTION_ENABLED: 'TRUE',
    REC_PRODUCTION_APPROVED: 'TRUE'
  }, false);

  REC_log('WARN', 'REC-016_LaunchControl', 'Production recruiting armed.', {
    effectiveUser: effective
  });

  return REC_result(true, REC_getLaunchStatus());
}

function REC_disarmProduction() {
  PropertiesService.getScriptProperties().setProperties({
    REC_PRODUCTION_ENABLED: 'FALSE',
    REC_PRODUCTION_APPROVED: 'FALSE'
  }, false);

  REC_log('PASS', 'REC-016_LaunchControl', 'Production recruiting disarmed.', null);
  return REC_result(true, REC_getLaunchStatus());
}

function REC_initializeLaunchSafety() {
  PropertiesService.getScriptProperties().setProperties({
    REC_PRODUCTION_ENABLED: 'FALSE',
    REC_PRODUCTION_APPROVED: 'FALSE'
  }, false);

  return REC_result(true, REC_getLaunchStatus());
}
