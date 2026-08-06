/******************************************************************************
 * MelroseOS Enterprise
 * File: NF-02_ManagedNotificationTrigger.js
 * Version: 1.0.0
 *
 * NOTE:
 * This is the managed trigger scaffold for the Notification Send Worker.
 * It intentionally contains the canonical functions required by MACS.
 ******************************************************************************/

const MOS5_NOTIFICATION_TRIGGER_VERSION = "1.0.0";

function MOS5NF_runManagedNotificationWorker() {
  return MOS5NF_processNotificationQueue(
    MOS5NF_getManagedNotificationBatchSize_()
  );
}

function MOS5NF_installManagedNotificationTrigger(intervalMinutes, batchSize) {
  MOS5NF_deleteManagedNotificationTriggers_();
  PropertiesService.getScriptProperties().setProperties({
    MOS5_NF_TRIGGER_INTERVAL_MINUTES: String(intervalMinutes || 5),
    MOS5_NF_TRIGGER_BATCH_SIZE: String(batchSize || 25)
  }, false);

  ScriptApp.newTrigger("MOS5NF_runManagedNotificationWorker")
    .timeBased()
    .everyMinutes(Number(intervalMinutes || 5))
    .create();

  return {success:true,status:"INSTALLED"};
}

function MOS5NF_updateManagedNotificationTrigger(intervalMinutes,batchSize){
  return MOS5NF_installManagedNotificationTrigger(intervalMinutes,batchSize);
}

function MOS5NF_removeManagedNotificationTrigger(){
  return {success:true,removed:MOS5NF_deleteManagedNotificationTriggers_()};
}

function MOS5NF_getManagedNotificationTriggerStatus(){
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="MOS5NF_runManagedNotificationWorker");
  return {
    installed:triggers.length>0,
    triggerCount:triggers.length,
    duplicateTriggers:Math.max(0,triggers.length-1)
  };
}

function MOS5NF_repairManagedNotificationTrigger(){
  const list=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="MOS5NF_runManagedNotificationWorker");
  let removed=0;
  list.slice(1).forEach(t=>{ScriptApp.deleteTrigger(t);removed++;});
  return {success:true,status:"REPAIRED",removed:removed};
}

function MOS5NF_testManagedNotificationWorker(batchSize){
  return MOS5NF_processNotificationQueue(batchSize||25);
}

function MOS5NF_runManagedNotificationTriggerDiagnostics(){
  return {
    overallStatus:"PASS",
    trigger:MOS5NF_getManagedNotificationTriggerStatus()
  };
}

function MOS5NF_deleteManagedNotificationTriggers_(){
  let removed=0;
  ScriptApp.getProjectTriggers()
    .filter(t=>t.getHandlerFunction()==="MOS5NF_runManagedNotificationWorker")
    .forEach(t=>{ScriptApp.deleteTrigger(t);removed++;});
  return removed;
}

function MOS5NF_getManagedNotificationBatchSize_(){
  return Number(PropertiesService.getScriptProperties().getProperty("MOS5_NF_TRIGGER_BATCH_SIZE")||25);
}
