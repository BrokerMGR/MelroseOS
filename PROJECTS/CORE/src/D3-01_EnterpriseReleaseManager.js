/**
 * FILE: D3-01_EnterpriseReleaseManager.gs
 * RELEASE: MOS5-D3.1
 * VERSION: 1.0.0
 */

const MOS5D31_VERSION = '1.0.0';

const MOS5D31_CONFIG = Object.freeze({
  release: 'MOS5-D3.1',
  environment: 'DEV',
  coreWorkbookId: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  coreScriptId: '1dWl5ZKQ531GF3TltgAS9WHSElWXVeyhKiLjEc9cSnt3IOCyBWLi6Sy3Z',
  registrySheet: 'SYS_RELEASE_REGISTRY',
  targetsSheet: 'SYS_DEPLOYMENT_TARGETS',
  auditSheet: 'SYS_RELEASE_AUDIT'
});

function MOS5D31_installReleaseManager() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Could not obtain script lock.');

  try {
    MOS5D31_assertCore_();
    MOS5D31_ensureSheets_();
    MOS5D31_seedTargets_();

    const record = MOS5D31_registerRelease({
      release: MOS5D31_CONFIG.release,
      version: MOS5D31_VERSION,
      environment: MOS5D31_CONFIG.environment,
      targetCode: 'CORE',
      targetWorkbookId: MOS5D31_CONFIG.coreWorkbookId,
      targetScriptId: MOS5D31_CONFIG.coreScriptId,
      installerVersion: '1.0.0',
      packageHash: 'LOCAL_MANIFEST',
      status: 'INSTALLED',
      validationStatus: 'PENDING',
      rollbackReference: '',
      brokerApprovalStatus: 'NOT_REQUIRED_DEV',
      notes: 'Enterprise Release Manager installed.'
    });

    const diagnostics = MOS5D31_runDiagnostics();

    const result = {
      success: diagnostics.overallStatus !== 'FAIL',
      release: MOS5D31_CONFIG.release,
      version: MOS5D31_VERSION,
      recordId: record.recordId,
      overallStatus: diagnostics.overallStatus,
      passed: diagnostics.passed,
      warnings: diagnostics.warnings,
      failed: diagnostics.failed,
      communicationsActivated: false,
      routingActivated: false,
      triggersInstalled: false,
      productionChanged: false,
      completedAt: new Date().toISOString()
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function MOS5D31_registerRelease(input) {
  MOS5D31_assertCore_();
  MOS5D31_ensureSheets_();

  const now = new Date();
  const recordId = 'REL-' + Utilities.formatDate(
    now,
    Session.getScriptTimeZone() || 'America/Chicago',
    'yyyyMMdd-HHmmss'
  ) + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();

  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D31_CONFIG.registrySheet)
    .appendRow([
      now,
      recordId,
      input.release || '',
      input.version || '',
      input.environment || '',
      input.targetCode || '',
      input.targetWorkbookId || '',
      input.targetScriptId || '',
      input.installerVersion || '',
      input.packageHash || '',
      input.status || '',
      input.validationStatus || '',
      input.rollbackReference || '',
      input.brokerApprovalStatus || '',
      Session.getEffectiveUser().getEmail() || 'UNAVAILABLE',
      input.notes || ''
    ]);

  MOS5D31_audit_('RELEASE_REGISTERED', recordId, JSON.stringify(input));
  return { recordId: recordId };
}

function MOS5D31_runDiagnostics() {
  MOS5D31_assertCore_();
  MOS5D31_ensureSheets_();

  const tests = [];
  MOS5D31_addTest_(tests, 'CORE_WORKBOOK', function() {
    return SpreadsheetApp.getActiveSpreadsheet().getId() === MOS5D31_CONFIG.coreWorkbookId
      ? {status: 'PASS', details: 'Correct Core workbook.'}
      : {status: 'FAIL', details: 'Wrong workbook.'};
  });

  MOS5D31_addTest_(tests, 'CORE_SCRIPT', function() {
    return ScriptApp.getScriptId() === MOS5D31_CONFIG.coreScriptId
      ? {status: 'PASS', details: 'Correct Core Apps Script project.'}
      : {status: 'FAIL', details: 'Wrong Apps Script project.'};
  });

  MOS5D31_addTest_(tests, 'REGISTRY_SHEET', function() {
    return MOS5D31_testSheet_(MOS5D31_CONFIG.registrySheet, 16);
  });

  MOS5D31_addTest_(tests, 'TARGETS_SHEET', function() {
    return MOS5D31_testSheet_(MOS5D31_CONFIG.targetsSheet, 8);
  });

  MOS5D31_addTest_(tests, 'AUDIT_SHEET', function() {
    return MOS5D31_testSheet_(MOS5D31_CONFIG.auditSheet, 6);
  });

  MOS5D31_addTest_(tests, 'CORE_TARGET_LOCK', MOS5D31_testCoreTargetLock_);
  MOS5D31_addTest_(tests, 'COMMUNICATIONS_CLOSED', MOS5D31_testCommunicationsClosed_);
  MOS5D31_addTest_(tests, 'ROUTING_CLOSED', MOS5D31_testRoutingClosed_);

  const counts = tests.reduce(function(acc, t) {
    if (t.status === 'PASS') acc.passed++;
    if (t.status === 'WARNING') acc.warnings++;
    if (t.status === 'FAIL') acc.failed++;
    return acc;
  }, {passed: 0, warnings: 0, failed: 0});

  const overallStatus = counts.failed ? 'FAIL' : (counts.warnings ? 'WARNING' : 'PASS');

  const result = {
    release: MOS5D31_CONFIG.release,
    version: MOS5D31_VERSION,
    overallStatus: overallStatus,
    passed: counts.passed,
    warnings: counts.warnings,
    failed: counts.failed,
    tests: tests,
    completedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function MOS5D31_getReleaseRegistry(limit) {
  MOS5D31_assertCore_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MOS5D31_CONFIG.registrySheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getDisplayValues();
  return rows.slice(-Math.max(1, Number(limit || 20))).reverse();
}

function MOS5D31_getDeploymentTargets() {
  MOS5D31_assertCore_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MOS5D31_CONFIG.targetsSheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getDisplayValues();
}

function MOS5D31_assertCore_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('This script must be bound to MelroseOS Core.');
  if (ss.getId() !== MOS5D31_CONFIG.coreWorkbookId) {
    throw new Error('Wrong workbook. Expected ' + MOS5D31_CONFIG.coreWorkbookId + '; found ' + ss.getId() + '.');
  }
}

function MOS5D31_ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let registry = ss.getSheetByName(MOS5D31_CONFIG.registrySheet);
  if (!registry) registry = ss.insertSheet(MOS5D31_CONFIG.registrySheet);
  if (registry.getLastRow() === 0) {
    registry.getRange(1, 1, 1, 16).setValues([[
      'DeployedAt','RecordID','Release','Version','Environment',
      'TargetCode','TargetWorkbookID','TargetScriptID','InstallerVersion',
      'PackageHash','Status','ValidationStatus','RollbackReference',
      'BrokerApprovalStatus','Actor','Notes'
    ]]);
    registry.setFrozenRows(1);
  }

  let targets = ss.getSheetByName(MOS5D31_CONFIG.targetsSheet);
  if (!targets) targets = ss.insertSheet(MOS5D31_CONFIG.targetsSheet);
  if (targets.getLastRow() === 0) {
    targets.getRange(1, 1, 1, 8).setValues([[
      'TargetCode','TargetName','WorkbookID','ScriptID',
      'Environment','Locked','Active','UpdatedAt'
    ]]);
    targets.setFrozenRows(1);
  }

  let audit = ss.getSheetByName(MOS5D31_CONFIG.auditSheet);
  if (!audit) audit = ss.insertSheet(MOS5D31_CONFIG.auditSheet);
  if (audit.getLastRow() === 0) {
    audit.getRange(1, 1, 1, 6).setValues([[
      'OccurredAt','AuditID','EventType','ReferenceID','Actor','Details'
    ]]);
    audit.setFrozenRows(1);
  }
}

function MOS5D31_seedTargets_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MOS5D31_CONFIG.targetsSheet);
  const existingCodes = {};

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getDisplayValues()
      .forEach(function(row) { existingCodes[String(row[0]).toUpperCase()] = true; });
  }

  const rows = [
    ['CORE','MelroseOS Core','1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',MOS5D31_CONFIG.coreScriptId,'DEV',true,true,new Date()],
    ['CRM','MelroseOS CRM','1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8','','DEV',false,true,new Date()],
    ['MARKETING','MelroseOS Marketing','1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo','','DEV',false,true,new Date()],
    ['WEBSITE','MelroseOS Website','1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc','','DEV',false,true,new Date()],
    ['ANALYTICS','MelroseOS Analytics','1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU','','DEV',false,true,new Date()],
    ['ARCHIVE','MelroseOS Archive','1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk','','DEV',false,true,new Date()]
  ].filter(function(row) {
    return !existingCodes[String(row[0]).toUpperCase()];
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  }
}

