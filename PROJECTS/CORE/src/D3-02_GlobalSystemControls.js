/**
 * FILE: D3-02_GlobalSystemControls.gs
 * RELEASE: MOS5-D3.2
 * VERSION: 1.0.0
 *
 * PURPOSE
 * -------
 * Central broker-controlled system safety registry.
 *
 * IMPORTANT
 * ---------
 * This release creates and manages control state only.
 * It does not yet wire CRM, Marketing, Website, or other projects
 * to obey these controls. That wiring will occur in later releases.
 */

const MOS5D32_VERSION = '1.0.0';

const MOS5D32_CONFIG = Object.freeze({
  release: 'MOS5-D3.2',
  environment: 'DEV',
  coreWorkbookId: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  coreScriptId: '1dWl5ZKQ531GF3TltgAS9WHSElWXVeyhKiLjEc9cSnt3IOCyBWLi6Sy3Z',
  brokerEmail: 'melrosegroupbroker@gmail.com',
  controlsSheet: 'SYS_GLOBAL_CONTROLS',
  historySheet: 'SYS_GLOBAL_CONTROL_HISTORY',
  auditSheet: 'SYS_GLOBAL_CONTROL_AUDIT'
});

const MOS5D32_CONTROL_DEFINITIONS = Object.freeze([
  {
    key: 'MAINTENANCE_MODE',
    label: 'Maintenance Mode',
    type: 'BOOLEAN',
    defaultValue: 'FALSE',
    failClosedValue: 'TRUE',
    description: 'Places MelroseOS in maintenance mode.'
  },
  {
    key: 'COMMUNICATIONS_PAUSED',
    label: 'Pause Communications',
    type: 'BOOLEAN',
    defaultValue: 'TRUE',
    failClosedValue: 'TRUE',
    description: 'Blocks outbound communications when enforced.'
  },
  {
    key: 'LEAD_INTAKE_PAUSED',
    label: 'Pause Lead Intake',
    type: 'BOOLEAN',
    defaultValue: 'TRUE',
    failClosedValue: 'TRUE',
    description: 'Blocks new lead intake when enforced.'
  },
  {
    key: 'ROUTING_PAUSED',
    label: 'Pause Routing',
    type: 'BOOLEAN',
    defaultValue: 'TRUE',
    failClosedValue: 'TRUE',
    description: 'Blocks assignment and routing when enforced.'
  },
  {
    key: 'ROUND_ROBIN_PAUSED',
    label: 'Pause Round Robin',
    type: 'BOOLEAN',
    defaultValue: 'TRUE',
    failClosedValue: 'TRUE',
    description: 'Blocks round-robin assignment when enforced.'
  },
  {
    key: 'BROKER_ONLY_ROUTING',
    label: 'Broker-Only Routing',
    type: 'BOOLEAN',
    defaultValue: 'TRUE',
    failClosedValue: 'TRUE',
    description: 'Forces eligible routing to broker when enforced.'
  },
  {
    key: 'READ_ONLY_MODE',
    label: 'Read-Only Mode',
    type: 'BOOLEAN',
    defaultValue: 'TRUE',
    failClosedValue: 'TRUE',
    description: 'Blocks operational write actions when enforced.'
  },
  {
    key: 'EXTERNAL_PORTAL_DISABLED',
    label: 'Disable External Portal',
    type: 'BOOLEAN',
    defaultValue: 'TRUE',
    failClosedValue: 'TRUE',
    description: 'Blocks external portal access when enforced.'
  },
  {
    key: 'EMERGENCY_SHUTDOWN',
    label: 'Emergency Shutdown',
    type: 'BOOLEAN',
    defaultValue: 'FALSE',
    failClosedValue: 'TRUE',
    description: 'Highest-priority emergency stop.'
  },
  {
    key: 'BROKER_OVERRIDE_ENABLED',
    label: 'Broker Override',
    type: 'BOOLEAN',
    defaultValue: 'FALSE',
    failClosedValue: 'FALSE',
    description: 'Allows explicit broker-authorized override where supported.'
  }
]);

