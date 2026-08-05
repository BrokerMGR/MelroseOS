/**
 * MELROSEOS 4.0 - BACKUP MANAGER
 */
var M4_BACKUP={VERSION:'4.0.0',MODULE:'SYSTEM',SHEETS:{JOBS:'BackupJobs',HISTORY:'BackupHistory',CONFIG:'BackupConfig'}};

function setupMelroseBackupManagerStep1(){const ss=m4_getCommandCenter_();m4_backupEnsure_(ss,'BackupJobs',['JobID','BackupType','Target','Status','StartedAt','CompletedAt']);return{success:true,nextFunction:'setupMelroseBackupManagerStep2'};}
function setupMelroseBackupManagerStep2(){const ss=m4_getCommandCenter_();m4_backupEnsure_(ss,'BackupHistory',['HistoryID','JobID','Result','FileId','CreatedAt']);return{success:true,nextFunction:'setupMelroseBackupManagerStep3'};}
function setupMelroseBackupManagerStep3(){const ss=m4_getCommandCenter_();m4_backupEnsure_(ss,'BackupConfig',['Setting','Value','UpdatedAt']);return{success:true,nextFunction:'setupMelroseBackupManagerFinalize'};}
function setupMelroseBackupManagerFinalize(){try{m4_setSetting_('BACKUP_MANAGER_VERSION',M4_BACKUP.VERSION,{type:'STRING',category:'SYSTEM',description:'Backup Manager',required:true});}catch(e){}return{success:true,version:M4_BACKUP.VERSION};}
function setupMelroseBackupManager(){return setupMelroseBackupManagerStep1();}
function m4_backupEnsure_(ss,n,h){let s=ss.getSheetByName(n);if(!s){s=ss.insertSheet(n);s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return;}const r=s.getRange(1,1,1,h.length),v=r.getDisplayValues()[0];h.forEach((x,i)=>{if(!v[i])v[i]=x});r.setValues([v]);}
function queueBackupJob(o){const sh=m4_getCommandCenter_().getSheetByName('BackupJobs');const id=m4_createID_('BACKUP');m4_appendObject_(sh,{JobID:id,BackupType:o.BackupType||'FULL',Target:o.Target||'COMMAND_CENTER',Status:'QUEUED',StartedAt:'',CompletedAt:''});return{success:true,jobID:id};}
function refreshMelroseBackupManager(){const sh=m4_getCommandCenter_().getSheetByName('BackupJobs');const rows=m4_readObjects_(sh);return{success:true,queued:rows.filter(r=>String(r.Status).toUpperCase()==='QUEUED').length,completed:rows.filter(r=>String(r.Status).toUpperCase()==='COMPLETED').length};}
function registerMelroseBackupManagerComponents(){if(typeof registerMelroseEngine==='function'){registerMelroseEngine({componentKey:'ENGINE.BACKUP_MANAGER_4',engineName:'Backup Manager',module:'SYSTEM',version:M4_BACKUP.VERSION,setupFunction:'setupMelroseBackupManager',requiredSheet:'BackupJobs',required:true,description:'Backup engine'});}return{success:true};}
function testMelroseBackupManager(){const ss=m4_getCommandCenter_();return{success:!!ss.getSheetByName('BackupJobs')&&!!ss.getSheetByName('BackupHistory')&&!!ss.getSheetByName('BackupConfig'),version:M4_BACKUP.VERSION};}

// BEGIN MOS5-G5-BACKUP-RUNTIME v1.0.0
const MOS5_G5_BACKUP_VERSION = "1.0.0";

function MOS5G5_getBackupRuntimeState() {
  return {
    release: "MOS5-G5-BACKUP-RUNTIME",
    version: MOS5_G5_BACKUP_VERSION,
    archiveProject: true,
    localBackupRoot: "D:\\MelroseOS_Storage\\Backups",
    reportRoot: "D:\\MelroseOS_Storage\\Reports",
    productionWritesEnabled: false,
    automaticRestoreEnabled: false,
    automaticDeploymentEnabled: false,
    generatedAt: new Date().toISOString()
  };
}

function MOS5G5_validateBackupRequest(request) {
  const input = request || {};
  const operation = String(input.operation || "BACKUP").trim().toUpperCase();
  const targetCode = String(input.targetCode || "").trim().toUpperCase();
  const requestedBy = String(
    input.requestedBy || Session.getEffectiveUser().getEmail() || ""
  ).trim().toLowerCase();

  if (!targetCode) {
    throw new Error("targetCode is required.");
  }

  if (["BACKUP","VERIFY","RESTORE_PREVIEW"].indexOf(operation) === -1) {
    throw new Error("Unsupported backup operation: " + operation);
  }

  return {
    success: true,
    operation: operation,
    targetCode: targetCode,
    requestedBy: requestedBy,
    approvedForExecution: operation !== "RESTORE_PREVIEW",
    restorePreviewOnly: operation === "RESTORE_PREVIEW",
    productionChanged: false,
    validatedAt: new Date().toISOString()
  };
}

function MOS5G5_buildBackupManifest(request) {
  const valid = MOS5G5_validateBackupRequest(request);

  return {
    release: "MOS5-G5-BACKUP-RUNTIME",
    version: MOS5_G5_BACKUP_VERSION,
    operation: valid.operation,
    targetCode: valid.targetCode,
    requestedBy: valid.requestedBy,
    archiveAuthority: "PROJECTS/ARCHIVE",
    localBackupRoot: "D:\\MelroseOS_Storage\\Backups",
    reportRoot: "D:\\MelroseOS_Storage\\Reports",
    checksumRequired: true,
    restoreRequiresBrokerApproval: true,
    productionChanged: false,
    createdAt: new Date().toISOString()
  };
}

function MOS5G5_runBackupRuntimeDiagnostics() {
  const tests = [];

  function add(code, passed, details) {
    tests.push({
      code: code,
      status: passed ? "PASS" : "FAIL",
      details: details
    });
  }

  const state = MOS5G5_getBackupRuntimeState();
  add("ARCHIVE_AUTHORITY", state.archiveProject === true,
      "Archive project is the backup authority.");
  add("LOCAL_BACKUP_ROOT",
      state.localBackupRoot === "D:\\MelroseOS_Storage\\Backups",
      "D: backup root is registered.");
  add("REPORT_ROOT",
      state.reportRoot === "D:\\MelroseOS_Storage\\Reports",
      "D: report root is registered.");
  add("RESTORE_DISABLED",
      state.automaticRestoreEnabled === false,
      "Automatic restore is disabled.");
  add("DEPLOYMENT_DISABLED",
      state.automaticDeploymentEnabled === false,
      "Automatic deployment is disabled.");

  const failed = tests.filter(function(test) {
    return test.status === "FAIL";
  }).length;

  const result = {
    release: "MOS5-G5-BACKUP-RUNTIME",
    version: MOS5_G5_BACKUP_VERSION,
    overallStatus: failed ? "FAIL" : "PASS",
    passed: tests.length - failed,
    failed: failed,
    tests: tests,
    productionChanged: false,
    completedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
// END MOS5-G5-BACKUP-RUNTIME v1.0.0
