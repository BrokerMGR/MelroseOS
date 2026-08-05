
function CIP_getRegistryByToken_(token){
  return CIP_objects_(CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.REGISTRY)).find(r=>String(r.PortalToken||"")===String(token||"")&&String(r.PortalStatus||"").toUpperCase()==="ACTIVE")||null;
}
function CIP_logPortalActivity(token,type,value,section,meta){
  const portal=CIP_getRegistryByToken_(token);if(!portal)throw new Error("Invalid or inactive portal token.");
  CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.ACTIVITY).appendRow([CIP_uuid_("ACT"),portal.LeadID,token,type||"",value||"",section||"",JSON.stringify(meta||{}),new Date()]);
  return CIP_refreshIntentForLead_(portal.LeadID);
}
function CIP_refreshIntentForLead_(leadId){
  const ss=CIP_websiteWorkbook_(),acts=CIP_objects_(ss.getSheetByName(CIP.SHEETS.ACTIVITY)).filter(x=>String(x.LeadID||"")===String(leadId||""));
  const points={};CIP_objects_(ss.getSheetByName(CIP.SHEETS.INTENT_RULES)).forEach(r=>{if(String(r.Active||"").toUpperCase()==="TRUE")points[String(r.ActivityType||"")]=Number(r.Points||0);});
  let score=0;acts.forEach(a=>score+=points[String(a.ActivityType||"")]||0);score=Math.min(100,score);
  let level="NEW";if(score>=80)level="HIGH_INTENT";else if(score>=50)level="ENGAGED";else if(score>=20)level="WARM";
  let next="SEND_PORTAL_INTRO",types={};acts.forEach(a=>types[String(a.ActivityType||"")]=true);
  if(types.VALUATION_REQUESTED)next="AGENT_FOLLOW_UP_VALUATION";
  else if(types.CONTACT_AGENT||types.CONSULTATION_CLICK)next="AGENT_CONTACT_NOW";
  else if(level==="HIGH_INTENT")next="AGENT_PRIORITY_OUTREACH";
  else if(types.CALCULATOR_USED)next="OFFER_FINANCING_CONVERSATION";
  else if(types.DASHBOARD_OPEN)next="ENCOURAGE_NEXT_STEP";
  const s=ss.getSheetByName(CIP.SHEETS.REGISTRY),r=CIP_objects_(s).find(x=>String(x.LeadID||"")===String(leadId||""));
  if(r){s.getRange(r._row,9).setValue(score);s.getRange(r._row,10).setValue(level);s.getRange(r._row,11).setValue(next);s.getRange(r._row,12).setValue(new Date());s.getRange(r._row,14).setValue(new Date());}
  return{success:true,leadId:intentLeadId_(leadId),intentScore:score,intentLevel:level,nextBestAction:next};
}
function intentLeadId_(v){return String(v||"");}
function CIP_getLeadIntelligenceSummary(leadId){
  const ss=CIP_websiteWorkbook_(),r=CIP_objects_(ss.getSheetByName(CIP.SHEETS.REGISTRY)).find(x=>String(x.LeadID||"")===String(leadId||"")),p=CIP_objects_(ss.getSheetByName(CIP.SHEETS.PROFILES)).find(x=>String(x.LeadID||"")===String(leadId||""));
  if(!r||!p)return{success:false,message:"Lead portal profile not found."};
  return{success:true,leadId:leadId,client:p.FullName||((p.FirstName||"")+" "+(p.LastName||"")).trim(),leadType:p.LeadType,intentScore:r.IntentScore,intentLevel:r.IntentLevel,nextBestAction:r.NextBestAction,lastPortalActivity:r.LastPortalActivity,criteria:{parish:p.Parish,cityOrArea:p.CityOrArea,timeline:p.Timeline,budget:p.PriceRangeOrRentBudget,bedrooms:p.Bedrooms,bathrooms:p.Bathrooms,financingStatus:p.FinancingStatus}};
}