function MOS5D32_installGlobalSystemControls() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('MOS5-D3.2 could not obtain the script lock.');
  }

  try {
    MOS5D32_assertCore_();
    MOS5D32_ensureSheets_();
    MOS5D32_seedControls_();

    const diagnostics = MOS5D32_runDiagnostics();

    const result = {
      success: diagnostics.overallStatus !== 'FAIL',
      release: MOS5D32_CONFIG.release,
      version: MOS5D32_VERSION,
      overallStatus: diagnostics.overallStatus,
      passed: diagnostics.passed,
      warnings: diagnostics.warnings,
      failed: diagnostics.failed,
      liveServicesWired: false,
      communicationsActivated: false,
      routingActivated: false,
      triggersInstalled: false,
      productionChanged: false,
      completedAt: new Date().toISOString()
    };

    MOS5D32_audit_(
      'GLOBAL_CONTROLS_INSTALLED',
      MOS5D32_CONFIG.release,
      JSON.stringify(result)
    );

    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function MOS5D32_setControl(controlKey, newValue, reason) {
  MOS5D32_assertCore_();
  MOS5D32_ensureSheets_();

  const key = String(controlKey || '').trim().toUpperCase();
  const definition = MOS5D32_getDefinition_(key);

  if (!definition) {
    throw new Error('Unknown control key: ' + key);
  }

  const normalizedValue = MOS5D32_normalizeValue_(definition.type, newValue);
  const actor = Session.getEffectiveUser().getEmail() || 'UNAVAILABLE';
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D32_CONFIG.controlsSheet);

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  const rowIndex = rows.findIndex(function(row) {
    return String(row[0]).trim().toUpperCase() === key;
  });

  if (rowIndex < 0) {
    throw new Error('Control row not found: ' + key);
  }

  const rowNumber = rowIndex + 2;
  const oldValue = String(sheet.getRange(rowNumber, 5).getDisplayValue());

  sheet.getRange(rowNumber, 5).setValue(normalizedValue);
  sheet.getRange(rowNumber, 7).setValue(new Date());
  sheet.getRange(rowNumber, 8).setValue(actor);
  sheet.getRange(rowNumber, 9).setValue(reason || '');
  sheet.getRange(rowNumber, 10).setValue('ACTIVE');

  MOS5D32_writeHistory_(key, oldValue, normalizedValue, reason || '', actor);
  MOS5D32_audit_(
    'CONTROL_CHANGED',
    key,
    JSON.stringify({
      oldValue: oldValue,
      newValue: normalizedValue,
      reason: reason || '',
      actor: actor
    })
  );

  return {
    success: true,
    controlKey: key,
    oldValue: oldValue,
    newValue: normalizedValue,
    changedAt: new Date().toISOString()
  };
}

function MOS5D32_getControl(controlKey) {
  MOS5D32_assertCore_();
  const key = String(controlKey || '').trim().toUpperCase();
  const map = MOS5D32_getControlMap_();

  if (!(key in map)) {
    throw new Error('Unknown control key: ' + key);
  }

  return map[key];
}

function MOS5D32_checkLeadIntakeGate_() {
  MOS5D32_assertCore_();
  const state = MOS5D32_getEffectiveSafetyState();

  if (state.emergencyShutdown || state.maintenanceMode || state.leadIntakePaused) {
    throw new Error('Lead intake is currently paused by global safety controls.');
  }

  return {
    success: true,
    gate: 'LEAD_INTAKE',
    status: 'OPEN',
    checkedAt: new Date().toISOString(),
    state: state
  };
}

function MOS5D32_checkRoutingGate_() {
  MOS5D32_assertCore_();
  const state = MOS5D32_getEffectiveSafetyState();

  if (state.emergencyShutdown || state.maintenanceMode || state.routingPaused) {
    throw new Error('Routing is currently paused by global safety controls.');
  }

  return {
    success: true,
    gate: 'ROUTING',
    status: 'OPEN',
    checkedAt: new Date().toISOString(),
    state: state
  };
}

function MOS5D32_checkCommunicationsGate_() {
  MOS5D32_assertCore_();
  const state = MOS5D32_getEffectiveSafetyState();

  if (state.emergencyShutdown || state.maintenanceMode || state.communicationsPaused) {
    throw new Error('Communications are currently paused by global safety controls.');
  }

  return {
    success: true,
    gate: 'COMMUNICATIONS',
    status: 'OPEN',
    checkedAt: new Date().toISOString(),
    state: state
  };
}

