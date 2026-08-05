
const MOS5D321_VERSION='1.0.0';
const MOS5D321={
  release:'MOS5-D3.2.1',
  coreWorkbookId:'1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  coreScriptId:'1dWl5ZKQ531GF3TltgAS9WHSElWXVeyhKiLjEc9cSnt3IOCyBWLi6Sy3Z',
  accounts:'SYS_ACCOUNT_REGISTRY',
  projects:'SYS_PROJECT_REGISTRY',
  rules:'SYS_DEPLOYMENT_RULES',
  vaults:'SYS_VAULT_REGISTRY',
  audit:'SYS_MULTI_ACCOUNT_AUDIT'
};

function MOS5D321_installMultiAccountRegistry(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(30000)) throw new Error('Could not obtain script lock.');
  try{
    MOS5D321_assertCore_();
    MOS5D321_ensureSheets_();
    MOS5D321_seed_();
    const d=MOS5D321_runDiagnostics();
    const out={
      success:d.overallStatus!=='FAIL',
      release:MOS5D321.release,
      version:MOS5D321_VERSION,
      overallStatus:d.overallStatus,
      passed:d.passed,
      warnings:d.warnings,
      failed:d.failed,
      ownershipMoved:false,
      triggersInstalled:false,
      communicationsActivated:false,
      routingActivated:false,
      productionChanged:false,
      completedAt:new Date().toISOString()
    };
    MOS5D321_audit_('MULTI_ACCOUNT_REGISTRY_INSTALLED',MOS5D321.release,JSON.stringify(out));
    console.log(JSON.stringify(out,null,2));
    return out;
  }finally{lock.releaseLock();}
}

function MOS5D321_runDiagnostics(){
  MOS5D321_assertCore_();
  const tests=[];
  MOS5D321_test_(tests,'CORE_WORKBOOK',
    SpreadsheetApp.getActiveSpreadsheet().getId()===MOS5D321.coreWorkbookId,
    'Correct Core workbook.','Wrong Core workbook.');
  MOS5D321_test_(tests,'CORE_SCRIPT',
    ScriptApp.getScriptId()===MOS5D321.coreScriptId,
    'Correct Core Apps Script project.','Wrong Core Apps Script project.');
  [MOS5D321.accounts,MOS5D321.projects,MOS5D321.rules,MOS5D321.vaults,MOS5D321.audit]
    .forEach(function(name){
      MOS5D321_test_(tests,name,!!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name),
        name+' is present.',name+' is missing.');
    });

  const accounts=MOS5D321_getRows_(MOS5D321.accounts,9);
  const projects=MOS5D321_getRows_(MOS5D321.projects,11);
  const vaults=MOS5D321_getRows_(MOS5D321.vaults,8);

  MOS5D321_test_(tests,'FIVE_ACCOUNTS',accounts.length===5,
    'All five enterprise accounts are registered.','Expected five accounts; found '+accounts.length+'.');
  MOS5D321_test_(tests,'SIX_PROJECTS',projects.length===6,
    'All six workbook targets are registered.','Expected six projects; found '+projects.length+'.');
  MOS5D321_test_(tests,'FIVE_VAULTS',vaults.length===5,
    'All five vaults are registered.','Expected five vaults; found '+vaults.length+'.');

  const core=projects.find(r=>String(r[0]).toUpperCase()==='CORE');
  MOS5D321_test_(tests,'CORE_LOCKED',
    !!core && String(core[3])===MOS5D321.coreScriptId && String(core[6]).toUpperCase()==='TRUE',
    'CORE is locked to the verified Script ID.','CORE lock is invalid.');

  const pending=projects.filter(r=>!String(r[3]||'').trim()).map(r=>r[0]);
  tests.push({
    code:'PENDING_SCRIPT_IDS',
    status:pending.length?'WARNING':'PASS',
    details:pending.length?'Pending verification: '+pending.join(', '):'All Script IDs registered.'
  });

  const c=tests.reduce((a,t)=>{a[t.status.toLowerCase()]++;return a;},{pass:0,warning:0,fail:0});
  const out={
    release:MOS5D321.release,
    version:MOS5D321_VERSION,
    overallStatus:c.fail?'FAIL':(c.warning?'WARNING':'PASS'),
    passed:c.pass,warnings:c.warning,failed:c.fail,
    tests:tests,
    completedAt:new Date().toISOString()
  };
  console.log(JSON.stringify(out,null,2));
  return out;
}

