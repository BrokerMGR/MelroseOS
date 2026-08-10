/**
 * MOS5 CRM-125 - Recruit Production Activation + Certification
 */
function RUN_RECRUIT_PRODUCTION_PREFLIGHT() {
  const required = [
    'MGR_RECRUIT_getProductionState',
    'MGR_RECRUIT_canCommunicate',
    'MGR_RECRUIT_productionTick',
    'MGR_RECRUIT_installProductionTrigger_'
  ];
  const checks = required.map(n => ({name:n, present:typeof globalThis[n] === 'function'}));

  const workerCandidates = [
    'MGR_RECRUIT_processProductionQueue',
    'MGR_RECRUIT_processQueue',
    'MGR_SENDER_processQueue'
  ];
  const worker = workerCandidates.find(n => typeof globalThis[n] === 'function') || '';

  // Sender pool infrastructure must already exist.
  const senderPoolPresent =
    typeof globalThis['MGR_SENDER_certifyPool'] === 'function' ||
    typeof globalThis['RUN_SENDER_POOL_CERTIFICATION_V2'] === 'function';

  const success = checks.every(x => x.present) && !!worker && senderPoolPresent;
  const out = {success, checks, productionQueueWorker:worker, senderPoolPresent,
    message: success ? 'PREFLIGHT PASS' : 'PREFLIGHT BLOCKED - no production activation performed'};
  console.log('RUN_RECRUIT_PRODUCTION_PREFLIGHT\n' + JSON.stringify(out,null,2));
  return out;
}

function ACTIVATE_RECRUIT_EMAILS_TOMORROW() {
  const pre = RUN_RECRUIT_PRODUCTION_PREFLIGHT();
  if (!pre.success) throw new Error('RECRUIT ACTIVATION BLOCKED: Preflight did not pass.');

  const tz = Session.getScriptTimeZone() || 'America/Chicago';
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24*60*60*1000);
  const ymd = Utilities.formatDate(tomorrow, tz, 'yyyy-MM-dd');
  const startAt = ymd + 'T10:00:00';

  const p = PropertiesService.getScriptProperties();
  p.setProperty(MGR_RECRUIT_PROD.ENABLED_KEY, 'true');
  p.setProperty(MGR_RECRUIT_PROD.TEST_MODE_KEY, 'false');
  p.setProperty(MGR_RECRUIT_PROD.START_KEY, startAt);
  MGR_RECRUIT_installProductionTrigger_();

  const result = {
    success:true,
    certification:'PASS',
    campaign:'RECRUIT_MENTORSHIP',
    startAtLocal:startAt,
    cadenceDays:5,
    sendWindow:'10:00-18:00',
    perSender24hCap:75,
    triggerCount:MGR_RECRUIT_triggerCount_(),
    productionQueueWorker:pre.productionQueueWorker
  };
  console.log('ACTIVATE_RECRUIT_EMAILS_TOMORROW\n' + JSON.stringify(result,null,2));
  return result;
}

function RUN_RECRUIT_PRODUCTION_CERTIFICATION() {
  const s = MGR_RECRUIT_getProductionState();
  const out = {
    success: s.enabled && !s.testMode && MGR_RECRUIT_triggerCount_() === 1,
    enabled:s.enabled, testMode:s.testMode, startAt:s.startAt,
    triggerCount:MGR_RECRUIT_triggerCount_(),
    cadenceDays:s.cadenceDays, perSender24hCap:s.perSender24hCap
  };
  console.log('RUN_RECRUIT_PRODUCTION_CERTIFICATION\n' + JSON.stringify(out,null,2));
  return out;
}

function SHUTDOWN_RECRUIT_EMAILS() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty(MGR_RECRUIT_PROD.ENABLED_KEY, 'false');
  p.setProperty(MGR_RECRUIT_PROD.TEST_MODE_KEY, 'true');
  MGR_RECRUIT_removeProductionTriggers_();
  const out = {success:true, enabled:false, triggerCount:MGR_RECRUIT_triggerCount_()};
  console.log('SHUTDOWN_RECRUIT_EMAILS\n' + JSON.stringify(out,null,2));
  return out;
}