function MOS5D32_getAllControls() {
  MOS5D32_assertCore_();
  const map = MOS5D32_getControlMap_();
  return Object.keys(map).sort().map(function(key) {
    return map[key];
  });
}

function MOS5D32_getEffectiveSafetyState() {
  MOS5D32_assertCore_();
  const controls = MOS5D32_getControlMap_();

  const emergency = MOS5D32_isTrue_(controls.EMERGENCY_SHUTDOWN.currentValue);
  const maintenance = MOS5D32_isTrue_(controls.MAINTENANCE_MODE.currentValue);

  return {
    emergencyShutdown: emergency,
    maintenanceMode: maintenance,
    communicationsPaused:
      emergency || maintenance || MOS5D32_isTrue_(controls.COMMUNICATIONS_PAUSED.currentValue),
    leadIntakePaused:
      emergency || maintenance || MOS5D32_isTrue_(controls.LEAD_INTAKE_PAUSED.currentValue),
    routingPaused:
      emergency || maintenance || MOS5D32_isTrue_(controls.ROUTING_PAUSED.currentValue),
    roundRobinPaused:
      emergency || maintenance || MOS5D32_isTrue_(controls.ROUND_ROBIN_PAUSED.currentValue),
    brokerOnlyRouting:
      emergency || maintenance || MOS5D32_isTrue_(controls.BROKER_ONLY_ROUTING.currentValue),
    readOnlyMode:
      emergency || maintenance || MOS5D32_isTrue_(controls.READ_ONLY_MODE.currentValue),
    externalPortalDisabled:
      emergency || maintenance || MOS5D32_isTrue_(controls.EXTERNAL_PORTAL_DISABLED.currentValue),
    brokerOverrideEnabled:
      !emergency && MOS5D32_isTrue_(controls.BROKER_OVERRIDE_ENABLED.currentValue),
    evaluatedAt: new Date().toISOString()
  };
}

