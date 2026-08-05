
const RAP={VERSION:"1.0.0",REQUESTS_SHEET:"PORTAL_ACADEMY_REQUESTS",ACADEMY_URL_PROPERTY:"MGR_AGENT_ACADEMY_URL",BROKER_EMAIL:"melrosegroupbroker@gmail.com"};

function RAP_initializeRecruitAcademyPortal(){
  CIP_initializePlatform();
  const ss=CIP_websiteWorkbook_();
  let sh=ss.getSheetByName(RAP.REQUESTS_SHEET);
  if(!sh){
    sh=ss.insertSheet(RAP.REQUESTS_SHEET);
    sh.appendRow(["RequestID","LeadID","PortalToken","FullName","Email","Phone","Status","RequestedAt","ReviewedAt","ReviewedBy","AcademyURL","UpdatedAt","Notes"]);
    sh.setFrozenRows(1);
  }
  BNP_addMissingHeaders_(ss.getSheetByName(CIP.SHEETS.PROFILES),["AcademyAccessStatus","AcademyRequestedAt","AcademyApprovedAt","AcademyURL"]);
  return RAP_getStatus();
}

function RAP_setAcademyUrl(url){
  if(!url||String(url).indexOf("http")!==0) throw new Error("Provide the full Agent Academy URL.");
  PropertiesService.getScriptProperties().setProperty(RAP.ACADEMY_URL_PROPERTY,String(url).trim());
  return RAP_getStatus();
}

function RAP_getAcademyUrl_(){
  return PropertiesService.getScriptProperties().getProperty(RAP.ACADEMY_URL_PROPERTY)||"";
}

function RAP_getRecruitAcademyState(portalToken){
  const c=RAP_context_(portalToken);
  if(!c.isRecruit) return {success:false,reason:"NOT_RECRUIT_PORTAL"};
  const r=RAP_latest_(c.leadId);
  const status=r?String(r.Status||"PENDING").toUpperCase():"NOT_REQUESTED";
  return {
    success:true,leadId:c.leadId,status:status,
    academyUrl:status==="APPROVED"?(r.AcademyURL||RAP_getAcademyUrl_()):"",
    canRequest:status==="NOT_REQUESTED"||status==="DENIED",
    pending:status==="PENDING",approved:status==="APPROVED",
    instructions:RAP_instructions_(status),disclosure:RAP_disclosure_()
  };
}

function RAP_requestAcademyAccess(portalToken){
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const c=RAP_context_(portalToken);
    if(!c.isRecruit) throw new Error("Academy requests are available only to recruiting leads.");
    const existing=RAP_latest_(c.leadId);
    if(existing&&["PENDING","APPROVED"].indexOf(String(existing.Status||"").toUpperCase())!==-1) return RAP_getRecruitAcademyState(portalToken);
    CIP_websiteWorkbook_().getSheetByName(RAP.REQUESTS_SHEET).appendRow([
      CIP_uuid_("ACADEMYREQ"),c.leadId,portalToken,c.fullName,c.email,c.phone,"PENDING",new Date(),"","","",new Date(),"Requested from recruiting dashboard."
    ]);
    RAP_profile_(c.leadId,"PENDING",new Date(),"","");
    CIP_RT_logSystemEvent_(c.leadId,"ACADEMY_ACCESS_REQUESTED",{email:c.email});
    return RAP_getRecruitAcademyState(portalToken);
  }finally{lock.releaseLock();}
}

function RAP_approveAcademyAccess(requestId,academyUrl){
  const sh=CIP_websiteWorkbook_().getSheetByName(RAP.REQUESTS_SHEET);
  const r=CIP_objects_(sh).find(x=>String(x.RequestID||"")===String(requestId||""));
  if(!r) throw new Error("Academy request not found.");
  const url=academyUrl||RAP_getAcademyUrl_();
  RAP_write_(sh,r._row,{Status:"APPROVED",ReviewedAt:new Date(),ReviewedBy:Session.getEffectiveUser().getEmail(),AcademyURL:url,UpdatedAt:new Date()});
  RAP_profile_(r.LeadID,"APPROVED",r.RequestedAt||"",new Date(),url);
  return {success:true,requestId:requestId,leadId:r.LeadID,status:"APPROVED",academyUrl:url,note:"Existing Academy approval/OTP workflow remains authoritative."};
}

