/**
 * MOS5-M1-B v1.0.0 — Controlled Legacy Outbound Shutdown
 *
 * TARGET IDENTITY: melrosegrouprealty@gmail.com
 * TARGET PROJECT: 1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd
 * TARGET HANDLER: OP_runOperationsCycle
 * TARGET TRIGGER ID observed in M1-A10: 3192736676900241408
 *
 * SAFETY DESIGN:
 * - PREVIEW is read-only.
 * - EXECUTE requires exact confirmation phrase.
 * - Fails closed if identity, trigger ID, handler, event type, or trigger source changed.
 * - Deletes ONLY the exact verified target trigger.
 * - Does not execute legacy handlers.
 * - Does not send email or mutate Gmail/CRM/lead ownership.
 */

const MOS5_M1B = Object.freeze({
  release:'MOS5-M1-B',
  version:'1.0.0',
  expectedIdentity:'melrosegrouprealty@gmail.com',
  expectedProjectId:'1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd',
  targetTriggerId:'3192736676900241408',
  targetHandler:'OP_runOperationsCycle',
  expectedEventType:'CLOCK',
  expectedTriggerSource:'CLOCK',
  confirmation:'DISABLE OP_runOperationsCycle 3192736676900241408'
});

function MOS5P_previewM1BControlledShutdown(){
  const audit=MOS5M1B_audit_();
  const r={
    success:audit.ready,
    release:MOS5_M1B.release,
    version:MOS5_M1B.version,
    mode:'PREVIEW_READ_ONLY',
    audit:audit,
    requiredConfirmation:MOS5_M1B.confirmation,
    mutationPerformed:false,
    result:audit.ready?'READY_FOR_CONTROLLED_SHUTDOWN':'BLOCKED'
  };
  Logger.log(JSON.stringify(r,null,2));
  return r;
}

function MOS5P_executeM1BControlledShutdown(confirmation){
  if(String(confirmation||'')!==MOS5_M1B.confirmation){
    throw new Error('M1B_CONFIRMATION_MISMATCH. Run preview first. Exact confirmation required: '+MOS5_M1B.confirmation);
  }

  const before=MOS5M1B_audit_();
  if(!before.ready){
    throw new Error('M1B_FAIL_CLOSED_PRECHECK: '+before.blockReason);
  }

  // Persist rollback evidence BEFORE mutation.
  const props=PropertiesService.getScriptProperties();
  const rollback={
    release:MOS5_M1B.release,
    version:MOS5_M1B.version,
    disabledAt:new Date().toISOString(),
    identity:before.effectiveUser,
    projectId:MOS5_M1B.expectedProjectId,
    triggerId:MOS5_M1B.targetTriggerId,
    handler:MOS5_M1B.targetHandler,
    eventType:MOS5_M1B.expectedEventType,
    triggerSource:MOS5_M1B.expectedTriggerSource,
    restoration:{
      handler:MOS5_M1B.targetHandler,
      note:'Original trigger was CLOCK-based. Exact cadence is intentionally not guessed by M1-B. Recover cadence from prior installer/source evidence before recreation.'
    }
  };
  props.setProperty('MOS5_M1B_ROLLBACK_RECORD',JSON.stringify(rollback));

  const triggers=ScriptApp.getProjectTriggers();
  const matches=triggers.filter(t=>String(t.getUniqueId())===MOS5_M1B.targetTriggerId);
  if(matches.length!==1) throw new Error('M1B_FAIL_CLOSED_TARGET_COUNT_CHANGED:'+matches.length);

  // Final just-in-time identity/handler verification.
  const t=matches[0];
  if(String(t.getHandlerFunction())!==MOS5_M1B.targetHandler) throw new Error('M1B_FAIL_CLOSED_HANDLER_CHANGED');
  if(String(t.getEventType())!==MOS5_M1B.expectedEventType) throw new Error('M1B_FAIL_CLOSED_EVENT_CHANGED');
  if(String(t.getTriggerSource())!==MOS5_M1B.expectedTriggerSource) throw new Error('M1B_FAIL_CLOSED_SOURCE_CHANGED');

  ScriptApp.deleteTrigger(t);

  const afterTriggers=ScriptApp.getProjectTriggers();
  const targetStillPresent=afterTriggers.some(x=>String(x.getUniqueId())===MOS5_M1B.targetTriggerId || String(x.getHandlerFunction())===MOS5_M1B.targetHandler);

  if(targetStillPresent) throw new Error('M1B_POSTCHECK_FAILED_TARGET_STILL_PRESENT');

  const r={
    success:true,
    release:MOS5_M1B.release,
    version:MOS5_M1B.version,
    mode:'CONTROLLED_SINGLE_TRIGGER_SHUTDOWN',
    disabled:{
      triggerId:MOS5_M1B.targetTriggerId,
      handler:MOS5_M1B.targetHandler
    },
    triggerCountBefore:before.triggerCount,
    triggerCountAfter:afterTriggers.length,
    targetStillPresent:false,
    rollbackRecordStored:true,
    untouchedHandlers:afterTriggers.map(x=>String(x.getHandlerFunction())),
    safety:{
      onlyExactTargetDeleted:true,
      legacyHandlerExecuted:false,
      emailSent:false,
      gmailMutationPerformed:false,
      spreadsheetMutationPerformed:false,
      crmMutationPerformed:false,
      leadAssignmentPerformed:false,
      leadOwnershipChanged:false,
      otherTriggersDeleted:false
    },
    nextGate:'RUN M1-B POSTCHECK, THEN OBSERVE SENT MAIL FOR LEGACY BUYER/SELLER COMMUNICATIONS',
    result:'PASS'
  };
  Logger.log(JSON.stringify(r,null,2));
  return r;
}

