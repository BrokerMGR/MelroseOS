
/******************************************************************************
 * MelroseOS Email Worker Registry
 ******************************************************************************/

function MGR_installEmailWorkerRegistry() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("SYS_EMAIL_WORKERS");

  if (!sheet) {
    sheet = ss.insertSheet("SYS_EMAIL_WORKERS");
    sheet.appendRow([
      "WorkerCode","EmailAddress","Purpose","Enabled","Priority",
      "LastSuccessfulRun","LastQuotaError","WorkerStatus","Notes"
    ]);
    sheet.setFrozenRows(1);
  }

  const rows = MGR_objects_(sheet);
  const workers = [
    ["BROKER","melrosegroupbroker@gmail.com","Universal intake / broker authority",true,1],
    ["MGR_LEADS","melrosegroupleads@gmail.com","MGR agent lead servicing",true,2],
    ["AGENT_LEAD_CENTRAL","agentleadcentral@gmail.com","Non-MGR agent lead servicing",true,3],
    ["REALTY","melrosegrouprealty@gmail.com","Recruiting / Agent Academy",true,4],
    ["STAFF","melrosegroupstaff@gmail.com","Portal / past client / operations",true,5]
  ];

  workers.forEach(function(w) {
    const found = rows.find(function(r){ return String(r.WorkerCode) === w[0]; });
    if (!found) {
      sheet.appendRow([w[0],w[1],w[2],w[3],w[4],"","","READY",""]);
    }
  });

  Logger.log(JSON.stringify({success:true,workersConfigured:workers.length},null,2));
}