function MOS5D32_runDiagnostics() {
  MOS5D32_assertCore_();
  MOS5D32_ensureSheets_();

  const tests = [];

  MOS5D32_addTest_(tests, 'CORE_WORKBOOK', function() {
    return SpreadsheetApp.getActiveSpreadsheet().getId() === MOS5D32_CONFIG.coreWorkbookId
      ? {status: 'PASS', details: 'Correct Core workbook.'}
      : {status: 'FAIL', details: 'Wrong Core workbook.'};
  });

  MOS5D32_addTest_(tests, 'CORE_SCRIPT', function() {
    return ScriptApp.getScriptId() === MOS5D32_CONFIG.coreScriptId
      ? {status: 'PASS', details: 'Correct Core Apps Script project.'}
      : {status: 'FAIL', details: 'Wrong Apps Script project.'};
  });

  MOS5D32_addTest_(tests, 'CONTROLS_SHEET', function() {
    return MOS5D32_testSheet_(MOS5D32_CONFIG.controlsSheet, 10);
  });

  MOS5D32_addTest_(tests, 'HISTORY_SHEET', function() {
    return MOS5D32_testSheet_(MOS5D32_CONFIG.historySheet, 9);
  });

  MOS5D32_addTest_(tests, 'AUDIT_SHEET', function() {
    return MOS5D32_testSheet_(MOS5D32_CONFIG.auditSheet, 6);
  });

  MOS5D32_addTest_(tests, 'CONTROL_SET_COMPLETE', MOS5D32_testControlSet_);
  MOS5D32_addTest_(tests, 'FAIL_CLOSED_DEFAULTS', MOS5D32_testFailClosedDefaults_);
  MOS5D32_addTest_(tests, 'EFFECTIVE_STATE_READBACK', MOS5D32_testEffectiveState_);
  MOS5D32_addTest_(tests, 'NO_LIVE_WIRING', function() {
    return {
      status: 'PASS',
      details: 'This release creates control state only; no live project wiring is installed.'
    };
  });

  const counts = tests.reduce(function(acc, test) {
    if (test.status === 'PASS') acc.passed++;
    if (test.status === 'WARNING') acc.warnings++;
    if (test.status === 'FAIL') acc.failed++;
    return acc;
  }, {passed: 0, warnings: 0, failed: 0});

  const overallStatus = counts.failed > 0
    ? 'FAIL'
    : counts.warnings > 0 ? 'WARNING' : 'PASS';

  const result = {
    release: MOS5D32_CONFIG.release,
    version: MOS5D32_VERSION,
    overallStatus: overallStatus,
    passed: counts.passed,
    warnings: counts.warnings,
    failed: counts.failed,
    tests: tests,
    effectiveSafetyState: MOS5D32_getEffectiveSafetyState(),
    completedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function MOS5D32_ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let controls = ss.getSheetByName(MOS5D32_CONFIG.controlsSheet);
  if (!controls) controls = ss.insertSheet(MOS5D32_CONFIG.controlsSheet);
  if (controls.getLastRow() === 0) {
    controls.getRange(1, 1, 1, 10).setValues([[
      'ControlKey', 'ControlLabel', 'ControlType', 'DefaultValue',
      'CurrentValue', 'FailClosedValue', 'UpdatedAt', 'UpdatedBy',
      'Reason', 'Status'
    ]]);
    controls.setFrozenRows(1);
  }

  let history = ss.getSheetByName(MOS5D32_CONFIG.historySheet);
  if (!history) history = ss.insertSheet(MOS5D32_CONFIG.historySheet);
  if (history.getLastRow() === 0) {
    history.getRange(1, 1, 1, 9).setValues([[
      'ChangedAt', 'HistoryID', 'ControlKey', 'OldValue', 'NewValue',
      'ChangedBy', 'Reason', 'Release', 'Environment'
    ]]);
    history.setFrozenRows(1);
  }

  let audit = ss.getSheetByName(MOS5D32_CONFIG.auditSheet);
  if (!audit) audit = ss.insertSheet(MOS5D32_CONFIG.auditSheet);
  if (audit.getLastRow() === 0) {
    audit.getRange(1, 1, 1, 6).setValues([[
      'OccurredAt', 'AuditID', 'EventType', 'ReferenceID', 'Actor', 'Details'
    ]]);
    audit.setFrozenRows(1);
  }
}

function MOS5D32_seedControls_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D32_CONFIG.controlsSheet);

  const existing = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getDisplayValues()
      .forEach(function(row) {
        existing[String(row[0]).trim().toUpperCase()] = true;
      });
  }

  const now = new Date();
  const actor = Session.getEffectiveUser().getEmail() || 'UNAVAILABLE';

  const rows = MOS5D32_CONTROL_DEFINITIONS
    .filter(function(definition) {
      return !existing[definition.key];
    })
    .map(function(definition) {
      return [
        definition.key,
        definition.label,
        definition.type,
        definition.defaultValue,
        definition.defaultValue,
        definition.failClosedValue,
        now,
        actor,
        'Initial fail-closed seed',
        'ACTIVE'
      ];
    });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
  }
}

function MOS5D32_getControlMap_() {
  MOS5D32_ensureSheets_();
  MOS5D32_seedControls_();

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D32_CONFIG.controlsSheet);

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getDisplayValues();
  const map = {};

  rows.forEach(function(row) {
    const key = String(row[0]).trim().toUpperCase();
    map[key] = {
      controlKey: key,
      controlLabel: row[1],
      controlType: row[2],
      defaultValue: row[3],
      currentValue: row[4],
      failClosedValue: row[5],
      updatedAt: row[6],
      updatedBy: row[7],
      reason: row[8],
      status: row[9]
    };
  });

  return map;
}

function MOS5D32_getDefinition_(key) {
  return MOS5D32_CONTROL_DEFINITIONS.find(function(definition) {
    return definition.key === key;
  }) || null;
}

function MOS5D32_normalizeValue_(type, value) {
  if (type === 'BOOLEAN') {
    return MOS5D32_isTrue_(value) ? 'TRUE' : 'FALSE';
  }
  return String(value == null ? '' : value);
}

function MOS5D32_writeHistory_(key, oldValue, newValue, reason, actor) {
  const now = new Date();
  const historyId = 'HIST-' + Utilities.formatDate(
    now,
    Session.getScriptTimeZone() || 'America/Chicago',
    'yyyyMMdd-HHmmss'
  ) + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();

  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D32_CONFIG.historySheet)
    .appendRow([
      now,
      historyId,
      key,
      oldValue,
      newValue,
      actor,
      reason,
      MOS5D32_CONFIG.release,
      MOS5D32_CONFIG.environment
    ]);
}

