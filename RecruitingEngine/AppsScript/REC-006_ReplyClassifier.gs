/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-006_ReplyClassifier
 * Release: MOS5-021
 * Version: 1.0.0
 */

const REC_STOP_PATTERNS = Object.freeze([
  /\bstop\b/i,
  /\bunsubscribe\b/i,
  /\bremove me\b/i,
  /\bdo not contact\b/i,
  /\bdon't contact\b/i,
  /\bopt out\b/i,
  /\bno more emails\b/i,
  /\bno thanks\b/i,
  /\bnot interested\b/i
]);

const REC_INTEREST_PATTERNS = Object.freeze([
  /\binterested\b/i,
  /\blearn more\b/i,
  /\btell me more\b/i,
  /\bschedule\b/i,
  /\bmeeting\b/i,
  /\bmeet\b/i,
  /\bzoom\b/i,
  /\bphone call\b/i,
  /\bcall me\b/i,
  /\btalk\b/i,
  /\bconversation\b/i,
  /\bavailable\b/i
]);

function REC_classifyReply(subject, body) {
  const text = [
    REC_normalizeText(subject),
    REC_normalizeText(body)
  ].join('\n');

  const stop = REC_STOP_PATTERNS.some(function(pattern) {
    return pattern.test(text);
  });

  if (stop) {
    return {
      classification: 'STOP',
      stopAutomation: true,
      markDNC: true,
      markUnsubscribed: true,
      sendAutoReply: false,
      brokerFollowUpRequired: false
    };
  }

  const interested = REC_INTEREST_PATTERNS.some(function(pattern) {
    return pattern.test(text);
  });

  if (interested) {
    return {
      classification: 'INTERESTED',
      stopAutomation: true,
      markDNC: false,
      markUnsubscribed: false,
      sendAutoReply: true,
      brokerFollowUpRequired: true,
      autoReplyType: 'BROKER_WILL_CONTACT'
    };
  }

  return {
    classification: 'BROKER_REVIEW',
    stopAutomation: true,
    markDNC: false,
    markUnsubscribed: false,
    sendAutoReply: false,
    brokerFollowUpRequired: true
  };
}

function REC_getInterestedAutoReply(firstName) {
  const greeting = firstName ? 'Hi ' + firstName + ',' : 'Hello,';

  return {
    subject: 'Thank you for reaching out to Melrose Group Realty',
    plainText:
      greeting + '\n\n' +
      'Thank you for reaching out to Melrose Group Realty. Your message has been received, and our broker will be in touch with you regarding the next conversation.\n\n' +
      'The first conversation can be scheduled by Zoom or phone, whichever is most convenient for you.\n\n' +
      'We look forward to speaking with you.\n\n' +
      'Melrose Group Realty',
    html:
      '<p>' + greeting + '</p>' +
      '<p>Thank you for reaching out to <strong>Melrose Group Realty</strong>. Your message has been received, and our broker will be in touch with you regarding the next conversation.</p>' +
      '<p>The first conversation can be scheduled by <strong>Zoom or phone</strong>, whichever is most convenient for you.</p>' +
      '<p>We look forward to speaking with you.</p>' +
      '<p><strong>Melrose Group Realty</strong></p>'
  };
}

function REC_shouldOverrideDNCForInboundRequest(replyText) {
  const text = REC_normalizeText(replyText);

  if (!text) return false;

  return REC_INTEREST_PATTERNS.some(function(pattern) {
    return pattern.test(text);
  });
}
