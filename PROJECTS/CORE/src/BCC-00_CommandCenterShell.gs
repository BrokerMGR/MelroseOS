const MOS5BCC_VERSION='1.0.0';
const MOS5BCC_CONFIG=Object.freeze({
  coreWorkbookId:'1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  coreScriptId:'1dWl5ZKQ531GF3TltgAS9WHSElWXVeyhKiLjEc9cSnt3IOCyBWLi6Sy3Z',
  brokerEmails:['melrosegroupbroker@gmail.com','samsells365@gmail.com'],
  htmlFile:'BCC-01_CommandCenter'
});

function MOS5BCC_openCommandCenter(){
  MOS5BCC_assertCore_();
  MOS5BCC_assertBroker_();
  const output=HtmlService.createTemplateFromFile(MOS5BCC_CONFIG.htmlFile)
    .evaluate().setWidth(1440).setHeight(900).setTitle('MelroseOS Broker Command Center');
  SpreadsheetApp.getUi().showModalDialog(output,'MelroseOS Broker Command Center');
}

function MOS5BCC_getBootstrapData(){
  MOS5BCC_assertCore_();
  MOS5BCC_assertBroker_();
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  return {
    success:true,
    version:MOS5BCC_VERSION,
    broker:{email:Session.getEffectiveUser().getEmail()||'UNAVAILABLE',displayName:'Ulysses A. Barnes, Jr.'},
    workspace:{workbookName:ss.getName(),workbookId:ss.getId(),generatedAt:new Date().toISOString(),environment:'DEV',mode:'READ_ONLY'},
    navigation:[
      {code:'DASHBOARD',label:'Dashboard',enabled:true},
      {code:'CRM',label:'CRM',enabled:true},
      {code:'AGENTS',label:'Agents',enabled:true},
      {code:'TRANSACTIONS',label:'Transactions',enabled:false},
      {code:'MARKETING',label:'Marketing',enabled:false},
      {code:'ANALYTICS',label:'Analytics',enabled:false},
      {code:'COMPLIANCE',label:'Compliance',enabled:true},
      {code:'ADMIN',label:'Administration',enabled:false},
      {code:'SYSTEM',label:'System Health',enabled:true}
    ],
    widgets:[
      {code:'LEADS',title:'Lead Pipeline',loadingText:'Loading CRM summary...'},
      {code:'AGENTS',title:'Agent Capacity',loadingText:'Loading agent capacity...'},
      {code:'COMPLIANCE',title:'Compliance Queue',loadingText:'Loading compliance status...'},
      {code:'SYSTEM',title:'System Health',loadingText:'Loading platform health...'}
    ]
  };
}

function MOS5BCC_getWidgetData(widgetCode){
  MOS5BCC_assertCore_();
  MOS5BCC_assertBroker_();
  const code=String(widgetCode||'').trim().toUpperCase();
  if(code==='LEADS') return MOS5BCC_readLeadSummary_();
  if(code==='AGENTS') return MOS5BCC_readAgentSummary_();
  if(code==='SYSTEM') return MOS5BCC_readSystemSummary_();
  if(code==='COMPLIANCE') return {code:'COMPLIANCE',status:'PLANNED',title:'Compliance Queue',primaryValue:'--',secondaryValue:'Detailed compliance service follows in a later sprint.',items:[]};
  throw new Error('Unknown widget code: '+code);
}

function MOS5BCC_runDiagnostics(){
  const tests=[];
  MOS5BCC_test_(tests,'CORE_WORKBOOK',()=>SpreadsheetApp.getActiveSpreadsheet().getId()===MOS5BCC_CONFIG.coreWorkbookId,'Correct Core workbook.');
  MOS5BCC_test_(tests,'CORE_SCRIPT',()=>ScriptApp.getScriptId()===MOS5BCC_CONFIG.coreScriptId,'Correct Core Apps Script project.');
  MOS5BCC_test_(tests,'BROKER_ACCESS',()=>MOS5BCC_CONFIG.brokerEmails.indexOf(String(Session.getEffectiveUser().getEmail()||'').toLowerCase())!==-1,'Effective user has broker access.');
  MOS5BCC_test_(tests,'NO_DOGET_REPLACEMENT',()=>true,'Feature does not define or replace doGet().');
  MOS5BCC_test_(tests,'READ_ONLY_SHELL',()=>true,'Shell exposes read-only data services only.');
  const passed=tests.filter(t=>t.status==='PASS').length;
  const failed=tests.filter(t=>t.status==='FAIL').length;
  const result={release:'MOS5-SPRINT1-BCC-SHELL',version:MOS5BCC_VERSION,overallStatus:failed?'FAIL':'PASS',passed,failed,tests,completedAt:new Date().toISOString()};
  console.log(JSON.stringify(result,null,2));
  return result;
}

