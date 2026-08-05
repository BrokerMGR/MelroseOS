
function AE_installRequiredColumns(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const ls=ss.getSheetByName(AE.LEADS_SHEET), as=ss.getSheetByName(AE.AGENTS_SHEET);
  if(!ls||!as) throw new Error("AE_LEADS and AE_AGENTS must exist.");

  AE_ensureColumns_(ls,[
    "AssignedAgentID","AssignedAgentName","AssignedAgentEmail",
    "AssignmentStatus","AssignmentMethod","AssignedAt","AssignmentError",
    "DistributionStatus","AgentSheetStatus","DistributedAt",
    "AgentSheetUpdatedAt","DistributionError"
  ]);

  AE_ensureRoutingStateSheet_();
  Logger.log("Assignment/distribution columns verified.");
}

function AE_systemCheck(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const ls=ss.getSheetByName(AE.LEADS_SHEET), as=ss.getSheetByName(AE.AGENTS_SHEET);
  const r={
    success:!!ls&&!!as&&typeof AE_runAssignmentEngine==="function"&&typeof AE_processDistributionQueue==="function",
    version:AE.VERSION,
    spreadsheet:ss.getName(),
    leadsSheetExists:!!ls,
    agentsSheetExists:!!as,
    routingStateSheetExists:!!ss.getSheetByName(AE.ROUTING_STATE_SHEET),
    leadHeaders:ls?AE_headers_(ls):[],
    agentHeaders:as?AE_headers_(as):[],
    functions:{
      AE_runAssignmentEngine:typeof AE_runAssignmentEngine==="function",
      AE_processDistributionQueue:typeof AE_processDistributionQueue==="function",
      AE_installRequiredColumns:typeof AE_installRequiredColumns==="function"
    }
  };
  Logger.log(JSON.stringify(r,null,2));
  return r;
}

function AE_previewEligibilityForTestLead(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const ls=ss.getSheetByName(AE.LEADS_SHEET), as=ss.getSheetByName(AE.AGENTS_SHEET);
  const lead=AE_objects_(ls).filter(r=>String(r.LeadID||"").indexOf("TESTLEAD_")===0).sort((a,b)=>AE_dateValue_(b.CreatedAt||b.UpdatedAt)-AE_dateValue_(a.CreatedAt||a.UpdatedAt))[0];
  if(!lead) throw new Error("No TESTLEAD_ record found in AE_LEADS.");

  const type=AE_upper_(lead.LeadType||lead.Type||lead.Category);
  const parish=AE_normalizeParish_(lead.Parish||lead.ParishNeeded||lead.CityOrArea);

  const agents=AE_objects_(as).map(a=>({
    agentId:AE_getFirst_(a,["AgentID","ID","Agent Id"]),
    name:AE_getAgentName_(a),
    email:AE_getAgentEmail_(a),
    active:AE_isAgentActive_(a),
    leadTypeEligible:AE_agentSupportsLeadType_(a,type),
    parishEligible:AE_agentSupportsParish_(a,parish),
    eligible:AE_isAgentEligible_(a,type,parish),
    workbookId:AE_getAgentWorkbookId_(a)
  }));

  const r={success:true,leadId:lead.LeadID,leadType:type,parish:parish,agents:agents};
  Logger.log(JSON.stringify(r,null,2));
  return r;
}

function AE_runTestLeadAssignmentOnly(){ return AE_runAssignmentEngine(); }
function AE_runTestLeadDistributionOnly(){ return AE_processDistributionQueue(); }

function AE_ensureColumns_(s,headers){
  const ex=AE_headers_(s); let c=ex.length+1;
  headers.forEach(h=>{ if(ex.indexOf(h)===-1){ s.getRange(1,c).setValue(h); c++; }});
  s.setFrozenRows(1);
}
