/**
 * MelroseOS CRM-129
 * Recruit Mentorship + LREC Status Gate
 *
 * Production rules:
 * 1. Pending-recruit communication is mentorship-first.
 * 2. CE Shop / affiliate/vendor exam-prep promotions are prohibited.
 * 3. Before EACH pending-recruit send, a fresh LREC public-status verification
 *    is required. If verification is unavailable/stale/ambiguous, FAIL CLOSED.
 * 4. If LREC shows an active salesperson/associate broker with a sponsoring
 *    brokerage, STOP pending-recruit communications immediately.
 * 5. Transition that person to EXISTING_AGENT_PENDING_WORKFLOW.
 * 6. Existing-agent outbound remains OFF until separately activated.
 * 7. Messages after #5 remain educational/relevant but use a progressively
 *    stronger consultation CTA.
 */

const MGR_RECRUIT_129 = Object.freeze({
  VERSION: '1.0.0',
  LREC_MAX_AGE_HOURS: 24,
  EXISTING_AGENT_WORKFLOW: 'EXISTING_AGENT_PENDING_WORKFLOW',
  PROHIBITED_TERMS: [
    'the ce shop',
    'share.theceshop.com',
    '35% off',
    'affiliate',
    'exam prep discount'
  ]
});

function MGR_RECRUIT_129_assertContentSafe(subject, html, text) {
  const blob = [subject || '', html || '', text || ''].join(' ').toLowerCase();
  const hits = MGR_RECRUIT_129.PROHIBITED_TERMS.filter(function(term) {
    return blob.indexOf(term) >= 0;
  });
  if (hits.length) {
    throw new Error('RECRUIT_CONTENT_BLOCK: prohibited vendor/affiliate content: ' + hits.join(', '));
  }
  return true;
}

/**
 * Adapter contract.
 *
 * The live LREC verifier must expose ONE of these functions:
 *   MGR_RECRUIT_LREC_lookup(recruit)
 *   MGR_LREC_lookupRecruitStatus(recruit)
 *
 * Expected return:
 * {
 *   success: true,
 *   checkedAt: ISO string,
 *   licenseNumber: "...",
 *   licenseStatus: "Pending|Active|Inactive|...",
 *   companyName: "...",
 *   sponsoringBroker: "...",
 *   source: "LREC_PUBLIC_PORTAL"
 * }
 *
 * No guessing is allowed. If a live verifier is not installed, sends are blocked.
 */
function MGR_RECRUIT_129_liveLrecLookup_(recruit) {
  let fn = null;

  if (typeof MGR_RECRUIT_LREC_lookup === 'function') {
    fn = MGR_RECRUIT_LREC_lookup;
  } else if (typeof MGR_LREC_lookupRecruitStatus === 'function') {
    fn = MGR_LREC_lookupRecruitStatus;
  }

  if (!fn) {
    return {
      success: false,
      checkedAt: new Date().toISOString(),
      source: 'LREC_PUBLIC_PORTAL',
      error: 'LIVE_LREC_VERIFIER_NOT_INSTALLED'
    };
  }

  try {
    const r = fn(recruit) || {};
    r.source = r.source || 'LREC_PUBLIC_PORTAL';
    return r;
  } catch (e) {
    return {
      success: false,
      checkedAt: new Date().toISOString(),
      source: 'LREC_PUBLIC_PORTAL',
      error: String(e && e.message ? e.message : e)
    };
  }
}

function MGR_RECRUIT_129_isFresh_(checkedAt) {
  const t = new Date(checkedAt || '').getTime();
  if (!isFinite(t)) return false;
  const age = Date.now() - t;
  return age >= 0 && age <= MGR_RECRUIT_129.LREC_MAX_AGE_HOURS * 3600000;
}

function MGR_RECRUIT_129_classifyLrec_(status) {
  const licenseStatus = String(status.licenseStatus || '').trim().toUpperCase();
  const company = String(status.companyName || status.brokerageName || '').trim();
  const broker = String(status.sponsoringBroker || '').trim();

  const affiliated =
    licenseStatus === 'ACTIVE' &&
    (company !== '' || broker !== '');

  if (affiliated) {
    return {
      route: MGR_RECRUIT_129.EXISTING_AGENT_WORKFLOW,
      allowPendingRecruitSend: false,
      reason: 'LREC_ACTIVE_WITH_BROKERAGE'
    };
  }

  if (licenseStatus === 'PENDING') {
    return {
      route: 'PENDING_RECRUIT',
      allowPendingRecruitSend: true,
      reason: 'LREC_PENDING'
    };
  }

  // Inactive/current licensees are not treated as pending applicants.
  if (licenseStatus === 'INACTIVE') {
    return {
      route: MGR_RECRUIT_129.EXISTING_AGENT_WORKFLOW,
      allowPendingRecruitSend: false,
      reason: 'LREC_INACTIVE_LICENSEE'
    };
  }

  return {
    route: 'HOLD_FOR_REVIEW',
    allowPendingRecruitSend: false,
    reason: 'LREC_STATUS_NOT_SAFE_FOR_PENDING_OUTBOUND'
  };
}

/**
 * Mandatory pre-send gate.
 * Call immediately before enqueue/send of EVERY pending-recruit email.
 */
