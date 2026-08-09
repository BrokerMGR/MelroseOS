/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-010_ReplyMonitor
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Monitors Gmail replies, stops nurture on any human reply,
 * permanently suppresses STOP/unsubscribe replies,
 * and acknowledges interested replies once.
 */

function REC_getRecruitLookup_() {
  REC_installSystemColumns();
  const recruits = REC_readRecruitRows(10000);
  const byEmail = {};

  recruits.forEach(function(recruit) {
    const email = REC_normalizeEmail(recruit.email);
    if (email && !byEmail[email]) byEmail[email] = recruit;
  });

  return byEmail;
}

function REC_extractEmailAddress_(value) {
  const text = String(value || '').trim();
  const match = text.match(/<([^>]+)>/);
  return REC_normalizeEmail(match ? match[1] : text);
}

function REC_applyReplyTransition_(recruit, classification, subject, body) {
  const sheet = REC_getRecruitingSheet();
  const state = REC_transitionForReply(recruit, classification);

  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'RecruitStage', state.recruitStage);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'CampaignStatus', state.campaignStatus);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'ReplyDetected', true);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'Unsubscribed', state.unsubscribed);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'DoNotContact', state.doNotContact);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'ActiveRecruitingQueue', state.activeRecruitingQueue);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'CampaignNotes', state.campaignNotes);

  if (classification.classification === 'STOP') {
    REC_setSystemValueByRow_(
      sheet,
      recruit.rowNumber,
      'CampaignNotes',
      REC_appendNote_(
        state.campaignNotes,
        'Reply classified STOP. Subject: ' + REC_normalizeText(subject)
      )
    );
  }

  if (classification.sendAutoReply === true &&
      classification.autoReplyType === 'BROKER_WILL_CONTACT') {
    const reply = REC_getInterestedAutoReply(recruit.firstName);

    GmailApp.sendEmail(
      recruit.email,
      reply.subject,
      reply.plainText,
      {
        htmlBody: reply.html,
        name: 'Melrose Group Realty',
        replyTo: REC_CONFIG.senderAccount
      }
    );
  }

  return state;
}

function REC_monitorRecruitReplies(hoursBack) {
  const lookback = Math.max(1, Math.min(Number(hoursBack || 48), 168));
  const recruitByEmail = REC_getRecruitLookup_();
  const after = Math.floor((Date.now() - (lookback * 60 * 60 * 1000)) / 1000);

  const threads = GmailApp.search('in:inbox after:' + after);
  const processed = [];
  const seen = {};

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      if (!message.isInInbox()) return;

      const from = REC_extractEmailAddress_(message.getFrom());
      const recruit = recruitByEmail[from];

      if (!recruit) return;
      if (seen[message.getId()]) return;
      seen[message.getId()] = true;

      // Ignore messages sent by the configured recruiting mailbox itself.
      if (from === REC_normalizeEmail(REC_CONFIG.senderAccount)) return;

      const subject = message.getSubject();
      const body = message.getPlainBody();
      const classification = REC_classifyReply(subject, body);

      REC_applyReplyTransition_(recruit, classification, subject, body);

      processed.push({
        messageId: message.getId(),
        recruitId: recruit.recruitId,
        email: recruit.email,
        classification: classification.classification
      });

      REC_log('PASS', 'REC-010_ReplyMonitor', 'Recruit reply processed.', {
        recruitId: recruit.recruitId,
        classification: classification.classification
      });
    });
  });

  return REC_result(true, {
    lookbackHours: lookback,
    processedCount: processed.length,
    processed: processed
  });
}
