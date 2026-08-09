/******************************************************************************
 * MelroseOS Enterprise
 * File: INV-07_AutomationScanner.gs
 * Version: 1.0.0
 * Requires: INV-01_Core.gs
 ******************************************************************************/
const M5_AUTOMATION_SHEET="AUTOMATION_INVENTORY";
const M5_AUTOMATION_WARNING_SHEET="AUTOMATION_WARNINGS";

function M5_runAutomationScanner(){
  const ss=workbook_();
  const inv=createSheetIfMissing_(ss,M5_AUTOMATION_SHEET);
  const warn=createSheetIfMissing_(ss,M5_AUTOMATION_WARNING_SHEET);
  clearSheet_(inv); clearSheet_(warn);

  const ih=["AutomationID","Handler Function","Trigger Source","Event Type","Source ID","Unique ID","Duplicate Count","Status","Scanned"];
  const wh=["WarningID","Severity","Handler Function","Warning Type","Details","Recommendation","Detected"];
  setHeaders_(inv,ih); setHeaders_(warn,wh);

  const triggers=ScriptApp.getProjectTriggers();
  const counts={};
  const items=[];

  triggers.forEach(function(t){
    const x={
      handler:t.getHandlerFunction()||"",
      source:String(t.getTriggerSource()||""),
      eventType:String(t.getEventType()||""),
      sourceId:M5_safeTriggerSourceId_(t),
      uniqueId:M5_safeTriggerUniqueId_(t)
    };
    x.key=[x.handler,x.source,x.eventType,x.sourceId].join("|");
    counts[x.key]=(counts[x.key]||0)+1;
    items.push(x);
  });

  const invRows=[], warningRows=[];
  items.forEach(function(x){
    const n=counts[x.key];
    invRows.push([
      "AUT-"+Utilities.getUuid().substring(0,8).toUpperCase(),
      x.handler,x.source,x.eventType,x.sourceId,x.uniqueId,n,
      n>1?"DUPLICATE_REVIEW":"ACTIVE",timestamp_()
    ]);
    if(n>1){
      warningRows.push([
        "WARN-"+Utilities.getUuid().substring(0,8).toUpperCase(),
        "HIGH",x.handler,"DUPLICATE_TRIGGER",
        n+" matching triggers detected.",
        "Review and remove unintended duplicate triggers.",timestamp_()
      ]);
    }
  });

  if(invRows.length) inv.getRange(2,1,invRows.length,ih.length).setValues(invRows);
  if(warningRows.length) warn.getRange(2,1,warningRows.length,wh.length).setValues(warningRows);

  M5_formatAutomationSheet_(inv);
  M5_formatAutomationSheet_(warn);

  setDocProperty_("M5_LAST_AUTOMATION_SCAN",new Date().toISOString());
  setDocProperty_("M5_AUTOMATION_TRIGGER_COUNT",String(triggers.length));
  setDocProperty_("M5_AUTOMATION_WARNING_COUNT",String(warningRows.length));

  return {success:true,triggersFound:triggers.length,warningsFound:warningRows.length};
}

function M5_safeTriggerSourceId_(trigger){
  try{return trigger.getTriggerSourceId()||"";}catch(e){return "";}
}

function M5_safeTriggerUniqueId_(trigger){
  try{return trigger.getUniqueId()||"";}catch(e){return "";}
}

function M5_removeDuplicateTriggersForHandler(handlerName){
  if(!handlerName) throw new Error("Handler name is required.");
  const ts=ScriptApp.getProjectTriggers().filter(function(t){
    return t.getHandlerFunction()===handlerName;
  });
  let removed=0;
  ts.slice(1).forEach(function(t){ScriptApp.deleteTrigger(t);removed++;});
  return {handler:handlerName,found:ts.length,removed:removed};
}

function M5_getAutomationSummary(){
  const ss=workbook_();
  const inv=ss.getSheetByName(M5_AUTOMATION_SHEET);
  const warn=ss.getSheetByName(M5_AUTOMATION_WARNING_SHEET);
  return {
    lastRun:getDocProperty_("M5_LAST_AUTOMATION_SCAN")||"",
    triggersFound:inv?Math.max(inv.getLastRow()-1,0):0,
    warningsFound:warn?Math.max(warn.getLastRow()-1,0):0
  };
}

function M5_resetAutomationScanner(){
  const ss=workbook_();
  [M5_AUTOMATION_SHEET,M5_AUTOMATION_WARNING_SHEET].forEach(function(n){
    const s=ss.getSheetByName(n); if(s) clearSheet_(s);
  });
  setDocProperty_("M5_LAST_AUTOMATION_SCAN","");
  setDocProperty_("M5_AUTOMATION_TRIGGER_COUNT","0");
  setDocProperty_("M5_AUTOMATION_WARNING_COUNT","0");
  return true;
}

function M5_formatAutomationSheet_(sheet){
  sheet.setFrozenRows(1);
  if(sheet.getLastRow()>1&&!sheet.getFilter()) sheet.getDataRange().createFilter();
  autoResize_(sheet);
}

function M5_testAutomationScanner(){
  const r=M5_runAutomationScanner();
  Logger.log(JSON.stringify(r));
  Logger.log(JSON.stringify(M5_getAutomationSummary()));
  if(!r.success) throw new Error("Automation scanner failed.");
  return true;
}
