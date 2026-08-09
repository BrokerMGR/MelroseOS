
const AE = {
  VERSION:"1.0.0",
  LEADS_SHEET:"AE_LEADS",
  AGENTS_SHEET:"AE_AGENTS",
  ROUTING_STATE_SHEET:"AE_ROUTING_STATE",
  BROKER_EMAIL:"melrosegroupbroker@gmail.com",
  BROKER_NAME:"Ulysses A. Barnes, Jr."
};

function AE_runAssignmentEngine(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const ls=ss.getSheetByName(AE.LEADS_SHEET);
  const as=ss.getSheetByName(AE.AGENTS_SHEET);
  if(!ls||!as) throw new Error("AE_LEADS and AE_AGENTS are required.");
  AE_ensureRoutingStateSheet_();

  const stats={success:true,version:AE.VERSION,candidates:0,assigned:0,retained:0,brokerAssigned:0,manualRespected:0,noEligibleAgent:0,errors:0};
  const agents=AE_objects_(as);
  const leads=AE_objects_(ls)
    .filter(AE_isAssignmentCandidate_)
    .sort((a,b)=>AE_dateValue_(b.CreatedAt||b.ReceivedAt||b.UpdatedAt)-AE_dateValue_(a.CreatedAt||a.ReceivedAt||a.UpdatedAt));

  leads.forEach(lead=>{
    stats.candidates++;
    try{
      const r=AE_assignLead_(lead,ls,agents);
      if(r==="ASSIGNED") stats.assigned++;
      else if(r==="RETAINED") stats.retained++;
      else if(r==="BROKER") stats.brokerAssigned++;
      else if(r==="MANUAL") stats.manualRespected++;
      else if(r==="NO_ELIGIBLE_AGENT") stats.noEligibleAgent++;
    }catch(e){
      stats.errors++;
      AE_updateRow_(ls,lead.__rowNumber,{AssignmentStatus:"ERROR",AssignmentError:String(e.stack||e),UpdatedAt:new Date()});
    }
  });
  Logger.log(JSON.stringify(stats,null,2));
  return stats;
}

function AE_assignLead_(lead,ls,agents){
  const type=AE_upper_(lead.LeadType||lead.Type||lead.Category);

  if(AE_hasManualAssignment_(lead)){
    AE_updateRow_(ls,lead.__rowNumber,{AssignmentStatus:"ASSIGNED_MANUAL",AssignmentMethod:"MANUAL",AssignmentError:"",UpdatedAt:new Date()});
    return "MANUAL";
  }

  if(type==="RECRUITING"){
    const broker=AE_findBrokerAgent_(agents);
    AE_applyAssignment_(ls,lead.__rowNumber,
      broker?AE_getFirst_(broker,["AgentID","ID","Agent Id"]):"BROKER",
      broker?AE_getAgentName_(broker):AE.BROKER_NAME,
      broker?AE_getAgentEmail_(broker):AE.BROKER_EMAIL,
      "BROKER_OVERRIDE");
    return "BROKER";
  }

  const prior=AE_findPriorAssignment_(lead,ls);
  if(prior){
    AE_applyAssignment_(ls,lead.__rowNumber,prior.agentId,prior.agentName,prior.agentEmail,"LEAD_LOCK");
    return "RETAINED";
  }

  const parish=AE_normalizeParish_(lead.Parish||lead.ParishNeeded||lead.CityOrArea);
  const eligible=agents.filter(a=>AE_isAgentEligible_(a,type,parish));

  if(!eligible.length){
    AE_updateRow_(ls,lead.__rowNumber,{
      AssignmentStatus:"NO_ELIGIBLE_AGENT",
      AssignmentMethod:"ROUND_ROBIN",
      AssignmentError:"No active eligible agent for "+type+" / "+(parish||"UNSPECIFIED"),
      UpdatedAt:new Date()
    });
    return "NO_ELIGIBLE_AGENT";
  }

  const selected=AE_selectRoundRobinAgent_(eligible,type,parish);
  const id=AE_getFirst_(selected,["AgentID","ID","Agent Id"]);
  const name=AE_getAgentName_(selected);
  const email=AE_getAgentEmail_(selected);

  AE_applyAssignment_(ls,lead.__rowNumber,id,name,email,"ROUND_ROBIN");
  AE_writeRoutingState_(type,parish,id,name);
  return "ASSIGNED";
}

