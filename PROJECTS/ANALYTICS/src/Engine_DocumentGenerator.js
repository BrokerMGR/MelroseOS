/**
 * MELROSEOS 4.0 - DOCUMENT GENERATOR
 */

var M4_DOC={
VERSION:'4.0.0',
MODULE:'BROKERAGE',
SHEETS:{
TEMPLATES:'DocumentTemplates',
QUEUE:'DocumentQueue',
ARCHIVE:'DocumentArchive'
}
};

function setupMelroseDocumentGeneratorStep1(){
 const ss=m4_getCommandCenter_();
 m4_docEnsure_(ss,M4_DOC.SHEETS.TEMPLATES,
 ['TemplateID','TemplateName','Category','OutputType','Active','UpdatedAt']);
 return {success:true,nextFunction:'setupMelroseDocumentGeneratorStep2'};
}

function setupMelroseDocumentGeneratorStep2(){
 const ss=m4_getCommandCenter_();
 m4_docEnsure_(ss,M4_DOC.SHEETS.QUEUE,
 ['JobID','TemplateID','RecordID','OutputName','Status','RequestedBy','CreatedAt','CompletedAt']);
 return {success:true,nextFunction:'setupMelroseDocumentGeneratorStep3'};
}

function setupMelroseDocumentGeneratorStep3(){
 const ss=m4_getCommandCenter_();
 m4_docEnsure_(ss,M4_DOC.SHEETS.ARCHIVE,
 ['ArchiveID','JobID','OutputName','FileId','FileUrl','GeneratedAt','GeneratedBy']);
 return {success:true,nextFunction:'setupMelroseDocumentGeneratorFinalize'};
}

function setupMelroseDocumentGeneratorFinalize(){
 try{
  m4_setSetting_('DOCUMENT_GENERATOR_VERSION',M4_DOC.VERSION,{
   type:'STRING',
   category:'BROKERAGE',
   description:'Document Generator',
   required:true
  });
 }catch(e){}
 return {success:true,version:M4_DOC.VERSION};
}

function setupMelroseDocumentGenerator(){return setupMelroseDocumentGeneratorStep1();}

function m4_docEnsure_(ss,name,headers){
 let sh=ss.getSheetByName(name);
 if(!sh){
   sh=ss.insertSheet(name);
   sh.getRange(1,1,1,headers.length).setValues([headers]);
   sh.setFrozenRows(1);
   return;
 }
 const r=sh.getRange(1,1,1,headers.length);
 const vals=r.getDisplayValues()[0];
 headers.forEach((h,i)=>{if(!vals[i]) vals[i]=h;});
 r.setValues([vals]);
}

function queueDocumentGeneration(o){
 const sh=m4_getCommandCenter_().getSheetByName(M4_DOC.SHEETS.QUEUE);
 const id=m4_createID_('DOCJOB');
 m4_appendObject_(sh,{
   JobID:id,
   TemplateID:o.TemplateID||'',
   RecordID:o.RecordID||'',
   OutputName:o.OutputName||'Document',
   Status:'QUEUED',
   RequestedBy:m4_currentUser_(),
   CreatedAt:new Date(),
   CompletedAt:''
 });
 return {success:true,jobID:id};
}

function refreshMelroseDocumentGenerator(){
 const sh=m4_getCommandCenter_().getSheetByName(M4_DOC.SHEETS.QUEUE);
 const rows=m4_readObjects_(sh);
 return {
   success:true,
   queued:rows.filter(r=>String(r.Status).toUpperCase()==='QUEUED').length,
   completed:rows.filter(r=>String(r.Status).toUpperCase()==='COMPLETED').length
 };
}

function registerMelroseDocumentGeneratorComponents(){
 if(typeof registerMelroseEngine==='function'){
   registerMelroseEngine({
     componentKey:'ENGINE.DOCUMENT_GENERATOR_4',
     engineName:'Document Generator',
     module:'BROKERAGE',
     version:M4_DOC.VERSION,
     setupFunction:'setupMelroseDocumentGenerator',
     requiredSheet:'DocumentTemplates',
     required:true,
     description:'Document generation engine'
   });
 }
 return {success:true};
}

function testMelroseDocumentGenerator(){
 const ss=m4_getCommandCenter_();
 return {
   success:
    !!ss.getSheetByName('DocumentTemplates') &&
    !!ss.getSheetByName('DocumentQueue') &&
    !!ss.getSheetByName('DocumentArchive'),
   version:M4_DOC.VERSION
 };
}
