const MGR_RECRUIT_129 = Object.freeze({
  VERSION: '1.2.0',
  LREC_MAX_AGE_HOURS: 24,
  EXISTING_AGENT_WORKFLOW: 'EXISTING_AGENT_PENDING_WORKFLOW',
  PROHIBITED_TERMS: Object.freeze([
    'share.theceshop.com',
    'theceshop.com',
    'the ce shop',
    '35% off',
    'exam prep discount'
  ])
});

function MGR_RECRUIT_129_assertContentSafe(subject, html, text) {
  const blob = [subject || '', html || '', text || ''].join(' ').toLowerCase();
  const hits = MGR_RECRUIT_129.PROHIBITED_TERMS.filter(function(term) {
    const clean = String(term || '').trim().toLowerCase();
    return clean && blob.indexOf(clean) >= 0;
  });

  if (hits.length) {
    throw new Error(
      'RECRUIT_CONTENT_BLOCK: prohibited vendor/promotion content: ' +
      hits.join(', ')
    );
  }
  return true;
}

function MGR_RECRUIT_129_liveLrecLookup_(recruit) {
  // Production interlock: the proven CRM-144 bridge / CRM-143 direct
  // LREC verifier is authoritative for pending-recruit outbound.
  if (typeof MGR_RECRUIT_144_verifyPendingCandidate === 'function') {
    try {
      const gate = MGR_RECRUIT_144_verifyPendingCandidate(recruit || {});
      const r = (gate && gate.lrec) || {};
      if (!r.checkedAt) r.checkedAt = new Date().toISOString();
      r.source = r.source || 'LREC_PUBLIC_PORTAL_DIRECT_SEARCH';
      if (gate && gate.decision) r.productionDecision = gate.decision;
      return r;
    } catch (e) {
      return {
        success:false,
        checkedAt:new Date().toISOString(),
        source:'LREC_PUBLIC_PORTAL_DIRECT_SEARCH',
        error:'CRM144_VERIFICATION_EXCEPTION: ' +
          String(e && e.message ? e.message : e)
      };
    }
  }

  // Fail closed. Do not silently fall back to superseded LREC transports.
  return {
    success:false,
    checkedAt:new Date().toISOString(),
    source:'LREC_PUBLIC_PORTAL_DIRECT_SEARCH',
    error:'CRM144_PRODUCTION_VERIFIER_NOT_INSTALLED'
  };
}

function MGR_RECRUIT_129_isFresh_(checkedAt) {
  const t = new Date(checkedAt || '').getTime();
  if (!isFinite(t)) return false;
  const age = Date.now() - t;
  return age >= 0 && age <= MGR_RECRUIT_129.LREC_MAX_AGE_HOURS * 3600000;
}

function MGR_RECRUIT_129_classifyLrec_(status) {
  if (typeof MGR_LREC_applyPendingBusinessRule_ === 'function') {
    return MGR_LREC_applyPendingBusinessRule_(status || {});
  }
  const r = status || {};
  if (r.noResults === true) {
    return {route:'PENDING_RECRUIT', allowPendingRecruitSend:true, reason:'LREC_NO_RESULTS_PENDING'};
  }
  if (r.recordFound === true) {
    return {route:MGR_RECRUIT_129.EXISTING_AGENT_WORKFLOW, allowPendingRecruitSend:false, reason:'LREC_LICENSE_RECORD_FOUND'};
  }
  return {route:'HOLD_FOR_REVIEW', allowPendingRecruitSend:false, reason:'LREC_STATUS_NOT_SAFE_FOR_PENDING_OUTBOUND'};
}

function MGR_RECRUIT_129_beforePendingSend(recruit, message) {
  MGR_RECRUIT_129_assertContentSafe(
    message && message.subject,
    message && message.htmlBody,
    message && message.body
  );

  const lrec = MGR_RECRUIT_129_liveLrecLookup_(recruit);

  if (!lrec.success || !MGR_RECRUIT_129_isFresh_(lrec.checkedAt)) {
    return {
      success:false,
      allowSend:false,
      route:'HOLD_FOR_REVIEW',
      reason:lrec.error || 'LREC_VERIFICATION_FAILED_OR_STALE',
      lrec:lrec
    };
  }

  const decision = MGR_RECRUIT_129_classifyLrec_(lrec);
  if (!decision.allowPendingRecruitSend) {
    MGR_RECRUIT_129_transition_(recruit, decision, lrec);
  }

  return {
    success:true,
    allowSend:decision.allowPendingRecruitSend,
    route:decision.route,
    reason:decision.reason,
    lrec:lrec
  };
}

