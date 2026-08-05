/******************************************************************************
 * File: AC-04_Metrics.gs
 * Version: 1.0.0
 ******************************************************************************/

function AC_refreshAgentMetrics() {
  AC_initialize();
  const rows=AC_objects_(AC.SHEETS.TRACKING);
  const grouped={};

  rows.forEach(function(r){
    const id=String(r.AgentID||"UNASSIGNED");
    if (!grouped[id]) grouped[id]={
      name:r.AgentName||"",assigned:0,met:0,missed:0,overdue:0,escalated:0,
      contactMinutes:[]
    };
    const g=grouped[id];
    g.assigned++;

    const s=String(r.SLAStatus||"").toUpperCase();
    if (s==="MET") g.met++;
    if (s==="MISSED") g.missed++;
    if (s==="OVERDUE") g.overdue++;
    if (s==="ESCALATED") {g.overdue++;g.escalated++;}

    if (r.FirstContactAt && r.AssignedAt) {
      const mins=(AC_date_(r.FirstContactAt)-AC_date_(r.AssignedAt))/60000;
      if (isFinite(mins) && mins>=0) g.contactMinutes.push(mins);
    }
  });

  const sheet=workbook_().getSheetByName(AC.SHEETS.METRICS);
  if (sheet.getLastRow()>1) {
    sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).clearContent();
  }

  const out=Object.keys(grouped).map(function(id){
    const g=grouped[id];
    const measured=g.met+g.missed+g.overdue;
    const pct=measured ? (g.met/measured)*100 : 100;
    const avg=g.contactMinutes.length
      ? g.contactMinutes.reduce(function(a,b){return a+b;},0)/g.contactMinutes.length
      : "";
    return [id,g.name,g.assigned,g.met,g.missed,g.overdue,g.escalated,
      Math.round(pct*10)/10,avg===""?"":Math.round(avg*10)/10,timestamp_()];
  });

  if (out.length) sheet.getRange(2,1,out.length,out[0].length).setValues(out);
  autoResize_(sheet);
  return {success:true,agents:out.length};
}
