/**
 * ==========================================================
 * MELROSEOS 4.0 — CORE UPGRADE MANAGER
 * Version 4.0.0
 * ==========================================================
 */

const M4_UPGRADE = {
  VERSION:'4.0.0',
  MODULE:'CORE_UPGRADE_MANAGER',
  SHEETS:{
    HISTORY:'MelroseOS_UpgradeHistory',
    PENDING:'MelroseOS_UpgradeQueue'
  }
};

function setupMelroseCoreUpgradeManager(){
  const ss=m4_getCommandCenter_();

  m4_ensureSheet_(ss,M4_UPGRADE.SHEETS.HISTORY,
    ['UpgradeID','StartedAt','CompletedAt','FromVersion','ToVersion','Status','ExecutedBy','Notes'],
    {frozenRows:1});

  m4_ensureSheet_(ss,M4_UPGRADE.SHEETS.PENDING,
    ['UpgradeKey','Description','Status','Priority','CreatedAt'],
    {frozenRows:1});

  if(typeof registerMelroseEngine==='function'){
    registerMelroseEngine({
      componentKey:'ENGINE.CORE_UPGRADE_MANAGER',
      engineName:'Core Upgrade Manager',
      module:'CORE',
      version:M4_UPGRADE.VERSION,
      setupFunction:'setupMelroseCoreUpgradeManager',
      requiredSheet:M4_UPGRADE.SHEETS.HISTORY,
      required:true,
      description:'Controls MelroseOS upgrades.'
    });
  }

  return {success:true,version:M4_UPGRADE.VERSION};
}

function runMelroseCoreUpgrade(){
  const ss=m4_getCommandCenter_();
  const sheet=ss.getSheetByName(M4_UPGRADE.SHEETS.HISTORY);

  const fromVersion=(typeof m4_getSetting_==='function')
    ? (m4_getSetting_('SYSTEM_VERSION')||'UNKNOWN')
    : 'UNKNOWN';

  if(typeof installOrUpgradeMelroseOS==='function'){
    installOrUpgradeMelroseOS('FULL_SYSTEM');
  }

  if(typeof refreshMelroseCoreRegistry==='function'){
    refreshMelroseCoreRegistry();
  }

  if(typeof refreshMelroseArchitecture==='function'){
    refreshMelroseArchitecture();
  }

  if(typeof runMelroseCoreHealthMonitor==='function'){
    runMelroseCoreHealthMonitor();
  }

  const toVersion=M4_UPGRADE.VERSION;

  if(typeof m4_setSetting_==='function'){
    m4_setSetting_('SYSTEM_VERSION',toVersion,{
      type:'STRING',
      category:'SYSTEM',
      description:'Installed system version.',
      required:true
    });
  }

  sheet.appendRow([
    m4_createID_('UPGRADE'),
    new Date(),
    new Date(),
    fromVersion,
    toVersion,
    'SUCCESS',
    Session.getEffectiveUser().getEmail(),
    ''
  ]);

  return {
    success:true,
    fromVersion,
    toVersion
  };
}

function queueMelroseUpgrade(description,priority){
  const ss=m4_getCommandCenter_();
  const sheet=ss.getSheetByName(M4_UPGRADE.SHEETS.PENDING);
  sheet.appendRow([
    m4_createID_('TASK'),
    description||'Upgrade Task',
    'PENDING',
    priority||'NORMAL',
    new Date()
  ]);
}

function openMelroseUpgradeHistory(){
  const ss=m4_getCommandCenter_();
  ss.setActiveSheet(ss.getSheetByName(M4_UPGRADE.SHEETS.HISTORY));
}

function testMelroseCoreUpgradeManager(){
  const ss=m4_getCommandCenter_();
  return{
    success:Boolean(ss.getSheetByName(M4_UPGRADE.SHEETS.HISTORY)),
    version:M4_UPGRADE.VERSION
  };
}
