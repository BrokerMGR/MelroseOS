/**
 * MOS5 ENTERPRISE D2.7.7 v1.0.1
 * Dedicated Enterprise Distribution Federation Scanner
 *
 * PROFILE: MOS5 — Distribution
 * ACCOUNT: agentleadcentral@gmail.com
 * PROJECT: MOS5 Distribution Federation Scanner
 * FILE: 146_EnterpriseD277DistributionFederation.gs
 */
const MOS5_D277 = Object.freeze({
  RELEASE:"MOS5-ENTERPRISE-D2.7.7",
  VERSION:"1.0.1",
  ROLE:"ENTERPRISE_DISTRIBUTION",
  EXPECTED_ACCOUNT:"agentleadcentral@gmail.com",
  AUTH_ARTIFACT_STORE:"1F_AQgeVCCMpf0rJd8D6Nx9gCdSLyUKSvdNg1R_gwK0U",
  STATE_KEY:"MOS5_D277_DISTRIBUTION_STATE_V1"
});

function MOS5D277_exists_(n){try{return typeof globalThis[n]==="function";}catch(e){return false;}}

function MOS5D277_seedIdentity_(){
  const p=PropertiesService.getScriptProperties();
  const existing=String(p.getProperty("MOS5_D26_CURRENT_ACCOUNT")||"").trim().toLowerCase();
  if(existing && existing!==MOS5_D277.EXPECTED_ACCOUNT){
    return {success:false,result:"BLOCKED_EXISTING_D26_IDENTITY_MISMATCH",
      existingAccount:existing,expectedAccount:MOS5_D277.EXPECTED_ACCOUNT};
  }
  p.setProperties({
    "MOS5_D26_CURRENT_ACCOUNT":MOS5_D277.EXPECTED_ACCOUNT,
    "MOS5_D26_CURRENT_ACCOUNT_SOURCE":"D277_DEDICATED_DISTRIBUTION_PROJECT"
  },false);
  const reread=String(p.getProperty("MOS5_D26_CURRENT_ACCOUNT")||"").trim().toLowerCase();
  return {success:reread===MOS5_D277.EXPECTED_ACCOUNT,
    result:reread===MOS5_D277.EXPECTED_ACCOUNT?"PASS":"BLOCKED_IDENTITY_PERSISTENCE",
    account:reread,manualScriptPropertyRequired:false};
}

function MOS5D277_pinArtifact_(){
  const p=PropertiesService.getScriptProperties();
  p.setProperties({
    "MOS5_D26_ARTIFACT_SPREADSHEET_ID":MOS5_D277.AUTH_ARTIFACT_STORE,
    "MOS5_D26_ARTIFACT_STORE_ID":MOS5_D277.AUTH_ARTIFACT_STORE,
    "MOS5_ARTIFACT_SPREADSHEET_ID":MOS5_D277.AUTH_ARTIFACT_STORE,
    "MOS5_D277_ARTIFACT_AUTHORITY":"D276_CERTIFIED_ENTERPRISE_STORE"
  },false);
  let ok=false,error="";
  try{
    const ss=SpreadsheetApp.openById(MOS5_D277.AUTH_ARTIFACT_STORE);
    ok=!!ss.getSheetByName("BatchRecords")&&!!ss.getSheetByName("BatchIndex");
  }catch(e){error=String(e)}
  return {success:ok,result:ok?"PASS":"BLOCKED_ARTIFACT_ACCESS",
    artifactSpreadsheetId:MOS5_D277.AUTH_ARTIFACT_STORE,error:error};
}

