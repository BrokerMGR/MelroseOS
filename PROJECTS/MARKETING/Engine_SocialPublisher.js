/**
 * MELROSEOS 4.0 - SOCIAL PUBLISHER
 */

var M4_SOCIAL={
VERSION:'4.0.0',
MODULE:'MARKETING',
SHEETS:{
QUEUE:'SocialPublishQueue',
HISTORY:'SocialPublishHistory'
}
};

function setupMelroseSocialPublisherStep1(){
 const ss=m4_getCommandCenter_();
 m4_socialEnsure_(ss,M4_SOCIAL.SHEETS.QUEUE,
 ['PublishID','Platform','CampaignID','CreativeID','Caption','MediaURL','Status','ScheduledAt','PublishedAt','CreatedAt','UpdatedAt']);
 return {success:true,nextFunction:'setupMelroseSocialPublisherStep2'};
}

function setupMelroseSocialPublisherStep2(){
 const ss=m4_getCommandCenter_();
 m4_socialEnsure_(ss,M4_SOCIAL.SHEETS.HISTORY,
 ['HistoryID','PublishID','Platform','Result','ExternalID','URL','PublishedAt']);
 return {success:true,nextFunction:'setupMelroseSocialPublisherFinalize'};
}

function setupMelroseSocialPublisherFinalize(){
 try{
   m4_setSetting_('SOCIAL_PUBLISHER_VERSION',M4_SOCIAL.VERSION,{
     type:'STRING',
     category:'MARKETING',
     description:'Social Publisher',
     required:true
   });
 }catch(e){}
 return {success:true};
}

function m4_socialEnsure_(ss,name,headers){
 let sh=ss.getSheetByName(name);
 if(!sh){
   sh=ss.insertSheet(name);
   sh.getRange(1,1,1,headers.length).setValues([headers]);
   sh.setFrozenRows(1);
   return;
 }
 const vals=sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
 headers.forEach((h,i)=>{if(!vals[i])vals[i]=h;});
 sh.getRange(1,1,1,headers.length).setValues([vals]);
}

function queueSocialPost(o){
 const ss=m4_getCommandCenter_();
 const sh=ss.getSheetByName(M4_SOCIAL.SHEETS.QUEUE);
 const id=m4_createID_('PUBLISH');
 m4_appendObject_(sh,{
   PublishID:id,
   Platform:o.Platform||'FACEBOOK',
   CampaignID:o.CampaignID||'',
   CreativeID:o.CreativeID||'',
   Caption:o.Caption||'',
   MediaURL:o.MediaURL||'',
   Status:'QUEUED',
   ScheduledAt:o.ScheduledAt||'',
   PublishedAt:'',
   CreatedAt:new Date(),
   UpdatedAt:new Date()
 });
 return {success:true,publishID:id};
}

function refreshMelroseSocialPublisher(){
 const ss=m4_getCommandCenter_();
 const sh=ss.getSheetByName(M4_SOCIAL.SHEETS.QUEUE);
 const rows=Math.max(0,sh.getLastRow()-1);
 return {success:true,queued:rows};
}

function registerMelroseSocialPublisherComponents(){
 if(typeof registerMelroseEngine==='function'){
   registerMelroseEngine({
     componentKey:'ENGINE.SOCIAL_PUBLISHER_4',
     engineName:'Social Publisher',
     module:'MARKETING',
     version:M4_SOCIAL.VERSION,
     setupFunction:'setupMelroseSocialPublisherStep1',
     requiredSheet:'SocialPublishQueue',
     required:true,
     description:'Social publishing queue'
   });
 }
 return {success:true};
}

function openMelroseSocialPublisher(){
 m4_getCommandCenter_().setActiveSheet(
   m4_getCommandCenter_().getSheetByName('SocialPublishQueue'));
}

function testMelroseSocialPublisher(){
 const ss=m4_getCommandCenter_();
 return {
  success:!!ss.getSheetByName('SocialPublishQueue')&&!!ss.getSheetByName('SocialPublishHistory'),
  version:M4_SOCIAL.VERSION
 };
}
