/******************************************************************************
 * File: AC-02_SLATracking.gs
 * Version: 1.0.0
 ******************************************************************************/

function AC_syncAssignedLeads(limit) {
  AC_initialize();
  const config=AC_getConfig_();
  const leads=AE_sheetObjects_(AE.SHEETS.LEADS)
    .filter(function(l){return String(l.AssignedAgentID||"").trim()!=="";})
    .slice(0,Math.max(1,Number(limit||500)));

  let created=0, updated=0;

  leads.forEach(function(lead){
    const leadId=String(lead.LeadID||"").trim();
    if (!leadId) return;

    const agent=typeof AE_getAgent==="function"
      ? AE_getAgent(lead.AssignedAgentID) : null;

    const assignedAt=AC_date_(
      lead.AssignedAt || lead.UpdatedAt || lead.CreatedAt || new Date()
    );

    const firstDue=new Date(assignedAt.getTime()+config.firstContactMinutes*60000);
    const escalationDue=new Date(assignedAt.getTime()+config.escalationMinutes*60000);

    const lifecycle=typeof LC_findLifecycleRow_==="function"
      ? (function(){
          const row=LC_findLifecycleRow_(leadId);
          return row ? LC_getLifecycleByRow_(row) : {};
        })() : {};

    const existing=AC_findTracking_(leadId);
    const firstContact=existing ? existing.FirstContactAt : "";
    const lifecycleStatus=String(lifecycle.CurrentStatus||lead.Status||"ASSIGNED").toUpperCase();

    const payload=[
      leadId,
      lead.AssignedAgentID||"",
      agent ? agent.AgentName||"" : lead.AssignedAgentName||"",
      agent ? (agent.Email||agent.AgentEmail||"") : "",
      lead.Name||lead.LeadName||lead.FullName||"",
      lead.Email||"",
      lead.Phone||"",
      lead.LeadType||"",
      lead.Parish||"",
      assignedAt,
      firstDue,
      escalationDue,
      firstContact||"",
      existing ? existing.SLAStatus||"PENDING" : "PENDING",
      existing ? existing.LastAlertAt||"" : "",
      existing ? existing.EscalatedAt||"" : "",
      lifecycleStatus,
      timestamp_()
    ];

    const sheet=workbook_().getSheetByName(AC.SHEETS.TRACKING);
    if (existing) {
      sheet.getRange(existing._row,1,1,payload.length).setValues([payload]);
      updated++;
    } else {
      sheet.appendRow(payload);
      created++;
    }
  });

  return {success:true,processed:leads.length,created:created,updated:updated};
}

function AC_date_(v) {
  const d=v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

function AC_detectFirstContacts() {
  AC_initialize();
  const rows=AC_objects_(AC.SHEETS.TRACKING);
  const sheet=workbook_().getSheetByName(AC.SHEETS.TRACKING);
  let changed=0;

  rows.forEach(function(r){
    if (r.FirstContactAt) return;

    let first=null;

    if (typeof LC_sheetObjects_==="function") {
      const activities=LC_sheetObjects_(LC.SHEETS.ACTIVITY)
        .filter(function(a){
          return String(a.LeadID||"")===String(r.LeadID||"");
        });

      activities.forEach(function(a){
        const type=String(a.ActivityType||"").toUpperCase();
        if (["EMAIL","CALL","TEXT","REPLY"].indexOf(type)===-1) return;
        const d=AC_date_(a.OccurredAt);
        if (!first || d<first) first=d;
      });
    }

    if (!first) return;

    const due=AC_date_(r.FirstContactDueAt);
    AC_set_(sheet,r._row,"FirstContactAt",first);
    AC_set_(sheet,r._row,"SLAStatus",first<=due ? "MET" : "MISSED");
    AC_set_(sheet,r._row,"UpdatedAt",timestamp_());
    changed++;
  });

  return {success:true,firstContactsRecorded:changed};
}
