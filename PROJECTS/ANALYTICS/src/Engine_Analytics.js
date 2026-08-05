/**
 * MELROSEOS 4.0 - ANALYTICS
 */
var M4_ANALYTICS={VERSION:'4.0.0',MODULE:'BROKERAGE',SHEETS:{METRICS:'AnalyticsMetrics',SNAPSHOTS:'AnalyticsSnapshots',DASH:'AnalyticsDashboard'}};

function setupMelroseAnalyticsStep1(){const ss=m4_getCommandCenter_();m4_anEnsure_(ss,M4_ANALYTICS.SHEETS.METRICS,['Metric','Value','Category','UpdatedAt']);return{success:true,nextFunction:'setupMelroseAnalyticsStep2'};}
function setupMelroseAnalyticsStep2(){const ss=m4_getCommandCenter_();m4_anEnsure_(ss,M4_ANALYTICS.SHEETS.SNAPSHOTS,['SnapshotID','Metric','Value','SnapshotDate']);return{success:true,nextFunction:'setupMelroseAnalyticsStep3'};}
function setupMelroseAnalyticsStep3(){const ss=m4_getCommandCenter_();m4_anEnsure_(ss,M4_ANALYTICS.SHEETS.DASH,['Widget','Value','UpdatedAt']);return{success:true,nextFunction:'setupMelroseAnalyticsFinalize'};}
function setupMelroseAnalyticsFinalize(){try{m4_setSetting_('ANALYTICS_VERSION',M4_ANALYTICS.VERSION,{type:'STRING',category:'BROKERAGE',description:'Analytics',required:true});}catch(e){}return{success:true,version:M4_ANALYTICS.VERSION};}
function setupMelroseAnalytics(){return setupMelroseAnalyticsStep1();}
function m4_anEnsure_(ss,n,h){let s=ss.getSheetByName(n);if(!s){s=ss.insertSheet(n);s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return;}let r=s.getRange(1,1,1,h.length),v=r.getDisplayValues()[0];h.forEach((x,i)=>{if(!v[i])v[i]=x});r.setValues([v]);}
function refreshMelroseAnalytics(){const ss=m4_getCommandCenter_(),d=ss.getSheetByName('AnalyticsDashboard');const m=[['CRM Leads',count('CRM_Leads')],['Contacts',count('CRM_Contacts')],['Campaigns',count('AdvertisingCampaigns')],['Website Jobs',count('WebsiteSyncJobs')],['Notifications',count('NotificationQueue')]];d.getRange(2,1,m.length,3).setValues(m.map(x=>[x[0],x[1],new Date()]));return{success:true};function count(n){const s=ss.getSheetByName(n);return s?Math.max(0,s.getLastRow()-1):0;}}
function registerMelroseAnalyticsComponents(){if(typeof registerMelroseEngine==='function'){registerMelroseEngine({componentKey:'ENGINE.ANALYTICS_4',engineName:'Analytics',module:'BROKERAGE',version:M4_ANALYTICS.VERSION,setupFunction:'setupMelroseAnalytics',requiredSheet:'AnalyticsMetrics',required:true,description:'Analytics engine'});}return{success:true};}
function testMelroseAnalytics(){const ss=m4_getCommandCenter_();return{success:!!ss.getSheetByName('AnalyticsMetrics')&&!!ss.getSheetByName('AnalyticsSnapshots')&&!!ss.getSheetByName('AnalyticsDashboard'),version:M4_ANALYTICS.VERSION};}
