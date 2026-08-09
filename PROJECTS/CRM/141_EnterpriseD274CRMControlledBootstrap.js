/**
 * MOS5 ENTERPRISE D2.7.4 v1.0.0
 * Controlled CRM Account Deployment + Federation Scan Bootstrap
 *
 * Target identity: melrosegroupleads@gmail.com / clasp alias "leads"
 * Target certified project: 1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd
 *
 * This module does NOT send mail, mutate Gmail, assign leads, execute round robin,
 * create triggers, or mutate source lead spreadsheets.
 */
const MOS5_D274 = Object.freeze({
  RELEASE: "MOS5-ENTERPRISE-D2.7.4",
  VERSION: "1.0.0",
  ROLE: "CRM",
  EXPECTED_ACCOUNT: "melrosegroupleads@gmail.com",
  EXPECTED_SCRIPT_ID: "1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd",
  BROKER_REGISTRY_SCRIPT_ID: "1gDNWCXcWdwDMaZi7z5Wi7rZzctc95nLSY6IKFKnbBVdVPTaWJrWS39Kw",
  ARTIFACT_SPREADSHEET_ID: "1F_AQgeVCCMpf0rJd8D6Nx9gCdSLyUKSvdNg1R_gwK0U",
  STATE_KEY: "MOS5_D274_CRM_FEDERATION_STATE_V1"
});

function MOS5D274_hash_(s) {
  const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8);
  return b.map(x=>("0"+((x<0?x+256:x).toString(16))).slice(-2)).join("");
}

function MOS5P_runD274CRMBootstrapCertification() {
  const started=new Date();
  const props=PropertiesService.getScriptProperties();
  const expected={
    schemaVersion:1,
    release:MOS5_D274.RELEASE,
    role:MOS5_D274.ROLE,
    account:MOS5_D274.EXPECTED_ACCOUNT,
    projectId:MOS5_D274.EXPECTED_SCRIPT_ID,
    scanStatus:"READY",
    cursor:{fileIndex:0,sheetIndex:0,nextRow:2,batchNumber:0,completed:false},
    sourceMutationAllowed:false,
    gmailMutationAllowed:false,
    emailSendAllowed:false,
    assignmentAllowed:false,
    roundRobinAllowed:false,
    triggerMutationAllowed:false
  };
  const compact=JSON.stringify(expected);
  const hash=MOS5D274_hash_(compact);
  const existing=props.getProperty(MOS5_D274.STATE_KEY);
  let stateWritten=false,stateReused=false,blocked=false,blockReason="";

  if(existing) {
    try {
      const parsed=JSON.parse(existing);
      if(parsed.role===expected.role && parsed.account===expected.account &&
         parsed.projectId===expected.projectId) {
        stateReused=true;
      } else {
        blocked=true; blockReason="EXISTING_D274_STATE_IDENTITY_MISMATCH";
      }
    } catch(e) {
      blocked=true; blockReason="EXISTING_D274_STATE_UNPARSEABLE";
    }
  } else {
    props.setProperty(MOS5_D274.STATE_KEY,compact);
    stateWritten=true;
  }

  let artifactAccessible=false, artifactError="";
  try {
    const ss=SpreadsheetApp.openById(MOS5_D274.ARTIFACT_SPREADSHEET_ID);
    artifactAccessible=!!ss;
  } catch(e) {
    artifactError=String(e);
  }

  const reread=props.getProperty(MOS5_D274.STATE_KEY);
  const statePersistenceVerified=!!reread;
  const success=!blocked && artifactAccessible && statePersistenceVerified;

  const out={
    success:success,
    release:MOS5_D274.RELEASE,
    version:MOS5_D274.VERSION,
    operation:"CRM_CONTROLLED_DEPLOYMENT_BOOTSTRAP_CERTIFICATION",
    role:MOS5_D274.ROLE,
    expectedAccount:MOS5_D274.EXPECTED_ACCOUNT,
    expectedProjectId:MOS5_D274.EXPECTED_SCRIPT_ID,
    registryAuthorityProjectId:MOS5_D274.BROKER_REGISTRY_SCRIPT_ID,
    artifactSpreadsheetId:MOS5_D274.ARTIFACT_SPREADSHEET_ID,
    artifactAccessible:artifactAccessible,
    artifactError:artifactError,
    stateWritten:stateWritten,
    stateReused:stateReused,
    statePersistenceVerified:statePersistenceVerified,
    stateHash:hash,
    blocked:blocked,
    blockReason:blockReason,
    safety:{
      sourceSpreadsheetMutationPerformed:false,
      gmailMutationPerformed:false,
      emailSent:false,
      leadAssignmentPerformed:false,
      roundRobinPerformed:false,
      triggerMutationPerformed:false
    },
    nextAction:success?"RUN_D274_CRM_READ_ONLY_SCAN_PROBE":"STOP_AND_REVIEW_BOOTSTRAP",
    result:success?"PASS":"BLOCKED",
    durationMs:new Date()-started
  };
  console.log(JSON.stringify(out,null,2)); return out;
}

function MOS5P_runD274CRMReadOnlyScanProbe() {
  const props=PropertiesService.getScriptProperties();
  const raw=props.getProperty(MOS5_D274.STATE_KEY);
  let state=null, parseError="";
  try { state=raw?JSON.parse(raw):null; } catch(e) { parseError=String(e); }
  let ss=null, sheets=[];
  try {
    ss=SpreadsheetApp.openById(MOS5_D274.ARTIFACT_SPREADSHEET_ID);
    sheets=ss.getSheets().map(s=>({name:s.getName(),lastRow:s.getLastRow(),lastColumn:s.getLastColumn()}));
  } catch(e) {}

  const identityPass=!!state &&
    state.role==="CRM" &&
    state.account===MOS5_D274.EXPECTED_ACCOUNT &&
    state.projectId===MOS5_D274.EXPECTED_SCRIPT_ID;
  const artifactPass=!!ss;
  const success=identityPass && artifactPass;

  const out={
    success:success,release:MOS5_D274.RELEASE,version:MOS5_D274.VERSION,
    operation:"CRM_READ_ONLY_SCAN_PROBE",
    identityStatePresent:!!state,
    identityStateValid:identityPass,
    parseError:parseError,
    artifactAccessible:artifactPass,
    artifactSheets:sheets,
    cursor:state?state.cursor:null,
    scanMutationPerformed:false,
    safety:{
      sourceSpreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,
      leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false
    },
    nextAction:success?"D274_PASS_READY_FOR_CRM_FEDERATION_SCANNER_INSTALL":"RUN_D274_CRM_BOOTSTRAP_CERTIFICATION",
    result:success?"PASS":"REVIEW_REQUIRED"
  };
  console.log(JSON.stringify(out,null,2)); return out;
}
