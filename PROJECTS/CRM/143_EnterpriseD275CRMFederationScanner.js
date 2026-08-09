/**
 * MOS5 ENTERPRISE D2.7.5 v1.0.0
 * PROFILE: MOS5 — CRM
 * ACCOUNT: melrosegroupleads@gmail.com
 * PROJECT: MelroseOS Secondary / Assignment
 */
const MOS5_D275={RELEASE:"MOS5-ENTERPRISE-D2.7.5",VERSION:"1.0.2",ROLE:"CRM",
EXPECTED_ACCOUNT:"melrosegroupleads@gmail.com",EXPECTED_PROJECT_ID:"1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd",
ARTIFACT_SPREADSHEET_ID:"1F_AQgeVCCMpf0rJd8D6Nx9gCdSLyUKSvdNg1R_gwK0U",D274_STATE_KEY:"MOS5_D274_CRM_FEDERATION_STATE_V1",
D275_STATE_KEY:"MOS5_D275_CRM_SCANNER_STATE_V1"};

function MOS5D275_exists_(n){try{return typeof globalThis[n]==="function";}catch(e){return false;}}
function MOS5D275_d274_(){const r=PropertiesService.getScriptProperties().getProperty(MOS5_D275.D274_STATE_KEY);if(!r)return null;try{return JSON.parse(r)}catch(e){return null}}

function MOS5D275_seedD26CertifiedIdentity_(){
 const d=MOS5D275_d274_();
 if(!d || d.role!=="CRM" || d.account!==MOS5_D275.EXPECTED_ACCOUNT || d.projectId!==MOS5_D275.EXPECTED_PROJECT_ID){
   return {success:false,result:"BLOCKED_D274_IDENTITY_INVALID"};
 }
 const props=PropertiesService.getScriptProperties();
 const existing=String(props.getProperty("MOS5_D26_CURRENT_ACCOUNT")||"").trim().toLowerCase();
 if(existing && existing!==MOS5_D275.EXPECTED_ACCOUNT){
   return {
     success:false,
     result:"BLOCKED_EXISTING_D26_IDENTITY_MISMATCH",
     existingAccount:existing,
     expectedAccount:MOS5_D275.EXPECTED_ACCOUNT
   };
 }
 props.setProperties({
   "MOS5_D26_CURRENT_ACCOUNT":MOS5_D275.EXPECTED_ACCOUNT,
   "MOS5_D26_CURRENT_ACCOUNT_SOURCE":"D275_CERTIFIED_CRM_IDENTITY_BRIDGE"
 },false);
 const reread=String(props.getProperty("MOS5_D26_CURRENT_ACCOUNT")||"").trim().toLowerCase();
 return {
   success:reread===MOS5_D275.EXPECTED_ACCOUNT,
   result:reread===MOS5_D275.EXPECTED_ACCOUNT?"PASS":"BLOCKED_IDENTITY_PERSISTENCE",
   account:reread,
   source:String(props.getProperty("MOS5_D26_CURRENT_ACCOUNT_SOURCE")||""),
   manualScriptPropertyRequired:false
 };
}

function MOS5P_runD275CRMIdentityBridgeCertification(){
 const out0=MOS5D275_seedD26CertifiedIdentity_();
 const out={
   success:out0.success===true,
   release:MOS5_D275.RELEASE,
   version:MOS5_D275.VERSION,
   operation:"CRM_D26_IDENTITY_BRIDGE_CERTIFICATION",
   profile:"MOS5 — CRM",
   expectedAccount:MOS5_D275.EXPECTED_ACCOUNT,
   expectedProjectId:MOS5_D275.EXPECTED_PROJECT_ID,
   identityBridge:out0,
   manualScriptPropertyRequired:false,
   safety:{
     sourceSpreadsheetMutationPerformed:false,
     gmailMutationPerformed:false,
     emailSent:false,
     leadAssignmentPerformed:false,
     roundRobinPerformed:false,
     triggerMutationPerformed:false
   },
   nextAction:out0.success?"RUN_D275_CRM_INITIALIZE_INVENTORY":"STOP_AND_REVIEW_IDENTITY_BRIDGE",
   result:out0.success?"PASS":"BLOCKED"
 };
 console.log(JSON.stringify(out,null,2));
 return out;
}