function MOS5P_postcheckM1B(){
  const triggers=ScriptApp.getProjectTriggers();
  const target=triggers.filter(t=>
    String(t.getUniqueId())===MOS5_M1B.targetTriggerId ||
    String(t.getHandlerFunction())===MOS5_M1B.targetHandler
  );
  const rollback=PropertiesService.getScriptProperties().getProperty('MOS5_M1B_ROLLBACK_RECORD');
  const r={
    success:target.length===0,
    release:MOS5_M1B.release,
    mode:'POST_SHUTDOWN_VERIFICATION_READ_ONLY',
    targetTriggerPresent:target.length>0,
    triggerCount:triggers.length,
    remainingHandlers:triggers.map(t=>String(t.getHandlerFunction())),
    rollbackRecordPresent:!!rollback,
    emailSent:false,
    gmailMutationPerformed:false,
    result:target.length===0?'PASS':'FAIL'
  };
  Logger.log(JSON.stringify(r,null,2));
  if(target.length) throw new Error('M1B_POSTCHECK_TARGET_PRESENT');
  return r;
}

function MOS5M1B_audit_(){
  const effective=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  const active=String(Session.getActiveUser().getEmail()||'').toLowerCase();
  const triggers=ScriptApp.getProjectTriggers();
  const byId=triggers.filter(t=>String(t.getUniqueId())===MOS5_M1B.targetTriggerId);
  const byHandler=triggers.filter(t=>String(t.getHandlerFunction())===MOS5_M1B.targetHandler);

  let block='';
  if(effective!==MOS5_M1B.expectedIdentity) block='WRONG_EFFECTIVE_USER';
  else if(byId.length!==1) block='TARGET_TRIGGER_ID_COUNT_'+byId.length;
  else if(byHandler.length!==1) block='TARGET_HANDLER_COUNT_'+byHandler.length;
  else if(String(byId[0].getHandlerFunction())!==MOS5_M1B.targetHandler) block='TRIGGER_ID_HANDLER_MISMATCH';
  else if(String(byId[0].getEventType())!==MOS5_M1B.expectedEventType) block='EVENT_TYPE_MISMATCH';
  else if(String(byId[0].getTriggerSource())!==MOS5_M1B.expectedTriggerSource) block='TRIGGER_SOURCE_MISMATCH';

  return {
    ready:!block,
    blockReason:block,
    expectedIdentity:MOS5_M1B.expectedIdentity,
    effectiveUser:effective,
    activeUser:active,
    identityConfirmed:effective===MOS5_M1B.expectedIdentity,
    expectedProjectId:MOS5_M1B.expectedProjectId,
    triggerCount:triggers.length,
    targetTriggerId:MOS5_M1B.targetTriggerId,
    targetHandler:MOS5_M1B.targetHandler,
    targetByIdCount:byId.length,
    targetByHandlerCount:byHandler.length,
    targetEventType:byId.length?String(byId[0].getEventType()):'',
    targetTriggerSource:byId.length?String(byId[0].getTriggerSource()):'',
    allHandlers:triggers.map(t=>String(t.getHandlerFunction()))
  };
}
function MOS5P_confirmAndExecuteM1BShutdown() {
  return MOS5P_executeM1BControlledShutdown(
    'DISABLE OP_runOperationsCycle 3192736676900241408'
  );
}