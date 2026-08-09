/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-004_SuppressionGate
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Global recruiting policy:
 * - Send Monday through Saturday only.
 * - Send only from 10:00 AM through 4:00 PM Central.
 * - Skip configured holidays.
 * - Reply stops nurture.
 * - STOP/unsubscribe/DNC permanently suppress outbound recruiting.
 * - Active license or active brokerage stops pre-license nurture.
 */

const REC_SEND_POLICY = Object.freeze({
  timezone: 'America/Chicago',
  allowedWeekdays: [1, 2, 3, 4, 5, 6],
  startHour: 10,
  endHour: 16,
  skipHolidays: true
});

function REC_isAllowedWeekday(date) {
  return REC_SEND_POLICY.allowedWeekdays.indexOf(new Date(date).getDay()) !== -1;
}

function REC_getLocalHour_(date) {
  return Number(
    Utilities.formatDate(
      new Date(date),
      REC_SEND_POLICY.timezone,
      'H'
    )
  );
}

function REC_isWithinSendWindow(date) {
  const d = new Date(date);

  if (!REC_isAllowedWeekday(d)) return false;

  if (REC_SEND_POLICY.skipHolidays && REC_isConfiguredHoliday(d)) {
    return false;
  }

  const hour = REC_getLocalHour_(d);
  return hour >= REC_SEND_POLICY.startHour && hour < REC_SEND_POLICY.endHour;
}

function REC_nextAllowedSendDateTime(date) {
  const input = date ? new Date(date) : REC_now();
  let candidate = new Date(input);

  for (let i = 0; i < 20; i++) {
    if (!REC_isAllowedWeekday(candidate) ||
        (REC_SEND_POLICY.skipHolidays && REC_isConfiguredHoliday(candidate))) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(REC_SEND_POLICY.startHour, 0, 0, 0);
      continue;
    }

    const hour = REC_getLocalHour_(candidate);

    if (hour < REC_SEND_POLICY.startHour) {
      candidate.setHours(REC_SEND_POLICY.startHour, 0, 0, 0);
      return candidate;
    }

    if (hour >= REC_SEND_POLICY.endHour) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(REC_SEND_POLICY.startHour, 0, 0, 0);
      continue;
    }

    return candidate;
  }

  throw new Error('Unable to calculate next permitted recruiting send time.');
}

function REC_evaluateSuppression(recruit, duplicateReasons) {
  const reasons = [];

  if (!recruit) {
    reasons.push('NO_RECRUIT');
  } else {
    if (!recruit.email) reasons.push('NO_EMAIL');
    if (recruit.unsubscribed) reasons.push('UNSUBSCRIBED');
    if (recruit.doNotContact) reasons.push('DO_NOT_CONTACT');
    if (recruit.replyDetected) reasons.push('REPLIED');

    const stage = String(recruit.recruitStage || '').toUpperCase();
    if ([
      'REPLIED',
      'UNSUBSCRIBED',
      'DNC',
      'ACTIVE_LICENSE',
      'ACTIVE_WITH_BROKERAGE',
      'ACTIVE_AGENT_HANDOFF',
      'JOINED_MGR',
      'STOPPED'
    ].indexOf(stage) !== -1) {
      reasons.push('STAGE_' + stage);
    }

    const lrec = String(recruit.lrecStatus || '').toUpperCase();
    if (lrec === 'ACTIVE') {
      reasons.push('LREC_ACTIVE');
    }

    if (recruit.sponsoringBroker) {
      reasons.push('SPONSORING_BROKER_FOUND');
    }
  }

  (duplicateReasons || []).forEach(function(reason) {
    reasons.push(reason);
  });

  return {
    suppressed: reasons.length > 0,
    reasons: Array.from(new Set(reasons))
  };
}

function REC_canSendRecruitingMessage(recruit, duplicateReasons, date) {
  const suppression = REC_evaluateSuppression(recruit, duplicateReasons);
  const now = date ? new Date(date) : REC_now();

  if (suppression.suppressed) {
    return {
      allowed: false,
      suppression: suppression,
      sendWindow: false,
      nextAllowedSend: null
    };
  }

  const windowAllowed = REC_isWithinSendWindow(now);

  return {
    allowed: windowAllowed,
    suppression: suppression,
    sendWindow: windowAllowed,
    nextAllowedSend: windowAllowed ? now : REC_nextAllowedSendDateTime(now)
  };
}

function REC_runSuppressionDiagnostics() {
  REC_assertSafeMode();

  const checks = [
    {
      name: 'Monday-Saturday',
      pass: JSON.stringify(REC_SEND_POLICY.allowedWeekdays) === JSON.stringify([1,2,3,4,5,6])
    },
    {
      name: 'Start hour 10',
      pass: REC_SEND_POLICY.startHour === 10
    },
    {
      name: 'End hour 16',
      pass: REC_SEND_POLICY.endHour === 16
    },
    {
      name: 'Skip holidays',
      pass: REC_SEND_POLICY.skipHolidays === true
    }
  ];

  return REC_result(
    checks.every(function(c) { return c.pass; }),
    { checks: checks }
  );
}
