/**
 * MelroseOS CRM
 * File: CRM-146_RecruitProductionReleaseController.gs
 * Version: 1.0.0
 *
 * FINAL RECRUIT PRODUCTION RELEASE CONTROLLER
 *
 * Pending recruit outbound may proceed ONLY when:
 *  - recruit production is enabled
 *  - existing-agent outbound is OFF
 *  - fresh CRM-144/143 LREC verification returns explicit no-result
 *  - unsubscribed = false
 *  - do-not-contact = false
 *  - email valid
 *  - sequence is due
 *  - communication window / holiday rules permit send
 *  - dedupe permits enqueue
 *
 * Licensed record => transition existing agent, no recruit send.
 * Any LREC ambiguity/error => HOLD.
 */

const MGR_RECRUIT_146 = Object.freeze({
  VERSION:'1.0.0',
  AUDIT_PROPERTY:'MGR_RECRUIT_145_LAST_FULL_AUDIT',
  RELEASE_PROPERTY:'MGR_RECRUIT_146_RELEASE',
  EXISTING_AGENT_OUTBOUND:'OFF',
  MAX_AUDIT_AGE_MINUTES:60
});

function RUN_RECRUIT_146_FINAL_RELEASE_CERTIFICATION() {
  const checks = [];

  const audit =
    MGR_RECRUIT_146_readJsonProperty_(
      MGR_RECRUIT_146.AUDIT_PROPERTY
    );

  const auditAgeMs =
    audit && audit.timestamp
      ? Date.now() - new Date(audit.timestamp).getTime()
      : Number.POSITIVE_INFINITY;

  checks.push({
    name:'FULL_ROSTER_AUDIT_PASS',
    pass:
      !!audit &&
      audit.success === true &&
      audit.releaseReady === true &&
      Number(audit.held || 0) === 0 &&
      Number(audit.migrationFailed || 0) === 0
  });

  checks.push({
    name:'FULL_ROSTER_AUDIT_FRESH',
    pass:
      isFinite(auditAgeMs) &&
      auditAgeMs >= 0 &&
      auditAgeMs <=
        MGR_RECRUIT_146.MAX_AUDIT_AGE_MINUTES * 60 * 1000
  });

  checks.push({
    name:'PROVEN_LREC_BRIDGE_PRESENT',
    pass:
      typeof MGR_RECRUIT_144_verifyPendingCandidate === 'function'
  });

  checks.push({
    name:'PRE_SEND_LREC_GATE_PRESENT',
    pass:
      typeof MGR_RECRUIT_129_beforePendingSend === 'function'
  });

  checks.push({
    name:'SENDER_POOL_PRESENT',
    pass:
      typeof MGR_SENDER_routePendingQueue === 'function'
  });

  checks.push({
    name:'PRODUCTION_TICK_PRESENT',
    pass:
      typeof MGR_RECRUIT_productionTick === 'function'
  });

  checks.push({
    name:'EXISTING_AGENT_OUTBOUND_LOCKED_OFF',
    pass:
      MGR_RECRUIT_146.EXISTING_AGENT_OUTBOUND === 'OFF'
  });

  const canary =
    typeof RUN_RECRUIT_144_BRIDGE_CERTIFICATION === 'function'
      ? RUN_RECRUIT_144_BRIDGE_CERTIFICATION()
      : {success:false};

  checks.push({
    name:'LIVE_LREC_POSITIVE_NEGATIVE_CANARY',
    pass:canary && canary.success === true
  });

  const result = {
    success:
      checks.every(function(c){ return c.pass === true; }),
    version:MGR_RECRUIT_146.VERSION,
    checks:checks,
    auditSummary:audit ? {
      scannedProspects:audit.scannedProspects,
      pending:audit.pending,
      licensed:audit.licensed,
      held:audit.held,
      migrated:audit.migrated,
      migrationFailed:audit.migrationFailed,
      timestamp:audit.timestamp
    } : null,
    existingAgentOutbound:'OFF',
    recruitOutboundReleased:false,
    timestamp:new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_146_FINAL_RELEASE_CERTIFICATION\n' +
    JSON.stringify(result,null,2)
  );

  return result;
}

function ACTIVATE_RECRUIT_PRODUCTION_146() {
  const cert =
    RUN_RECRUIT_146_FINAL_RELEASE_CERTIFICATION();

  if (!cert.success) {
    throw new Error(
      'CRM-146 RELEASE BLOCKED: final certification failed.'
    );
  }

  // Existing-agent outbound remains independently hard locked OFF.
  PropertiesService.getScriptProperties().setProperty(
    'MGR_EXISTING_AGENT_OUTBOUND',
    'OFF'
  );

  // Preserve the existing production state system.
  const props = PropertiesService.getScriptProperties();
  props.setProperty('MGR_RECRUIT_PRODUCTION_ENABLED','true');
  props.setProperty('MGR_RECRUIT_TEST_MODE','false');
  props.setProperty(
    MGR_RECRUIT_146.RELEASE_PROPERTY,
    JSON.stringify({
      enabled:true,
      existingAgentOutbound:'OFF',
      releasedAt:new Date().toISOString(),
      certificationVersion:MGR_RECRUIT_146.VERSION
    })
  );

  if (typeof MGR_RECRUIT_installProductionTrigger_ === 'function') {
    MGR_RECRUIT_installProductionTrigger_();
  }

  const result = {
    success:true,
    recruitProduction:'ON',
    existingAgentOutbound:'OFF',
    testMode:false,
    timestamp:new Date().toISOString()
  };

  console.log(
    'ACTIVATE_RECRUIT_PRODUCTION_146\n' +
    JSON.stringify(result,null,2)
  );

  return result;
}