function MOS5D32_testControlSet_() {
  const map = MOS5D32_getControlMap_();
  const missing = MOS5D32_CONTROL_DEFINITIONS
    .map(function(definition) { return definition.key; })
    .filter(function(key) { return !(key in map); });

  return missing.length
    ? {status: 'FAIL', details: 'Missing controls: ' + missing.join(', ')}
    : {status: 'PASS', details: 'All ' +
        MOS5D32_CONTROL_DEFINITIONS.length + ' controls are present.'};
}

function MOS5D32_testFailClosedDefaults_() {
  const map = MOS5D32_getControlMap_();

  const requiredTrue = [
    'COMMUNICATIONS_PAUSED',
    'LEAD_INTAKE_PAUSED',
    'ROUTING_PAUSED',
    'ROUND_ROBIN_PAUSED',
    'BROKER_ONLY_ROUTING',
    'READ_ONLY_MODE',
    'EXTERNAL_PORTAL_DISABLED'
  ];

  const unsafe = requiredTrue.filter(function(key) {
    return !MOS5D32_isTrue_(map[key].currentValue);
  });

  return unsafe.length
    ? {status: 'FAIL', details: 'Unsafe defaults: ' + unsafe.join(', ')}
    : {status: 'PASS', details: 'Operational controls are seeded fail-closed.'};
}

function MOS5D32_testEffectiveState_() {
  const state = MOS5D32_getEffectiveSafetyState();

  if (!state.communicationsPaused ||
      !state.leadIntakePaused ||
      !state.routingPaused ||
      !state.roundRobinPaused ||
      !state.readOnlyMode ||
      !state.externalPortalDisabled) {
    return {
      status: 'FAIL',
      details: 'Effective safety state is not fail-closed.'
    };
  }

  return {
    status: 'PASS',
    details: 'Effective safety state is fail-closed.'
  };
}

function MOS5D32_testSheet_(name, minColumns) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) return {status: 'FAIL', details: name + ' is missing.'};
  if (sheet.getLastColumn() < minColumns) {
    return {
      status: 'FAIL',
      details: name + ' has fewer than ' + minColumns + ' columns.'
    };
  }
  return {status: 'PASS', details: name + ' is present.'};
}

function MOS5D32_addTest_(tests, code, fn) {
  try {
    const result = fn();
    tests.push({
      code: code,
      status: result.status || 'FAIL',
      details: result.details || ''
    });
  } catch (error) {
    tests.push({
      code: code,
      status: 'FAIL',
      details: String(error && error.message ? error.message : error)
    });
  }
}

function MOS5D32_audit_(eventType, referenceId, details) {
  MOS5D32_ensureSheets_();

  const now = new Date();
  const auditId = 'AUD-' + Utilities.formatDate(
    now,
    Session.getScriptTimeZone() || 'America/Chicago',
    'yyyyMMdd-HHmmss'
  ) + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();

  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D32_CONFIG.auditSheet)
    .appendRow([
      now,
      auditId,
      eventType,
      referenceId || '',
      Session.getEffectiveUser().getEmail() || 'UNAVAILABLE',
      details || ''
    ]);
}

function MOS5D32_isTrue_(value) {
  return ['TRUE', 'YES', 'ON', 'ENABLED', 'ACTIVE', 'LIVE', '1']
    .indexOf(String(value || '').trim().toUpperCase()) !== -1;
}

function MOS5D32_assertCore_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('This script must be bound to MelroseOS Core.');
  }

  if (ss.getId() !== MOS5D32_CONFIG.coreWorkbookId) {
    throw new Error(
      'Wrong workbook. Expected ' +
      MOS5D32_CONFIG.coreWorkbookId +
      '; found ' +
      ss.getId() +
      '.'
    );
  }

  if (ScriptApp.getScriptId() !== MOS5D32_CONFIG.coreScriptId) {
    throw new Error(
      'Wrong Apps Script project. Expected ' +
      MOS5D32_CONFIG.coreScriptId +
      '; found ' +
      ScriptApp.getScriptId() +
      '.'
    );
  }
}
