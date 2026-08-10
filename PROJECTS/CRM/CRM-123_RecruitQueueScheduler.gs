/**
 * MOS5 CRM-123 - Recruit Queue Scheduler
 * Uses existing CRM queue/sender-pool functions when present; does not bypass them.
 */
function MGR_RECRUIT_isSendWindowNow_() {
  const tz = Session.getScriptTimeZone() || 'America/Chicago';
  const now = new Date();
  const dow = Number(Utilities.formatDate(now, tz, 'u')); // 1..7
  const hour = Number(Utilities.formatDate(now, tz, 'H'));
  if (MGR_RECRUIT_PROD.SKIP_SUNDAYS && dow === 7) return false;
  return hour >= MGR_RECRUIT_PROD.SEND_START_HOUR && hour < MGR_RECRUIT_PROD.SEND_END_HOUR;
}

function MGR_RECRUIT_productionTick() {
  const state = MGR_RECRUIT_getProductionState();
  if (!state.enabled || state.testMode) {
    console.log('RECRUIT TICK: production disabled/test mode.');
    return {success:true, sent:0, reason:'NOT_LIVE'};
  }
  if (!MGR_RECRUIT_isSendWindowNow_()) {
    return {success:true, sent:0, reason:'OUTSIDE_SEND_WINDOW'};
  }

  // Require the existing production queue worker. Never invent a second outbound path.
  const candidates = [
    'MGR_RECRUIT_processProductionQueue',
    'MGR_RECRUIT_processQueue',
    'MGR_SENDER_processQueue'
  ];
  for (const name of candidates) {
    try {
      const fn = globalThis[name];
      if (typeof fn === 'function' && fn !== MGR_RECRUIT_productionTick) {
        return fn();
      }
    } catch (e) {}
  }
  throw new Error('RECRUIT_ACTIVATION_BLOCK: Existing production queue worker not found. Activation remains safe/off.');
}