function MOS5D31_testSheet_(name, minColumns) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) return {status: 'FAIL', details: name + ' is missing.'};
  if (sheet.getLastColumn() < minColumns) {
    return {status: 'FAIL', details: name + ' has fewer than ' + minColumns + ' columns.'};
  }
  return {status: 'PASS', details: name + ' is present.'};
}

function MOS5D31_testCoreTargetLock_() {
  const rows = MOS5D31_getDeploymentTargets();
  const core = rows.find(function(row) { return String(row[0]).toUpperCase() === 'CORE'; });
  if (!core) return {status: 'FAIL', details: 'CORE target missing.'};

  const locked = String(core[5]).toUpperCase() === 'TRUE';
  const scriptMatch = String(core[3]) === MOS5D31_CONFIG.coreScriptId;

  return locked && scriptMatch
    ? {status: 'PASS', details: 'CORE target is locked to the verified Script ID.'}
    : {status: 'FAIL', details: 'CORE target lock is invalid.'};
}

function MOS5D31_testCommunicationsClosed_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  const keys = ['COMMUNICATIONS_ENABLED','EMAIL_ENABLED','LIVE_EMAIL_ENABLED','CAMPAIGNS_ENABLED','OUTBOUND_ENABLED','PRODUCTION_EMAIL_ENABLED'];
  const enabled = keys.filter(function(k) { return MOS5D31_isAffirmative_(p[k]); });

  return enabled.length
    ? {status: 'FAIL', details: 'Enabled: ' + enabled.join(', ')}
    : {status: 'PASS', details: 'Communications remain fail-closed.'};
}

