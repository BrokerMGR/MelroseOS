/**
 * MELROSEOS 4.0 - REPORT BUILDER
 */

var M4_REPORT={
VERSION:'4.0.0',
MODULE:'BROKERAGE',
SHEETS:{
REPORTS:'ReportDefinitions',
QUEUE:'ReportQueue',
ARCHIVE:'ReportArchive'
}
};

function setupMelroseReportBuilderStep1(){
 const ss=m4_getCommandCenter_();
 m4_reportEnsure_(ss,M4_REPORT.SHEETS.REPORTS,
 ['ReportID','ReportName','Category','Source','Enabled','CreatedAt','UpdatedAt']);
 return {success:true,nextFunction:'setupMelroseReportBuilderStep2'};
}

function setupMelroseReportBuilderStep2(){
 const ss=m4_getCommandCenter_();
 m4_reportEnsure_(ss,M4_REPORT.SHEETS.QUEUE,
 ['QueueID','ReportID','RequestedBy','Status','OutputFile','StartedAt','FinishedAt']);
 return {success:true,nextFunction:'setupMelroseReportBuilderStep3'};
}

function setupMelroseReportBuilderStep3(){
 const ss=m4_getCommandCenter_();
 m4_reportEnsure_(ss,M4_REPORT.SHEETS.ARCHIVE,
 ['ArchiveID','ReportID','ReportName','OutputFile','GeneratedAt','GeneratedBy']);
 return {success:true,nextFunction:'setupMelroseReportBuilderFinalize'};
}

function setupMelroseReportBuilderFinalize(){
 try{
  m4_setSetting_('REPORT_BUILDER_VERSION',M4_REPORT.VERSION,{
   type:'STRING',
   category:'BROKERAGE',
   description:'Report Builder',
   required:true
  });
 }catch(e){}
 return {success:true,version:M4_REPORT.VERSION};
}

function setupMelroseReportBuilder(){return setupMelroseReportBuilderStep1();}

function m4_reportEnsure_(ss,name,headers){
 let sh=ss.getSheetByName(name);
 if(!sh){
   sh=ss.insertSheet(name);
   sh.getRange(1,1,1,headers.length).setValues([headers]);
   sh.setFrozenRows(1);
   return sh;
 }
 const r=sh.getRange(1,1,1,headers.length);
 const vals=r.getDisplayValues()[0];
 headers.forEach((h,i)=>{if(!vals[i]) vals[i]=h;});
 r.setValues([vals]);
 return sh;
}

function queueReportBuild(o){
 const sh=m4_getCommandCenter_().getSheetByName(M4_REPORT.SHEETS.QUEUE);
 const id=m4_createID_('REPORT');
 m4_appendObject_(sh,{
   QueueID:id,
   ReportID:o.ReportID||'',
   RequestedBy:o.RequestedBy||m4_currentUser_(),
   Status:'QUEUED',
   OutputFile:'',
   StartedAt:'',
   FinishedAt:''
 });
 return {success:true,queueID:id};
}

function refreshMelroseReportBuilder(){
 const sh=m4_getCommandCenter_().getSheetByName(M4_REPORT.SHEETS.QUEUE);
 const rows=m4_readObjects_(sh);
 return{
  success:true,
  queued:rows.filter(r=>String(r.Status).toUpperCase()==='QUEUED').length,
  completed:rows.filter(r=>String(r.Status).toUpperCase()==='COMPLETED').length
 };
}

function registerMelroseReportBuilderComponents(){
 if(typeof registerMelroseEngine==='function'){
  registerMelroseEngine({
   componentKey:'ENGINE.REPORT_BUILDER_4',
   engineName:'Report Builder',
   module:'BROKERAGE',
   version:M4_REPORT.VERSION,
   setupFunction:'setupMelroseReportBuilder',
   requiredSheet:'ReportDefinitions',
   required:true,
   description:'Reporting engine'
  });
 }
 return {success:true};
}

function testMelroseReportBuilder(){
 const ss=m4_getCommandCenter_();
 return{
  success:
   !!ss.getSheetByName('ReportDefinitions') &&
   !!ss.getSheetByName('ReportQueue') &&
   !!ss.getSheetByName('ReportArchive'),
  version:M4_REPORT.VERSION
 };
}