function AE_isAssignmentCandidate_(lead){
  const type=AE_upper_(lead.LeadType||lead.Type||lead.Category);
  if(["BUYER","SELLER","RENTER","RECRUITING"].indexOf(type)===-1) return false;
  const st=AE_upper_(lead.Status||"NEW");
  if(["CLOSED","ARCHIVED","DNC","DO_NOT_CONTACT"].indexOf(st)!==-1) return false;
  const ast=AE_upper_(lead.AssignmentStatus||"");
  const has=String(lead.AssignedAgentID||"").trim()||String(lead.AssignedAgentName||"").trim();
  return !(has&&["ASSIGNED","ASSIGNED_MANUAL","ASSIGNED_LOCKED"].indexOf(ast)!==-1);
}

function AE_hasManualAssignment_(lead){
  const has=String(lead.AssignedAgentID||"").trim()||String(lead.AssignedAgentName||"").trim();
  const method=AE_upper_(lead.AssignmentMethod||lead.AssignmentSource||"");
  const flag=AE_upper_(lead.ManualAssignment||lead.ManualAssign||"");
  return !!has&&(method==="MANUAL"||["YES","TRUE","1"].indexOf(flag)!==-1);
}

function AE_findPriorAssignment_(lead,ls){
  const email=AE_normalizeEmail_(lead.Email), phone=AE_normalizePhone_(lead.Phone), id=String(lead.LeadID||"");
  if(!email&&!phone) return null;
  const rows=AE_objects_(ls);
  for(let i=rows.length-1;i>=0;i--){
    const r=rows[i];
    if(id&&String(r.LeadID||"")===id) continue;
    const match=(email&&AE_normalizeEmail_(r.Email)===email)||(phone&&AE_normalizePhone_(r.Phone)===phone);
    if(!match) continue;
    const aid=String(r.AssignedAgentID||"").trim(), an=String(r.AssignedAgentName||"").trim();
    if(aid||an) return {agentId:aid,agentName:an,agentEmail:String(r.AssignedAgentEmail||"").trim()};
  }
  return null;
}

function AE_isAgentEligible_(a,type,parish){
  return AE_isAgentActive_(a)&&AE_agentSupportsLeadType_(a,type)&&AE_agentSupportsParish_(a,parish);
}

function AE_isAgentActive_(a){
  const raw=AE_getFirst_(a,["Active","IsActive","Status","AgentStatus","Enabled","Available"]);
  if(raw==="") return true;
  const v=AE_upper_(raw);
  if(["PAUSED","INACTIVE","NO","FALSE","DISABLED","0"].indexOf(v)!==-1) return false;
  return !/PAUS|INACTIVE|DISABLED|OFFBOARD|TERMINATED/.test(v);
}

function AE_agentSupportsLeadType_(a,type){
  const raw=AE_getFirst_(a,["LeadTypes","LeadType","EligibleLeadTypes","Categories","Specialties","Services"]);
  if(!raw) return true;
  const vals=AE_splitMulti_(raw);
  return vals.indexOf("ALL")!==-1||vals.indexOf(type)!==-1;
}

function AE_agentSupportsParish_(a,parish){
  const raw=AE_getFirst_(a,["Parishes","Parish","ServiceAreas","ServiceArea","Areas","Coverage","Territory"]);
  if(!raw) return true;
  const vals=AE_splitMulti_(raw);
  if(vals.indexOf("ALL")!==-1) return true;
  return !!parish&&vals.indexOf(parish)!==-1;
}

function AE_findBrokerAgent_(agents){
  const be=AE_normalizeEmail_(AE.BROKER_EMAIL);
  return agents.find(a=>AE_getAgentEmail_(a)===be)||
         agents.find(a=>AE_getAgentName_(a).toUpperCase()===AE.BROKER_NAME.toUpperCase())||
         null;
}

