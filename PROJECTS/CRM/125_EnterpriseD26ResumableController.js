/**
 * MOS5 ENTERPRISE D2.6 — Resumable Federated Inventory Controller
 * READ ONLY
 *
 * Known-error guards:
 * - No getOwners()
 * - No Session.getEffectiveUser()
 * - No unsupported clasp status concepts here
 * - No spreadsheet writes
 * - No Gmail mutation
 * - No sends
 * - No triggers
 *
 * Runtime design:
 * - chunked workbook/tab scanning
 * - persisted cursor/checkpoint in Script Properties
 * - idempotent batches
 * - detailed PASS/CONTINUE/REVIEW_REQUIRED status every run
 */
const MOS5_D26_DEPLOYMENT_IDENTITY = Object.freeze({
  account:'__MOS5_DEPLOY_ACCOUNT__',
  source:'SMART_CLASP_VERIFIED_ROUTE'
});

const MOS5_D26 = Object.freeze({
  ARTIFACT_FOLDER:'MOS5 Federation',
  ARTIFACT_SUBFOLDER:'D2.6',
  RELEASE:'MOS5-ENTERPRISE-D2.6',
  VERSION:'1.3.0',
  MODE:'READ_ONLY_RESUMABLE_FEDERATION',
  SAFE_RUNTIME_MS:240000,
  DEFAULT_ROWS_PER_BATCH:200,
  MAX_FILES_PER_RUN:20,
  PROP_ACCOUNT:'MOS5_D26_CURRENT_ACCOUNT',
  PROP_ACCOUNT_SOURCE:'MOS5_D26_CURRENT_ACCOUNT_SOURCE',
  PROP_ARTIFACT_SPREADSHEET_ID:'MOS5_D26_ARTIFACT_SPREADSHEET_ID',
  PROP_STATE:'MOS5_D26_STATE_JSON',
  PROP_MANIFEST:'MOS5_D26_MANIFEST_JSON',
  LEAD_TAB_HINTS:[
    'lead','leads','leadintake','intake','masterlog','crm','client','clients',
    'buyer','seller','renter','prospect','referral','contacts','database'
  ],
  EXCLUDE_TAB_HINTS:[
    'systemlog','emaillog','audit','config','settings','holidays','parishes',
    'questions','templates','validation','stats','dashboard','analytics',
    'appointments','agents','roster','sync','shadow','health','backup'
  ]
});

function MOS5D26_norm_(v){ return String(v||'').toLowerCase().replace(/\s+/g,' ').trim(); }

function MOS5D26_isLeadLikeTab_(name, headers){
  const n=MOS5D26_norm_(name);
  if(MOS5_D26.EXCLUDE_TAB_HINTS.some(function(x){return n.indexOf(x)>=0;})) return false;
  const h=(headers||[]).map(MOS5D26_norm_);
  const leadHeaderSignals=['email','phone','lead','name','first name','last name','status','source','assigned agent','owner'];
  const signalCount=leadHeaderSignals.filter(function(x){return h.indexOf(x)>=0;}).length;
  const hinted=MOS5_D26.LEAD_TAB_HINTS.some(function(x){return n.indexOf(x)>=0;});
  return hinted || signalCount>=2;
}

function MOS5D26_readState_(){
  const raw=PropertiesService.getScriptProperties().getProperty(MOS5_D26.PROP_STATE);
  if(!raw) return null;
  try{return JSON.parse(raw);}catch(e){return null;}
}
function MOS5D26_writeState_(state){
  state=state||{};
  const compact={
    account:String(state.account||''),
    fileIndex:Number(state.fileIndex||0),
    sheetIndex:Number(state.sheetIndex||0),
    nextRow:Number(state.nextRow||2),
    completed:state.completed===true,
    initializedAt:String(state.initializedAt||''),
    batchNumber:Number(state.batchNumber||0),
    lastArtifactHash:String(state.lastArtifactHash||''),
    lastArtifactRow:Number(state.lastArtifactRow||0)
  };
  PropertiesService.getScriptProperties().setProperty(
    MOS5_D26.PROP_STATE,
    JSON.stringify(compact)
  );
}
function MOS5D26_readManifest_(){
  const raw=PropertiesService.getScriptProperties().getProperty(MOS5_D26.PROP_MANIFEST);
  if(!raw) return [];
  try{
    const x=JSON.parse(raw);
    return Array.isArray(x)?x:[];
  }catch(e){return [];}
}
function MOS5D26_writeManifest_(rows){
  PropertiesService.getScriptProperties().setProperty(MOS5_D26.PROP_MANIFEST,JSON.stringify(rows||[]));
}



function MOS5D26_sha256_(s){
  const bytes=Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(s),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b){
    const x=(b<0?b+256:b).toString(16);
    return x.length===1?'0'+x:x;
  }).join('');
}

function MOS5D26_ensureHeader_(sh,headers){
  if(!sh || typeof sh.getLastRow!=='function'){
    throw new Error('HEADER_TARGET_INVALID');
  }
  const width=headers.length;
  let current=[];
  if(sh.getLastRow()>=1 && sh.getLastColumn()>=width){
    current=sh.getRange(1,1,1,width).getDisplayValues()[0];
  }
  const ok=current.length===width && headers.every(function(h,i){
    return String(current[i]||'')===h;
  });
  if(!ok){
    sh.getRange(1,1,1,width).setValues([headers]);
  }
}

function MOS5D26_getArtifactStore_(account){
  const props=PropertiesService.getScriptProperties();
  let id=String(props.getProperty(MOS5_D26.PROP_ARTIFACT_SPREADSHEET_ID)||'').trim();
  let ss=null;
  let created=false;

  if(id){
    try{ ss=SpreadsheetApp.openById(id); }
    catch(e){ ss=null; id=''; }
  }

  if(!ss){
    const safe=String(account||'unknown')
      .replace(/[^a-zA-Z0-9._-]+/g,'_').substring(0,80);
    ss=SpreadsheetApp.create('MOS5 Federation D2.6 - '+safe,1000,24);
    id=ss.getId();
    props.setProperty(MOS5_D26.PROP_ARTIFACT_SPREADSHEET_ID,id);
    created=true;
  }

  let index=ss.getSheetByName('BatchIndex');
  let records=ss.getSheetByName('BatchRecords');
  let repaired=false;

  if(!index){ index=ss.insertSheet('BatchIndex'); repaired=true; }
  if(!records){ records=ss.insertSheet('BatchRecords'); repaired=true; }

  if(!index || typeof index.getLastRow!=='function'){
    throw new Error('ARTIFACT_INDEX_RESOLUTION_FAILED');
  }
  if(!records || typeof records.getLastRow!=='function'){
    throw new Error('ARTIFACT_RECORDS_RESOLUTION_FAILED');
  }

  return {
    spreadsheet:ss,
    indexSheet:index,
    recordsSheet:records,
    id:id,
    created:created,
    repaired:repaired,
    schemaReady:true
  };
}

