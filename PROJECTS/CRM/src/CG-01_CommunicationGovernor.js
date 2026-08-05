/******************************************************************************
 * MelroseOS Global Communication Governor
 * CG-01_CommunicationGovernor.gs
 * Version 1.0.0
 *
 * Every automated promotional/nurture send should call CG_canSend() first.
 ******************************************************************************/

const CG = {
  VERSION:"1.0.0",
  LEDGER:"CG_COMMUNICATION_LEDGER",
  SUPPRESSIONS:"CG_SUPPRESSIONS",
  CONFIG:"CG_CONFIG",
  TZ:"America/Chicago"
};

function CG_installCommunicationGovernor() {
  const ss=workbook_();

  UI_ensureSheet_(ss,CG.LEDGER,[
    "CommunicationID","LeadID","Email","Phone","MessageType","TemplateKey",
    "Priority","Workflow","Status","Decision","SuppressionReason",
    "ScheduledAt","SentAt","CreatedAt","SourceEventID","UpdatedAt"
  ]);

  UI_ensureSheet_(ss,CG.SUPPRESSIONS,[
    "SuppressionID","LeadID","Email","Phone","Type","Reason","Active",
    "CreatedAt","ExpiresAt","UpdatedAt"
  ]);

  const cfg=UI_ensureSheet_(ss,CG.CONFIG,["Key","Value","Notes"]);
  if(cfg.getLastRow()<2){
    cfg.getRange(2,1,8,3).setValues([
      ["SEND_WINDOW_START","09:00","America/Chicago"],
      ["SEND_WINDOW_END","18:30","America/Chicago"],
      ["MAX_AUTOMATED_NURTURE_PER_24H","1","Hard frequency ceiling"],
      ["MIN_MARKETING_SPACING_HOURS","24","Configurable safety spacing"],
      ["DUPLICATE_TEMPLATE_COOLDOWN_DAYS","60","Suppress same template"],
      ["HISTORICAL_BACKFILL","FALSE","Never back-send old campaign steps"],
      ["REPLY_PAUSES_NURTURE","TRUE","Human response takes priority"],
      ["APPOINTMENT_PAUSES_PROSPECTING","TRUE","Appointment communication wins"]
    ]);
  }

  const out={success:true,version:CG.VERSION,mode:"ENFORCEMENT_READY",timezone:CG.TZ};
  Logger.log(JSON.stringify(out,null,2)); return out;
}

function CG_canSend(request) {
  request=request||{};
  const leadId=String(request.leadId||request.LeadID||"");
  const email=String(request.email||request.Email||"").toLowerCase().trim();
  const phone=UI_normalizePhone_(request.phone||request.Phone||"");
  const messageType=String(request.messageType||"NURTURE").toUpperCase();
  const templateKey=String(request.templateKey||"");
  const priority=Number(request.priority||50);

  if(!leadId && !email && !phone) return CG_decision_(false,"NO_IDENTITY");

  const suppression=CG_findActiveSuppression_(leadId,email,phone);
  if(suppression) return CG_decision_(false,"GLOBAL_SUPPRESSION_" + String(suppression.Type||""));

  if(CG_isDncOrUnsubscribed_(leadId,email,phone)) return CG_decision_(false,"DO_NOT_CONTACT_OR_UNSUBSCRIBED");

  if(!CG_isTransactional_(messageType) && !CG_inSendWindow_()) {
    return CG_decision_(false,"OUTSIDE_9AM_630PM_CENTRAL");
  }

  if(!CG_isTransactional_(messageType) && CG_hasHigherPriorityCollision_(leadId,email,phone,priority)) {
    return CG_decision_(false,"HIGHER_PRIORITY_COMMUNICATION_EXISTS");
  }

  if(templateKey && CG_templateRecentlySent_(leadId,email,phone,templateKey,60)) {
    return CG_decision_(false,"DUPLICATE_TEMPLATE_COOLDOWN");
  }

  if(CG_isNurture_(messageType) && CG_nurtureSentWithinHours_(leadId,email,phone,24)) {
    return CG_decision_(false,"NURTURE_FREQUENCY_CEILING");
  }

  if(CG_isNurture_(messageType) && CG_replyDetected_(leadId)) {
    return CG_decision_(false,"REPLY_DETECTED_NURTURE_PAUSED");
  }

  if(CG_isProspecting_(messageType) && CG_appointmentScheduled_(leadId)) {
    return CG_decision_(false,"APPOINTMENT_SCHEDULED_PROSPECTING_PAUSED");
  }

  return CG_decision_(true,"SEND_APPROVED");
}

function CG_recordDecision(request,decision) {
  const sh=workbook_().getSheetByName(CG.LEDGER);
  const h=UI_headers_(sh);
  const payload={
    CommunicationID:UI_uuid_("COMM"),
    LeadID:request.leadId||request.LeadID||"",
    Email:request.email||request.Email||"",
    Phone:request.phone||request.Phone||"",
    MessageType:request.messageType||"",
    TemplateKey:request.templateKey||"",
    Priority:request.priority||50,
    Workflow:request.workflow||"",
    Status:decision.allowed?"APPROVED":"SUPPRESSED",
    Decision:decision.reason,
    SuppressionReason:decision.allowed?"":decision.reason,
    ScheduledAt:request.scheduledAt||"",
    CreatedAt:new Date(),
    SourceEventID:request.sourceEventId||"",
    UpdatedAt:new Date()
  };
  sh.appendRow(h.map(function(k){return payload[k]!==undefined?payload[k]:"";}));
  return decision;
}

