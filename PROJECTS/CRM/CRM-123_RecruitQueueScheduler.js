/**
 * MOS5 CRM-123 - Recruit Queue Scheduler
 * v1.1.0
 * Uses existing CRM queue/sender-pool functions and honors production start time.
 */
function MGR_RECRUIT_isSendWindowNow_() {
  const tz =
    Session.getScriptTimeZone() ||
    'America/Chicago';

  const now = new Date();

  const dow = Number(
    Utilities.formatDate(
      now,
      tz,
      'u'
    )
  );

  const hour = Number(
    Utilities.formatDate(
      now,
      tz,
      'H'
    )
  );

  if (
    MGR_RECRUIT_PROD.SKIP_SUNDAYS &&
    dow === 7
  ) {
    return false;
  }

  return (
    hour >=
      MGR_RECRUIT_PROD
        .SEND_START_HOUR &&
    hour <
      MGR_RECRUIT_PROD
        .SEND_END_HOUR
  );
}

function MGR_RECRUIT_productionTick() {
  const state =
    MGR_RECRUIT_getProductionState();

  if (
    !state.enabled ||
    state.testMode
  ) {
    console.log(
      'RECRUIT TICK: production disabled/test mode.'
    );

    return {
      success: true,
      sent: 0,
      reason: 'NOT_LIVE'
    };
  }

  if (
    typeof
      MGR_RECRUIT_startReached_ ===
      'function' &&
    !MGR_RECRUIT_startReached_(
      state.startAt
    )
  ) {
    return {
      success: true,
      sent: 0,
      reason:
        'START_TIME_NOT_REACHED',
      startAt:
        state.startAt
    };
  }

  if (
    !MGR_RECRUIT_isSendWindowNow_()
  ) {
    return {
      success: true,
      sent: 0,
      reason:
        'OUTSIDE_SEND_WINDOW'
    };
  }

  if (
    typeof
      MGR_RECRUIT_processProductionQueue ===
      'function'
  ) {
    return MGR_RECRUIT_processProductionQueue();
  }

  throw new Error(
    'RECRUIT_ACTIVATION_BLOCK: Production recruit queue worker not found.'
  );
}