function MOS5D321_setProjectScriptId(targetCode,scriptId,reason){
  MOS5D321_assertCore_();
  const code=String(targetCode||'').trim().toUpperCase();
  const id=String(scriptId||'').trim();
  if(!code||!id) throw new Error('Target code and Script ID are required.');
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MOS5D321.projects);
  const rows=MOS5D321_getRows_(MOS5D321.projects,11);
  const i=rows.findIndex(r=>String(r[0]).toUpperCase()===code);
  if(i<0) throw new Error('Unknown target: '+code);
  const row=i+2;
  sh.getRange(row,4).setValue(id);
  sh.getRange(row,7).setValue(true);
  sh.getRange(row,9).setValue('REGISTERED');
  sh.getRange(row,10).setValue(new Date());
  sh.getRange(row,11).setValue(reason||'Verified Script ID');
  MOS5D321_audit_('PROJECT_SCRIPT_ID_REGISTERED',code,id);
  return {success:true,targetCode:code,scriptId:id};
}

function MOS5D321_getDeploymentAuthority(targetCode){
  const code=String(targetCode||'').trim().toUpperCase();
  const projects=MOS5D321_getRows_(MOS5D321.projects,11);
  const accounts=MOS5D321_getRows_(MOS5D321.accounts,9);
  const p=projects.find(r=>String(r[0]).toUpperCase()===code);
  if(!p) throw new Error('Unknown target: '+code);
  const a=accounts.find(r=>String(r[0]).toUpperCase()===String(p[4]).toUpperCase());
  return {
    targetCode:code,
    workbookId:p[2],
    scriptId:p[3],
    accountCode:p[4],
    accountEmail:a?a[1]:'',
    environment:p[5],
    locked:String(p[6]).toUpperCase()==='TRUE',
    active:String(p[7]).toUpperCase()==='TRUE',
    deployable:Boolean(p[3] && String(p[6]).toUpperCase()==='TRUE' && a)
  };
}

function MOS5D321_ensureSheets_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const defs=[
    [MOS5D321.accounts,['AccountCode','Email','Role','Active','DefaultTarget','TriggerAuthority','VaultCode','Notes','UpdatedAt']],
    [MOS5D321.projects,['TargetCode','TargetName','WorkbookID','ScriptID','AccountCode','Environment','Locked','Active','Status','UpdatedAt','Notes']],
    [MOS5D321.rules,['RuleCode','TargetCode','RequiredAccountCode','RequireScriptID','RequireLockedTarget','AllowTriggerInstall','AllowProduction','Status','UpdatedAt']],
    [MOS5D321.vaults,['Priority','VaultCode','Email','Purpose','Active','CurrentUsage','CapacityStatus','UpdatedAt']],
    [MOS5D321.audit,['OccurredAt','AuditID','EventType','ReferenceID','Actor','Details']]
  ];
  defs.forEach(function(d){
    let sh=ss.getSheetByName(d[0]);
    if(!sh) sh=ss.insertSheet(d[0]);
    if(sh.getLastRow()===0){
      sh.getRange(1,1,1,d[1].length).setValues([d[1]]);
      sh.setFrozenRows(1);
    }
  });
}

