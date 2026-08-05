/**
 * MELROSEOS 4.0 — CORE BACKUP
 * Version 4.0.0
 */

var M4_BACKUP_ENGINE = Object.freeze({
  VERSION: '4.0.0',
  MODULE: 'SYSTEM',
  SHEETS: {
    JOBS: 'BackupJobs',
    HISTORY: 'BackupHistory',
    CONFIG: 'BackupConfig'
  }
});

function setupMelroseCoreBackup(){
  const ss=m4_getCommandCenter_();
  m4_ensureSheet_(ss,M4_BACKUP.SHEETS.LOG,
    ['BackupID','StartedAt','CompletedAt','Status','SpreadsheetId','SpreadsheetName','SheetsBackedUp','Notes'],
    {frozenRows:1});
  m4_ensureSheet_(ss,M4_BACKUP.SHEETS.CONFIG,
    ['Setting','Value','Description'],
    {frozenRows:1});
  if(typeof registerMelroseEngine==='function'){
    registerMelroseEngine({
      componentKey:'ENGINE.CORE_BACKUP',
      engineName:'Core Backup',
      module:'CORE',
      version:M4_BACKUP.VERSION,
      setupFunction:'setupMelroseCoreBackup',
      requiredSheet:M4_BACKUP.SHEETS.LOG,
      required:true,
      description:'Spreadsheet backup engine.'
    });
  }
  return {success:true,version:M4_BACKUP.VERSION};
}

function runMelroseCoreBackup(){
  const ss=m4_getCommandCenter_();
  const log=ss.getSheetByName(M4_BACKUP.SHEETS.LOG);
  const started=new Date();
  const name=ss.getName()+' Backup '+Utilities.formatDate(started,Session.getScriptTimeZone(),'yyyy-MM-dd HHmmss');
  const copy=DriveApp.getFileById(ss.getId()).makeCopy(name);
  log.appendRow([
    m4_createID_('BACKUP'),
    started,
    new Date(),
    'SUCCESS',
    copy.getId(),
    name,
    ss.getSheets().length,
    ''
  ]);
  return {success:true,backupId:copy.getId(),backupName:name};
}

function openMelroseBackupLog(){
  const ss=m4_getCommandCenter_();
  ss.setActiveSheet(ss.getSheetByName(M4_BACKUP.SHEETS.LOG));
}

function restoreMelroseBackupPlaceholder(){
  throw new Error('Restore is intentionally disabled.');
}

function testMelroseCoreBackup(){
  const ss=m4_getCommandCenter_();
  return {
    success:Boolean(ss.getSheetByName(M4_BACKUP.SHEETS.LOG)),
    version:M4_BACKUP.VERSION
  };
}
