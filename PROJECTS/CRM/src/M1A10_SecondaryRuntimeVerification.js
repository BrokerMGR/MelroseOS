/**
 * MOS5-M1-A10 — Secondary Runtime Trigger Verification
 * Run ONLY while authenticated as melrosegrouprealty@gmail.com
 * inside secondary project:
 * 1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd
 *
 * READ ONLY: does not execute/delete/create triggers or send email.
 */
function MOS5P_runM1A10SecondaryRuntimeVerification() {
  const EXPECTED_USER='melrosegrouprealty@gmail.com';
  const EXPECTED_PROJECT='1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd';

  const effective=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  const active=String(Session.getActiveUser().getEmail()||'').toLowerCase();
  const triggers=ScriptApp.getProjectTriggers();

  const criticalRx=/(send|mail|notification|notify|follow.?up|retry|campaign|queue)/i;
  const highRx=/(worker|dispatch|automation|scheduler|orchestr|process|lifecycle)/i;
  const lowRx=/(backup|health|metric|dashboard|refresh|open)/i;

  const rows=triggers.map(function(t){
    const h=String(t.getHandlerFunction()||'');
    let risk='MEDIUM';
    let reason='UNCLASSIFIED_RUNTIME_HANDLER';
    if(criticalRx.test(h)){risk='CRITICAL_OUTBOUND';reason='OUTBOUND_OR_QUEUE_HANDLER_NAME';}
    else if(highRx.test(h)){risk='HIGH';reason='AUTOMATION_OR_WORKER_HANDLER_NAME';}
    else if(lowRx.test(h)){risk='LOW';reason='UTILITY_OR_OBSERVABILITY_HANDLER_NAME';}

    return {
      uniqueId:safe_(function(){return t.getUniqueId();}),
      handlerFunction:h,
      eventType:safe_(function(){return String(t.getEventType());}),
      triggerSource:safe_(function(){return String(t.getTriggerSource());}),
      sourceId:safe_(function(){return String(t.getTriggerSourceId()||'');}),
      risk:risk,
      reason:reason,
      specificallyInteresting:/^(NF_processFollowUpQueue|NF_retrySendErrors|AC_installAccountabilityAutomation)$/i.test(h) ||
        /^OP_/i.test(h)
    };
  });

  const critical=rows.filter(r=>r.risk==='CRITICAL_OUTBOUND');
  const interesting=rows.filter(r=>r.specificallyInteresting);

  const r={
    success:true,
    release:'MOS5-M1-A10',
    version:'1.0.0',
    mode:'SECONDARY_RUNTIME_TRIGGER_READ_ONLY',
    expectedProjectId:EXPECTED_PROJECT,
    targetIdentity:EXPECTED_USER,
    effectiveUser:effective,
    activeUser:active,
    targetIdentityConfirmed:effective===EXPECTED_USER,
    triggerCount:rows.length,
    criticalOutboundCount:critical.length,
    specificallyInterestingCount:interesting.length,
    triggers:rows,
    interpretation:critical.length
      ? 'OUTBOUND_CAPABLE_TRIGGER_CANDIDATES_VISIBLE'
      : (rows.length ? 'TRIGGERS_VISIBLE_BUT_NO_NAME_BASED_CRITICAL_MATCH' : 'ZERO_TRIGGERS_VISIBLE_UNDER_THIS_IDENTITY'),
    nextGate:critical.length
      ? 'CORRELATE_CRITICAL_HANDLERS_WITH_A9_CALL_CHAIN_BEFORE_M1B'
      : 'DO_NOT_SHUT_DOWN_SECONDARY_PROJECT_BASED_ON_CURRENT_EVIDENCE',
    safety:{
      triggerExecuted:false,
      triggerMutationPerformed:false,
      triggerDeleted:false,
      triggerCreated:false,
      emailSent:false,
      gmailMutationPerformed:false,
      spreadsheetMutationPerformed:false,
      leadAssignmentPerformed:false
    },
    result:'PASS'
  };
  Logger.log(JSON.stringify(r,null,2));
  return r;
}
function safe_(fn){try{const x=fn();return x==null?'':x;}catch(e){return 'UNAVAILABLE: '+e.message;}}
