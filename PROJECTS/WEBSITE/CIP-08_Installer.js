
function CIP_installClientIntelligencePlatform(){
  const init=CIP_initializePlatform();
  ScriptApp.getProjectTriggers().forEach(t=>{if(t.getHandlerFunction()==="CIP_syncLeadPortals")ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("CIP_syncLeadPortals").timeBased().everyMinutes(5).create();
  return{success:true,version:CIP.VERSION,initialized:init,sync:CIP_syncLeadPortals(),triggerCount:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="CIP_syncLeadPortals").length};
}
function CIP_getPlatformStatus(){
  const ss=CIP_websiteWorkbook_(),r={version:CIP.VERSION,portalRecords:Math.max(0,ss.getSheetByName(CIP.SHEETS.REGISTRY).getLastRow()-1),profiles:Math.max(0,ss.getSheetByName(CIP.SHEETS.PROFILES).getLastRow()-1),vendors:Math.max(0,ss.getSheetByName(CIP.SHEETS.VENDORS).getLastRow()-1),activity:Math.max(0,ss.getSheetByName(CIP.SHEETS.ACTIVITY).getLastRow()-1),syncTriggers:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="CIP_syncLeadPortals").length,webAppUrl:ScriptApp.getService().getUrl()||""};
  Logger.log(JSON.stringify(r,null,2));return r;
}
function CIP_testPlatform(){
  CIP_initializePlatform();
  const out={success:true,sync:CIP_syncLeadPortals(),communicationFoundation:CIP_getCommunicationFoundationStatus()};
  Logger.log(JSON.stringify(out,null,2));return true;
}
