/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-015_Scheduler
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Installs time-based triggers for queue sends, reply monitoring,
 * and broker dashboard refresh.
 */

function REC_deleteRecruitingTriggers() {
  const names = [
    'REC_scheduledSendWorker',
    'REC_scheduledReplyWorker',
    'REC_scheduledDashboardWorker'
  ];

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (names.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  return REC_result(true, { deletedHandlers: names });
}

function REC_installRecruitingTriggers() {
  REC_assertSafeMode();
  REC_deleteRecruitingTriggers();

  // Send worker runs hourly. The sender itself enforces 10AM-4PM Central,
  // Monday-Saturday and holiday restrictions.
  ScriptApp.newTrigger('REC_scheduledSendWorker')
    .timeBased()
    .everyHours(1)
    .create();

  // Reply monitor runs hourly.
  ScriptApp.newTrigger('REC_scheduledReplyWorker')
    .timeBased()
    .everyHours(1)
    .create();

  // Dashboard refresh runs every six hours.
  ScriptApp.newTrigger('REC_scheduledDashboardWorker')
    .timeBased()
    .everyHours(6)
    .create();

  return REC_result(true, {
    handlers: [
      'REC_scheduledSendWorker',
      'REC_scheduledReplyWorker',
      'REC_scheduledDashboardWorker'
    ],
    note: 'Triggers installed. Production email remains disabled until launch flags are explicitly enabled.'
  });
}

function REC_scheduledSendWorker() {
  if (!REC_isProductionEnabled_()) {
    REC_log('INFO', 'REC-015_Scheduler', 'Scheduled send skipped: production disabled.', null);
    return;
  }

  if (!REC_isWithinSendWindow(REC_now())) {
    REC_log('INFO', 'REC-015_Scheduler', 'Scheduled send skipped: outside permitted window.', null);
    return;
  }

  REC_sendDueRecruitBatch(10);
}

function REC_scheduledReplyWorker() {
  REC_monitorRecruitReplies(48);
}

function REC_scheduledDashboardWorker() {
  REC_refreshBrokerDashboardSheet();
}

function REC_runSchedulerDiagnostics() {
  const handlers = ScriptApp.getProjectTriggers().map(function(trigger) {
    return trigger.getHandlerFunction();
  });

  const required = [
    'REC_scheduledSendWorker',
    'REC_scheduledReplyWorker',
    'REC_scheduledDashboardWorker'
  ];

  const checks = required.map(function(name) {
    return {
      name: name,
      pass: handlers.indexOf(name) !== -1
    };
  });

  return REC_result(
    checks.every(function(c) { return c.pass; }),
    { checks: checks, installedHandlers: handlers }
  );
}
