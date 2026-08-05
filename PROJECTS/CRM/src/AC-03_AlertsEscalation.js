/******************************************************************************
 * File: AC-03_AlertsEscalation.gs
 * Version: 1.0.0
 ******************************************************************************/

function AC_processSLAAlerts() {
  AC_initialize();
  const config=AC_getConfig_();
  const rows=AC_objects_(AC.SHEETS.TRACKING);
  const sheet=workbook_().getSheetByName(AC.SHEETS.TRACKING);
  const now=new Date();
  let overdue=0, agentAlerts=0, escalations=0;

  rows.forEach(function(r){
    const lifecycle=String(r.CurrentLifecycleStatus||"").toUpperCase();
    if (AC.TERMINAL_STATUSES.indexOf(lifecycle)!==-1 || r.FirstContactAt) return;

    const firstDue=AC_date_(r.FirstContactDueAt);
    if (now<=firstDue) return;

    overdue++;
    AC_set_(sheet,r._row,"SLAStatus","OVERDUE");

    const lastAlert=r.LastAlertAt ? AC_date_(r.LastAlertAt) : null;
    const canAlert=!lastAlert ||
      (now.getTime()-lastAlert.getTime()) >= config.repeatAlertMinutes*60000;

    if (canAlert && config.sendAgentAlerts && r.AgentEmail) {
      AC_sendAgentAlert_(r);
      AC_set_(sheet,r._row,"LastAlertAt",timestamp_());
      agentAlerts++;
    }

    const escalationDue=AC_date_(r.EscalationDueAt);
    if (now>=escalationDue && !r.EscalatedAt && config.sendBrokerEscalations) {
      AC_sendBrokerEscalation_(r,config.brokerEmail);
      AC_set_(sheet,r._row,"EscalatedAt",timestamp_());
      AC_set_(sheet,r._row,"SLAStatus","ESCALATED");
      escalations++;
    }

    AC_set_(sheet,r._row,"UpdatedAt",timestamp_());
  });

  return {
    success:true,
    overdue:overdue,
    agentAlerts:agentAlerts,
    brokerEscalations:escalations
  };
}

function AC_sendAgentAlert_(r) {
  const subject="Action Required: New Lead Follow-Up";
  const body=
    "Hello "+(r.AgentName||"Agent")+",\n\n"+
    "A lead assigned to you has passed the first-contact target and still needs follow-up.\n\n"+
    "Lead: "+(r.LeadName||r.LeadID)+"\n"+
    "Type: "+(r.LeadType||"")+"\n"+
    "Parish: "+(r.Parish||"")+"\n\n"+
    "Please contact the lead as soon as possible and update the lead activity/status.\n\n"+
    "Melrose Group Realty";

  GmailApp.sendEmail(String(r.AgentEmail),subject,body);
  AC_logAlert_(r,"AGENT_OVERDUE",r.AgentEmail,"SENT","First-contact SLA overdue alert.");
}

function AC_sendBrokerEscalation_(r,email) {
  const subject="Lead SLA Escalation: "+(r.AgentName||r.AgentID||"Assigned Agent");
  const body=
    "A lead has exceeded the broker escalation threshold.\n\n"+
    "Lead: "+(r.LeadName||r.LeadID)+"\n"+
    "Lead ID: "+r.LeadID+"\n"+
    "Assigned Agent: "+(r.AgentName||r.AgentID)+"\n"+
    "Lead Type: "+(r.LeadType||"")+"\n"+
    "Parish: "+(r.Parish||"")+"\n"+
    "Assigned At: "+r.AssignedAt+"\n"+
    "First Contact Due: "+r.FirstContactDueAt+"\n\n"+
    "Review the lead for follow-up or reassignment.";

  GmailApp.sendEmail(String(email),subject,body);
  AC_logAlert_(r,"BROKER_ESCALATION",email,"SENT","Lead exceeded escalation threshold.");
}

function AC_logAlert_(r,type,recipient,status,details) {
  workbook_().getSheetByName(AC.SHEETS.ALERTS).appendRow([
    "ALT-"+Utilities.getUuid().substring(0,8).toUpperCase(),
    r.LeadID||"",
    r.AgentID||"",
    type,
    recipient,
    status,
    details,
    timestamp_()
  ]);
}
