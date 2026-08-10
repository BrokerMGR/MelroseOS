/**
 * MelroseOS Enterprise Core
 * File: CORE-21_EmailQuotaGovernor.gs
 * Purpose:
 * System-wide quota-aware email governor.
 *
 * Policy:
 * - Check remaining Apps Script email recipient quota before send.
 * - Reserve capacity for operational / broker-critical communications.
 * - Recruiting and marketing may not consume the operational reserve.
 * - Never bypass Google's quota.
 */

const MGR_EMAIL_QUOTA_GOVERNOR_VERSION = '1.0.0';

const MGR_EMAIL_QUOTA_POLICY = Object.freeze({
  OPERATIONAL_RESERVE: 20,
  CAMPAIGN_MIN_REMAINING_AFTER_SEND: 20,
  DEFAULT_RECIPIENT_COST: 1
});

function MGR_EMAIL_quotaSnapshot() {
  const remaining = MailApp.getRemainingDailyQuota();

  return {
    success: true,
    version: MGR_EMAIL_QUOTA_GOVERNOR_VERSION,
    remainingDailyRecipients: remaining,
    operationalReserve:
      MGR_EMAIL_QUOTA_POLICY.OPERATIONAL_RESERVE,
    campaignCapacity:
      Math.max(
        0,
        remaining -
          MGR_EMAIL_QUOTA_POLICY.OPERATIONAL_RESERVE
      ),
    timestamp: new Date().toISOString()
  };
}

function MGR_EMAIL_quotaClass_(options) {
  const o = options || {};
  const raw = String(
    o.messageClass ||
    o.emailClass ||
    o.classification ||
    o.campaign ||
    ''
  ).toUpperCase();

  if (
    raw.indexOf('RECRUIT') >= 0 ||
    raw.indexOf('MARKETING') >= 0 ||
    raw.indexOf('CAMPAIGN') >= 0 ||
    raw.indexOf('FOLLOWUP') >= 0 ||
    raw.indexOf('FOLLOW_UP') >= 0
  ) {
    return 'CAMPAIGN';
  }

  if (
    raw.indexOf('BROKER') >= 0 ||
    raw.indexOf('COMPLIANCE') >= 0 ||
    raw.indexOf('APPOINTMENT') >= 0 ||
    raw.indexOf('TRANSACTION') >= 0 ||
    raw.indexOf('LEAD') >= 0 ||
    raw.indexOf('OPERATION') >= 0
  ) {
    return 'OPERATIONAL';
  }

  return 'STANDARD';
}

function MGR_EMAIL_recipientCost_(options) {
  const o = options || {};
  const recipients = [];

  ['to', 'cc', 'bcc'].forEach(function(key) {
    if (!o[key]) return;

    String(o[key])
      .split(',')
      .map(function(v) {
        return v.trim();
      })
      .filter(Boolean)
      .forEach(function(v) {
        recipients.push(v.toLowerCase());
      });
  });

  const unique = {};
  recipients.forEach(function(v) {
    unique[v] = true;
  });

  const count = Object.keys(unique).length;

  return Math.max(
    MGR_EMAIL_QUOTA_POLICY.DEFAULT_RECIPIENT_COST,
    count
  );
}

function MGR_EMAIL_quotaDecision(options) {
  const remaining = MailApp.getRemainingDailyQuota();
  const classification = MGR_EMAIL_quotaClass_(options);
  const cost = MGR_EMAIL_recipientCost_(options);

  let reserve = 0;

  if (classification === 'CAMPAIGN') {
    reserve =
      MGR_EMAIL_QUOTA_POLICY
        .CAMPAIGN_MIN_REMAINING_AFTER_SEND;
  }

  const allowed =
    remaining >= cost &&
    remaining - cost >= reserve;

  return {
    success: true,
    allowed: allowed,
    classification: classification,
    recipientCost: cost,
    remainingBeforeSend: remaining,
    remainingAfterSendIfAllowed:
      Math.max(0, remaining - cost),
    reserveRequired: reserve,
    reason: allowed
      ? 'QUOTA_AVAILABLE'
      : (
          remaining < cost
            ? 'GOOGLE_DAILY_EMAIL_QUOTA_EXHAUSTED'
            : 'OPERATIONAL_RESERVE_PROTECTED'
        ),
    version: MGR_EMAIL_QUOTA_GOVERNOR_VERSION,
    timestamp: new Date().toISOString()
  };
}

function MGR_EMAIL_assertQuota(options) {
  const decision = MGR_EMAIL_quotaDecision(options);

  if (!decision.allowed) {
    const err = new Error(
      'EMAIL_QUOTA_PAUSED: ' +
      decision.reason +
      ' | class=' +
      decision.classification +
      ' | remaining=' +
      decision.remainingBeforeSend +
      ' | cost=' +
      decision.recipientCost +
      ' | reserve=' +
      decision.reserveRequired
    );

    err.mgrQuotaDecision = decision;
    throw err;
  }

  return decision;
}

function MGR_CORE_emailQuotaSnapshot() {
  return MGR_EMAIL_quotaSnapshot();
}

function MGR_CORE_emailQuotaDecision(options) {
  return MGR_EMAIL_quotaDecision(options);
}