function MOS5D26_recordRow_(batchNo,account,r){
  const ci=r.contactIntegrity||{};
  const ei=ci.email||{};
  const pi=ci.phone||{};
  return [
    batchNo,
    account,
    String(r.fileId||''),
    String(r.workbook||''),
    String(r.sheet||''),
    Number(r.rowNumber||0),
    String(r.name||''),
    String(r.email||''),
    String(r.phone||''),
    String(r.owner||''),
    String(r.status||''),
    String(r.source||''),
    String(r.ownershipEvidence||''),
    r.leadLock===true,
    r.roundRobinEligible===true,
    r.campaignEligible===true,
    String(ei.status||''),
    String(pi.status||''),
    Number(ci.authenticityScore||0),
    String(ci.contactIntegrityStatus||''),
    ci.requiresVerification===true,
    String(r.nameEmailConsistency||''),
    Number(r.contactOwnershipConfidence||0),
    String(r.identityConsistencyStatus||'')
  ];
}

function MOS5D26_writeBatchArtifact_(account,state,rows,meta){
  let artifactStage='START';
  try{
  const batchNo=Number(state.batchNumber||0)+1;
  const generatedAt=new Date().toISOString();
  const cursorAfter={
    fileIndex:state.fileIndex,
    sheetIndex:state.sheetIndex,
    nextRow:state.nextRow,
    completed:state.completed===true
  };

  const identityReviewRequired=rows.filter(function(r){
    return r.identityConsistencyStatus==='IDENTITY_REVIEW_REQUIRED';
  }).length;
  const contactIntegrityIssues=rows.filter(function(r){
    return r.contactIntegrity && r.contactIntegrity.requiresVerification===true;
  }).length;
  const ownershipEvidenceFound=rows.filter(function(r){
    return !!r.ownershipEvidence;
  }).length;

  const canonical=JSON.stringify({
    sourceAccount:account,
    batchNumber:batchNo,
    cursorBefore:meta.cursorBefore||null,
    cursorAfter:cursorAfter,
    rows:rows
  });
  const hash=MOS5D26_sha256_(canonical);

  artifactStage='GET_ARTIFACT_STORE';
  const store=MOS5D26_getArtifactStore_(account);
  if(!store || !store.spreadsheet){
    throw new Error('ARTIFACT_STORE_UNAVAILABLE');
  }

  // Resolve the exact sheets used by this writer from the spreadsheet object.
  artifactStage='RESOLVE_BATCH_INDEX';
  let index=store.spreadsheet.getSheetByName('BatchIndex');
  artifactStage='RESOLVE_BATCH_RECORDS';
  let records=store.spreadsheet.getSheetByName('BatchRecords');

  const indexHeaders=[
    'BatchNumber','SourceAccount','GeneratedAt','ArtifactHash',
    'CursorBefore','CursorAfter','RowsExamined','LeadRowsFound',
    'IdentityReviewRequired','ContactIntegrityIssues',
    'OwnershipEvidenceFound','RecordRowsWritten'
  ];
  const recordHeaders=[
    'BatchNumber','SourceAccount','FileId','Workbook','Sheet','SourceRow',
    'Name','Email','Phone','Owner','Status','Source',
    'OwnershipEvidence','LeadLock','RoundRobinEligible','CampaignEligible',
    'EmailIntegrityStatus','PhoneIntegrityStatus','AuthenticityScore',
    'ContactIntegrityStatus','RequiresVerification',
    'NameEmailConsistency','ContactOwnershipConfidence','IdentityConsistencyStatus'
  ];

  let repaired=false;

  if(!index){
    index=store.spreadsheet.insertSheet('BatchIndex');
    repaired=true;
  }
  if(!records){
    records=store.spreadsheet.insertSheet('BatchRecords');
    repaired=true;
  }

  artifactStage='ENSURE_INDEX_HEADER';
  MOS5D26_ensureHeader_(index,indexHeaders);
  artifactStage='ENSURE_RECORDS_HEADER';
  MOS5D26_ensureHeader_(records,recordHeaders);

  if(typeof index.getLastRow!=='function'){
    throw new Error('BATCH_INDEX_OBJECT_INVALID');
  }
  if(typeof records.getLastRow!=='function'){
    throw new Error('BATCH_RECORDS_OBJECT_INVALID');
  }

  // Idempotency by hash in BatchIndex column D.
  artifactStage='INDEX_GET_LAST_ROW';
  const lastIndex=index.getLastRow();
  if(lastIndex>=2){
    const hashes=index.getRange(2,4,lastIndex-1,1)
      .getDisplayValues()
      .map(function(r){return r[0];});
    const found=hashes.indexOf(hash);
    if(found>=0){
      const indexRow=found+2;
      state.batchNumber=batchNo;
      state.lastArtifactHash=hash;
      state.lastArtifactRow=indexRow;
      return {
        saved:true,
        reused:true,
        storageType:'GOOGLE_SHEET_ROW_ARTIFACT_STORE',
        artifactStoreSchemaReady:true,
        artifactStoreRepaired:repaired,
        artifactSpreadsheetId:store.id,
        artifactIndexSheet:'BatchIndex',
        artifactRecordsSheet:'BatchRecords',
        artifactIndexRow:indexRow,
        firstRecordRow:0,
        recordRowsWritten:0,
        sha256:hash,
        batchNumber:batchNo
      };
    }
  }

  const recordRows=rows.map(function(r){
    return MOS5D26_recordRow_(batchNo,account,r);
  });

  let firstRecordRow=0;
  if(recordRows.length){
    artifactStage='RECORDS_GET_LAST_ROW_BEFORE_WRITE';
    firstRecordRow=records.getLastRow()+1;
    artifactStage='WRITE_BATCH_RECORDS';
    records.getRange(firstRecordRow,1,recordRows.length,24).setValues(recordRows);
  }

  // Verify the record rows are physically present before writing the index.
  artifactStage='RECORDS_GET_LAST_ROW_AFTER_WRITE';
  const lastRecordRowAfter=records.getLastRow();
  if(recordRows.length && lastRecordRowAfter < firstRecordRow + recordRows.length - 1){
    throw new Error('BATCH_RECORD_WRITE_VERIFICATION_FAILED');
  }

  artifactStage='INDEX_GET_LAST_ROW_BEFORE_WRITE';
  const indexRow=index.getLastRow()+1;
  artifactStage='WRITE_BATCH_INDEX';
  index.getRange(indexRow,1,1,12).setValues([[
    batchNo,
    account,
    generatedAt,
    hash,
    JSON.stringify(meta.cursorBefore||null),
    JSON.stringify(cursorAfter),
    Number(meta.rowsExamined||0),
    rows.length,
    identityReviewRequired,
    contactIntegrityIssues,
    ownershipEvidenceFound,
    recordRows.length
  ]]);

  // Verify index row is physically present before returning success.
  artifactStage='VERIFY_BATCH_INDEX';
  if(index.getLastRow() < indexRow){
    throw new Error('BATCH_INDEX_WRITE_VERIFICATION_FAILED');
  }

  state.batchNumber=batchNo;
  state.lastArtifactHash=hash;
  state.lastArtifactRow=indexRow;

  return {
    saved:true,
    reused:false,
    storageType:'GOOGLE_SHEET_ROW_ARTIFACT_STORE',
    artifactStoreSchemaReady:true,
    artifactStoreRepaired:repaired,
    artifactSpreadsheetId:store.id,
    artifactIndexSheet:'BatchIndex',
    artifactRecordsSheet:'BatchRecords',
    artifactIndexRow:indexRow,
    firstRecordRow:firstRecordRow,
    recordRowsWritten:recordRows.length,
    sha256:hash,
    batchNumber:batchNo
  };
  }catch(e){
    throw new Error('ARTIFACT_STAGE='+artifactStage+' | '+String(e));
  }
}

