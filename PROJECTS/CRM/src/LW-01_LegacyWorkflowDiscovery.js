/******************************************************************************
 * MelroseOS Legacy Workflow Discovery + Safe Pause Manager
 * LW-01_LegacyWorkflowDiscovery.gs
 * REPORT FIRST. No trigger is removed unless explicitly paused by unique ID.
 ******************************************************************************/

const LW={VERSION:"1.0.0",REPORT:"LW_LEGACY_WORKFLOW_AUDIT",BACKUP:"LW_TRIGGER_BACKUP"};

function LW_installDiscoveryManager(){
  const ss=workbook_();
  UI_ensureSheet_(ss,LW.REPORT,["AuditID","Project","FunctionName","EventType","Source","RiskClass","Recommendation","AuditedAt"]);
  UI_ensureSheet_(ss,LW.BACKUP,["BackupID","FunctionName","EventType","TriggerSource","SourceId","CreatedAt","PausedAt","RestoreNotes"]);
  return LW_discoverCurrentProjectTriggers();
}

function LW_discoverCurrentProjectTriggers(){
  const triggers=ScriptApp.getProjectTriggers();
  const rows=triggers.map(function(t){
    const fn=t.getHandlerFunction();
    const risk=LW_classify_(fn);
    return {
      functionName:fn,
      eventType:String(t.getEventType()),
      source:String(t.getTriggerSource()),
      riskClass:risk,
      recommendation:risk==="OUTBOUND_RECRUITING"||risk==="LEGACY_GMAIL_INTAKE"?"REVIEW_FOR_CONTROLLED_PAUSE":"PRESERVE_UNLESS_CONFIRMED"
    };
  });
  const sh=workbook_().getSheetByName(LW.REPORT);
  rows.forEach(function(r){
    sh.appendRow([UI_uuid_("AUD"),"CURRENT_PROJECT",r.functionName,r.eventType,r.source,r.riskClass,r.recommendation,new Date()]);
  });
  const out={success:true,reportOnly:true,triggers:rows};
  Logger.log(JSON.stringify(out,null,2)); return out;
}

function LW_previewPauseCandidates(){
  const rows=UI_objects_(workbook_().getSheetByName(LW.REPORT)).filter(function(r){
    return String(r.Recommendation)==="REVIEW_FOR_CONTROLLED_PAUSE";
  });
  const out={success:true,mode:"PREVIEW_ONLY",candidates:rows};
  Logger.log(JSON.stringify(out,null,2)); return out;
}

function LW_classify_(fn){
  const s=String(fn||"").toLowerCase();
  if(/recruit|prospect|campaign/.test(s)&&/send|queue|run|follow/.test(s))return "OUTBOUND_RECRUITING";
  if(/leadimport|gmail|newlead|intake/.test(s))return "LEGACY_GMAIL_INTAKE";
  if(/reply|appointment|calendar|confirm|reschedule|unsubscribe/.test(s))return "PRESERVE_SUPPORT_FUNCTION";
  return "UNKNOWN_REVIEW";
}