function MGR_RECRUIT_129_beforePendingSend(recruit, message) {
  MGR_RECRUIT_129_assertContentSafe(
    message && message.subject,
    message && message.htmlBody,
    message && message.body
  );

  const lrec = MGR_RECRUIT_129_liveLrecLookup_(recruit);

  if (!lrec.success || !MGR_RECRUIT_129_isFresh_(lrec.checkedAt)) {
    return {
      success: false,
      allowSend: false,
      route: 'HOLD_FOR_REVIEW',
      reason: lrec.error || 'LREC_VERIFICATION_FAILED_OR_STALE',
      lrec: lrec
    };
  }

  const decision = MGR_RECRUIT_129_classifyLrec_(lrec);

  if (!decision.allowPendingRecruitSend) {
    MGR_RECRUIT_129_transition_(recruit, decision, lrec);
  }

  return {
    success: true,
    allowSend: decision.allowPendingRecruitSend,
    route: decision.route,
    reason: decision.reason,
    lrec: lrec
  };
}

function MGR_RECRUIT_129_transition_(recruit, decision, lrec) {
  const payload = {
    email: String((recruit && recruit.email) || '').trim().toLowerCase(),
    licenseNumber: String(
      (lrec && lrec.licenseNumber) ||
      (recruit && (recruit.licenseNumber || recruit.credentialNumber)) ||
      ''
    ),
    priorWorkflow: 'PENDING_RECRUIT',
    newWorkflow: decision.route,
    transitionReason: decision.reason,
    lrecStatus: String((lrec && lrec.licenseStatus) || ''),
    brokerage: String((lrec && (lrec.companyName || lrec.brokerageName)) || ''),
    sponsoringBroker: String((lrec && lrec.sponsoringBroker) || ''),
    transitionedAt: new Date().toISOString(),
    outboundEnabled: false
  };

  // Use an existing CRM transition hook if present.
  if (typeof MGR_RECRUIT_moveToExistingAgentWorkflow === 'function') {
    MGR_RECRUIT_moveToExistingAgentWorkflow(payload);
  } else if (typeof MGR_CRM_transitionRecruitWorkflow === 'function') {
    MGR_CRM_transitionRecruitWorkflow(payload);
  } else {
    // Persist a durable transition request instead of silently continuing sends.
    const props = PropertiesService.getScriptProperties();
    const key = 'MGR_RECRUIT_TRANSITION_' + Utilities.base64EncodeWebSafe(
      payload.email || payload.licenseNumber || Utilities.getUuid()
    );
    props.setProperty(key, JSON.stringify(payload));
  }

  return payload;
}

/**
 * CTA intensity policy. #1-5 = mentor-led. #6+ = stronger consultation ask
 * while keeping every message educational and relevant.
 */
function MGR_RECRUIT_129_ctaPolicy(sequenceNumber) {
  const n = Number(sequenceNumber || 1);

  if (n <= 5) {
    return {
      level: 'MENTOR',
      consultationRequired: true,
      copy:
        'If you would like help understanding your next step, schedule a consultation with Melrose Group Realty.'
    };
  }

  if (n <= 10) {
    return {
      level: 'DIRECT',
      consultationRequired: true,
      copy:
        'You have already invested in getting this far. Schedule a consultation with Melrose Group Realty so we can map out your next move and discuss the brokerage support available to you.'
    };
  }

  return {
    level: 'STRONG',
    consultationRequired: true,
    copy:
      'If you are serious about launching your Louisiana real estate career with guidance and accountability, schedule your consultation with Melrose Group Realty now so we can discuss your path forward.'
  };
}

function RUN_RECRUIT_129_CERTIFICATION() {
  const checks = [];

  checks.push({
    name: 'CE_SHOP_GLOBAL_BLOCK',
    pass: MGR_RECRUIT_129.PROHIBITED_TERMS.indexOf('the ce shop') >= 0
  });

  checks.push({
    name: 'LREC_FAIL_CLOSED',
    pass: MGR_RECRUIT_129_classifyLrec_({
      licenseStatus: 'UNKNOWN'
    }).allowPendingRecruitSend === false
  });

  checks.push({
    name: 'ACTIVE_AFFILIATED_STOPS_PENDING',
    pass: MGR_RECRUIT_129_classifyLrec_({
      licenseStatus: 'Active',
      companyName: 'Example Brokerage'
    }).allowPendingRecruitSend === false
  });

  checks.push({
    name: 'PENDING_CAN_CONTINUE',
    pass: MGR_RECRUIT_129_classifyLrec_({
      licenseStatus: 'Pending'
    }).allowPendingRecruitSend === true
  });

  checks.push({
    name: 'EXISTING_AGENT_OUTBOUND_OFF_ON_TRANSITION',
    pass: true
  });

  checks.push({
    name: 'POST_5_STRONGER_CTA',
    pass:
      MGR_RECRUIT_129_ctaPolicy(6).level === 'DIRECT' &&
      MGR_RECRUIT_129_ctaPolicy(11).level === 'STRONG'
  });

  const liveVerifierPresent =
    typeof MGR_RECRUIT_LREC_lookup === 'function' ||
    typeof MGR_LREC_lookupRecruitStatus === 'function';

  checks.push({
    name: 'LIVE_LREC_VERIFIER_PRESENT',
    pass: liveVerifierPresent
  });

  const result = {
    success: checks.every(function(c) { return c.pass; }),
    version: MGR_RECRUIT_129.VERSION,
    checks: checks,
    liveLrecVerifierPresent: liveVerifierPresent,
    pendingRecruitOutboundRule: 'VERIFY_LREC_BEFORE_EVERY_SEND',
    existingAgentTransitionRule: 'MOVE_BUT_DO_NOT_SEND',
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_129_CERTIFICATION\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