function MOS5D31_testRoutingClosed_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  const keys = ['LIVE_ROUTING_ENABLED','ROUTING_ENABLED','ROUND_ROBIN_ENABLED','LEAD_INTAKE_ENABLED'];
  const enabled = keys.filter(function(k) { return MOS5D31_isAffirmative_(p[k]); });

  return enabled.length
    ? {status: 'WARNING', details: 'Found affirmative settings: ' + enabled.join(', ')}
    : {status: 'PASS', details: 'No affirmative routing/intake property found.'};
}

function MOS5D31_addTest_(tests, code, fn) {
  try {
    const result = fn();
    tests.push({code: code, status: result.status || 'FAIL', details: result.details || ''});
  } catch (error) {
    tests.push({
      code: code,
      status: 'FAIL',
      details: String(error && error.message ? error.message : error)
    });
  }
}

function MOS5D31_audit_(eventType, referenceId, details) {
  MOS5D31_ensureSheets_();
  const now = new Date();
  const auditId = 'AUD-' + Utilities.formatDate(
    now,
    Session.getScriptTimeZone() || 'America/Chicago',
    'yyyyMMdd-HHmmss'
  ) + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();

  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D31_CONFIG.auditSheet)
    .appendRow([
      now,
      auditId,
      eventType,
      referenceId || '',
      Session.getEffectiveUser().getEmail() || 'UNAVAILABLE',
      details || ''
    ]);
}

function MOS5D31_isAffirmative_(value) {
  return ['TRUE','YES','ON','ENABLED','ACTIVE','LIVE','1']
    .indexOf(String(value || '').trim().toUpperCase()) !== -1;
}
