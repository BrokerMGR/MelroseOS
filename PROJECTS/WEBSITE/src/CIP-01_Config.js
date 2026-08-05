
const CIP={
  VERSION:"1.0.0",
  WORKBOOKS:{
    CRM:"1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8",
    WEBSITE:"1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc"
  },
  SHEETS:{
    REGISTRY:"PORTAL_REGISTRY",
    PROFILES:"PORTAL_PROFILES",
    VENDORS:"PORTAL_PREFERRED_VENDORS",
    ACTIVITY:"PORTAL_ACTIVITY",
    ASSUMPTIONS:"PORTAL_MARKET_ASSUMPTIONS",
    INTENT_RULES:"PORTAL_INTENT_RULES",
    COMM_SETTINGS:"PORTAL_COMM_SETTINGS",
    COMM_QUEUE:"PORTAL_COMM_QUEUE",
    HOLIDAYS:"PORTAL_HOLIDAY_CALENDAR"
  },
  TIMEZONE:"America/Chicago",
  WINDOW_START:"09:00",
  WINDOW_END:"18:30",
  DISCLAIMER:{
    FINANCIAL:"Planning estimates are for general informational purposes only and are not a loan estimate, financing offer, insurance quote, appraisal, tax advice, or guarantee. Rates, taxes, insurance, flood insurance, mortgage insurance, fees, and eligibility vary. Contact a licensed local mortgage professional and appropriate insurance/tax professionals for property-specific guidance.",
    VALUATION:"Automated property estimates are ball-park planning estimates only and are not an appraisal or comparative market analysis. Contact Melrose Group Realty for a property-specific professional pricing analysis.",
    FLOOD:"Flood information is provided for general informational purposes only. Flood maps and designations may change and do not predict whether a property will or will not flood. Verify property-specific information with FEMA, local authorities, your lender, and a licensed insurance professional.",
    VENDORS:"Preferred Professional Resources are optional. Consumers are free to select providers of their choice. Inclusion does not guarantee pricing, availability, performance, or services."
  }
};
function CIP_websiteWorkbook_(){return SpreadsheetApp.openById(CIP.WORKBOOKS.WEBSITE);}
function CIP_crmWorkbook_(){return SpreadsheetApp.openById(CIP.WORKBOOKS.CRM);}
function CIP_uuid_(p){return (p||"ID")+"-"+Utilities.getUuid().substring(0,12).toUpperCase();}
function CIP_objects_(s){
  if(!s||s.getLastRow()<2)return[];
  const v=s.getDataRange().getValues(),h=v.shift().map(x=>String(x||"").trim());
  return v.filter(r=>r.some(x=>String(x||"").trim()!=="")).map((r,i)=>{
    const o={_row:i+2};h.forEach((k,j)=>o[k]=r[j]);return o;
  });
}
function CIP_first_(o,n){for(let i=0;i<n.length;i++){const v=o[n[i]];if(v!==null&&v!==undefined&&String(v).trim()!=="")return v;}return"";}
function CIP_normalizeEmail_(v){return String(v||"").trim().toLowerCase();}
function CIP_normalizePhone_(v){return String(v||"").replace(/\D/g,"");}
