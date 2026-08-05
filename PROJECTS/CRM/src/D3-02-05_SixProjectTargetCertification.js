const MOS5D325_VERSION='1.0.1';
const MOS5D325_CONFIG=Object.freeze({
  release:'MOS5-D3.2.5',
  environment:'DEV',
  coreWorkbookId:'1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  certificationSheet:'SYS_TARGET_CERTIFICATION',
  projectRegistrySheet:'SYS_PROJECT_REGISTRY',
  targets:{
    CORE:{workbookId:'1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',scriptId:'1dWl5ZKQ531GF3TltgAS9WHSElWXVeyhKiLjEc9cSnt3IOCyBWLi6Sy3Z',accountCode:'BROKER_CORE',accountEmail:'melrosegroupbroker@gmail.com'},
    CRM:{workbookId:'1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',scriptId:'1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd',accountCode:'LEAD_DISTRIBUTION',accountEmail:'agentleadcentral@gmail.com'},
    MARKETING:{workbookId:'1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo',scriptId:'1jqUR4xA4y9yK1amiQ1eCIMmkOb0t5UBilNVa8YkyryBSnpFRYV_GqXtU',accountCode:'BROKERAGE_SHARED',accountEmail:'melrosegrouprealty@gmail.com'},
    WEBSITE:{workbookId:'1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc',scriptId:'1gbTJrTrD46FQsnrNvWr9_8Z2NA5Rwn5AgchEDK-JIbjv_acY2iPN94oP',accountCode:'BROKERAGE_SHARED',accountEmail:'melrosegrouprealty@gmail.com'},
    ANALYTICS:{workbookId:'1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU',scriptId:'1mqRPOAnCfIrSIILX6SrT7PPPi02gv1H0kpFN-5gABtJC-pFcbZ0xJhDI',accountCode:'STAFF_OPERATIONS',accountEmail:'melrosegroupstaff@gmail.com'},
    ARCHIVE:{workbookId:'1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk',scriptId:'1ual3-PPEc66CiE_kK03W2GgQoqk_S938XYKyzh_97GYR4IWzps3Z6Pv4',accountCode:'LEADS_VAULT',accountEmail:'melrosegroupleads@gmail.com'}
  }
});

function MOS5D325_runTargetCertification(){
  const actualScriptId=ScriptApp.getScriptId();
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss) throw new Error('Validator must run from a spreadsheet-bound project.');
  const actualWorkbookId=ss.getId();
  const targetCode=Object.keys(MOS5D325_CONFIG.targets).find(function(code){
    return MOS5D325_CONFIG.targets[code].scriptId===actualScriptId;
  });
  if(!targetCode) throw new Error('Unregistered Script ID: '+actualScriptId);
  const expected=MOS5D325_CONFIG.targets[targetCode];
  const registry=MOS5D325_readRegistry_(targetCode);
  const tests=[];
  MOS5D325_add_(tests,'SCRIPT_ID_MATCH',actualScriptId===expected.scriptId);
  MOS5D325_add_(tests,'WORKBOOK_ID_MATCH',actualWorkbookId===expected.workbookId);
  MOS5D325_add_(tests,'CORE_REGISTRY_MATCH',Boolean(registry&&registry.workbookId===expected.workbookId&&registry.scriptId===expected.scriptId&&registry.accountCode===expected.accountCode&&registry.locked));
  MOS5D325_add_(tests,'ENVIRONMENT_DEV',!registry||registry.environment==='DEV');
  const triggers=ScriptApp.getProjectTriggers();
  MOS5D325_add_(tests,'TRIGGER_INVENTORY_READABLE',Array.isArray(triggers));
  const props=PropertiesService.getScriptProperties().getProperties();
  MOS5D325_add_(tests,'COMMUNICATIONS_NOT_AFFIRMATIVELY_ENABLED',MOS5D325_enabled_(props,['COMMUNICATIONS_ENABLED','EMAIL_ENABLED','LIVE_EMAIL_ENABLED','CAMPAIGNS_ENABLED','OUTBOUND_ENABLED','PRODUCTION_EMAIL_ENABLED']).length===0);
  MOS5D325_add_(tests,'ROUTING_NOT_AFFIRMATIVELY_ENABLED',MOS5D325_enabled_(props,['LIVE_ROUTING_ENABLED','ROUTING_ENABLED','ROUND_ROBIN_ENABLED','LEAD_INTAKE_ENABLED']).length===0);

  const counts=tests.reduce(function(a,t){a[t.status.toLowerCase()]++;return a;},{pass:0,warning:0,fail:0});
  const result={
    release:MOS5D325_CONFIG.release,
    version:MOS5D325_VERSION,
    targetCode:targetCode,
    expectedAccountCode:expected.accountCode,
    expectedAccountEmail:expected.accountEmail,
    actualEffectiveUser:Session.getEffectiveUser().getEmail()||'UNAVAILABLE',
    actualScriptId:actualScriptId,
    actualWorkbookId:actualWorkbookId,
    workbookName:ss.getName(),
    environment:registry?registry.environment:'DEV',
    overallStatus:counts.fail?'FAIL':(counts.warning?'WARNING':'PASS'),
    passed:counts.pass,warnings:counts.warning,failed:counts.fail,
    triggerCount:triggers.length,
    tests:tests,
    completedAt:new Date().toISOString()
  };
  MOS5D325_write_(result);
  console.log(JSON.stringify(result,null,2));
  return result;
}

