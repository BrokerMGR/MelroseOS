
function doGet(e){
  CIP_initializePlatform();
  const t=String(e&&e.parameter&&e.parameter.t?e.parameter.t:"").trim();
  const x=HtmlService.createTemplateFromFile("Portal");x.portalToken=t;
  return x.evaluate().setTitle("Melrose Group Realty Client Portal").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function CIP_getPortalData(token){
  CIP_initializePlatform();
  const r=CIP_getRegistryByToken_(token);if(!r)return{success:false,message:"This portal link is invalid or inactive."};
  const p=CIP_objects_(CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.PROFILES)).find(x=>String(x.LeadID||"")===String(r.LeadID||""));
  if(!p)return{success:false,message:"Your portal profile is still being prepared. Please check again shortly."};
  const a={};CIP_objects_(CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.ASSUMPTIONS)).forEach(x=>a[String(x.Key||"")]=x.Value);
  CIP_logPortalActivity(token,"DASHBOARD_OPEN","","PORTAL",{});
  return{success:true,portalToken:token,portal:{leadId:r.LeadID,leadType:String(p.LeadType||"").toUpperCase(),firstName:p.FirstName||"",fullName:p.FullName||"",assignedAgentName:p.AssignedAgentName||"",assignedAgentEmail:p.AssignedAgentEmail||"",intentScore:Number(r.IntentScore||0),intentLevel:r.IntentLevel||"NEW"},criteria:{parish:p.Parish||"",cityOrArea:p.CityOrArea||"",timeline:p.Timeline||"",budget:p.PriceRangeOrRentBudget||"",bedrooms:p.Bedrooms||"",bathrooms:p.Bathrooms||"",financingStatus:p.FinancingStatus||"",propertyToSellAddress:p.PropertyToSellAddress||""},assumptions:a,vendors:CIP_getVendorsForLead_(p),disclaimers:CIP.DISCLAIMER};
}