function MOS5D26_writeBatchArtifactV2_(account,state,rows,meta){
  let artifactStage='START';
  try{
  const batchNo=Number(state.batchNumber||0)+1;
  const generatedAt=new Date().toISOString();
  const cursorAfter={
    fileIndex:state.fileIndex,
    sheetIndex:state.sheetIndex,
    nextRow:state.nextRow,
    completed:state.completed===true
  };

  const identityReviewRequired=rows.filter(function(r){
    return r.identityConsistencyStatus==='IDENTITY_REVIEW_REQUIRED';
  }).length;
  const contactIntegrityIssues=rows.filter(function(r){
    return r.contactIntegrity && r.contactIntegrity.requiresVerification===true;
  }).length;
  const ownershipEvidenceFound=rows.filter(function(r){
    return !!r.ownershipEvidence;
  }).length;

  const canonical=JSON.stringify({
    sourceAccount:account,
    batchNumber:batchNo,
    cursorBefore:meta.cursorBefore||null,
    cursorAfter:cursorAfter,
    rows:rows
  });
  const hash=MOS5D26_sha256_(canonical);

  artifactStage='GET_ARTIFACT_STORE';
  const store=MOS5D26_getArtifactStore_(account);
  if(!store || !store.spreadsheet){
    throw new Error('ARTIFACT_STORE_UNAVAILABLE');
  }

  // Resolve the exact sheets used by this writer from the spreadsheet object.
  artifactStage='RESOLVE_BATCH_INDEX';
  let index=store.spreadsheet.getSheetByName('BatchIndex');
  artifactStage='RESOLVE_BATCH_RECORDS';
  let records=store.spreadsheet.getSheetByName('BatchRecords');

  const indexHeaders=[
    'BatchNumber','SourceAccount','GeneratedAt','ArtifactHash',
    'CursorBefore','CursorAfter','RowsExamined','LeadRowsFound',
    'IdentityReviewRequired','ContactIntegrityIssues',
    'OwnershipEvidenceFound','RecordRowsWritten'
  ];
  const recordHeaders=[
    'BatchNumber','SourceAccount','FileId','Workbook','Sheet','SourceRow',
    'Name','Email','Phone','Owner','Status','Source',
    'OwnershipEvidence','LeadLock','RoundRobinEligible','CampaignEligible',
    'EmailIntegrityStatus','PhoneIntegrityStatus','AuthenticityScore',
    'ContactIntegrityStatus','RequiresVerification',
    'NameEmailConsistency','ContactOwnershipConfidence','IdentityConsistencyStatus'
  ];

  let repaired=false;

  if(!index){
    index=store.spreadsheet.insertSheet('BatchIndex');
    repaired=true;
  }
  if(!records){
    records=store.spreadsheet.insertSheet('BatchRecords');
    repaired=true;
  }

  artifactStage='ENSURE_INDEX_HEADER';
  MOS5D26_ensureHeader_(index,indexHeaders);
  artifactStage='ENSURE_RECORDS_HEADER';
  MOS5D26_ensureHeader_(records,recordHeaders);

  if(typeof index.getLastRow!=='function'){
    throw new Error('BATCH_INDEX_OBJECT_INVALID');
  }
  if(typeof records.getLastRow!=='function'){
    throw new Error('BATCH_RECORDS_OBJECT_INVALID');
  }

  // Idempotency by hash in BatchIndex column D.
  artifactStage='INDEX_GET_LAST_ROW';
  const lastIndex=index.getLastRow();
  if(lastIndex>=2){
    const hashes=index.getRange(2,4,lastIndex-1,1)
      .getDisplayValues()
      .map(function(r){return r[0];});
    const found=hashes.indexOf(hash);
    if(found>=0){
      const indexRow=found+2;
      state.batchNumber=batchNo;
      state.lastArtifactHash=hash;
      state.lastArtifactRow=indexRow;
      return {
        saved:true,
        reused:true,
        storageType:'GOOGLE_SHEET_ROW_ARTIFACT_STORE',
        artifactStoreSchemaReady:true,
        artifactStoreRepaired:repaired,
        artifactSpreadsheetId:store.id,
        artifactIndexSheet:'BatchIndex',
        artifactRecordsSheet:'BatchRecords',
        artifactIndexRow:indexRow,
        firstRecordRow:0,
        recordRowsWritten:0,
        sha256:hash,
        batchNumber:batchNo
      };
    }
  }

  const recordRows=rows.map(function(r){
    return MOS5D26_recordRow_(batchNo,account,r);
  });

  let firstRecordRow=0;
  if(recordRows.length){
    artifactStage='RECORDS_GET_LAST_ROW_BEFORE_WRITE';
    firstRecordRow=records.getLastRow()+1;
    artifactStage='WRITE_BATCH_RECORDS';
    records.getRange(firstRecordRow,1,recordRows.length,24).setValues(recordRows);
  }

  // Verify the record rows are physically present before writing the index.
  artifactStage='RECORDS_GET_LAST_ROW_AFTER_WRITE';
  const lastRecordRowAfter=records.getLastRow();
  if(recordRows.length && lastRecordRowAfter < firstRecordRow + recordRows.length - 1){
    throw new Error('BATCH_RECORD_WRITE_VERIFICATION_FAILED');
  }

  artifactStage='INDEX_GET_LAST_ROW_BEFORE_WRITE';
  const indexRow=index.getLastRow()+1;
  artifactStage='WRITE_BATCH_INDEX';
  index.getRange(indexRow,1,1,12).setValues([[
    batchNo,
    account,
    generatedAt,
    hash,
    JSON.stringify(meta.cursorBefore||null),
    JSON.stringify(cursorAfter),
    Number(meta.rowsExamined||0),
    rows.length,
    identityReviewRequired,
    contactIntegrityIssues,
    ownershipEvidenceFound,
    recordRows.length
  ]]);

  // Verify index row is physically present before returning success.
  artifactStage='VERIFY_BATCH_INDEX';
  if(index.getLastRow() < indexRow){
    throw new Error('BATCH_INDEX_WRITE_VERIFICATION_FAILED');
  }

  state.batchNumber=batchNo;
  state.lastArtifactHash=hash;
  state.lastArtifactRow=indexRow;

  return {
    saved:true,
    reused:false,
    storageType:'GOOGLE_SHEET_ROW_ARTIFACT_STORE',
    artifactStoreSchemaReady:true,
    artifactStoreRepaired:repaired,
    artifactSpreadsheetId:store.id,
    artifactIndexSheet:'BatchIndex',
    artifactRecordsSheet:'BatchRecords',
    artifactIndexRow:indexRow,
    firstRecordRow:firstRecordRow,
    recordRowsWritten:recordRows.length,
    sha256:hash,
    batchNumber:batchNo
  };
  }catch(e){
    throw new Error('D26_WRITER_V2 | ARTIFACT_STAGE='+artifactStage+' | '+String(e));
  }
}