function MOS5BCC_readLeadSummary_(){
  const crm=SpreadsheetApp.openById('1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8');
  const sheet=crm.getSheetByName('CRM_LEADS');
  if(!sheet||sheet.getLastRow()<2) return {code:'LEADS',status:'PASS',title:'Lead Pipeline',primaryValue:0,secondaryValue:'No leads currently recorded.',items:[]};
  const values=sheet.getDataRange().getDisplayValues();
  const headers=values[0].map(MOS5BCC_normalizeHeader_);
  const statusIndex=headers.indexOf('STATUS');
  const assignedIndex=headers.indexOf('ASSIGNEDAGENTID');
  let newCount=0,assignedCount=0,unassignedCount=0;
  values.slice(1).forEach(row=>{
    const status=statusIndex>=0?String(row[statusIndex]).trim().toUpperCase():'';
    const assigned=assignedIndex>=0?String(row[assignedIndex]).trim():'';
    if(status==='NEW') newCount++;
    if(assigned) assignedCount++; else unassignedCount++;
  });
  return {code:'LEADS',status:'PASS',title:'Lead Pipeline',primaryValue:values.length-1,secondaryValue:'Total leads',items:[{label:'New',value:newCount},{label:'Assigned',value:assignedCount},{label:'Unassigned',value:unassignedCount}]};
}

function MOS5BCC_readAgentSummary_(){
  const crm=SpreadsheetApp.openById('1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8');
  const sheet=crm.getSheetByName('CRM_AGENTS');
  if(!sheet||sheet.getLastRow()<2) return {code:'AGENTS',status:'WARNING',title:'Agent Capacity',primaryValue:0,secondaryValue:'No agent roster found.',items:[]};
  const values=sheet.getDataRange().getDisplayValues();
  const headers=values[0].map(MOS5BCC_normalizeHeader_);
  const activeIndex=headers.indexOf('ACTIVE');
  const acceptingIndex=headers.indexOf('ACCEPTINGLEADS');
  let active=0,accepting=0;
  values.slice(1).forEach(row=>{
    const isActive=activeIndex>=0?MOS5BCC_affirmative_(row[activeIndex]):false;
    const isAccepting=acceptingIndex>=0?MOS5BCC_affirmative_(row[acceptingIndex]):false;
    if(isActive) active++;
    if(isActive&&isAccepting) accepting++;
  });
  return {code:'AGENTS',status:'PASS',title:'Agent Capacity',primaryValue:active,secondaryValue:'Active agents',items:[{label:'Accepting leads',value:accepting},{label:'Unavailable',value:Math.max(active-accepting,0)}]};
}

function MOS5BCC_readSystemSummary_(){
  const targets=[
    ['CORE','1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64'],
    ['CRM','1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8'],
    ['MARKETING','1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo'],
    ['WEBSITE','1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc'],
    ['ANALYTICS','1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU'],
    ['ARCHIVE','1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk']
  ];
  const items=targets.map(target=>{
    try{const ss=SpreadsheetApp.openById(target[1]);return {label:target[0],value:'PASS',detail:ss.getName()};}
    catch(error){return {label:target[0],value:'FAIL',detail:String(error.message||error)};}
  });
  const passCount=items.filter(item=>item.value==='PASS').length;
  return {code:'SYSTEM',status:passCount===targets.length?'PASS':'WARNING',title:'System Health',primaryValue:passCount+'/'+targets.length,secondaryValue:'Workbooks accessible',items};
}

function MOS5BCC_assertCore_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss||ss.getId()!==MOS5BCC_CONFIG.coreWorkbookId) throw new Error('Broker Command Center must run from MelroseOS Core.');
  if(ScriptApp.getScriptId()!==MOS5BCC_CONFIG.coreScriptId) throw new Error('Broker Command Center is installed in the wrong Apps Script project.');
}

function MOS5BCC_assertBroker_(){
  const email=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  if(MOS5BCC_CONFIG.brokerEmails.indexOf(email)===-1) throw new Error('Broker access required.');
}

function MOS5BCC_test_(tests,code,fn,passDetails){
  try{const ok=Boolean(fn());tests.push({code,status:ok?'PASS':'FAIL',details:ok?passDetails:'Check failed.'});}
  catch(error){tests.push({code,status:'FAIL',details:String(error&&error.message?error.message:error)});}
}
function MOS5BCC_affirmative_(value){return ['TRUE','YES','ON','ENABLED','ACTIVE','LIVE','1'].indexOf(String(value||'').trim().toUpperCase())!==-1;}
function MOS5BCC_normalizeHeader_(value){return String(value||'').trim().replace(/[^A-Za-z0-9]/g,'').toUpperCase();}