function MOS5D325_getConsolidatedCertification(){
  const core=SpreadsheetApp.openById(MOS5D325_CONFIG.coreWorkbookId);
  const sh=core.getSheetByName(MOS5D325_CONFIG.certificationSheet);
  if(!sh||sh.getLastRow()<2) return {overallStatus:'INCOMPLETE',missingTargets:Object.keys(MOS5D325_CONFIG.targets)};
  const rows=sh.getRange(2,1,sh.getLastRow()-1,17).getDisplayValues();
  const latest={};
  rows.forEach(function(r){latest[String(r[2]).toUpperCase()]={status:r[10],certifiedAt:r[0]};});
  const all=Object.keys(MOS5D325_CONFIG.targets);
  const missing=all.filter(function(c){return !(c in latest);});
  const failed=all.filter(function(c){return latest[c]&&latest[c].status!=='PASS';});
  return {overallStatus:missing.length?'INCOMPLETE':(failed.length?'FAIL':'PASS'),certifiedTargets:latest,missingTargets:missing,failedTargets:failed,evaluatedAt:new Date().toISOString()};
}

function MOS5D325_readRegistry_(code){
  const core=SpreadsheetApp.openById(MOS5D325_CONFIG.coreWorkbookId);
  const sh=core.getSheetByName(MOS5D325_CONFIG.projectRegistrySheet);
  if(!sh||sh.getLastRow()<2) return null;
  const row=sh.getRange(2,1,sh.getLastRow()-1,11).getDisplayValues().find(function(r){return String(r[0]).toUpperCase()===code;});
  return row?{workbookId:row[2],scriptId:row[3],accountCode:row[4],environment:row[5],locked:String(row[6]).toUpperCase()==='TRUE'}:null;
}

function MOS5D325_write_(r){
  const core=SpreadsheetApp.openById(MOS5D325_CONFIG.coreWorkbookId);
  let sh=core.getSheetByName(MOS5D325_CONFIG.certificationSheet);
  if(!sh) sh=core.insertSheet(MOS5D325_CONFIG.certificationSheet);
  if(sh.getLastRow()===0){
    sh.getRange(1,1,1,17).setValues([['CertifiedAt','CertificationID','TargetCode','WorkbookName','ActualWorkbookID','ActualScriptID','ExpectedAccountCode','ExpectedAccountEmail','EffectiveUser','Environment','OverallStatus','Passed','Warnings','Failed','TriggerCount','Release','DetailsJSON']]);
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(),'CERT-'+Utilities.getUuid().slice(0,8).toUpperCase(),r.targetCode,r.workbookName,r.actualWorkbookId,r.actualScriptId,r.expectedAccountCode,r.expectedAccountEmail,r.actualEffectiveUser,r.environment,r.overallStatus,r.passed,r.warnings,r.failed,r.triggerCount,r.release,JSON.stringify(r)]);
}

function MOS5D325_enabled_(p,keys){return keys.filter(function(k){return ['TRUE','YES','ON','ENABLED','ACTIVE','LIVE','1'].indexOf(String(p[k]||'').trim().toUpperCase())!==-1;});}
function MOS5D325_add_(tests,code,ok){tests.push({code:code,status:ok?'PASS':'FAIL',details:ok?'Check passed.':'Check failed.'});}
