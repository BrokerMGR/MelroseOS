/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-012_StateEngine
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Central lifecycle transition logic for pre-license recruiting.
 */

const REC_ALLOWED_STAGES = Object.freeze([
  'NEW',
  'PRE_LICENSE',
  'NURTURING',
  'LREC_CHECK_PENDING',
  'BROKER_FOLLOW_UP_REQUIRED',
  'REPLIED',
  'UNSUBSCRIBED',
  'DNC',
  'ACTIVE_LICENSE',
  'ACTIVE_WITH_BROKERAGE',
  'BROKERAGE_REVIEW_REQUIRED',
  'ACTIVE_AGENT_HANDOFF',
  'JOINED_MGR',
  'STOPPED'
]);

function REC_transitionForReply(recruit, classification) {
  const result = {
    recruitStage: recruit.recruitStage,
    campaignStatus: recruit.campaignStatus,
    replyDetected: true,
    unsubscribed: recruit.unsubscribed,
    doNotContact: recruit.doNotContact,
    activeRecruitingQueue: recruit.activeRecruitingQueue,
    campaignNotes: recruit.campaignNotes || ''
  };

  if (classification.classification === 'STOP') {
    result.recruitStage = 'DNC';
    result.campaignStatus = 'STOPPED';
    result.unsubscribed = true;
    result.doNotContact = true;
    result.activeRecruitingQueue = false;
    result.campaignNotes = REC_appendNote_(
      result.campaignNotes,
      'STOP/UNSUBSCRIBE reply received. Permanent outbound suppression applied.'
    );
    return result;
  }

  if (classification.classification === 'INTERESTED') {
    result.recruitStage = 'BROKER_FOLLOW_UP_REQUIRED';
    result.campaignStatus = 'STOPPED';
    result.campaignNotes = REC_appendNote_(
      result.campaignNotes,
      'Interested reply received. Broker follow-up required; first conversation by Zoom or phone.'
    );
    return result;
  }

  result.recruitStage = 'BROKER_FOLLOW_UP_REQUIRED';
  result.campaignStatus = 'STOPPED';
  result.campaignNotes = REC_appendNote_(
    result.campaignNotes,
    'Reply received. Automated nurture stopped pending broker review.'
  );
  return result;
}

function REC_transitionForLRECStatus(recruit, lrecResult) {
  const status = String((lrecResult && lrecResult.status) || 'UNKNOWN').toUpperCase();
  const broker = REC_normalizeText((lrecResult && lrecResult.sponsoringBroker) || '');

  const result = {
    recruitStage: recruit.recruitStage,
    campaignStatus: recruit.campaignStatus,
    lrecStatus: status,
    sponsoringBroker: broker,
    lrecLastChecked: REC_now(),
    activeRecruitingQueue: recruit.activeRecruitingQueue,
    campaignNotes: recruit.campaignNotes || ''
  };

  if (status !== 'ACTIVE') {
    if (result.recruitStage === 'NEW') result.recruitStage = 'PRE_LICENSE';
    if (result.recruitStage === 'LREC_CHECK_PENDING') result.recruitStage = 'NURTURING';
    return result;
  }

  result.campaignStatus = 'STOPPED';

  if (broker) {
    result.recruitStage = 'ACTIVE_WITH_BROKERAGE';
    result.activeRecruitingQueue = true;
    result.campaignNotes = REC_appendNote_(
      result.campaignNotes,
      'LREC ACTIVE status detected. Sponsoring brokerage recorded. Pre-license nurture stopped; queued for future active-agent recruiting.'
    );
  } else {
    result.recruitStage = 'BROKERAGE_REVIEW_REQUIRED';
    result.activeRecruitingQueue = false;
    result.campaignNotes = REC_appendNote_(
      result.campaignNotes,
      'LREC ACTIVE status detected but sponsoring brokerage was not confidently resolved. Manual review required.'
    );
  }

  return result;
}

function REC_appendNote_(existing, note) {
  const stamp = REC_formatDateTime(REC_now());
  const line = '[' + stamp + '] ' + note;
  return existing ? existing + '\n' + line : line;
}

function REC_validateStage_(stage) {
  return REC_ALLOWED_STAGES.indexOf(String(stage || '').toUpperCase()) !== -1;
}