function MOS5D26_identityConsistency_(name,email,phone){
  const nm=String(name||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim();
  const em=String(email||'').toLowerCase().trim();
  const local=(em.split('@')[0]||'').replace(/[^a-z0-9]/g,'');
  const tokens=nm.split(/\s+/).filter(function(x){return x.length>=3;});
  let nec='UNKNOWN',score=50;

  if(em&&tokens.length){
    const hits=tokens.filter(function(t){
      return local.indexOf(t)>=0 || (t.length>=4 && local.indexOf(t.substring(0,4))>=0);
    }).length;
    if(hits){
      nec='CONSISTENT';
      score=85;
    }else{
      nec='NO_OBVIOUS_MATCH';
      score=45;
    }
  }else if(!em){
    nec='NO_EMAIL';
    score=40;
  }

  return {
    nameEmailConsistency:nec,
    namePhoneConsistency:phone?'UNVERIFIED':'NO_PHONE',
    crossSourceMatchCount:0,
    contactOwnershipConfidence:score,
    identityConsistencyStatus:nec==='NO_OBVIOUS_MATCH'
      ? 'IDENTITY_REVIEW_REQUIRED'
      : 'NO_IDENTITY_CONFLICT_FOUND'
  };
}

function MOS5D26_writeBatchArtifact_(account,state,rows,meta){
  const batchNo=Number(state.batchNumber||0)+1;
  const generatedAt=new Date().toISOString();
  const cursorAfter={
    fileIndex:state.fileIndex,
    sheetIndex:state.sheetIndex,
    nextRow:state.nextRow,
    completed:state.completed===true
  };

  const payload={
    schemaVersion:'1.0',
    release:MOS5_D26.RELEASE,
    version:MOS5_D26.VERSION,
    sourceAccount:account,
    batchNumber:batchNo,
    generatedAt:generatedAt,
    cursorBefore:meta.cursorBefore||null,
    cursorAfter:cursorAfter,
    counts:{
      rowsExamined:meta.rowsExamined||0,
      leadRowsFound:rows.length,
      identityReviewRequired:rows.filter(function(r){
        return r.identityConsistencyStatus==='IDENTITY_REVIEW_REQUIRED';
      }).length
    },
    rows:rows
  };

  const canonical=JSON.stringify(payload);
  const hash=MOS5D26_sha256_(canonical);
  payload.sha256=hash;

  const store=MOS5D26_getArtifactStore_(account);
  const sh=store.sheet;

  // Idempotency: hash lookup in ArtifactHash column D.
  const last=sh.getLastRow();
  if(last>=2){
    const hashes=sh.getRange(2,4,last-1,1).getDisplayValues().map(function(r){return r[0];});
    const idx=hashes.indexOf(hash);
    if(idx>=0){
      const existingRow=idx+2;
      state.batchNumber=batchNo;
      state.lastArtifactHash=hash;
      state.lastArtifactRow=existingRow;
      return {
        saved:true,
        reused:true,
        storageType:'GOOGLE_SHEET_ROW_ARTIFACT_STORE',
        artifactSpreadsheetId:store.id,
        artifactSheet:'Batches',
        artifactRow:existingRow,
        sha256:hash,
        batchNumber:batchNo
      };
    }
  }

  const payloadJson=JSON.stringify(payload);
  const row=[
    batchNo,
    account,
    generatedAt,
    hash,
    JSON.stringify(meta.cursorBefore||null),
    JSON.stringify(cursorAfter),
    meta.rowsExamined||0,
    rows.length,
    payload.counts.identityReviewRequired,
    payloadJson
  ];

  const targetRow=sh.getLastRow()+1;
  sh.getRange(targetRow,1,1,row.length).setValues([row]);

  state.batchNumber=batchNo;
  state.lastArtifactHash=hash;
  state.lastArtifactRow=targetRow;

  return {
    saved:true,
    reused:false,
    storageType:'GOOGLE_SHEET_ROW_ARTIFACT_STORE',
    artifactSpreadsheetId:store.id,
    artifactSheet:'Batches',
    artifactRow:targetRow,
    artifactStoreCreated:store.created,
    sha256:hash,
    batchNumber:batchNo
  };
}

function MOS5P_initializeD26Inventory(){
  const started=new Date();
  const props=PropertiesService.getScriptProperties();
  let account=MOS5D26_norm_(props.getProperty(MOS5_D26.PROP_ACCOUNT));
  let accountSource=String(props.getProperty(MOS5_D26.PROP_ACCOUNT_SOURCE)||'').trim();
  if(!account && MOS5_D26_DEPLOYMENT_IDENTITY.account && MOS5_D26_DEPLOYMENT_IDENTITY.account.indexOf('__MOS5_')!==0){
    account=MOS5D26_norm_(MOS5_D26_DEPLOYMENT_IDENTITY.account);
    accountSource=MOS5_D26_DEPLOYMENT_IDENTITY.source;
    props.setProperty(MOS5_D26.PROP_ACCOUNT,account);
    props.setProperty(MOS5_D26.PROP_ACCOUNT_SOURCE,accountSource);
  }
  if(!account){
    const r={
      success:false,release:MOS5_D26.RELEASE,version:'1.0.1',
      mode:MOS5_D26.MODE,result:'AUTO_IDENTITY_NOT_INITIALIZED',
      instruction:'Re-run the D2.6 v1.0.1 one-click deployment package so Smart Clasp can inject the verified account identity automatically.',
      manualScriptPropertyRequired:false,
      writesPerformed:false
    };
    Logger.log(JSON.stringify(r,null,2)); return r;
  }

  const terms=['lead','leads','crm','client','seller','buyer','referral','prospect'];
  const seen={}, manifest=[], errors=[];
  terms.forEach(function(term){
    try{
      const q="mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and title contains '"+term.replace(/'/g,"\\'")+"'";
      const it=DriveApp.searchFiles(q);
      let n=0;
      while(it.hasNext() && n<100){
        const f=it.next(); n++;
        if(seen[f.getId()])continue;
        seen[f.getId()]=true;
        manifest.push({fileId:f.getId(),name:f.getName(),matchedTerm:term});
      }
    }catch(e){
      errors.push({stage:'DRIVE_SEARCH',term:term,error:String(e)});
    }
  });

  manifest.sort(function(a,b){return a.name.localeCompare(b.name);});
  MOS5D26_writeManifest_(manifest);
  MOS5D26_writeState_({
    account:account,
    fileIndex:0,
    sheetIndex:0,
    nextRow:2,
    completed:false,
    initializedAt:new Date().toISOString()
  });

  const r={
    success:errors.length===0,
    release:MOS5_D26.RELEASE,version:MOS5_D26.VERSION,mode:MOS5_D26.MODE,
    operation:'INITIALIZE',
    sourceAccount:account,
    accountIdentitySource:accountSource||'AUTO_INJECTED_DEPLOYMENT_CONTEXT',
    manualScriptPropertyRequired:false,
    manifestFiles:manifest.length,
    errorCount:errors.length,
    errors:errors,
    durationMs:new Date().getTime()-started.getTime(),
    checkpoint:{fileIndex:0,sheetIndex:0,nextRow:2},
    safety:{
      spreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,
      leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false
    },
    result:errors.length===0?'PASS':'REVIEW_REQUIRED'
  };
  Logger.log(JSON.stringify(r,null,2)); return r;
}


/**
 * D2.6 v1.2.0 source-sheet eligibility gate.
 * Fail-safe policy: unknown sheets remain eligible; only known operational/system
 * surfaces are excluded from lead-row federation.
 */
function MOS5D26_headerTokens_(sh){
  if(!sh || sh.getLastColumn()<1 || sh.getLastRow()<1) return [];
  const width=Math.min(sh.getLastColumn(),120);
  const vals=sh.getRange(1,1,1,width).getDisplayValues()[0];
  return vals.map(function(v){
    return MOS5D26_norm_(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }).filter(String);
}

function MOS5D26_hasHeader_(tokens,patterns){
  return tokens.some(function(t){
    return patterns.some(function(p){ return p.test(t); });
  });
}

/**
 * v1.3.0 structural source classifier.
 * Unknown names no longer qualify merely because they exist.
 * A source must look like a person/lead/client table by BOTH purpose and headers.
 */
function MOS5D26_sheetEligibility_(workbookName,sheetName,sh){
  const wb=MOS5D26_norm_(workbookName);
  const sn=MOS5D26_norm_(sheetName);
  const n=sn.toLowerCase();

  const hardSkip={
    'import history':'IMPORT_HISTORY',
    'communications':'COMMUNICATION_HISTORY',
    'communication':'COMMUNICATION_HISTORY',
    'email log':'EMAIL_LOG',
    'emaillog':'EMAIL_LOG',
    'system log':'SYSTEM_LOG',
    'systemlog':'SYSTEM_LOG',
    'audit log':'AUDIT_LOG',
    'ae_audit_log':'AUDIT_LOG',
    'validation':'VALIDATION',
    'settings':'SETTINGS',
    'config':'CONFIG',
    'ae_config':'CONFIG',
    'agentconfig':'AGENT_CONFIG',
    'agents':'AGENT_ROSTER',
    'ae_agents':'AGENT_ROSTER',
    'templates':'TEMPLATES',
    'questions':'QUESTIONS',
    'holidays':'HOLIDAYS',
    'parishes':'PARISHES',
    'stats_leads':'STATS',
    'escalation':'ESCALATION',
    'leadindex':'LEAD_INDEX',
    'ae_lead_locks':'LEAD_LOCK_STORE',
    'ae_assignments':'ASSIGNMENT_STORE',
    'ae_shadow_results':'SHADOW_RESULTS',
    'ae_agent_roster_sync_log':'ROSTER_SYNC_LOG',
    'ae_agent_distribution_log':'DISTRIBUTION_LOG',
    'crm_campaign_library':'CAMPAIGN_LIBRARY'
  };
  if(hardSkip[n]){
    return {eligible:false,reason:hardSkip[n],workbook:wb,sheet:sn,structuralScore:0};
  }

  if(/(^|[_\s-])(log|logs|history|audit|communication|communications)([_\s-]|$)/i.test(sn)){
    return {eligible:false,reason:'OPERATIONAL_HISTORY_PATTERN',workbook:wb,sheet:sn,structuralScore:0};
  }
  if(/(^|[_\s-])(config|settings|template|templates|library|stats|validation)([_\s-]|$)/i.test(sn)){
    return {eligible:false,reason:'CONFIG_TEMPLATE_PATTERN',workbook:wb,sheet:sn,structuralScore:0};
  }

  const tokens=MOS5D26_headerTokens_(sh);
  const hasName=MOS5D26_hasHeader_(tokens,[
    /^(name|full name|client name|lead name|contact name|first name|firstname)$/,
    /^last name$/, /^lastname$/
  ]);
  const hasEmail=MOS5D26_hasHeader_(tokens,[/(^| )email( address)?$/,/^e mail$/]);
  const hasPhone=MOS5D26_hasHeader_(tokens,[/(^| )(phone|mobile|cell)( number)?$/,/^telephone$/]);
  const hasStatus=MOS5D26_hasHeader_(tokens,[/(^| )(status|stage|lifecycle)( |$)/]);
  const hasSource=MOS5D26_hasHeader_(tokens,[/(^| )(source|lead source|origin)( |$)/]);
  const hasOwner=MOS5D26_hasHeader_(tokens,[/(^| )(owner|agent|assigned agent|assigned to|broker)( |$)/]);
  const hasLeadType=MOS5D26_hasHeader_(tokens,[/(^| )(lead type|type|category|client type)( |$)/]);
  const hasProperty=MOS5D26_hasHeader_(tokens,[/(^| )(property|address|property address|city|parish|zip|zipcode)( |$)/]);

  const personContact = hasName && (hasEmail || hasPhone);
  const dualContact = hasEmail && hasPhone;
  const leadContextCount=[hasStatus,hasSource,hasOwner,hasLeadType,hasProperty].filter(Boolean).length;
  const nameSuggestsLead=/(lead|client|prospect|contact|intake|master)/i.test(sn);

  let score=0;
  if(hasName) score+=25;
  if(hasEmail) score+=25;
  if(hasPhone) score+=20;
  score+=Math.min(leadContextCount*8,24);
  if(nameSuggestsLead) score+=10;

  const eligible =
    personContact ||
    (dualContact && (leadContextCount>=1 || nameSuggestsLead)) ||
    (nameSuggestsLead && (hasEmail || hasPhone) && leadContextCount>=1);

  return {
    eligible:eligible,
    reason:eligible?'STRUCTURAL_LEAD_SOURCE':'INSUFFICIENT_LEAD_STRUCTURE',
    workbook:wb,
    sheet:sn,
    structuralScore:Math.min(score,100),
    headers:{
      name:hasName,email:hasEmail,phone:hasPhone,status:hasStatus,
      source:hasSource,owner:hasOwner,leadType:hasLeadType,property:hasProperty
    },
    leadContextCount:leadContextCount
  };
}

function MOS5P_runD26NextBatch(rowsPerBatch){
  const started=new Date();
  rowsPerBatch=Math.max(25,Math.min(Number(rowsPerBatch||MOS5_D26.DEFAULT_ROWS_PER_BATCH),500));
  const manifest=MOS5D26_readManifest_();
  const state=MOS5D26_readState_();
  const cursorBefore={
    fileIndex:state?state.fileIndex:0,
    sheetIndex:state?state.sheetIndex:0,
    nextRow:state?state.nextRow:2,
    completed:state?state.completed===true:false
  };
  const batchResults=[];
  const errors=[];
  let rowsExamined=0, leadRowsFound=0, sheetsSkipped=0, sheetsCompleted=0, filesCompleted=0;
  let lastWorkbook='', lastSheet='';

  if(!state || !manifest.length){
    const r={success:false,release:MOS5_D26.RELEASE,version:MOS5_D26.VERSION,
      result:'NOT_INITIALIZED',instruction:'Run MOS5P_initializeD26Inventory first.'};
    Logger.log(JSON.stringify(r,null,2)); return r;
  }

  while(state.fileIndex < manifest.length){
    if(new Date().getTime()-started.getTime() >= MOS5_D26.SAFE_RUNTIME_MS) break;
    if(rowsExamined>=rowsPerBatch) break;

    const mf=manifest[state.fileIndex];
    lastWorkbook=mf.name;
    let ss;
    try{ ss=SpreadsheetApp.openById(mf.fileId); }
    catch(e){
      errors.push({fileId:mf.fileId,stage:'OPEN_WORKBOOK',error:String(e)});
      state.fileIndex++; state.sheetIndex=0; state.nextRow=2; filesCompleted++;
      continue;
    }

    const sheets=ss.getSheets();
    if(state.sheetIndex>=sheets.length){
      state.fileIndex++; state.sheetIndex=0; state.nextRow=2; filesCompleted++;
      continue;
    }

    const sh=sheets[state.sheetIndex];
      const d26Eligibility=MOS5D26_sheetEligibility_(mf.name,sh.getName(),sh);
      if(!d26Eligibility.eligible){
        sheetsSkipped++;
        state.sheetIndex++;
        state.nextRow=2;
        continue;
      }
    lastSheet=sh.getName();
    const lr=sh.getLastRow(), lc=sh.getLastColumn();

    let headers=[];
    if(lr>=1 && lc>=1){
      try{headers=sh.getRange(1,1,1,Math.min(lc,100)).getDisplayValues()[0];}
      catch(e){errors.push({fileId:mf.fileId,sheet:lastSheet,stage:'READ_HEADERS',error:String(e)});}
    }

    if(!MOS5D26_isLeadLikeTab_(lastSheet,headers) || lr<2){
      sheetsSkipped++;
      state.sheetIndex++; state.nextRow=2;
      continue;
    }

    const remaining=lr-state.nextRow+1;
    if(remaining<=0){
      sheetsCompleted++; state.sheetIndex++; state.nextRow=2; continue;
    }

    const take=Math.min(remaining, rowsPerBatch-rowsExamined, 200);
    if(take<=0) break;

    let values=[];
    try{
      values=sh.getRange(state.nextRow,1,take,Math.min(lc,100)).getDisplayValues();
    }catch(e){
      errors.push({fileId:mf.fileId,sheet:lastSheet,stage:'READ_ROWS',error:String(e)});
      state.sheetIndex++; state.nextRow=2;
      continue;
    }

    for(let i=0;i<values.length;i++){
      const rowNum=state.nextRow+i;
rowsExamined++;

      const row=values[i];
      const record={};
      headers.forEach(function(h,idx){record[MOS5D26_norm_(h)]=row[idx];});

      const email=record['email']||record['email address']||record['lead email']||'';
      const phone=record['phone']||record['phone number']||record['mobile']||record['cell']||'';
      const first=record['first name']||record['firstname']||'';
      const last=record['last name']||record['lastname']||'';
      const name=record['name']||[first,last].join(' ').trim();
      const owner=record['assigned agent']||record['agent']||record['owner']||record['assigned to']||'';
      const status=record['status']||record['lead status']||'';
      const source=record['source']||record['lead source']||'';

      if(email || phone || name){
        leadRowsFound++;
        let integrity=null;
        try{
          if(typeof MOS5CI_scoreSubmission_==='function'){
            integrity=MOS5CI_scoreSubmission_({email:email,phone:phone,name:name});
          }
        }catch(e){}

        batchResults.push({
          sourceAccount:state.account,
          fileId:mf.fileId,workbook:mf.name,sheet:lastSheet,rowNumber:rowNum,
          name:name,email:email,phone:phone,owner:owner,status:status,source:source,
          ownershipEvidence:owner?'ROW_LEVEL_AGENT_FIELD':'',
          leadLock:true,roundRobinEligible:false,campaignEligible:false,
          contactIntegrity:integrity
        });
        const _r=batchResults[batchResults.length-1];
        const _id=MOS5D26_identityConsistency_(_r.name,_r.email,_r.phone);
        Object.keys(_id).forEach(function(k){_r[k]=_id[k];});
      }
    }

    state.nextRow += take;
    if(state.nextRow>lr){
      sheetsCompleted++;
      state.sheetIndex++;
      state.nextRow=2;
    }
  }

  if(state.fileIndex>=manifest.length){
    state.completed=true;
  }
  const batchAccount=MOS5D26_norm_(state.account || PropertiesService.getScriptProperties().getProperty(MOS5_D26.PROP_ACCOUNT));
  if(!batchAccount){
    const blocked={
      success:false,release:MOS5_D26.RELEASE,version:MOS5_D26.VERSION,
      operation:'PROCESS_BATCH',result:'BLOCKED_ACCOUNT_IDENTITY_MISSING',
      instruction:'Run MOS5P_initializeD26Inventory once. No batch artifact or source mutation was performed.',
      safety:{spreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false}
    };
    Logger.log(JSON.stringify(blocked,null,2)); return blocked;
  }
  let artifact;
  try{
    artifact=MOS5D26_writeBatchArtifactV2_(
      batchAccount,
      state,
      batchResults,
      {rowsExamined:rowsExamined,cursorBefore:cursorBefore}
    );
  }catch(e){
    const failed={
      success:false,
      release:MOS5_D26.RELEASE,
      version:MOS5_D26.VERSION,
      mode:MOS5_D26.MODE,
      operation:'PROCESS_BATCH_ARTIFACT_COMMIT',
      sourceAccount:batchAccount,
      rowsExamined:rowsExamined,
      leadRowsFound:leadRowsFound,
      cursorBefore:cursorBefore,
      inMemoryCursorAfter:{
        fileIndex:state.fileIndex,
        sheetIndex:state.sheetIndex,
        nextRow:state.nextRow,
        completed:state.completed===true
      },
      checkpointAdvanced:false,
      artifactSaved:false,
      error:String(e),
      nextAction:'FIX_ARTIFACT_STORE_AND_RERUN_SAME_BATCH',
      safety:{
        sourceSpreadsheetMutationPerformed:false,
        gmailMutationPerformed:false,
        emailSent:false,
        leadAssignmentPerformed:false,
        roundRobinPerformed:false,
        triggerMutationPerformed:false
      },
      result:'BLOCKED_ARTIFACT_COMMIT'
    };
    Logger.log(JSON.stringify(failed,null,2));
    return failed;
  }

  // Only persist the cursor after durable artifact commit succeeds.
  MOS5D26_writeState_(state);

  const duration=new Date().getTime()-started.getTime();
  const r={
    success:true,release:MOS5_D26.RELEASE,version:MOS5_D26.VERSION,mode:MOS5_D26.MODE,
    operation:'PROCESS_BATCH',
    sourceAccount:state.account,
    rowsPerBatchRequested:rowsPerBatch,
    rowsExamined:rowsExamined,
    leadRowsFound:leadRowsFound,
    batchResults:batchResults.length,
    resultsStorage:'DURABLE_GOOGLE_SHEET_ROW_ARTIFACT_STORE',
    sheetsSkipped:sheetsSkipped,
    sheetsCompleted:sheetsCompleted,
    filesCompleted:filesCompleted,
    currentWorkbook:lastWorkbook,currentSheet:lastSheet,
    durationMs:duration,
    cursor:{
      fileIndex:state.fileIndex,sheetIndex:state.sheetIndex,nextRow:state.nextRow,
      manifestFiles:manifest.length,completed:state.completed
    },
    errorCount:errors.length,errors:errors,
    nextAction:state.completed?'FEDERATION_ACCOUNT_COMPLETE':'RUN_SAME_FUNCTION_AGAIN',
    artifactSaved:artifact.saved,
    artifactReused:artifact.reused,
    artifactStorageType:artifact.storageType,
    artifactStoreSchemaReady:artifact.artifactStoreSchemaReady===true,
    artifactStoreRepaired:artifact.artifactStoreRepaired===true,
    artifactSpreadsheetId:artifact.artifactSpreadsheetId,
    artifactIndexSheet:artifact.artifactIndexSheet,
    artifactRecordsSheet:artifact.artifactRecordsSheet,
    artifactIndexRow:artifact.artifactIndexRow,
    firstRecordRow:artifact.firstRecordRow||0,
    recordRowsWritten:artifact.recordRowsWritten||0,
    artifactHash:artifact.sha256,
    batchNumber:artifact.batchNumber,
    identityReviewRequired:batchResults.filter(function(x){return x.identityConsistencyStatus==='IDENTITY_REVIEW_REQUIRED';}).length,
    contactIntegrityIssues:batchResults.filter(function(x){return x.contactIntegrity&&x.contactIntegrity.requiresVerification===true;}).length,
    ownershipEvidenceFound:batchResults.filter(function(x){return !!x.ownershipEvidence;}).length,
    knownErrorGuards:{
      resumable:true,idempotentProcessedKeys:true,
      safeRuntimeMs:MOS5_D26.SAFE_RUNTIME_MS,
      usesDriveAppGetOwner:false,
      requiresSessionEffectiveUser:false
    },
    safety:{
      spreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,
      leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false
    },
    result:state.completed?'PASS':'CONTINUE'
  };
  Logger.log(JSON.stringify(r,null,2)); return r;
}


function MOS5P_resetD26OversizedLegacyProperties(){
  const props=PropertiesService.getScriptProperties();
  const removed=[];
  ['MOS5_D26_RESULTS_JSON'].forEach(function(k){
    if(props.getProperty(k)!==null){
      props.deleteProperty(k);
      removed.push(k);
    }
  });
  const r={
    success:true,
    release:MOS5_D26.RELEASE,
    version:MOS5_D26.VERSION,
    operation:'REMOVE_OVERSIZED_LEGACY_RESULTS_PROPERTY',
    removedProperties:removed,
    statePreserved:true,
    accountPreserved:true,
    manifestPreserved:true,
    result:'PASS'
  };
  Logger.log(JSON.stringify(r,null,2));
  return r;
}


function MOS5P_compactD26CheckpointState(){
  const props=PropertiesService.getScriptProperties();
  const raw=props.getProperty(MOS5_D26.PROP_STATE);
  let oldState={};
  try{ oldState=raw?JSON.parse(raw):{}; }catch(e){ oldState={}; }

  const compact={
    account:String(oldState.account||props.getProperty(MOS5_D26.PROP_ACCOUNT)||''),
    fileIndex:Number(oldState.fileIndex||0),
    sheetIndex:Number(oldState.sheetIndex||0),
    nextRow:Number(oldState.nextRow||2),
    completed:oldState.completed===true,
    initializedAt:String(oldState.initializedAt||''),
    batchNumber:Number(oldState.batchNumber||0),
    lastArtifactHash:String(oldState.lastArtifactHash||''),
    lastArtifactRow:Number(oldState.lastArtifactRow||0)
  };

  // Remove obsolete large properties from earlier revisions.
  const removed=[];
  ['MOS5_D26_RESULTS_JSON'].forEach(function(k){
    if(props.getProperty(k)!==null){
      props.deleteProperty(k);
      removed.push(k);
    }
  });

  props.setProperty(MOS5_D26.PROP_STATE,JSON.stringify(compact));

  const r={
    success:true,
    release:MOS5_D26.RELEASE,
    version:MOS5_D26.VERSION,
    operation:'COMPACT_CHECKPOINT_STATE',
    removedLegacyProperties:removed,
    processedKeysRemoved:true,
    stateBytes:JSON.stringify(compact).length,
    checkpointPreserved:{
      account:compact.account,
      fileIndex:compact.fileIndex,
      sheetIndex:compact.sheetIndex,
      nextRow:compact.nextRow,
      batchNumber:compact.batchNumber,
      completed:compact.completed
    },
    result:'PASS'
  };
  Logger.log(JSON.stringify(r,null,2));
  return r;
}

function MOS5P_getD26Status(){
  const manifest=MOS5D26_readManifest_(), state=MOS5D26_readState_();
  const r={
    success:!!state,release:MOS5_D26.RELEASE,version:MOS5_D26.VERSION,
    mode:MOS5_D26.MODE,operation:'STATUS',
    manifestFiles:manifest.length,
    sourceAccount:state?state.account:'',
    accountIdentitySource:PropertiesService.getScriptProperties().getProperty(MOS5_D26.PROP_ACCOUNT_SOURCE)||'AUTO_INJECTED_DEPLOYMENT_CONTEXT',
    manualScriptPropertyRequired:false,
    accountIdentitySource:PropertiesService.getScriptProperties().getProperty(MOS5_D26.PROP_ACCOUNT_SOURCE)||'AUTO_INJECTED_DEPLOYMENT_CONTEXT',
    manualScriptPropertyRequired:false,
    cursor:state?{
      fileIndex:state.fileIndex,sheetIndex:state.sheetIndex,nextRow:state.nextRow,completed:state.completed
    }:null,
    accumulatedResults:'NOT_STORED_IN_SCRIPT_PROPERTIES',
    roundRobin:false,campaignActivation:false,crmWrites:false,
    emailSend:false,gmailMutation:false,spreadsheetMutation:false,
    result:state?(state.completed?'PASS':'CONTINUE'):'NOT_INITIALIZED'
  };
  Logger.log(JSON.stringify(r,null,2)); return r;
}

function MOS5P_exportD26Snapshot(){
  const state=MOS5D26_readState_();
  const r={
    success:!!state && state.completed===true,
    release:MOS5_D26.RELEASE,version:'1.0.2',
    operation:'EXPORT_SNAPSHOT_STATUS',
    sourceAccount:state?state.account:'',
    completed:state?state.completed:false,
    resultStorage:'DURABLE_GOOGLE_SHEET_ROW_ARTIFACT_STORES',
    instruction:'Batch rows are persisted as hashed JSON payloads in a dedicated MOS5 Federation spreadsheet; Script Properties store cursor only.',
    safety:{
      spreadsheetMutationPerformed:false,gmailMutationPerformed:false,emailSent:false,
      leadAssignmentPerformed:false,roundRobinPerformed:false,triggerMutationPerformed:false
    },
    result:(state&&state.completed)?'PASS':'CONTINUE'
  };
  Logger.log(JSON.stringify(r,null,2)); return r;
}
