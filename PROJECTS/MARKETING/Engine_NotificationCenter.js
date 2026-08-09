/**
 * MELROSEOS 4.0 - NOTIFICATION CENTER
 */

var M4_NOTIFICATION={
  VERSION:'4.0.0',
  MODULE:'AUTOMATION',
  SHEETS:{
    QUEUE:'NotificationQueue',
    TEMPLATES:'NotificationTemplates',
    HISTORY:'NotificationHistory'
  }
};

function setupMelroseNotificationCenterStep1(){
  const ss=m4_getCommandCenter_();
  m4_notificationEnsure_(ss,M4_NOTIFICATION.SHEETS.QUEUE,
  ['NotificationID','Channel','Recipient','Subject','Message','TemplateID','Status','Priority','ScheduledAt','SentAt','CreatedAt','UpdatedAt']);
  return {success:true,nextFunction:'setupMelroseNotificationCenterStep2'};
}

function setupMelroseNotificationCenterStep2(){
  const ss=m4_getCommandCenter_();
  m4_notificationEnsure_(ss,M4_NOTIFICATION.SHEETS.TEMPLATES,
  ['TemplateID','TemplateName','Channel','SubjectTemplate','MessageTemplate','Active','CreatedAt','UpdatedAt']);
  return {success:true,nextFunction:'setupMelroseNotificationCenterStep3'};
}

function setupMelroseNotificationCenterStep3(){
  const ss=m4_getCommandCenter_();
  m4_notificationEnsure_(ss,M4_NOTIFICATION.SHEETS.HISTORY,
  ['HistoryID','NotificationID','Channel','Recipient','Result','ExternalID','SentAt','Message']);
  return {success:true,nextFunction:'setupMelroseNotificationCenterFinalize'};
}

function setupMelroseNotificationCenterFinalize(){
  try{
    m4_setSetting_('NOTIFICATION_CENTER_VERSION',M4_NOTIFICATION.VERSION,{
      type:'STRING',
      category:'AUTOMATION',
      description:'Notification Center',
      required:true
    });
  }catch(e){}
  return {success:true,version:M4_NOTIFICATION.VERSION};
}

function setupMelroseNotificationCenter(){
  return setupMelroseNotificationCenterStep1();
}

function m4_notificationEnsure_(ss,name,headers){
  let sh=ss.getSheetByName(name);

  if(!sh){
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }

  const range=sh.getRange(1,1,1,headers.length);
  const vals=range.getDisplayValues()[0];

  headers.forEach((h,i)=>{
    if(!vals[i]) vals[i]=h;
  });

  range.setValues([vals]);
  sh.setFrozenRows(1);

  return sh;
}

function queueMelroseNotification(o){
  if(!o || typeof o!=='object'){
    throw new Error('Notification configuration is required.');
  }

  const ss=m4_getCommandCenter_();
  const sh=ss.getSheetByName(M4_NOTIFICATION.SHEETS.QUEUE);

  if(!sh){
    throw new Error('NotificationQueue does not exist.');
  }

  const id=m4_createID_('NOTICE');

  m4_appendObject_(sh,{
    NotificationID:id,
    Channel:String(o.Channel||'EMAIL').toUpperCase(),
    Recipient:o.Recipient||'',
    Subject:o.Subject||'',
    Message:o.Message||'',
    TemplateID:o.TemplateID||'',
    Status:'QUEUED',
    Priority:String(o.Priority||'NORMAL').toUpperCase(),
    ScheduledAt:o.ScheduledAt||'',
    SentAt:'',
    CreatedAt:new Date(),
    UpdatedAt:new Date()
  });

  return {success:true,notificationID:id};
}

function refreshMelroseNotificationCenter(){
  const ss=m4_getCommandCenter_();
  const sh=ss.getSheetByName(M4_NOTIFICATION.SHEETS.QUEUE);

  if(!sh){
    throw new Error('NotificationQueue does not exist.');
  }

  const rows=m4_readObjects_(sh);

  return {
    success:true,
    total:rows.length,
    queued:rows.filter(r=>String(r.Status||'').toUpperCase()==='QUEUED').length,
    sent:rows.filter(r=>String(r.Status||'').toUpperCase()==='SENT').length,
    failed:rows.filter(r=>String(r.Status||'').toUpperCase()==='FAILED').length
  };
}

function markSelectedNotificationSent(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();

  if(!ss){
    throw new Error('Open the Command Center spreadsheet first.');
  }

  const sh=ss.getActiveSheet();

  if(sh.getName()!==M4_NOTIFICATION.SHEETS.QUEUE){
    throw new Error('Open NotificationQueue and select a notification row.');
  }

  const row=sh.getActiveRange().getRow();

  if(row<2){
    throw new Error('Select a notification data row.');
  }

  const record=m4_readRowObject_(sh,row);

  if(!record.NotificationID){
    throw new Error('The selected row does not contain a NotificationID.');
  }

  m4_updateObject_(sh,row,{
    Status:'SENT',
    SentAt:new Date(),
    UpdatedAt:new Date()
  });

  const history=ss.getSheetByName(M4_NOTIFICATION.SHEETS.HISTORY);

  if(history){
    m4_appendObject_(history,{
      HistoryID:m4_createID_('NOTICEHISTORY'),
      NotificationID:record.NotificationID,
      Channel:record.Channel||'',
      Recipient:record.Recipient||'',
      Result:'SENT',
      ExternalID:'',
      SentAt:new Date(),
      Message:'Notification marked sent.'
    });
  }

  return {success:true,notificationID:record.NotificationID};
}

function registerMelroseNotificationCenterComponents(){
  if(typeof registerMelroseEngine==='function'){
    registerMelroseEngine({
      componentKey:'ENGINE.NOTIFICATION_CENTER_4',
      engineName:'Notification Center',
      module:'AUTOMATION',
      version:M4_NOTIFICATION.VERSION,
      setupFunction:'setupMelroseNotificationCenter',
      requiredSheet:'NotificationQueue',
      required:true,
      description:'Central notification queue, templates, and history.'
    });
  }

  if(typeof registerMelroseDependency==='function'){
    [
      ['ENGINE.CORE_COMMON',true],
      ['ENGINE.CORE_SETTINGS',true],
      ['ENGINE.CORE_REGISTRY',true]
    ].forEach(item=>{
      registerMelroseDependency({
        source:'ENGINE.NOTIFICATION_CENTER_4',
        type:'REQUIRES',
        target:item[0],
        required:item[1],
        notes:'Notification Center dependency.'
      });
    });
  }

  return {success:true};
}

function openMelroseNotificationCenter(){
  const ss=m4_getCommandCenter_();
  const sh=ss.getSheetByName(M4_NOTIFICATION.SHEETS.QUEUE);

  if(!sh){
    throw new Error('NotificationQueue does not exist.');
  }

  ss.setActiveSheet(sh);
  sh.getRange('A1').activate();
}

function testMelroseNotificationCenter(){
  const ss=m4_getCommandCenter_();

  return {
    success:
      !!ss.getSheetByName(M4_NOTIFICATION.SHEETS.QUEUE) &&
      !!ss.getSheetByName(M4_NOTIFICATION.SHEETS.TEMPLATES) &&
      !!ss.getSheetByName(M4_NOTIFICATION.SHEETS.HISTORY),
    version:M4_NOTIFICATION.VERSION
  };
}
