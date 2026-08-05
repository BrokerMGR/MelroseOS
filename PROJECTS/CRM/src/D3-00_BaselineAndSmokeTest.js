/**
 * FILE: D3-00_BaselineAndSmokeTest.gs
 * RELEASE: MOS5-D3.0
 * VERSION: 1.0.0
 *
 * SAFE/READ-ONLY BEHAVIOR
 * - Does not send email.
 * - Does not route leads.
 * - Does not install triggers.
 * - Does not modify CRM records.
 * - Does not alter deployments.
 * - Writes only to SYS_BASELINE and SYS_SMOKE_TESTS in MelroseOS Core.
 */

const MOS5D3_BASELINE_VERSION = '1.0.0';

const MOS5D3_CONFIG = Object.freeze({
  release: 'MOS5-D3.0',
  environment: 'DEV',

  coreWorkbookId: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  crmWorkbookId: '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
  marketingWorkbookId: '1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo',
  websiteWorkbookId: '1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc',
  analyticsWorkbookId: '1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU',
  archiveWorkbookId: '1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk',

  brokerEmail: 'melrosegroupbroker@gmail.com',

  baselineSheet: 'SYS_BASELINE',
  smokeSheet: 'SYS_SMOKE_TESTS',

  crmLeadSheet: 'CRM_LEADS',
  crmAgentSheet: 'CRM_AGENTS',
  crmLockSheet: 'CRM_LEAD_LOCKS',

  requiredLeadHeaders: [
    'LeadID', 'Status', 'LifecycleStage',
    'ContactStatus', 'AssignedAgentID'
  ],

  requiredAgentHeaders: [
    'AgentID', 'Name', 'Email', 'Active', 'AcceptingLeads',
    'Parishes', 'LeadTypes', 'DailyCap',
    'CurrentDailyCount', 'LastAssignedAt'
  ],

  requiredLockHeaders: ['LeadID', 'AgentID']
});