function RAP_denyAcademyAccess(requestId,notes){
  const sh=CIP_websiteWorkbook_().getSheetByName(RAP.REQUESTS_SHEET);
  const r=CIP_objects_(sh).find(x=>String(x.RequestID||"")===String(requestId||""));
  if(!r) throw new Error("Academy request not found.");
  RAP_write_(sh,r._row,{Status:"DENIED",ReviewedAt:new Date(),ReviewedBy:Session.getEffectiveUser().getEmail(),UpdatedAt:new Date(),Notes:notes||"Not approved."});
  RAP_profile_(r.LeadID,"DENIED",r.RequestedAt||"","","");
  return {success:true,status:"DENIED"};
}

function RAP_getPendingAcademyRequests(){
  const rows=CIP_objects_(CIP_websiteWorkbook_().getSheetByName(RAP.REQUESTS_SHEET)).filter(r=>String(r.Status||"").toUpperCase()==="PENDING");
  const out={success:true,count:rows.length,requests:rows}; Logger.log(JSON.stringify(out,null,2)); return out;
}

function RAP_context_(token){
  const ss=CIP_websiteWorkbook_();
  const reg=CIP_objects_(ss.getSheetByName(CIP.SHEETS.REGISTRY)).find(r=>String(r.PortalToken||"")===String(token||""));
  if(!reg) throw new Error("Invalid portal token.");
  const p=CIP_objects_(ss.getSheetByName(CIP.SHEETS.PROFILES)).find(r=>String(r.LeadID||"")===String(reg.LeadID||""))||{};
  const type=String(reg.LeadType||p.LeadType||"").toUpperCase();
  return {leadId:reg.LeadID,isRecruit:["RECRUIT","RECRUITING","AGENT","NEW AGENT"].indexOf(type)!==-1,fullName:p.FullName||"",email:p.Email||"",phone:p.Phone||""};
}

function RAP_latest_(leadId){
  const sh=CIP_websiteWorkbook_().getSheetByName(RAP.REQUESTS_SHEET);
  if(!sh||sh.getLastRow()<2)return null;
  const a=CIP_objects_(sh).filter(r=>String(r.LeadID||"")===String(leadId||""));
  return a.length?a[a.length-1]:null;
}

function RAP_profile_(leadId,status,requested,approved,url){
  const sh=CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.PROFILES);
  const p=CIP_objects_(sh).find(r=>String(r.LeadID||"")===String(leadId||""));
  if(!p)return;
  BNP_setByHeader_(sh,p._row,"AcademyAccessStatus",status);
  if(requested)BNP_setByHeader_(sh,p._row,"AcademyRequestedAt",requested);
  if(approved)BNP_setByHeader_(sh,p._row,"AcademyApprovedAt",approved);
  BNP_setByHeader_(sh,p._row,"AcademyURL",url||"");
}

function RAP_write_(sh,row,values){
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  Object.keys(values).forEach(k=>{const c=h.indexOf(k)+1;if(c>0)sh.getRange(row,c).setValue(values[k]);});
}

function RAP_instructions_(s){
  if(s==="PENDING")return "Your Agent Academy access request is under review. Once approved, you will receive secure access instructions.";
  if(s==="APPROVED")return "Your request has been approved. Open the Agent Academy and complete secure verification when prompted.";
  if(s==="DENIED")return "Your previous request is not currently approved. Contact the broker for additional information or submit a new request if appropriate.";
  return "Click Request Academy Access. Your request will be sent to the broker for review. Once approved, you will receive secure access instructions and complete the Academy verification process.";
}

function RAP_disclosure_(){
  return "Agent Academy access is subject to approval. Access to recruiting or training resources does not by itself create employment, independent-contractor status, brokerage affiliation, sponsorship, or another contractual relationship with Melrose Group Realty. Any affiliation is subject to separate eligibility, licensing, onboarding, and written agreement requirements.";
}

function RAP_getStatus(){
  const out={success:true,version:RAP.VERSION,requestSheetExists:!!CIP_websiteWorkbook_().getSheetByName(RAP.REQUESTS_SHEET),academyUrlConfigured:!!RAP_getAcademyUrl_(),states:["NOT_REQUESTED","PENDING","APPROVED","DENIED"],securityModel:"EXISTING_ACADEMY_APPROVAL_AND_OTP_REMAINS_AUTHORITATIVE"};
  Logger.log(JSON.stringify(out,null,2)); return out;
}
