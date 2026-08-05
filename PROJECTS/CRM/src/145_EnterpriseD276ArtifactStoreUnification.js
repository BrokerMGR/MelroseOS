const MOS5_D276=Object.freeze({
 RELEASE:"MOS5-ENTERPRISE-D2.7.6",VERSION:"1.0.0",ROLE:"CRM",
 AUTH_STORE:"1F_AQgeVCCMpf0rJd8D6Nx9gCdSLyUKSvdNg1R_gwK0U",CRM_STORE:"1b9dOcEWpuJcz8wsLqHPE6tHNSf5yXUCA47sqvkdQxuA",STATE_KEY:"MOS5_D276_STATE_V1"
});
function MOS5D276_vals_(ss,n){const s=ss.getSheetByName(n);return s&&s.getLastRow()?s.getDataRange().getValues():[];}
function MOS5D276_key_(h,r){const o={};h.forEach((x,i)=>o[String(x)]=r[i]);
 for(const k of ["artifactHash","ArtifactHash","processedKey","ProcessedKey","recordKey","RecordKey"])if(o[k]!==undefined&&String(o[k]).trim())return k+":"+String(o[k]).trim();
 return JSON.stringify(r);
}
function MOS5D276_snap_(id){const ss=SpreadsheetApp.openById(id),i=MOS5D276_vals_(ss,"BatchIndex"),r=MOS5D276_vals_(ss,"BatchRecords");
 return {id:id,name:ss.getName(),batchIndexRows:Math.max(0,i.length-1),batchRecordRows:Math.max(0,r.length-1),
 indexHeaders:i.length?i[0].map(String):[],recordHeaders:r.length?r[0].map(String):[]};}
function MOS5P_runD276ArtifactStoreDiscovery(){
 let a,c,errors=[];try{a=MOS5D276_snap_(MOS5_D276.AUTH_STORE)}catch(e){errors.push("AUTH: "+e)}try{c=MOS5D276_snap_(MOS5_D276.CRM_STORE)}catch(e){errors.push("CRM: "+e)}
 const compatible=!!a&&!!c&&JSON.stringify(a.recordHeaders)===JSON.stringify(c.recordHeaders);
 const out={success:!errors.length,release:MOS5_D276.RELEASE,version:MOS5_D276.VERSION,operation:"READ_ONLY_ARTIFACT_DISCOVERY",
 authoritativeStore:a,crmStore:c,schemaCompatible:compatible,errors:errors,writesPerformed:false,
 nextAction:errors.length?"STOP_AND_REVIEW_ACCESS":compatible?"RUN_D276_UNIFICATION_CERTIFICATION":"STOP_AND_REVIEW_SCHEMA",
 result:errors.length?"BLOCKED":compatible?"PASS":"REVIEW_REQUIRED"};
 console.log(JSON.stringify(out,null,2));return out;
}
function MOS5P_runD276UnificationCertification(){
 const d=MOS5P_runD276ArtifactStoreDiscovery();if(!d.success||!d.schemaCompatible)return d;
 const s=SpreadsheetApp.openById(MOS5_D276.CRM_STORE),t=SpreadsheetApp.openById(MOS5_D276.AUTH_STORE);
 const sr=MOS5D276_vals_(s,"BatchRecords"),dr=MOS5D276_vals_(t,"BatchRecords"),sh=sr[0]||[],dh=dr[0]||[];
 const keys=new Set();for(let i=1;i<dr.length;i++)keys.add(MOS5D276_key_(dh,dr[i]));
 let unique=0,dup=0;for(let i=1;i<sr.length;i++)keys.has(MOS5D276_key_(sh,sr[i]))?dup++:unique++;
 const state={sourceStore:MOS5_D276.CRM_STORE,authoritativeStore:MOS5_D276.AUTH_STORE,sourceRecords:Math.max(0,sr.length-1),uniqueRecordsToCopy:unique,duplicatesAlreadyPresent:dup,certifiedAt:new Date().toISOString()};
 PropertiesService.getScriptProperties().setProperty(MOS5_D276.STATE_KEY,JSON.stringify(state));
 const out={success:true,release:MOS5_D276.RELEASE,version:MOS5_D276.VERSION,operation:"UNIFICATION_CERTIFICATION",state:state,
 artifactRecordCopyPerformed:false,nextAction:"RUN_D276_CONTROLLED_MIGRATION",result:"PASS"};
 console.log(JSON.stringify(out,null,2));return out;
}
function MOS5P_runD276ControlledMigration(){
 const raw=PropertiesService.getScriptProperties().getProperty(MOS5_D276.STATE_KEY);if(!raw)throw new Error("Run certification first.");
 const s=SpreadsheetApp.openById(MOS5_D276.CRM_STORE),t=SpreadsheetApp.openById(MOS5_D276.AUTH_STORE);
 const ss=s.getSheetByName("BatchRecords"),ts=t.getSheetByName("BatchRecords"),sr=MOS5D276_vals_(s,"BatchRecords"),dr=MOS5D276_vals_(t,"BatchRecords");
 const sh=sr[0]||[],dh=dr[0]||[];if(JSON.stringify(sh.map(String))!==JSON.stringify(dh.map(String)))throw new Error("BatchRecords schema mismatch.");
 const keys=new Set();for(let i=1;i<dr.length;i++)keys.add(MOS5D276_key_(dh,dr[i]));
 const add=[];for(let i=1;i<sr.length;i++){const k=MOS5D276_key_(sh,sr[i]);if(!keys.has(k)){add.push(sr[i]);keys.add(k)}}
 if(add.length)ts.getRange(ts.getLastRow()+1,1,add.length,sh.length).setValues(add);
 const out={success:true,release:MOS5_D276.RELEASE,version:MOS5_D276.VERSION,operation:"CONTROLLED_CRM_ARTIFACT_MIGRATION",
 recordsCopied:add.length,sourceArtifactStoreMutationPerformed:false,sourceLeadSpreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,
 leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false,nextAction:"RUN_D276_POST_MIGRATION_VERIFY",result:"PASS"};
 console.log(JSON.stringify(out,null,2));return out;
}
function MOS5P_runD276PostMigrationVerify(){
 const s=SpreadsheetApp.openById(MOS5_D276.CRM_STORE),t=SpreadsheetApp.openById(MOS5_D276.AUTH_STORE),sr=MOS5D276_vals_(s,"BatchRecords"),dr=MOS5D276_vals_(t,"BatchRecords"),sh=sr[0]||[],dh=dr[0]||[];
 const keys=new Set();for(let i=1;i<dr.length;i++)keys.add(MOS5D276_key_(dh,dr[i]));let missing=0;for(let i=1;i<sr.length;i++)if(!keys.has(MOS5D276_key_(sh,sr[i])))missing++;
 const ok=missing===0,out={success:ok,release:MOS5_D276.RELEASE,version:MOS5_D276.VERSION,operation:"POST_MIGRATION_VERIFY",
 crmSourceRecords:Math.max(0,sr.length-1),authoritativeRecords:Math.max(0,dr.length-1),missingCRMRecords:missing,authoritativeStore:MOS5_D276.AUTH_STORE,
 nextAction:ok?"BUILD_D277_DISTRIBUTION_FEDERATION":"STOP_AND_REVIEW",result:ok?"PASS":"BLOCKED"};
 console.log(JSON.stringify(out,null,2));return out;
}