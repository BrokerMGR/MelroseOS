/**
 * MOS5 CRM-124 - Recruit Production Trigger
 */
function MGR_RECRUIT_removeProductionTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'MGR_RECRUIT_productionTick') ScriptApp.deleteTrigger(t);
  });
}

function MGR_RECRUIT_installProductionTrigger_() {
  MGR_RECRUIT_removeProductionTriggers_();
  ScriptApp.newTrigger('MGR_RECRUIT_productionTick').timeBased().everyMinutes(15).create();
  return true;
}

function MGR_RECRUIT_triggerCount_() {
  return ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'MGR_RECRUIT_productionTick').length;
}