function CG_addSuppression(leadId,email,phone,type,reason,expiresAt) {
  const sh=workbook_().getSheetByName(CG.SUPPRESSIONS);
  sh.appendRow([
    UI_uuid_("SUP"),leadId||"",String(email||"").toLowerCase(),UI_normalizePhone_(phone),
    type||"GLOBAL",reason||"",true,new Date(),expiresAt||"",new Date()
  ]);
  return {success:true};
}

function CG_findActiveSuppression_(leadId,email,phone) {
  const sh=workbook_().getSheetByName(CG.SUPPRESSIONS);
  const now=new Date();
  return UI_objects_(sh).find(function(r){
    const active=String(r.Active).toUpperCase()!=="FALSE";
    const identity=(leadId&&String(r.LeadID)===leadId) ||
      (email&&String(r.Email).toLowerCase()===email) ||
      (phone&&UI_normalizePhone_(r.Phone)===phone);
    const notExpired=!r.ExpiresAt || new Date(r.ExpiresAt)>now;
    return active&&identity&&notExpired;
  })||null;
}

function CG_isDncOrUnsubscribed_(leadId,email,phone) {
  const sh=workbook_().getSheetByName("AE_LEADS");
  if(!sh)return false;
  const r=UI_objects_(sh).find(function(x){
    return (leadId&&String(x.LeadID)===leadId) ||
      (email&&String(x.Email||"").toLowerCase()===email) ||
      (phone&&UI_normalizePhone_(x.Phone)===phone);
  });
  if(!r)return false;
  return ["DO_NOT_CONTACT","DNC","UNSUBSCRIBED"].indexOf(String(r.Status||"").toUpperCase())!==-1 ||
    String(r.DoNotContact||"").toUpperCase()==="TRUE" ||
    String(r.Unsubscribed||"").toUpperCase()==="TRUE";
}

function CG_inSendWindow_() {
  const now=new Date();
  const hhmm=Utilities.formatDate(now,CG.TZ,"HH:mm");
  return hhmm>="09:00" && hhmm<="18:30";
}

function CG_templateRecentlySent_(leadId,email,phone,key,days) {
  const cutoff=Date.now()-days*86400000;
  return UI_objects_(workbook_().getSheetByName(CG.LEDGER)).some(function(r){
    const identity=(leadId&&String(r.LeadID)===leadId)||(email&&String(r.Email).toLowerCase()===email)||(phone&&UI_normalizePhone_(r.Phone)===phone);
    return identity && String(r.TemplateKey)===key && String(r.Status)==="SENT" && r.SentAt && new Date(r.SentAt).getTime()>=cutoff;
  });
}

function CG_nurtureSentWithinHours_(leadId,email,phone,hours) {
  const cutoff=Date.now()-hours*3600000;
  return UI_objects_(workbook_().getSheetByName(CG.LEDGER)).some(function(r){
    const identity=(leadId&&String(r.LeadID)===leadId)||(email&&String(r.Email).toLowerCase()===email)||(phone&&UI_normalizePhone_(r.Phone)===phone);
    return identity && CG_isNurture_(r.MessageType) && String(r.Status)==="SENT" && r.SentAt && new Date(r.SentAt).getTime()>=cutoff;
  });
}

function CG_hasHigherPriorityCollision_(leadId,email,phone,priority) {
  const today=Utilities.formatDate(new Date(),CG.TZ,"yyyy-MM-dd");
  return UI_objects_(workbook_().getSheetByName(CG.LEDGER)).some(function(r){
    const identity=(leadId&&String(r.LeadID)===leadId)||(email&&String(r.Email).toLowerCase()===email)||(phone&&UI_normalizePhone_(r.Phone)===phone);
    const date=r.ScheduledAt?Utilities.formatDate(new Date(r.ScheduledAt),CG.TZ,"yyyy-MM-dd"):"";
    return identity && date===today && Number(r.Priority||999)<priority && ["APPROVED","QUEUED","SENT"].indexOf(String(r.Status))!==-1;
  });
}

function CG_replyDetected_(leadId) {
  const sh=workbook_().getSheetByName("LC_LEAD_LIFECYCLE");
  if(!sh)return false;
  const r=UI_objects_(sh).find(function(x){return String(x.LeadID)===String(leadId);});
  return !!(r && (String(r.ReplyDetected).toUpperCase()==="TRUE" || ["CONTACTED","ACTIVE_CLIENT"].indexOf(String(r.Status).toUpperCase())!==-1));
}

function CG_appointmentScheduled_(leadId) {
  const sh=workbook_().getSheetByName("AP_APPOINTMENTS");
  if(!sh)return false;
  return UI_objects_(sh).some(function(r){
    return String(r.LeadID)===String(leadId) &&
      ["SCHEDULED","CONFIRMED","CONSULTATION_SCHEDULED"].indexOf(String(r.Status||r.BookingStatus||"").toUpperCase())!==-1;
  });
}

function CG_isTransactional_(t){return ["TRANSACTIONAL","APPOINTMENT","OTP","SECURITY","REQUESTED_RESPONSE"].indexOf(String(t).toUpperCase())!==-1;}
function CG_isNurture_(t){return ["NURTURE","MARKETING","HOLIDAY","PAST_CLIENT"].indexOf(String(t).toUpperCase())!==-1;}
function CG_isProspecting_(t){return ["NURTURE","MARKETING","RECRUITING"].indexOf(String(t).toUpperCase())!==-1;}
function CG_decision_(allowed,reason){return {allowed:allowed,reason:reason,checkedAt:new Date(),timezone:CG.TZ};}
