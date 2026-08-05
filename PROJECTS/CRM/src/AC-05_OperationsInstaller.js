/******************************************************************************
 * File: AC-05_OperationsInstaller.gs
 * Version: 1.0.0
 ******************************************************************************/

function AC_runAccountabilityCycle() {
  AC_initialize();

  const result={
    success:true,
    sync:null,
    contacts:null,
    alerts:null,
    metrics:null,
    errors:[]
  };

  try { result.sync=AC_syncAssignedLeads(500); }
  catch(e){result.success=false;result.errors.push("Sync: "+(e.message||e));}

  try { result.contacts=AC_detectFirstContacts(); }
  catch(e){result.success=false;result.errors.push("Contacts: "+(e.message||e));}

  try { result.alerts=AC_processSLAAlerts(); }
  catch(e){result.success=false;result.errors.push("Alerts: "+(e.message||e));}

  try { result.metrics=AC_refreshAgentMetrics(); }
  catch(e){result.success=false;result.errors.push("Metrics: "+(e.message||e));}

  return result;
}

function AC_installAccountabilityAutomation() {
  AC_initialize();

  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction()==="AC_runAccountabilityCycle") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("AC_runAccountabilityCycle")
    .timeBased()
    .everyMinutes(5)
    .create();

  return {
    success:true,
    triggers:ScriptApp.getProjectTriggers().filter(function(t){
      return t.getHandlerFunction()==="AC_runAccountabilityCycle";
    }).length,
    initialRun:AC_runAccountabilityCycle()
  };
}

function AC_getAccountabilityStatus() {
  return {
    version:AC.VERSION,
    triggers:ScriptApp.getProjectTriggers().filter(function(t){
      return t.getHandlerFunction()==="AC_runAccountabilityCycle";
    }).length,
    config:AC_getConfig_(),
    trackedLeads:AC_objects_(AC.SHEETS.TRACKING).length,
    alerts:AC_objects_(AC.SHEETS.ALERTS).length,
    agentsMeasured:AC_objects_(AC.SHEETS.METRICS).length
  };
}

function AC_testAccountabilityModule() {
  const result=AC_runAccountabilityCycle();
  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(AC_getAccountabilityStatus()));
  if (!result.success) throw new Error("Accountability module test found errors.");
  return true;
}