function MOS5D3_installBaselineAndRunSmokeTest() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('MOS5-D3.0 could not obtain the script lock.');
  }

  try {
    MOS5D3_assertCoreProject_();
    MOS5D3_ensureSystemSheets_();

    const baseline = MOS5D3_captureBaseline();
    const smoke = MOS5D3_runSmokeTest();

    const result = {
      success: smoke.overallStatus !== 'FAIL',
      release: MOS5D3_CONFIG.release,
      version: MOS5D3_BASELINE_VERSION,
      environment: MOS5D3_CONFIG.environment,
      baselineId: baseline.baselineId,
      overallStatus: smoke.overallStatus,
      passed: smoke.passed,
      warnings: smoke.warnings,
      failed: smoke.failed,
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

function MOS5D3_captureBaseline() {
  MOS5D3_assertCoreProject_();
  MOS5D3_ensureSystemSheets_();

  const now = new Date();
  const baselineId = 'BASE-' + Utilities.formatDate(
    now,
    Session.getScriptTimeZone() || 'America/Chicago',
    'yyyyMMdd-HHmmss'
  );

  const triggers = ScriptApp.getProjectTriggers().map(function(trigger) {
    return {
      handlerFunction: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      triggerSource: String(trigger.getTriggerSource()),
      uniqueId: trigger.getUniqueId()
    };
  });

  const workbookResults = MOS5D3_inspectWorkbooks_();

  const payload = {
    baselineId: baselineId,
    release: MOS5D3_CONFIG.release,
    version: MOS5D3_BASELINE_VERSION,
    environment: MOS5D3_CONFIG.environment,
    capturedAt: now.toISOString(),
    timezone: Session.getScriptTimeZone(),
    effectiveUser: Session.getEffectiveUser().getEmail() || 'UNAVAILABLE',
    activeUser: Session.getActiveUser().getEmail() || 'UNAVAILABLE',
    scriptId: ScriptApp.getScriptId(),
    serviceUrl: MOS5D3_getServiceUrl_(),
    activeWorkbookId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    activeWorkbookName: SpreadsheetApp.getActiveSpreadsheet().getName(),
    scriptProperties: MOS5D3_redactObject_(
      PropertiesService.getScriptProperties().getProperties()
    ),
    userProperties: MOS5D3_redactObject_(
      PropertiesService.getUserProperties().getProperties()
    ),
    documentProperties: MOS5D3_redactObject_(
      PropertiesService.getDocumentProperties().getProperties()
    ),
    triggers: triggers,
    workbooks: workbookResults
  };

  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D3_CONFIG.baselineSheet)
    .appendRow([
      now, baselineId, MOS5D3_CONFIG.release, MOS5D3_BASELINE_VERSION,
      MOS5D3_CONFIG.environment, payload.effectiveUser, payload.scriptId,
      payload.serviceUrl, triggers.length, JSON.stringify(workbookResults),
      JSON.stringify(payload)
    ]);

  return payload;
}

function MOS5D3_runSmokeTest() {
  MOS5D3_assertCoreProject_();
  MOS5D3_ensureSystemSheets_();

  const runId = 'SMOKE-' + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || 'America/Chicago',
    'yyyyMMdd-HHmmss'
  );

  const tests = [];

  MOS5D3_addTest_(tests, 'CORE_PROJECT_ALIGNMENT',
    'Core project is attached to the correct workbook',
    MOS5D3_testCoreAlignment_);

  MOS5D3_addTest_(tests, 'ENTERPRISE_WORKBOOK_ACCESS',
    'All six MelroseOS workbooks are accessible',
    MOS5D3_testWorkbookAccess_);

  MOS5D3_addTest_(tests, 'CRM_REQUIRED_SHEETS',
    'Critical CRM sheets exist',
    MOS5D3_testCrmSheets_);

  MOS5D3_addTest_(tests, 'CRM_LEADS_SCHEMA',
    'CRM_LEADS contains its critical fields',
    MOS5D3_testLeadSchema_);

  MOS5D3_addTest_(tests, 'CRM_AGENTS_SCHEMA',
    'CRM_AGENTS contains its critical fields',
    MOS5D3_testAgentSchema_);

  MOS5D3_addTest_(tests, 'CRM_LEAD_LOCKS_SCHEMA',
    'CRM_LEAD_LOCKS contains its critical fields',
    MOS5D3_testLockSchema_);

  MOS5D3_addTest_(tests, 'BROKER_AGENT_RECORD',
    'Broker agent record exists',
    MOS5D3_testBrokerAgent_);

  MOS5D3_addTest_(tests, 'TRIGGER_DUPLICATES',
    'No duplicate trigger handlers exist in this project',
    MOS5D3_testDuplicateTriggers_);

  MOS5D3_addTest_(tests, 'COMMUNICATIONS_FAIL_CLOSED',
    'Communications are not affirmatively enabled',
    MOS5D3_testCommunicationsClosed_);

  MOS5D3_addTest_(tests, 'ROUTING_FAIL_CLOSED',
    'Live routing is not affirmatively enabled from Core',
    MOS5D3_testRoutingClosed_);

  MOS5D3_addTest_(tests, 'DASHBOARD_SERVICE_STATE',
    'Dashboard service state can be inspected',
    MOS5D3_testDashboardService_);

  const counts = tests.reduce(function(acc, test) {
    if (test.status === 'PASS') acc.passed++;
    if (test.status === 'WARNING') acc.warnings++;
    if (test.status === 'FAIL') acc.failed++;
    return acc;
  }, {passed: 0, warnings: 0, failed: 0});

  const overallStatus = counts.failed > 0
    ? 'FAIL'
    : counts.warnings > 0 ? 'WARNING' : 'PASS';

  MOS5D3_writeSmokeResults_(runId, tests, overallStatus);

  const result = {
    runId: runId,
    release: MOS5D3_CONFIG.release,
    version: MOS5D3_BASELINE_VERSION,
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

function MOS5D3_testCoreAlignment_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  return active.getId() === MOS5D3_CONFIG.coreWorkbookId
    ? {status: 'PASS', details: active.getName() + ' is the expected Core workbook.'}
    : {status: 'FAIL', details: 'Expected Core workbook ' +
        MOS5D3_CONFIG.coreWorkbookId + ' but found ' + active.getId()};
}

function MOS5D3_testWorkbookAccess_() {
  const inspections = MOS5D3_inspectWorkbooks_();
  const failures = inspections.filter(function(item) { return !item.accessible; });
  return failures.length
    ? {status: 'FAIL', details: 'Unavailable: ' +
        failures.map(function(item) { return item.key; }).join(', ')}
    : {status: 'PASS', details: 'All six enterprise workbooks are accessible.'};
}

function MOS5D3_testCrmSheets_() {
  const crm = SpreadsheetApp.openById(MOS5D3_CONFIG.crmWorkbookId);
  const required = [
    MOS5D3_CONFIG.crmLeadSheet,
    MOS5D3_CONFIG.crmAgentSheet,
    MOS5D3_CONFIG.crmLockSheet
  ];
  const missing = required.filter(function(name) { return !crm.getSheetByName(name); });
  return missing.length
    ? {status: 'FAIL', details: 'Missing CRM sheets: ' + missing.join(', ')}
    : {status: 'PASS', details: 'All critical CRM sheets exist.'};
}

function MOS5D3_testLeadSchema_() {
  return MOS5D3_testHeaders_(MOS5D3_CONFIG.crmLeadSheet,
    MOS5D3_CONFIG.requiredLeadHeaders);
}

function MOS5D3_testAgentSchema_() {
  return MOS5D3_testHeaders_(MOS5D3_CONFIG.crmAgentSheet,
    MOS5D3_CONFIG.requiredAgentHeaders);
}

function MOS5D3_testLockSchema_() {
  return MOS5D3_testHeaders_(MOS5D3_CONFIG.crmLockSheet,
    MOS5D3_CONFIG.requiredLockHeaders);
}

function MOS5D3_testBrokerAgent_() {
  const crm = SpreadsheetApp.openById(MOS5D3_CONFIG.crmWorkbookId);
  const sheet = crm.getSheetByName(MOS5D3_CONFIG.crmAgentSheet);
  if (!sheet) return {status: 'FAIL', details: 'CRM_AGENTS does not exist.'};

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return {status: 'FAIL', details: 'CRM_AGENTS contains no agent records.'};
  }

  const headers = values[0].map(MOS5D3_normalizeHeader_);
  const emailIndex = headers.indexOf('EMAIL');
  const idIndex = headers.indexOf('AGENTID');

  if (emailIndex === -1) {
    return {status: 'FAIL', details: 'CRM_AGENTS is missing the Email field.'};
  }

  const brokerEmail = MOS5D3_CONFIG.brokerEmail.toLowerCase();
  const brokerRow = values.slice(1).find(function(row) {
    return String(row[emailIndex]).trim().toLowerCase() === brokerEmail;
  });

  if (!brokerRow) {
    return {status: 'FAIL', details: 'No broker record found for ' +
      MOS5D3_CONFIG.brokerEmail};
  }

  return {
    status: 'PASS',
    details: 'Broker record found' +
      (idIndex >= 0 ? ' with AgentID ' + brokerRow[idIndex] : '') + '.'
  };
}

