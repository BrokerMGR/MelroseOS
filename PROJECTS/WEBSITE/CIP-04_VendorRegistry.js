
function CIP_getVendorsForLead_(profile){
  const vendors=CIP_objects_(CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.VENDORS));
  const type=String(profile.LeadType||"").toUpperCase(),parish=String(profile.Parish||"").toUpperCase();
  return vendors.filter(v=>{
    if(String(v.Active||"").toUpperCase()!=="TRUE")return false;
    const types=String(v.LeadTypes||"").toUpperCase().split(",").map(x=>x.trim()).filter(Boolean);
    const parishes=String(v.Parishes||"").toUpperCase().split(",").map(x=>x.trim()).filter(Boolean);
    return (!types.length||types.includes("ALL")||types.includes(type))&&(!parishes.length||parishes.includes("ALL")||!parish||parishes.includes(parish));
  }).sort((a,b)=>(String(b.Featured||"").toUpperCase()==="TRUE")-(String(a.Featured||"").toUpperCase()==="TRUE")||Number(a.Priority||999)-Number(b.Priority||999))
  .map(v=>({vendorId:v.VendorID,category:v.VendorCategory,companyName:v.CompanyName,contactName:v.ContactName,title:v.Title,phone:v.Phone,email:v.Email,websiteUrl:v.WebsiteURL,photoUrl:v.PhotoURL,businessCardUrl:v.BusinessCardURL,logoUrl:v.LogoURL,featured:v.Featured,disclaimer:v.Disclaimer||CIP.DISCLAIMER.VENDORS}));
}
function CIP_addPreferredVendor(v){
  CIP_initializePlatform();
  const id=v.VendorID||CIP_uuid_("VENDOR");
  CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.VENDORS).appendRow([
    id,v.Active!==false,v.Priority||100,v.VendorCategory||"",v.CompanyName||"",v.ContactName||"",v.Title||"",v.Phone||"",v.Email||"",v.WebsiteURL||"",v.PhotoURL||"",v.BusinessCardURL||"",v.LogoURL||"",v.ServiceAreas||"",v.Parishes||"ALL",v.LeadTypes||"ALL",v.Featured||false,v.Disclaimer||"",new Date()
  ]);
  return{success:true,vendorId:id};
}