function MGR_RECRUIT_129_transition_(recruit, decision, lrec) {
  const payload = {
    email:String((recruit && recruit.email) || '').trim().toLowerCase(),
    licenseNumber:String(
      (lrec && lrec.licenseNumber) ||
      (recruit && (recruit.licenseNumber || recruit.credentialNumber)) ||
      ''
    ),
    priorWorkflow:'PENDING_RECRUIT',
    newWorkflow:decision.route,
    transitionReason:decision.reason,
    lrecStatus:String((lrec && lrec.licenseStatus) || ''),
    brokerage:String((lrec && (lrec.companyName || lrec.brokerageName)) || ''),
    sponsoringBroker:String((lrec && lrec.sponsoringBroker) || ''),
    transitionedAt:new Date().toISOString(),
    outboundEnabled:false
  };

  if (typeof MGR_RECRUIT_moveToExistingAgentWorkflow === 'function') {
    MGR_RECRUIT_moveToExistingAgentWorkflow(payload);
  } else if (typeof MGR_CRM_transitionRecruitWorkflow === 'function') {
    MGR_CRM_transitionRecruitWorkflow(payload);
  } else {
    const props = PropertiesService.getScriptProperties();
    const key = 'MGR_RECRUIT_TRANSITION_' + Utilities.base64EncodeWebSafe(
      payload.email || payload.licenseNumber || Utilities.getUuid()
    );
    props.setProperty(key, JSON.stringify(payload));
  }
  return payload;
}

function MGR_RECRUIT_129_ctaPolicy(sequenceNumber) {
  const n = Number(sequenceNumber || 1);
  if (n <= 5) {
    return {
      level:'MENTOR',
      consultationRequired:true,
      copy:'If you would like help understanding your next step, schedule a consultation with Melrose Group Realty.'
    };
  }
  if (n <= 10) {
    return {
      level:'DIRECT',
      consultationRequired:true,
      copy:'You have already invested in getting this far. Schedule a consultation with Melrose Group Realty so we can map out your next move and discuss the brokerage support available to you.'
    };
  }
  return {
    level:'STRONG',
    consultationRequired:true,
    copy:'If you are serious about launching your Louisiana real estate career with guidance and accountability, schedule your consultation with Melrose Group Realty now so we can discuss your path forward.'
  };
}

function RUN_RECRUIT_129_CERTIFICATION() {
  const checks = [];

  let normalAllowed = false;
  try {
    MGR_RECRUIT_129_assertContentSafe(
      'Choosing a brokerage',
      '<p>You may affiliate with the brokerage that best supports your career.</p>',
      ''
    );
    normalAllowed = true;
  } catch (e) {}
  checks.push({name:'NORMAL_AFFILIATION_LANGUAGE_ALLOWED', pass:normalAllowed});

  let vendorBlocked = false;
  try {
    MGR_RECRUIT_129_assertContentSafe(
      'Test',
      '<p>Visit share.theceshop.com/example</p>',
      ''
    );
  } catch (e) {
    vendorBlocked = true;
  }
  checks.push({name:'VENDOR_PROMOTION_BLOCKED', pass:vendorBlocked});

  checks.push({
    name:'LREC_FAIL_CLOSED',
    pass:MGR_RECRUIT_129_classifyLrec_({}).allowPendingRecruitSend === false
  });

  checks.push({
    name:'PENDING_CAN_CONTINUE',
    pass:MGR_RECRUIT_129_classifyLrec_({success:true,noResults:true}).allowPendingRecruitSend === true
  });

  checks.push({
    name:'LICENSE_RECORD_STOPS_PENDING',
    pass:MGR_RECRUIT_129_classifyLrec_({success:true,recordFound:true,licenseStatus:'Active'}).allowPendingRecruitSend === false
  });

  const liveVerifierPresent =
    typeof MGR_RECRUIT_LREC_lookup === 'function' ||
    typeof MGR_LREC_lookupRecruitStatus === 'function';

  checks.push({name:'LIVE_LREC_VERIFIER_PRESENT', pass:liveVerifierPresent});

  const result = {
    success:checks.every(function(c){return c.pass === true;}),
    version:MGR_RECRUIT_129.VERSION,
    checks:checks,
    liveLrecVerifierPresent:liveVerifierPresent,
    pendingRecruitOutboundRule:'VERIFY_LREC_BEFORE_EVERY_SEND',
    existingAgentTransitionRule:'MOVE_BUT_DO_NOT_SEND',
    timestamp:new Date().toISOString()
  };

  console.log('RUN_RECRUIT_129_CERTIFICATION\n' + JSON.stringify(result,null,2));
  return result;
}