function MOS5P_runD275CRMFederationCertification(){
 const d=MOS5D275_d274_();
 const f=["MOS5P_initializeD26Inventory","MOS5P_runD26NextBatch","MOS5P_runD26AutoContinue"].map(n=>({name:n,present:MOS5D275_exists_(n)}));
 let a=false,ae="";try{a=!!SpreadsheetApp.openById(MOS5_D275.ARTIFACT_SPREADSHEET_ID)}catch(e){ae=String(e)}
 const id=!!d&&d.role==="CRM"&&d.account===MOS5_D275.EXPECTED_ACCOUNT&&d.projectId===MOS5_D275.EXPECTED_PROJECT_ID;
 const ready=f.every(x=>x.present);
 const ok=id&&ready&&a;
 if(ok&&!PropertiesService.getScriptProperties().getProperty(MOS5_D275.D275_STATE_KEY)){
   PropertiesService.getScriptProperties().setProperty(MOS5_D275.D275_STATE_KEY,JSON.stringify({role:"CRM",account:MOS5_D275.EXPECTED_ACCOUNT,projectId:MOS5_D275.EXPECTED_PROJECT_ID,status:"READY"}));
 }
 const out={success:ok,release:MOS5_D275.RELEASE,version:MOS5_D275.VERSION,operation:"CRM_FEDERATION_SCANNER_CERTIFICATION",
 profile:"MOS5 — CRM",d274IdentityValid:id,hardenedScannerFunctions:f,scannerStackReady:ready,artifactAccessible:a,artifactError:ae,
 safety:{sourceSpreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false},
 nextAction:ok?"RUN_D275_CRM_SINGLE_BATCH_PROBE":"STOP_AND_REVIEW_CERTIFICATION",result:ok?"PASS":"BLOCKED"};
 console.log(JSON.stringify(out,null,2));return out;
}


function MOS5P_runD275CRMInitializeInventory(){
 if(!PropertiesService.getScriptProperties().getProperty(MOS5_D275.D275_STATE_KEY)){
   throw new Error("Run MOS5P_runD275CRMFederationCertification first.");
 }
 const bridge=MOS5D275_seedD26CertifiedIdentity_();
 if(!bridge.success){
   const blocked={
     success:false,release:MOS5_D275.RELEASE,version:MOS5_D275.VERSION,
     operation:"CRM_INVENTORY_INITIALIZATION",
     identityBridge:bridge,
     nextAction:"STOP_AND_REVIEW_IDENTITY_BRIDGE",
     result:"BLOCKED_IDENTITY_BRIDGE"
   };
   console.log(JSON.stringify(blocked,null,2));return blocked;
 }
 if(!MOS5D275_exists_("MOS5P_initializeD26Inventory")){
   throw new Error("Hardened D2.6 inventory initializer not installed.");
 }
 const child=globalThis["MOS5P_initializeD26Inventory"]();
 const ok=child&&child.success!==false;
 const out={
   success:ok,
   release:MOS5_D275.RELEASE,
   version:MOS5_D275.VERSION,
   operation:"CRM_INVENTORY_INITIALIZATION",
   childResult:child,
   safety:{
     sourceSpreadsheetMutationPerformed:false,
     gmailMutationPerformed:false,
     emailSent:false,
     leadAssignmentPerformed:false,
     roundRobinPerformed:false,
     triggerMutationPerformed:false
   },
   nextAction:ok?"RUN_D275_CRM_SINGLE_BATCH_PROBE":"STOP_AND_REVIEW_INITIALIZATION",
   result:ok?"PASS":"BLOCKED"
 };
 console.log(JSON.stringify(out,null,2));
 return out;
}

function MOS5P_runD275CRMSingleBatchProbe(){
 if(!PropertiesService.getScriptProperties().getProperty(MOS5_D275.D275_STATE_KEY))throw new Error("Run D275 certification first.");
 const child=globalThis["MOS5P_runD26NextBatch"]();
 const ok=child&&child.success!==false;
 const out={success:ok,release:MOS5_D275.RELEASE,version:MOS5_D275.VERSION,operation:"CRM_SINGLE_BATCH_PROBE",childResult:child,
 safety:{sourceSpreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false},
 nextAction:ok?"RUN_D275_CRM_AUTORUNNER":"STOP_AND_REVIEW_CHILD_BATCH",result:ok?"PASS":"BLOCKED"};
 console.log(JSON.stringify(out,null,2));return out;
}

function MOS5P_runD275CRMAutoRunner(){
 if(!PropertiesService.getScriptProperties().getProperty(MOS5_D275.D275_STATE_KEY))throw new Error("Run D275 certification first.");
 const child=globalThis["MOS5P_runD26AutoContinue"]();
 const done=child&&child.result==="ACCOUNT_SCAN_COMPLETE";
 const blocked=child&&child.success===false;
 const out={success:!blocked,release:MOS5_D275.RELEASE,version:MOS5_D275.VERSION,operation:"CRM_FEDERATION_AUTORUNNER",
 childResult:child,
 nextAction:blocked?(child&&child.result==="BLOCKED_CHILD_BATCH"?"RUN_D275_CRM_INITIALIZE_INVENTORY":"STOP_AND_REVIEW_CHILD_BATCH"):(done?"CRM_ACCOUNT_SCAN_COMPLETE":"RUN_SAME_FUNCTION_AGAIN"),
 safety:{sourceSpreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false},
 result:blocked?"BLOCKED_CHILD_BATCH":(done?"ACCOUNT_SCAN_COMPLETE":"CONTINUE")};
 console.log(JSON.stringify(out,null,2));return out;
}
