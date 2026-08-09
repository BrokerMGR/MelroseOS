/**
 * MELROSEOS 4.0 - EMAIL AUTOMATION
 */

var M4_EMAIL={
VERSION:'4.0.0',
MODULE:'EMAIL',
SHEETS:{
QUEUE:'EmailQueue',
TEMPLATES:'EmailTemplates',
HISTORY:'EmailHistory'
}
};

function setupMelroseEmailAutomationStep1(){
 const ss=m4_getCommandCenter_();
 m4_emailEnsure_(ss,M4_EMAIL.SHEETS.QUEUE,
 ['EmailID','Recipient','Subject','Body','TemplateID','Status','ScheduledAt','SentAt','CreatedAt','UpdatedAt']);
 return {success:true,nextFunction:'setupMelroseEmailAutomationStep2'};
}

function setupMelroseEmailAutomationStep2(){
 const ss=m4_getCommandCenter_();
 m4_emailEnsure_(ss,M4_EMAIL.SHEETS.TEMPLATES,
 ['TemplateID','TemplateName','Category','Subject','Body','Active','UpdatedAt']);
 return {success:true,nextFunction:'setupMelroseEmailAutomationStep3'};
}

function setupMelroseEmailAutomationStep3(){
 const ss=m4_getCommandCenter_();
 m4_emailEnsure_(ss,M4_EMAIL.SHEETS.HISTORY,
 ['HistoryID','EmailID','Recipient','Result','MessageID','SentAt']);
 return {success:true,nextFunction:'setupMelroseEmailAutomationFinalize'};
}

function setupMelroseEmailAutomationFinalize(){
 try{
  m4_setSetting_('EMAIL_AUTOMATION_VERSION',M4_EMAIL.VERSION,{
   type:'STRING',
   category:'EMAIL',
   description:'Email Automation',
   required:true
  });
 }catch(e){}
 return {success:true,version:M4_EMAIL.VERSION};
}

function m4_emailEnsure_(ss,name,headers){
 let sh=ss.getSheetByName(name);
 if(!sh){
  sh=ss.insertSheet(name);
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return;
 }
 const vals=sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
 headers.forEach((h,i)=>{if(!vals[i]) vals[i]=h;});
 sh.getRange(1,1,1,headers.length).setValues([vals]);
}

function queueEmailAutomation(o){
 const sh=m4_getCommandCenter_().getSheetByName(M4_EMAIL.SHEETS.QUEUE);
 const id=m4_createID_('EMAIL');
 m4_appendObject_(sh,{
  EmailID:id,
  Recipient:o.Recipient||'',
  Subject:o.Subject||'',
  Body:o.Body||'',
  TemplateID:o.TemplateID||'',
  Status:'QUEUED',
  ScheduledAt:o.ScheduledAt||'',
  SentAt:'',
  CreatedAt:new Date(),
  UpdatedAt:new Date()
 });
 return {success:true,emailID:id};
}

function refreshMelroseEmailAutomation(){
 const sh=m4_getCommandCenter_().getSheetByName(M4_EMAIL.SHEETS.QUEUE);
 return {success:true,queued:Math.max(0,sh.getLastRow()-1)};
}

function registerMelroseEmailAutomationComponents(){
 if(typeof registerMelroseEngine==='function'){
  registerMelroseEngine({
   componentKey:'ENGINE.EMAIL_AUTOMATION_4',
   engineName:'Email Automation',
   module:'EMAIL',
   version:M4_EMAIL.VERSION,
   setupFunction:'setupMelroseEmailAutomationStep1',
   requiredSheet:'EmailQueue',
   required:true,
   description:'Central email queue and templates'
  });
 }
 return {success:true};
}

function testMelroseEmailAutomation(){
 const ss=m4_getCommandCenter_();
 return {
  success:!!ss.getSheetByName('EmailQueue')&&!!ss.getSheetByName('EmailTemplates')&&!!ss.getSheetByName('EmailHistory'),
  version:M4_EMAIL.VERSION
 };
}
