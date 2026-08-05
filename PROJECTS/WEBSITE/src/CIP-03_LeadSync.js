
function CIP_syncLeadPortals(){
  CIP_initializePlatform();
  const crm=CIP_crmWorkbook_(),site=CIP_websiteWorkbook_();
  const leads=CIP_objects_(crm.getSheetByName("AE_LEADS"));
  const agents=CIP_objects_(crm.getSheetByName("AE_AGENTS"));
  const regS=site.getSheetByName(CIP.SHEETS.REGISTRY),proS=site.getSheetByName(CIP.SHEETS.PROFILES);
  const regs=CIP_objects_(regS),pros=CIP_objects_(proS),regBy={},proBy={},agentBy={};
  regs.forEach(x=>regBy[String(x.LeadID||"")]=x);
  pros.forEach(x=>proBy[String(x.LeadID||"")]=x);
  agents.forEach(x=>agentBy[String(x.AgentID||"")]=x);
  let created=0,profiles=0;
  leads.forEach(lead=>{
    const id=String(lead.LeadID||"").trim();if(!id)return;
    const aid=String(lead.AssignedAgentID||"").trim(),agent=agentBy[aid]||{};
    if(!regBy[id]){
      const token=CIP_generateToken_();
      regS.appendRow([CIP_uuid_("PORTAL"),id,token,"ACTIVE",lead.LeadType||"",aid,lead.AssignedAgentName||agent.AgentName||"",lead.AssignedAgentEmail||agent.Email||agent.AgentEmail||"",0,"NEW","OPEN_DASHBOARD","",new Date(),new Date()]);
      regBy[id]={LeadID:id,PortalToken:token};created++;
    }
    const d=CIP_findDetailedLead_(lead,agent);
    CIP_upsertProfile_(proS,proBy[id],lead,d,agent);profiles++;
  });
  return{success:true,version:CIP.VERSION,leadsScanned:leads.length,portalsCreated:created,profilesUpdated:profiles};
}
function CIP_findDetailedLead_(lead,agent){
  const wid=String(CIP_first_(agent,["AgentLeadsSheetId","LeadsSheetId","LeadSheetId"])||"").trim();
  if(!wid)return{};
  try{
    const ss=SpreadsheetApp.openById(wid),s=ss.getSheetByName("Leads")||ss.getSheetByName("LEADS")||ss.getSheets()[0];
    const rows=CIP_objects_(s),id=String(lead.LeadID||""),em=CIP_normalizeEmail_(lead.Email),ph=CIP_normalizePhone_(lead.Phone);
    return rows.find(r=>(id&&String(r.LeadID||"")===id)||(em&&CIP_normalizeEmail_(r.Email)===em)||(ph&&CIP_normalizePhone_(r.Phone)===ph))||{};
  }catch(e){return{};}
}
function CIP_upsertProfile_(s,existing,lead,d,agent){
  const full=String(d.FullName||((String(lead.FirstName||"")+" "+String(lead.LastName||"")).trim()));
  const v={
    LeadID:lead.LeadID||"",LeadType:lead.LeadType||d.LeadType||"",FirstName:lead.FirstName||"",LastName:lead.LastName||"",FullName:full,
    Email:lead.Email||d.Email||"",Phone:lead.Phone||d.Phone||"",PreferredContactMethod:d.PreferredContactMethod||"",
    Parish:lead.Parish||d.ParishNeeded||"",CityOrArea:d.CityOrArea||"",Timeline:d.Timeline||"",PriceRangeOrRentBudget:d.PriceRangeOrRentBudget||"",
    Bedrooms:d.Bedrooms||"",Bathrooms:d.Bathrooms||"",FinancingStatus:d.FinancingStatus||"",PropertyToSellAddress:d.PropertyToSellAddress||"",
    ReasonForMoveOrSell:d.ReasonForMoveOrSell||"",NotesFromLead:d.NotesFromLead||"",SourceCampaign:d.SourceCampaign||lead.Source||"",
    AssignedAgentID:lead.AssignedAgentID||"",AssignedAgentName:lead.AssignedAgentName||agent.AgentName||"",AssignedAgentEmail:lead.AssignedAgentEmail||agent.Email||agent.AgentEmail||"",
    Status:lead.Status||d.Status||"",RawJson:JSON.stringify(d||{}),UpdatedAt:new Date()
  };
  const h=s.getRange(1,1,1,s.getLastColumn()).getDisplayValues()[0].map(x=>String(x||"").trim());
  const row=h.map(k=>Object.prototype.hasOwnProperty.call(v,k)?v[k]:"");
  if(existing&&existing._row)s.getRange(existing._row,1,1,row.length).setValues([row]);else s.appendRow(row);
}
function CIP_generateToken_(){
  const seed=Utilities.getUuid()+"|"+Date.now()+"|"+Math.random();
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,seed,Utilities.Charset.UTF_8).map(b=>("0"+((b<0?b+256:b).toString(16))).slice(-2)).join("");
}
function CIP_getPortalLinkByLeadId(id){
  const r=CIP_objects_(CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.REGISTRY)).find(x=>String(x.LeadID||"")===String(id||""));
  if(!r)return"";
  const base=ScriptApp.getService().getUrl();
  return base?base+"?t="+encodeURIComponent(r.PortalToken):"WEB_APP_NOT_DEPLOYED?t="+r.PortalToken;
}
