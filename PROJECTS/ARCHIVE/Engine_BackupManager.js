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
