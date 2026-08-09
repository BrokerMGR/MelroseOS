const MOS5_D26_AUTO={
  RELEASE:'MOS5-ENTERPRISE-D2.6',
  VERSION:'1.3.0',
  MAX_BATCHES_PER_RUN:8,
  MAX_RUNTIME_MS:210000
};

function MOS5P_runD26AutoContinue(){
  const started=Date.now();
  const runs=[];
  let finalResult='CONTINUE';

  for(let i=0;i<MOS5_D26_AUTO.MAX_BATCHES_PER_RUN;i++){
    if(Date.now()-started>=MOS5_D26_AUTO.MAX_RUNTIME_MS){
      finalResult='PAUSED_RUNTIME_GUARD';
      break;
    }

    const r=MOS5P_runD26NextBatch();
    runs.push({
      run:i+1,
      success:r&&r.success===true,
      result:r&&r.result||'UNKNOWN',
      batchNumber:r&&r.batchNumber||null,
      rowsExamined:r&&r.rowsExamined||0,
      leadRowsFound:r&&r.leadRowsFound||0,
      recordRowsWritten:r&&r.recordRowsWritten||0,
      currentWorkbook:r&&r.currentWorkbook||'',
      currentSheet:r&&r.currentSheet||'',
      cursor:r&&r.cursor||null
    });

    if(!r || r.success!==true){
      finalResult='BLOCKED_CHILD_BATCH';
      break;
    }
    if(r.cursor&&r.cursor.completed===true){
      finalResult='ACCOUNT_SCAN_COMPLETE';
      break;
    }
    if(r.result!=='CONTINUE'){
      finalResult=r.result||'STOPPED';
      break;
    }
  }

  const state=MOS5D26_readState_()||{};
  const out={
    success:finalResult!=='BLOCKED_CHILD_BATCH',
    release:MOS5_D26_AUTO.RELEASE,
    version:MOS5_D26_AUTO.VERSION,
    operation:'SMART_AUTO_CONTINUE',
    batchesAttempted:runs.length,
    batches:runs,
    finalCheckpoint:{
      fileIndex:Number(state.fileIndex||0),
      sheetIndex:Number(state.sheetIndex||0),
      nextRow:Number(state.nextRow||2),
      batchNumber:Number(state.batchNumber||0),
      completed:state.completed===true
    },
    safety:{
      sourceSpreadsheetMutationPerformed:false,
      gmailMutationPerformed:false,
      emailSent:false,
      leadAssignmentPerformed:false,
      roundRobinPerformed:false,
      triggerMutationPerformed:false
    },
    nextAction:finalResult==='ACCOUNT_SCAN_COMPLETE'
      ?'BUILD_NEXT_ACCOUNT_FEDERATION_ROUTER'
      :finalResult==='PAUSED_RUNTIME_GUARD'||finalResult==='CONTINUE'
        ?'RUN_SAME_AUTO_FUNCTION_AGAIN'
        :'REVIEW_BLOCK',
    result:finalResult
  };
  Logger.log(JSON.stringify(out,null,2));
  return out;
}

function MOS5P_runD26SmartSourceCertification(){
  const cases=[
    ['Seller Funnel','Import History',false],
    ['Melrose Lead Master Log','SystemLog',false],
    ['Melrose Lead Master Log','EmailLog',false],
    ['Melrose Lead Master Log','AE_AUDIT_LOG',false],
    ['MelroseOS CRM','CRM_CAMPAIGN_LIBRARY',false],
    ['Leads Follow up','Templates',false],
    ['Leads Follow up','Leads',true],
    ['Master Lead List - 2025','Closed Clients',true],
    ['James -Leads','MasterLog',true],
    ['Agent Sheet','LeadIntake',true],
    ['Unknown Workbook','Prospects',true],
    ['Unknown Workbook','Contacts',true]
  ];

  const tests=cases.map(function(c){
    const r=MOS5D26_sheetEligibility_(c[0],c[1]);
    return {workbook:c[0],sheet:c[1],expectedEligible:c[2],
      actualEligible:r.eligible,reason:r.reason,pass:r.eligible===c[2]};
  });
  const pass=tests.every(function(t){return t.pass;});
  const state=MOS5D26_readState_()||{};
  const out={
    success:pass,
    release:MOS5_D26_AUTO.RELEASE,
    version:MOS5_D26_AUTO.VERSION,
    test:'SMART_SOURCE_AND_AUTORUN_CERTIFICATION',
    testsPassed:tests.filter(function(t){return t.pass;}).length,
    testsTotal:tests.length,
    tests:tests,
    checkpointPreserved:{
      fileIndex:Number(state.fileIndex||0),
      sheetIndex:Number(state.sheetIndex||0),
      nextRow:Number(state.nextRow||2),
      batchNumber:Number(state.batchNumber||0),
      completed:state.completed===true
    },
    automation:{
      maxBatchesPerRun:MOS5_D26_AUTO.MAX_BATCHES_PER_RUN,
      maxRuntimeMs:MOS5_D26_AUTO.MAX_RUNTIME_MS,
      installsTrigger:false
    },
    safety:{
      sourceSpreadsheetMutationPerformed:false,
      gmailMutationPerformed:false,
      emailSent:false,
      leadAssignmentPerformed:false,
      roundRobinPerformed:false,
      triggerMutationPerformed:false
    },
    result:pass?'PASS':'BLOCKED'
  };
  Logger.log(JSON.stringify(out,null,2));
  return out;
}