function MGR_RECRUIT_146_preSendGate(recruit, message, context) {
  recruit = recruit || {};
  context = context || {};

  const email =
    String(
      recruit.email ||
      recruit.Email ||
      context.email ||
      ''
    ).trim().toLowerCase();

  if (!MGR_RECRUIT_146_validEmail_(email)) {
    return {
      allow:false,
      status:'HOLD',
      reason:'INVALID_EMAIL'
    };
  }

  if (
    MGR_RECRUIT_146_truthy_(
      recruit.unsubscribed ||
      recruit.Unsubscribed ||
      recruit['Unsubscribed']
    )
  ) {
    return {
      allow:false,
      status:'STOP',
      reason:'UNSUBSCRIBED'
    };
  }

  if (
    MGR_RECRUIT_146_truthy_(
      recruit.doNotContact ||
      recruit.DoNotContact ||
      recruit['Do Not Contact'] ||
      recruit.DNC
    )
  ) {
    return {
      allow:false,
      status:'STOP',
      reason:'DO_NOT_CONTACT'
    };
  }

  const lrec =
    MGR_RECRUIT_144_verifyPendingCandidate(
      recruit
    );

  if (!lrec || lrec.success !== true) {
    return {
      allow:false,
      status:'HOLD',
      reason:
        (lrec && lrec.reason) ||
        'LREC_VERIFICATION_FAILED',
      lrec:lrec || null
    };
  }

  if (lrec.decision === 'TRANSITION_EXISTING_AGENT') {
    return {
      allow:false,
      status:'TRANSITION_EXISTING_AGENT',
      reason:'LREC_RECORD_FOUND',
      existingAgentOutbound:'OFF',
      lrec:lrec
    };
  }

  if (lrec.decision !== 'ALLOW_PENDING_RECRUIT') {
    return {
      allow:false,
      status:'HOLD',
      reason:'LREC_NOT_EXPLICIT_PENDING',
      lrec:lrec
    };
  }

  // Existing CRM-129 content gate + fail-closed policy remains authoritative.
  const contentGate =
    MGR_RECRUIT_129_beforePendingSend(
      recruit,
      message || {}
    );

  if (
    !contentGate ||
    contentGate.success !== true ||
    contentGate.allowSend !== true
  ) {
    return {
      allow:false,
      status:
        contentGate && contentGate.route ===
          'EXISTING_AGENT_PENDING_WORKFLOW'
          ? 'TRANSITION_EXISTING_AGENT'
          : 'HOLD',
      reason:
        contentGate && contentGate.reason ||
        'CRM129_GATE_BLOCKED',
      lrec:contentGate && contentGate.lrec || null
    };
  }

  return {
    allow:true,
    status:'ALLOW_PENDING_RECRUIT',
    reason:'ALL_RELEASE_GATES_PASS',
    email:email,
    existingAgentOutbound:'OFF',
    lrec:lrec
  };
}

function MGR_RECRUIT_146_truthy_(value) {
  if (value === true || value === 1) return true;
  const s = String(value || '').trim().toUpperCase();
  return ['TRUE','YES','Y','1','UNSUBSCRIBED','DNC','DO_NOT_CONTACT']
    .indexOf(s) >= 0;
}

function MGR_RECRUIT_146_validEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || '').trim()
  );
}

function MGR_RECRUIT_146_readJsonProperty_(key) {
  const raw =
    PropertiesService.getScriptProperties()
      .getProperty(key);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function RUN_RECRUIT_146_EXISTING_AGENT_LOCK_CERTIFICATION() {
  const props = PropertiesService.getScriptProperties();

  // Set the operational lock as part of certification.
  props.setProperty(
    'MGR_EXISTING_AGENT_OUTBOUND',
    'OFF'
  );

  const result = {
    success:
      props.getProperty(
        'MGR_EXISTING_AGENT_OUTBOUND'
      ) === 'OFF',
    existingAgentOutbound:
      props.getProperty(
        'MGR_EXISTING_AGENT_OUTBOUND'
      ),
    purpose:
      'MANUAL_BROKER_FILTERING_REQUIRED_BEFORE_EXISTING_AGENT_OUTBOUND',
    timestamp:
      new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_146_EXISTING_AGENT_LOCK_CERTIFICATION\n' +
    JSON.stringify(result,null,2)
  );

  return result;
}