function AE_selectRoundRobinAgent_(eligible,type,parish){
  const sorted=eligible.slice().sort((a,b)=>String(AE_getFirst_(a,["AgentID","ID","Agent Id"])).localeCompare(String(AE_getFirst_(b,["AgentID","ID","Agent Id"]))));
  const state=AE_getRoutingState_(type,parish);
  if(!state||!state.LastAgentID) return sorted[0];
  const idx=sorted.findIndex(a=>String(AE_getFirst_(a,["AgentID","ID","Agent Id"]))===String(state.LastAgentID));
  return idx<0?sorted[0]:sorted[(idx+1)%sorted.length];
}

function AE_applyAssignment_(ls,row,id,name,email,method){
  AE_updateRow_(ls,row,{
    AssignedAgentID:id||"",
    AssignedAgentName:name||"",
    AssignedAgentEmail:email||"",
    AssignmentStatus:"ASSIGNED",
    AssignmentMethod:method||"",
    AssignedAt:new Date(),
    AssignmentError:"",
    UpdatedAt:new Date()
  });
}

function AE_ensureRoutingStateSheet_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let s=ss.getSheetByName(AE.ROUTING_STATE_SHEET);
  if(!s){
    s=ss.insertSheet(AE.ROUTING_STATE_SHEET);
    s.appendRow(["RouteKey","LeadType","Parish","LastAgentID","LastAgentName","LastAssignedAt","UpdatedAt"]);
    s.setFrozenRows(1);
  }
  return s;
}

function AE_getRoutingState_(type,parish){
  const key=AE_routeKey_(type,parish);
  return AE_objects_(AE_ensureRoutingStateSheet_()).find(r=>String(r.RouteKey||"")===key)||null;
}

function AE_writeRoutingState_(type,parish,id,name){
  const s=AE_ensureRoutingStateSheet_(), key=AE_routeKey_(type,parish), ex=AE_getRoutingState_(type,parish);
  const p={RouteKey:key,LeadType:type,Parish:parish,LastAgentID:id||"",LastAgentName:name||"",LastAssignedAt:new Date(),UpdatedAt:new Date()};
  if(ex) AE_updateRow_(s,ex.__rowNumber,p); else AE_appendRow_(s,p);
}

function AE_routeKey_(type,parish){ return AE_upper_(type)+"|"+AE_normalizeParish_(parish||"UNSPECIFIED"); }
function AE_getAgentName_(a){ return String(AE_getFirst_(a,["AgentName","FullName","Name"])||"").trim(); }
function AE_getAgentEmail_(a){ return AE_normalizeEmail_(AE_getFirst_(a,["Email","AgentEmail","WorkEmail"])); }
function AE_getFirst_(o,keys){ for(const k of keys){ if(o[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=="") return o[k]; } return ""; }
function AE_splitMulti_(v){ return String(v||"").split(/[,;|/\n]+/).map(x=>AE_upper_(x).replace(/\s+PARISH$/i,"").trim()).filter(Boolean); }
function AE_normalizeParish_(v){ return AE_upper_(v).replace(/\s+PARISH$/i,"").trim(); }
function AE_upper_(v){ return String(v||"").trim().toUpperCase(); }
function AE_normalizeEmail_(v){ return String(v||"").trim().toLowerCase(); }
function AE_normalizePhone_(v){ const d=String(v||"").replace(/\D/g,""); return d.length>10?d.slice(-10):d; }
function AE_dateValue_(v){ if(v instanceof Date) return v.getTime(); const d=new Date(v); return isNaN(d.getTime())?0:d.getTime(); }
function AE_headers_(s){ if(!s||s.getLastColumn()<1) return []; return s.getRange(1,1,1,s.getLastColumn()).getDisplayValues()[0].map(v=>String(v||"").trim()); }
function AE_objects_(s){ if(!s||s.getLastRow()<2) return []; const h=AE_headers_(s), vals=s.getRange(2,1,s.getLastRow()-1,h.length).getValues(); return vals.map((r,i)=>{ const o={__rowNumber:i+2}; h.forEach((x,j)=>o[x]=r[j]); return o; }); }
function AE_appendRow_(s,p){ const h=AE_headers_(s); s.appendRow(h.map(x=>p[x]!==undefined?p[x]:"")); }
function AE_updateRow_(s,row,p){ const h=AE_headers_(s), cur=s.getRange(row,1,1,h.length).getValues()[0]; s.getRange(row,1,1,h.length).setValues([h.map((x,i)=>p[x]!==undefined?p[x]:cur[i])]); }