function MOS5P_runD277DistributionCertification(){
  const funcs=["MOS5P_initializeD26Inventory","MOS5P_runD26NextBatch","MOS5P_runD26AutoContinue"]
    .map(n=>({name:n,present:MOS5D277_exists_(n)}));
  const identity=MOS5D277_seedIdentity_(),artifact=MOS5D277_pinArtifact_();
  const ready=funcs.every(x=>x.present),ok=identity.success&&artifact.success&&ready;
  if(ok)PropertiesService.getScriptProperties().setProperty(MOS5_D277.STATE_KEY,
    JSON.stringify({status:"READY",role:MOS5_D277.ROLE,account:MOS5_D277.EXPECTED_ACCOUNT,
      artifactSpreadsheetId:MOS5_D277.AUTH_ARTIFACT_STORE,certifiedAt:new Date().toISOString()}));
  const out={success:ok,release:MOS5_D277.RELEASE,version:MOS5_D277.VERSION,
    operation:"DISTRIBUTION_FEDERATION_CERTIFICATION",
    profile:"MOS5 — Distribution",account:MOS5_D277.EXPECTED_ACCOUNT,
    project:"MOS5 Distribution Federation Scanner",
    dedicatedProjectIsolation:true,identity:identity,artifactAuthority:artifact,
    hardenedScannerFunctions:funcs,scannerStackReady:ready,
    safety:{sourceSpreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,
      leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false},
    nextAction:ok?"RUN_D277_DISTRIBUTION_INITIALIZE":"STOP_AND_REVIEW_CERTIFICATION",
    result:ok?"PASS":"BLOCKED"};
  console.log(JSON.stringify(out,null,2));return out;
}

function MOS5P_runD277DistributionInitializeInventory(){
  if(!PropertiesService.getScriptProperties().getProperty(MOS5_D277.STATE_KEY))
    throw new Error("Run MOS5P_runD277DistributionCertification first.");
  const identity=MOS5D277_seedIdentity_(),artifact=MOS5D277_pinArtifact_();
  if(!identity.success||!artifact.success){
    const out={success:false,release:MOS5_D277.RELEASE,version:MOS5_D277.VERSION,
      operation:"DISTRIBUTION_INVENTORY_INITIALIZATION",identity:identity,artifactAuthority:artifact,
      result:"BLOCKED"};console.log(JSON.stringify(out,null,2));return out;
  }
  const child=globalThis["MOS5P_initializeD26Inventory"](),ok=child&&child.success!==false;
  const out={success:ok,release:MOS5_D277.RELEASE,version:MOS5_D277.VERSION,
    operation:"DISTRIBUTION_INVENTORY_INITIALIZATION",childResult:child,
    nextAction:ok?"RUN_D277_DISTRIBUTION_SINGLE_BATCH_PROBE":"STOP_AND_REVIEW_INITIALIZATION",
    result:ok?"PASS":"BLOCKED"};
  console.log(JSON.stringify(out,null,2));return out;
}

function MOS5P_runD277DistributionSingleBatchProbe(){
  const child=globalThis["MOS5P_runD26NextBatch"]();
  const ok=child&&child.success!==false;
  const store=child&&child.artifactSpreadsheetId?String(child.artifactSpreadsheetId):"";
  const correct=!store||store===MOS5_D277.AUTH_ARTIFACT_STORE;
  const out={success:ok&&correct,release:MOS5_D277.RELEASE,version:MOS5_D277.VERSION,
    operation:"DISTRIBUTION_SINGLE_BATCH_PROBE",childResult:child,
    authoritativeArtifactStore:MOS5_D277.AUTH_ARTIFACT_STORE,
    childArtifactStoreCorrect:correct,
    nextAction:ok&&correct?"RUN_D277_DISTRIBUTION_AUTORUNNER":"STOP_AND_REVIEW_PROBE",
    result:ok&&correct?"PASS":"BLOCKED"};
  console.log(JSON.stringify(out,null,2));return out;
}

function MOS5P_runD277DistributionAutoRunner(){
  const child=globalThis["MOS5P_runD26AutoContinue"]();
  const blocked=child&&child.success===false,done=child&&child.result==="ACCOUNT_SCAN_COMPLETE";
  const out={success:!blocked,release:MOS5_D277.RELEASE,version:MOS5_D277.VERSION,
    operation:"DISTRIBUTION_FEDERATION_AUTORUNNER",childResult:child,
    authoritativeArtifactStore:MOS5_D277.AUTH_ARTIFACT_STORE,
    nextAction:blocked?"STOP_AND_REVIEW_CHILD_BATCH":done?"DISTRIBUTION_ACCOUNT_SCAN_COMPLETE":"RUN_SAME_FUNCTION_AGAIN",
    result:blocked?"BLOCKED_CHILD_BATCH":done?"ACCOUNT_SCAN_COMPLETE":"CONTINUE"};
  console.log(JSON.stringify(out,null,2));return out;
}