function MOS5D321_seed_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const now=new Date();

  const accountRows=[
    ['BROKER_CORE','melrosegroupbroker@gmail.com','Broker governance and executive control',true,'CORE',true,'VAULT_1_BROKER','Primary broker authority',now],
    ['BROKERAGE_SHARED','melrosegrouprealty@gmail.com','Shared brokerage infrastructure and recruiting',true,'MARKETING',true,'VAULT_2_REALTY','Shared services',now],
    ['LEAD_DISTRIBUTION','agentleadcentral@gmail.com','Lead distribution and servicing',true,'CRM',true,'VAULT_3_AGENTLEADCENTRAL','Lead processing',now],
    ['STAFF_OPERATIONS','melrosegroupstaff@gmail.com','Staff and operations',true,'ANALYTICS',true,'VAULT_4_STAFF','Operations workload',now],
    ['LEADS_VAULT','melrosegroupleads@gmail.com','Lead storage and overflow',true,'ARCHIVE',true,'VAULT_5_LEADS','Overflow and safety capacity',now]
  ];

  const projectRows=[
    ['CORE','MelroseOS Core','1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',MOS5D321.coreScriptId,'BROKER_CORE','DEV',true,true,'REGISTERED',now,'Verified Core target'],
    ['CRM','MelroseOS CRM','1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8','','LEAD_DISTRIBUTION','DEV',false,true,'SCRIPT_ID_PENDING',now,'Pending verification'],
    ['MARKETING','MelroseOS Marketing','1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo','','BROKERAGE_SHARED','DEV',false,true,'SCRIPT_ID_PENDING',now,'Pending verification'],
    ['WEBSITE','MelroseOS Website','1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc','','BROKERAGE_SHARED','DEV',false,true,'SCRIPT_ID_PENDING',now,'Pending verification'],
    ['ANALYTICS','MelroseOS Analytics','1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU','','STAFF_OPERATIONS','DEV',false,true,'SCRIPT_ID_PENDING',now,'Pending verification'],
    ['ARCHIVE','MelroseOS Archive','1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk','','LEADS_VAULT','DEV',false,true,'SCRIPT_ID_PENDING',now,'Pending verification']
  ];

  const ruleRows=projectRows.map(r=>['DEPLOY_'+r[0],r[0],r[4],true,true,false,false,'ACTIVE',now]);

  const vaultRows=[
    [1,'VAULT_1_BROKER','melrosegroupbroker@gmail.com','Primary broker vault',true,'','NOT_MEASURED',now],
    [2,'VAULT_2_REALTY','melrosegrouprealty@gmail.com','Shared brokerage vault',true,'','NOT_MEASURED',now],
    [3,'VAULT_3_AGENTLEADCENTRAL','agentleadcentral@gmail.com','Lead distribution vault',true,'','NOT_MEASURED',now],
    [4,'VAULT_4_STAFF','melrosegroupstaff@gmail.com','Operations vault',true,'','NOT_MEASURED',now],
    [5,'VAULT_5_LEADS','melrosegroupleads@gmail.com','Lead storage and overflow vault',true,'','NOT_MEASURED',now]
  ];

  MOS5D321_seedSheet_(MOS5D321.accounts,accountRows);
  MOS5D321_seedSheet_(MOS5D321.projects,projectRows);
  MOS5D321_seedSheet_(MOS5D321.rules,ruleRows);
  MOS5D321_seedSheet_(MOS5D321.vaults,vaultRows);
}

function MOS5D321_seedSheet_(name,rows){
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if(sh.getLastRow()>1) return;
  sh.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}

function MOS5D321_getRows_(name,width){
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if(!sh||sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,width).getDisplayValues();
}

function MOS5D321_test_(tests,code,ok,passDetail,failDetail){
  tests.push({code:code,status:ok?'PASS':'FAIL',details:ok?passDetail:failDetail});
}

function MOS5D321_audit_(eventType,referenceId,details){
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MOS5D321.audit);
  sh.appendRow([
    new Date(),
    'AUD-'+Utilities.getUuid().slice(0,8).toUpperCase(),
    eventType,
    referenceId||'',
    Session.getEffectiveUser().getEmail()||'UNAVAILABLE',
    details||''
  ]);
}

function MOS5D321_assertCore_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss) throw new Error('This script must be bound to MelroseOS Core.');
  if(ss.getId()!==MOS5D321.coreWorkbookId) throw new Error('Wrong Core workbook.');
  if(ScriptApp.getScriptId()!==MOS5D321.coreScriptId) throw new Error('Wrong Core Apps Script project.');
}