function MOS5D3_testDuplicateTriggers_() {
  const triggers = ScriptApp.getProjectTriggers();
  const counts = {};

  triggers.forEach(function(trigger) {
    const key = trigger.getHandlerFunction() + '|' +
      String(trigger.getEventType()) + '|' + String(trigger.getTriggerSource());
    counts[key] = (counts[key] || 0) + 1;
  });

  const duplicates = Object.keys(counts).filter(function(key) {
    return counts[key] > 1;
  });

  return duplicates.length
    ? {status: 'WARNING', details: 'Possible duplicate triggers: ' +
        duplicates.join(', ')}
    : {status: 'PASS', details: triggers.length +
        ' project trigger(s); no duplicate handlers found.'};
}

function MOS5D3_testCommunicationsClosed_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  const keys = [
    'COMMUNICATIONS_ENABLED', 'EMAIL_ENABLED', 'LIVE_EMAIL_ENABLED',
    'CAMPAIGNS_ENABLED', 'OUTBOUND_ENABLED', 'PRODUCTION_EMAIL_ENABLED'
  ];
  const enabled = keys.filter(function(key) {
    return MOS5D3_isAffirmative_(properties[key]);
  });

  return enabled.length
    ? {status: 'FAIL', details: 'Communications appear enabled through: ' +
        enabled.join(', ')}
    : {status: 'PASS', details:
        'No affirmative communications-enable property was found.'};
}

function MOS5D3_testRoutingClosed_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  const keys = [
    'LIVE_ROUTING_ENABLED', 'ROUTING_ENABLED',
    'ROUND_ROBIN_ENABLED', 'LEAD_INTAKE_ENABLED'
  ];
  const enabled = keys.filter(function(key) {
    return MOS5D3_isAffirmative_(properties[key]);
  });

  return enabled.length
    ? {status: 'WARNING', details:
        'Core contains affirmative routing/intake settings: ' +
        enabled.join(', ') + '. Confirm they do not control live CRM operations.'}
    : {status: 'PASS', details:
        'No affirmative live routing or intake property was found in Core.'};
}

function MOS5D3_testDashboardService_() {
  const url = MOS5D3_getServiceUrl_();
  return url
    ? {status: 'PASS', details: 'Service URL detected: ' + url}
    : {status: 'WARNING', details:
        'No deployed service URL returned. Dashboard may be deployed elsewhere.'};
}

function MOS5D3_assertCoreProject_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('This script must be container-bound to MelroseOS Core.');
  }
  if (active.getId() !== MOS5D3_CONFIG.coreWorkbookId) {
    throw new Error('Wrong workbook. Expected ' +
      MOS5D3_CONFIG.coreWorkbookId + '; found ' + active.getId() + '.');
  }
}

