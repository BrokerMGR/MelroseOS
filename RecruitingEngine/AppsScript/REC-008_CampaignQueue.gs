/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-008_CampaignQueue
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Builds the eligible pre-license recruiting queue.
 * This module DOES NOT send email.
 */

function REC_getSystemHeaderColumn_(sheet, name) {
  const map = REC_getHeaderMap(sheet);
  return map.map[String(name).toLowerCase()] || null;
}

function REC_getDueDate_(recruit) {
  if (recruit.nextEmailDate) return new Date(recruit.nextEmailDate);

  if (recruit.lastEmailSent) {
    return REC_calculateNextTouch(recruit.lastEmailSent);
  }

  // New recruit: eligible for first touch immediately, subject to send window.
  return REC_nextAllowedSendDateTime(REC_now());
}

function REC_isRecruitDue_(recruit, now) {
  const due = REC_getDueDate_(recruit);
  return due.getTime() <= now.getTime();
}

function REC_buildCampaignQueue(limit) {
  REC_assertSafeMode();
  REC_installSystemColumns();

  const recruits = REC_readRecruitRows(limit || 5000);
  const duplicateIndex = REC_buildDuplicateIndex(recruits);
  const now = REC_now();
  const queue = [];
  const skipped = [];

  recruits.forEach(function(recruit) {
    const duplicateReasons = REC_findDuplicateReasons(recruit, duplicateIndex);
    const gate = REC_canSendRecruitingMessage(recruit, duplicateReasons, now);
    const due = REC_getDueDate_(recruit);
    const isDue = REC_isRecruitDue_(recruit, now);

    if (!isDue) {
      skipped.push({
        recruitId: recruit.recruitId,
        rowNumber: recruit.rowNumber,
        reason: 'NOT_DUE',
        due: REC_formatDateTime(due)
      });
      return;
    }

    if (gate.suppression.suppressed) {
      skipped.push({
        recruitId: recruit.recruitId,
        rowNumber: recruit.rowNumber,
        reason: 'SUPPRESSED',
        details: gate.suppression.reasons
      });
      return;
    }

    const plannedSend = gate.sendWindow ? now : gate.nextAllowedSend;

    queue.push({
      recruitId: recruit.recruitId,
      rowNumber: recruit.rowNumber,
      firstName: recruit.firstName,
      lastName: recruit.lastName,
      email: recruit.email,
      city: recruit.city,
      parish: recruit.parish,
      licenseNumber: recruit.licenseNumber,
      recruitStage: recruit.recruitStage,
      sequenceNumber: recruit.sequenceNumber,
      emailCount: recruit.emailCount,
      plannedSend: REC_formatDateTime(plannedSend),
      sendNowAllowed: gate.sendWindow
    });
  });

  REC_log('PASS', 'REC-008_CampaignQueue', 'Campaign queue built.', {
    eligible: queue.length,
    skipped: skipped.length
  });

  return REC_result(true, {
    generatedAt: REC_formatDateTime(now),
    eligibleCount: queue.length,
    skippedCount: skipped.length,
    queue: queue,
    skipped: skipped
  });
}

function REC_getQueuePreview(limit) {
  return REC_buildCampaignQueue(limit || 100);
}
