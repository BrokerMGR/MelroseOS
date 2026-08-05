
/******************************************************************************
 * MelroseOS CRM - Agent Affiliation + Capacity
 * Version 1.0.0
 ******************************************************************************/

function MGR_installAffiliationFields() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const agents = ss.getSheetByName("AE_AGENTS");
  const leads = ss.getSheetByName("AE_LEADS");

  if (!agents || !leads) {
    throw new Error("AE_AGENTS and AE_LEADS are required.");
  }

  MGR_ensureColumns_(agents, [
    "BrokerageAffiliation",
    "IsMGRAgent",
    "BrokerageName",
    "ExternalBrokerageName",
    "LeadServiceAccount",
    "LeadDistributionGroup",
    "PortalEnabled",
    "PortalRole"
  ]);

  MGR_ensureColumns_(leads, [
    "AssignedAgentIsMGR",
    "AssignedAgentBrokerage",
    "AssignedAgentServiceAccount",
    "AssignedAgentDistributionGroup"
  ]);

  Logger.log("Affiliation + portal fields installed.");
}

function MGR_stampAgentAffiliationOnLeads() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const agentsSheet = ss.getSheetByName("AE_AGENTS");
  const leadsSheet = ss.getSheetByName("AE_LEADS");

  const agents = MGR_objects_(agentsSheet);
  const leads = MGR_objects_(leadsSheet);
  let updated = 0;

  leads.forEach(function(lead) {
    const agentId = String(lead.AssignedAgentID || "").trim();
    if (!agentId) return;

    const agent = agents.find(function(a) {
      return String(a.AgentID || "").trim() === agentId;
    });
    if (!agent) return;

    const isMgr = MGR_bool_(agent.IsMGRAgent);

    MGR_updateMapped_(leadsSheet, lead.__rowNumber, {
      AssignedAgentIsMGR: isMgr,
      AssignedAgentBrokerage:
        agent.BrokerageName ||
        agent.ExternalBrokerageName ||
        agent.BrokerageAffiliation ||
        "",
      AssignedAgentServiceAccount:
        agent.LeadServiceAccount ||
        (isMgr ? "MGR_LEADS" : "AGENT_LEAD_CENTRAL"),
      AssignedAgentDistributionGroup:
        agent.LeadDistributionGroup ||
        (isMgr ? "MGR" : "NON_MGR"),
      UpdatedAt: new Date()
    });

    updated++;
  });

  Logger.log(JSON.stringify({success:true, updated:updated}, null, 2));
}

function MGR_capacityMonitor() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  let allocatedCells = 0;
  let estimatedUsedCells = 0;

  const detail = sheets.map(function(sheet) {
    const allocated = sheet.getMaxRows() * sheet.getMaxColumns();
    const used = Math.max(sheet.getLastRow(), 1) * Math.max(sheet.getLastColumn(), 1);

    allocatedCells += allocated;
    estimatedUsedCells += used;

    return {
      sheet: sheet.getName(),
      maxRows: sheet.getMaxRows(),
      maxColumns: sheet.getMaxColumns(),
      allocatedCells: allocated,
      usedRows: sheet.getLastRow(),
      usedColumns: sheet.getLastColumn(),
      estimatedUsedCells: used
    };
  });

  const result = {
    success: true,
    spreadsheet: ss.getName(),
    sheetCount: sheets.length,
    allocatedCells: allocatedCells,
    estimatedUsedCells: estimatedUsedCells,
    percentOf10MAllocated: Number((allocatedCells / 10000000 * 100).toFixed(2)),
    percentOf10MEstimatedUsed: Number((estimatedUsedCells / 10000000 * 100).toFixed(2)),
    sheets: detail
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function MGR_ensureColumns_(sheet, headers) {
  const existing = MGR_headers_(sheet);
  let col = existing.length + 1;

  headers.forEach(function(header) {
    if (existing.indexOf(header) === -1) {
      sheet.getRange(1, col).setValue(header);
      col++;
    }
  });
}

function MGR_headers_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1,1,1,sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(function(v){ return String(v || "").trim(); });
}

function MGR_objects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = MGR_headers_(sheet);
  const values = sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();

  return values.map(function(row, i) {
    const obj = {__rowNumber:i+2};
    headers.forEach(function(h,j){ obj[h] = row[j]; });
    return obj;
  });
}

function MGR_updateMapped_(sheet, rowNumber, payload) {
  const headers = MGR_headers_(sheet);
  const current = sheet.getRange(rowNumber,1,1,headers.length).getValues()[0];

  sheet.getRange(rowNumber,1,1,headers.length).setValues([
    headers.map(function(h,i) {
      return payload[h] !== undefined ? payload[h] : current[i];
    })
  ]);
}

function MGR_bool_(value) {
  if (value === true) return true;
  return ["TRUE","YES","Y","1","MGR"].indexOf(
    String(value || "").trim().toUpperCase()
  ) !== -1;
}