function MOS5D3_ensureSystemSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let baseline = ss.getSheetByName(MOS5D3_CONFIG.baselineSheet);
  if (!baseline) baseline = ss.insertSheet(MOS5D3_CONFIG.baselineSheet);
  if (baseline.getLastRow() === 0) {
    baseline.getRange(1, 1, 1, 11).setValues([[
      'CapturedAt', 'BaselineID', 'Release', 'Version', 'Environment',
      'EffectiveUser', 'ScriptID', 'ServiceURL', 'TriggerCount',
      'WorkbookSummaryJSON', 'FullBaselineJSON'
    ]]);
    baseline.setFrozenRows(1);
  }

  let smoke = ss.getSheetByName(MOS5D3_CONFIG.smokeSheet);
  if (!smoke) smoke = ss.insertSheet(MOS5D3_CONFIG.smokeSheet);
  if (smoke.getLastRow() === 0) {
    smoke.getRange(1, 1, 1, 9).setValues([[
      'RunAt', 'RunID', 'Release', 'Version', 'OverallStatus',
      'TestCode', 'Description', 'Status', 'Details'
    ]]);
    smoke.setFrozenRows(1);
  }
}

function MOS5D3_inspectWorkbooks_() {
  const workbooks = [
    {key: 'CORE', id: MOS5D3_CONFIG.coreWorkbookId},
    {key: 'CRM', id: MOS5D3_CONFIG.crmWorkbookId},
    {key: 'MARKETING', id: MOS5D3_CONFIG.marketingWorkbookId},
    {key: 'WEBSITE', id: MOS5D3_CONFIG.websiteWorkbookId},
    {key: 'ANALYTICS', id: MOS5D3_CONFIG.analyticsWorkbookId},
    {key: 'ARCHIVE', id: MOS5D3_CONFIG.archiveWorkbookId}
  ];

  return workbooks.map(function(item) {
    try {
      const spreadsheet = SpreadsheetApp.openById(item.id);
      return {
        key: item.key,
        id: item.id,
        name: spreadsheet.getName(),
        accessible: true,
        sheetCount: spreadsheet.getSheets().length,
        sheets: spreadsheet.getSheets().map(function(sheet) {
          return sheet.getName();
        })
      };
    } catch (error) {
      return {
        key: item.key,
        id: item.id,
        accessible: false,
        error: String(error && error.message ? error.message : error)
      };
    }
  });
}

function MOS5D3_testHeaders_(sheetName, requiredHeaders) {
  const crm = SpreadsheetApp.openById(MOS5D3_CONFIG.crmWorkbookId);
  const sheet = crm.getSheetByName(sheetName);

  if (!sheet) return {status: 'FAIL', details: sheetName + ' does not exist.'};

  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    return {status: 'FAIL', details: sheetName + ' has no header row.'};
  }

  const actual = sheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0].map(MOS5D3_normalizeHeader_);

  const missing = requiredHeaders.filter(function(header) {
    return actual.indexOf(MOS5D3_normalizeHeader_(header)) === -1;
  });

  return missing.length
    ? {status: 'FAIL', details: sheetName + ' is missing: ' +
        missing.join(', ')}
    : {status: 'PASS', details: sheetName + ' contains all ' +
        requiredHeaders.length + ' critical fields.'};
}

function MOS5D3_addTest_(tests, code, description, testFunction) {
  try {
    const result = testFunction();
    tests.push({
      code: code,
      description: description,
      status: result.status || 'FAIL',
      details: result.details || ''
    });
  } catch (error) {
    tests.push({
      code: code,
      description: description,
      status: 'FAIL',
      details: String(error && error.message ? error.message : error)
    });
  }
}

function MOS5D3_writeSmokeResults_(runId, tests, overallStatus) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D3_CONFIG.smokeSheet);
  const now = new Date();

  const rows = tests.map(function(test) {
    return [
      now, runId, MOS5D3_CONFIG.release, MOS5D3_BASELINE_VERSION,
      overallStatus, test.code, test.description, test.status, test.details
    ];
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
      .setValues(rows);
  }
}

function MOS5D3_getServiceUrl_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (error) {
    return '';
  }
}

function MOS5D3_redactObject_(source) {
  const result = {};
  Object.keys(source || {}).forEach(function(key) {
    result[key] = MOS5D3_isSensitiveKey_(key) ? '[REDACTED]' : source[key];
  });
  return result;
}

function MOS5D3_isSensitiveKey_(key) {
  return /(TOKEN|SECRET|PASSWORD|API.?KEY|PRIVATE.?KEY|CREDENTIAL)/i.test(
    String(key)
  );
}

function MOS5D3_isAffirmative_(value) {
  return ['TRUE', 'YES', 'ON', 'ENABLED', 'ACTIVE', 'LIVE', '1']
    .indexOf(String(value || '').trim().toUpperCase()) !== -1;
}

function MOS5D3_normalizeHeader_(value) {
  return String(value || '').trim()
    .replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
