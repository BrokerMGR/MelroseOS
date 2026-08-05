
/******************************************************************************
 * MelroseOS Notification Governor v1.0.0
 ******************************************************************************/

const NG = {
  RULES:"SYS_NOTIFICATION_RULES",
  LOG:"SYS_NOTIFICATION_LOG",
  ROUTINE_LABEL:"MGR/System Alerts/Routine",
  CRITICAL_LABEL:"MGR/System Alerts/Critical",
  SOURCE_LABEL:"MGR/New Leads",
  ROUTINE_DAYS:7,
  CRITICAL_DAYS:30,
  BROKER:"melrosegroupbroker@gmail.com",
  SAMANTHA:"samsells365@gmail.com"
};

function NG_installNotificationGovernor() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();

  NG_ensureSheet_(ss,NG.RULES,[
    "EventCode","EventName","Severity","EmailBroker","EmailSamantha",
    "EmailAssignedAgent","Dashboard","RetentionDays","Enabled","UpdatedAt"
  ]);

  NG_ensureSheet_(ss,NG.LOG,[
    "NotificationID","CreatedAt","EventCode","Severity","LeadID","AgentID",
    "Recipient","Subject","Message","DashboardStatus","EmailStatus",
    "SourceSystem","Metadata","AcknowledgedAt"
  ]);

  NG_seedRules_();

  Logger.log(JSON.stringify({
    success:true,
    version:"1.0.0",
    message:"Notification Governor installed."
  },null,2));
}

function NG_seedRules_() {
  const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NG.RULES);
  const existing=NG_objects_(s).map(function(r){ return String(r.EventCode||""); });

  const rules=[
    ["NEW_LEAD_ASSIGNED","New Lead Assigned","ROUTINE",true,false,true,true,7,true],
    ["CONSULTATION_SCHEDULED","Consultation Scheduled","ROUTINE",true,false,true,true,7,true],
    ["LEAD_REASSIGNED","Lead Reassigned","ROUTINE",true,false,true,true,7,true],
    ["ASSIGNMENT_FAILED","Lead Assignment Failed","CRITICAL",true,true,false,true,30,true],
    ["DISTRIBUTION_FAILED","Lead Distribution Failed","CRITICAL",true,true,false,true,30,true],
    ["PARSER_FAILED","Lead Parser Failed","CRITICAL",true,true,false,true,30,true],
    ["INTAKE_FAILED","Lead Intake Failed","CRITICAL",true,true,false,true,30,true],
    ["SECURITY_ALERT","Security Alert","CRITICAL",true,true,false,true,30,true],
    ["PERMISSION_FAILED","Permission Failure","CRITICAL",true,true,false,true,30,true],
    ["SYSTEM_HEALTH_FAILED","System Health Failure","CRITICAL",true,true,false,true,30,true],
    ["LEAD_DISTRIBUTED","Lead Distributed","ROUTINE",false,false,false,true,7,true],
    ["LEAD_CONTACTED","Lead Contacted","ROUTINE",false,false,false,true,7,true],
    ["FOLLOWUP_COMPLETED","Follow-Up Completed","ROUTINE",false,false,false,true,7,true]
  ];

  rules.forEach(function(r){
    if(existing.indexOf(r[0])===-1) {
      s.appendRow(r.concat([new Date()]));
    }
  });
}

function NG_notify(eventCode,payload) {
  payload=payload||{};

  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const rule=NG_objects_(ss.getSheetByName(NG.RULES)).find(function(r){
    return String(r.EventCode)===String(eventCode);
  });

  if(!rule||!NG_bool_(rule.Enabled)) {
    return {success:true,skipped:true,reason:"RULE_DISABLED_OR_MISSING"};
  }

  const severity=String(rule.Severity||"ROUTINE").toUpperCase();
  const recipients=[];

  if(NG_bool_(rule.EmailBroker)) recipients.push(NG.BROKER);
  if(NG_bool_(rule.EmailSamantha)) recipients.push(NG.SAMANTHA);
  if(NG_bool_(rule.EmailAssignedAgent)&&payload.agentEmail) {
    recipients.push(String(payload.agentEmail).trim());
  }

  const unique=[...new Set(
    recipients.filter(Boolean).map(function(x){ return x.toLowerCase(); })
  )];

  let emailStatus="NOT_REQUIRED";

  if(unique.length) {
    MailApp.sendEmail({
      to:unique.join(","),
      subject:String(payload.subject||rule.EventName||eventCode),
      htmlBody:String(payload.htmlBody||payload.message||"MelroseOS notification.")
    });
    emailStatus="SENT";
  }

  if(NG_bool_(rule.Dashboard)) {
    NG_append_(ss.getSheetByName(NG.LOG),{
      NotificationID:"NTF_"+Utilities.getUuid().replace(/-/g,"").toUpperCase(),
      CreatedAt:new Date(),
      EventCode:eventCode,
      Severity:severity,
      LeadID:payload.leadId||"",
      AgentID:payload.agentId||"",
      Recipient:unique.join(","),
      Subject:payload.subject||rule.EventName||eventCode,
      Message:payload.message||"",
      DashboardStatus:"ACTIVE",
      EmailStatus:emailStatus,
      SourceSystem:payload.sourceSystem||"",
      Metadata:JSON.stringify(payload.metadata||{})
    });
  }

  return {
    success:true,
    eventCode:eventCode,
    emailStatus:emailStatus,
    recipients:unique
  };
}

function NG_ensureSheet_(ss,name,headers) {
  let s=ss.getSheetByName(name);

  if(!s) {
    s=ss.insertSheet(name);
    s.appendRow(headers);
    s.setFrozenRows(1);
  }

  return s;
}

function NG_headers_(s) {
  return s.getRange(1,1,1,s.getLastColumn()).getDisplayValues()[0]
    .map(function(v){ return String(v||"").trim(); });
}

function NG_objects_(s) {
  if(!s||s.getLastRow()<2) return [];
  const h=NG_headers_(s);
  const vals=s.getRange(2,1,s.getLastRow()-1,h.length).getValues();

  return vals.map(function(r,i){
    const o={__rowNumber:i+2};
    h.forEach(function(x,j){ o[x]=r[j]; });
    return o;
  });
}

function NG_append_(s,p) {
  const h=NG_headers_(s);
  s.appendRow(h.map(function(x){ return p[x]!==undefined?p[x]:""; }));
}

function NG_update_(s,row,p) {
  const h=NG_headers_(s);
  const cur=s.getRange(row,1,1,h.length).getValues()[0];

  s.getRange(row,1,1,h.length).setValues([
    h.map(function(x,i){ return p[x]!==undefined?p[x]:cur[i]; })
  ]);
}

function NG_bool_(v) {
  return v===true || ["TRUE","YES","Y","1"].indexOf(
    String(v||"").trim().toUpperCase()
  )!==-1;
}
