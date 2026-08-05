
function AE_processDistributionQueue(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const ls=ss.getSheetByName(AE.LEADS_SHEET), as=ss.getSheetByName(AE.AGENTS_SHEET);
  if(!ls||!as) throw new Error("AE_LEADS and AE_AGENTS are required.");

  const agents=AE_objects_(as);
  const stats={success:true,candidates:0,distributed:0,alreadyPresent:0,missingWorkbook:0,errors:0};

  const leads=AE_objects_(ls).filter(l=>{
    const assigned=String(l.AssignedAgentID||"").trim()||String(l.AssignedAgentName||"").trim();
    const st=AE_upper_(l.DistributionStatus||l.AgentSheetStatus||"");
    return !!assigned&&["VERIFIED","COMPLETED","DISTRIBUTED","SYNCED","SUCCESS"].indexOf(st)===-1;
  });

  leads.forEach(lead=>{
    stats.candidates++;
    try{
      const agent=AE_findAssignedAgentRecord_(lead,agents);
      if(!agent) throw new Error("Assigned agent not found in AE_AGENTS.");

      const wid=AE_getAgentWorkbookId_(agent);
      if(!wid){
        stats.missingWorkbook++;
        AE_updateRow_(ls,lead.__rowNumber,{DistributionStatus:"MISSING_AGENT_WORKBOOK",AgentSheetStatus:"PENDING",DistributionError:"No agent workbook ID configured in AE_AGENTS.",UpdatedAt:new Date()});
        return;
      }

      const r=AE_writeLeadToAgentWorkbook_(wid,lead);

      AE_updateRow_(ls,lead.__rowNumber,{
        DistributionStatus:r.duplicate?"VERIFIED":"DISTRIBUTED",
        AgentSheetStatus:"VERIFIED",
        DistributedAt:lead.DistributedAt||new Date(),
        AgentSheetUpdatedAt:new Date(),
        DistributionError:"",
        UpdatedAt:new Date()
      });

      if(r.duplicate) stats.alreadyPresent++; else stats.distributed++;
    }catch(e){
      stats.errors++;
      AE_updateRow_(ls,lead.__rowNumber,{DistributionStatus:"ERROR",AgentSheetStatus:"PENDING",DistributionError:String(e.stack||e),UpdatedAt:new Date()});
    }
  });

  Logger.log(JSON.stringify(stats,null,2));
  return stats;
}

function AE_findAssignedAgentRecord_(lead,agents){
  const id=String(lead.AssignedAgentID||"").trim();
  const name=String(lead.AssignedAgentName||"").trim();
  const email=AE_normalizeEmail_(lead.AssignedAgentEmail||"");
  return agents.find(a=>{
    const aid=String(AE_getFirst_(a,["AgentID","ID","Agent Id"])||"").trim();
    return (id&&aid===id)||(email&&AE_getAgentEmail_(a)===email)||(name&&AE_getAgentName_(a)===name);
  })||null;
}

function AE_getAgentWorkbookId_(a){
  return String(AE_getFirst_(a,[
    "AgentLeadsSheetId","AgentLeadsWorkbookId","LeadWorkbookId","LeadsWorkbookId",
    "LeadSheetId","WorkbookID","WorkbookId","SpreadsheetID","SpreadsheetId"
  ])||"").trim();
}

function AE_writeLeadToAgentWorkbook_(wid,lead){
  const wb=SpreadsheetApp.openById(wid);
  const s=AE_findAgentLeadSheet_(wb);
  if(!s) throw new Error("No usable lead worksheet found.");
  const ex=AE_findExistingLeadInAgentSheet_(s,lead);
  if(ex) return {success:true,duplicate:true,rowNumber:ex.__rowNumber};

  const h=AE_headers_(s);
  if(!h.length) throw new Error("Assigned agent lead sheet has no header row.");

  const p={};
  h.forEach(x=>{ if(Object.prototype.hasOwnProperty.call(lead,x)) p[x]=lead[x]; });
  if(h.indexOf("Name")!==-1&&p.Name===undefined) p.Name=lead.FullName||"";
  if(h.indexOf("Lead Name")!==-1&&p["Lead Name"]===undefined) p["Lead Name"]=lead.FullName||"";
  if(h.indexOf("Type")!==-1&&p.Type===undefined) p.Type=lead.LeadType||"";
  if(h.indexOf("Category")!==-1&&p.Category===undefined) p.Category=lead.LeadType||"";

  AE_appendRow_(s,p);
  return {success:true,duplicate:false,rowNumber:s.getLastRow()};
}

function AE_findAgentLeadSheet_(wb){
  for(const n of ["Leads","LEADS","Agent Leads","AGENT LEADS","Lead Pipeline","Pipeline"]){
    const s=wb.getSheetByName(n); if(s) return s;
  }
  return wb.getSheets()[0]||null;
}

function AE_findExistingLeadInAgentSheet_(s,lead){
  const id=String(lead.LeadID||"").trim();
  const email=AE_normalizeEmail_(lead.Email||"");
  const phone=AE_normalizePhone_(lead.Phone||"");
  return AE_objects_(s).find(r=>
    (id&&String(r.LeadID||"")===id)||
    (email&&AE_normalizeEmail_(r.Email||"")===email)||
    (phone&&AE_normalizePhone_(r.Phone||"")===phone)
  )||null;
}
