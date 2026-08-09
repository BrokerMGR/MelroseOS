/**
 * ================================================================
 * MELROSEOS 4.0 — BROKER DASHBOARD
 * Version 4.0.0
 *
 * Public:
 * - setupMelroseBrokerDashboardStep1()
 * - setupMelroseBrokerDashboardStep2()
 * - setupMelroseBrokerDashboardFinalize()
 * - refreshMelroseBrokerDashboard()
 * - openMelroseBrokerDashboard()
 * - testMelroseBrokerDashboard()
 * ================================================================
 */

var M4_BROKER_DASHBOARD={
  VERSION:'4.0.0',
  MODULE:'BROKERAGE',
  SHEETS:{
    DASHBOARD:'BrokerDashboard',
    METRICS:'BrokerMetrics'
  }
};

function setupMelroseBrokerDashboardStep1(){
  const ss=m4_getCommandCenter_();
  m4_dashboardEnsure_(ss,M4_BROKER_DASHBOARD.SHEETS.DASHBOARD,
  ['Widget','Value','UpdatedAt']);
  return {success:true,nextFunction:'setupMelroseBrokerDashboardStep2'};
}

function setupMelroseBrokerDashboardStep2(){
  const ss=m4_getCommandCenter_();
  m4_dashboardEnsure_(ss,M4_BROKER_DASHBOARD.SHEETS.METRICS,
  ['Metric','Value','Category','UpdatedAt']);
  return {success:true,nextFunction:'setupMelroseBrokerDashboardFinalize'};
}

function setupMelroseBrokerDashboardFinalize(){
  try{
    m4_setSetting_('BROKER_DASHBOARD_VERSION',M4_BROKER_DASHBOARD.VERSION,{
      type:'STRING',
      category:'BROKERAGE',
      description:'Broker Dashboard Version',
      required:true
    });
  }catch(e){}
  return {success:true,version:M4_BROKER_DASHBOARD.VERSION};
}

function m4_dashboardEnsure_(ss,name,headers){
  let sh=ss.getSheetByName(name);
  if(!sh){
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }
  const vals=sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
  const out=vals.slice();
  headers.forEach((h,i)=>{if(!out[i])out[i]=h;});
  sh.getRange(1,1,1,headers.length).setValues([out]);
  return sh;
}

function refreshMelroseBrokerDashboard(){
  const ss=m4_getCommandCenter_();
  const dash=ss.getSheetByName(M4_BROKER_DASHBOARD.SHEETS.DASHBOARD);
  const metrics=[
    ['CRM Leads',countSheet_('CRM_Leads')],
    ['Contacts',countSheet_('CRM_Contacts')],
    ['Routing Queue',countSheet_('LeadRoutingQueue')],
    ['Campaigns',countSheet_('AdvertisingCampaigns')],
    ['Graphics',countSheet_('AdvertisingGraphicQueue')]
  ];
  dash.getRange(2,1,metrics.length,3).setValues(metrics.map(r=>[r[0],r[1],new Date()]));
  return {success:true,widgets:metrics.length};

  function countSheet_(n){
    const s=ss.getSheetByName(n);
    return s?Math.max(0,s.getLastRow()-1):0;
  }
}

function registerMelroseBrokerDashboardComponents(){
  if(typeof registerMelroseEngine==='function'){
    registerMelroseEngine({
      componentKey:'ENGINE.BROKER_DASHBOARD_4',
      engineName:'Broker Dashboard',
      module:'BROKERAGE',
      version:M4_BROKER_DASHBOARD.VERSION,
      setupFunction:'setupMelroseBrokerDashboardStep1',
      requiredSheet:'BrokerDashboard',
      required:true,
      description:'Broker KPI dashboard'
    });
  }
  return {success:true};
}

function openMelroseBrokerDashboard(){
  const ss=m4_getCommandCenter_();
  ss.setActiveSheet(ss.getSheetByName('BrokerDashboard'));
}

function testMelroseBrokerDashboard(){
  const ss=m4_getCommandCenter_();
  return {
    success:!!ss.getSheetByName('BrokerDashboard')&&!!ss.getSheetByName('BrokerMetrics'),
    version:M4_BROKER_DASHBOARD.VERSION
  };
}
