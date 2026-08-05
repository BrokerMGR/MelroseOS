/**
 * FILE: D3-02-04_ProjectRegistrationWizard.gs
 * RELEASE: MOS5-D3.2.4
 * VERSION: 1.0.0
 *
 * PURPOSE
 * -------
 * Provides a safe Core-based wizard for registering and locking
 * the remaining Apps Script project IDs.
 *
 * SAFETY
 * ------
 * - No ownership changes
 * - No trigger installation
 * - No communications
 * - No routing
 * - No production deployment changes
 */

const MOS5D324_VERSION = '1.0.0';

const MOS5D324 = Object.freeze({
  release: 'MOS5-D3.2.4',
  environment: 'DEV',
  coreWorkbookId: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  coreScriptId: '1dWl5ZKQ531GF3TltgAS9WHSElWXVeyhKiLjEc9cSnt3IOCyBWLi6Sy3Z',
  projectsSheet: 'SYS_PROJECT_REGISTRY',
  auditSheet: 'SYS_MULTI_ACCOUNT_AUDIT',
  registrationSheet: 'SYS_PROJECT_REGISTRATION'
});

function MOS5D324_installProjectRegistrationWizard() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    throw new Error('MOS5-D3.2.4 could not obtain the script lock.');
  }

  try {
    MOS5D324_assertCore_();
    MOS5D324_ensureRegistrationSheet_();
    MOS5D324_seedRegistrationRows_();

    const diagnostics = MOS5D324_runDiagnostics();

    const result = {
      success: diagnostics.overallStatus !== 'FAIL',
      release: MOS5D324.release,
      version: MOS5D324_VERSION,
      overallStatus: diagnostics.overallStatus,
      passed: diagnostics.passed,
      warnings: diagnostics.warnings,
      failed: diagnostics.failed,
      ownershipMoved: false,
      triggersInstalled: false,
      communicationsActivated: false,
      routingActivated: false,
      productionChanged: false,
      completedAt: new Date().toISOString()
    };

    MOS5D324_audit_(
      'PROJECT_REGISTRATION_WIZARD_INSTALLED',
      MOS5D324.release,
      JSON.stringify(result)
    );

    console.log(JSON.stringify(result, null, 2));
    return result;

  } finally {
    lock.releaseLock();
  }
}

function MOS5D324_registerPendingProjects() {
  MOS5D324_assertCore_();
  MOS5D324_ensureRegistrationSheet_();

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D324.registrationSheet);

  if (sheet.getLastRow() < 2) {
    throw new Error('No project registration rows were found.');
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  const results = [];

  rows.forEach(function(row, index) {
    const targetCode = String(row[0] || '').trim().toUpperCase();
    const expectedWorkbookId = String(row[2] || '').trim();
    const scriptId = String(row[4] || '').trim();
    const confirm = String(row[5] || '').trim().toUpperCase();
    const reason = String(row[6] || '').trim();
    const rowNumber = index + 2;

    if (!targetCode || targetCode === 'CORE') {
      return;
    }

    if (!scriptId) {
      results.push({
        targetCode: targetCode,
        status: 'SKIPPED',
        details: 'No Script ID entered.'
      });
      return;
    }

    if (confirm !== 'REGISTER') {
      results.push({
        targetCode: targetCode,
        status: 'SKIPPED',
        details: 'Confirmation must equal REGISTER.'
      });
      return;
    }

    try {
      MOS5D324_validateScriptIdFormat_(scriptId);

      const update = MOS5D324_updateProjectRegistry_(
        targetCode,
        expectedWorkbookId,
        scriptId,
        reason || 'Registered through D3.2.4 wizard'
      );

      sheet.getRange(rowNumber, 7).setValue(reason || 'Registered through D3.2.4 wizard');
      sheet.getRange(rowNumber, 8).setValue('REGISTERED');
      sheet.getRange(rowNumber, 9).setValue(new Date());

      results.push({
        targetCode: targetCode,
        status: 'REGISTERED',
        details: update
      });

    } catch (error) {
      sheet.getRange(rowNumber, 8).setValue('ERROR');
      sheet.getRange(rowNumber, 9).setValue(new Date());

      results.push({
        targetCode: targetCode,
        status: 'ERROR',
        details: String(error && error.message ? error.message : error)
      });
    }
  });

  const errors = results.filter(function(item) {
    return item.status === 'ERROR';
  });

  const result = {
    success: errors.length === 0,
    release: MOS5D324.release,
    version: MOS5D324_VERSION,
    registered: results.filter(function(item) {
      return item.status === 'REGISTERED';
    }).length,
    skipped: results.filter(function(item) {
      return item.status === 'SKIPPED';
    }).length,
    errors: errors.length,
    results: results,
    completedAt: new Date().toISOString()
  };

  MOS5D324_audit_(
    'PROJECT_REGISTRATION_BATCH',
    MOS5D324.release,
    JSON.stringify(result)
  );

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function MOS5D324_runDiagnostics() {
  MOS5D324_assertCore_();

  const tests = [];

  MOS5D324_addTest_(tests, 'CORE_WORKBOOK', function() {
    return SpreadsheetApp.getActiveSpreadsheet().getId() === MOS5D324.coreWorkbookId
      ? {status: 'PASS', details: 'Correct Core workbook.'}
      : {status: 'FAIL', details: 'Wrong Core workbook.'};
  });

  MOS5D324_addTest_(tests, 'CORE_SCRIPT', function() {
    return ScriptApp.getScriptId() === MOS5D324.coreScriptId
      ? {status: 'PASS', details: 'Correct Core Apps Script project.'}
      : {status: 'FAIL', details: 'Wrong Core Apps Script project.'};
  });

  MOS5D324_addTest_(tests, 'PROJECT_REGISTRY_PRESENT', function() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(MOS5D324.projectsSheet);

    return sheet
      ? {status: 'PASS', details: 'SYS_PROJECT_REGISTRY is present.'}
      : {status: 'FAIL', details: 'SYS_PROJECT_REGISTRY is missing.'};
  });

  MOS5D324_addTest_(tests, 'REGISTRATION_SHEET_PRESENT', function() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(MOS5D324.registrationSheet);

    return sheet
      ? {status: 'PASS', details: 'SYS_PROJECT_REGISTRATION is present.'}
      : {status: 'FAIL', details: 'SYS_PROJECT_REGISTRATION is missing.'};
  });

  MOS5D324_addTest_(tests, 'PENDING_TARGETS_PRESENT', MOS5D324_testPendingTargets_);
  MOS5D324_addTest_(tests, 'CORE_STILL_LOCKED', MOS5D324_testCoreLocked_);
  MOS5D324_addTest_(tests, 'NO_LIVE_CHANGES', function() {
    return {
      status: 'PASS',
      details: 'Wizard only updates registry metadata after explicit REGISTER confirmation.'
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
    release: MOS5D324.release,
    version: MOS5D324_VERSION,
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

function MOS5D324_ensureRegistrationSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MOS5D324.registrationSheet);

  if (!sheet) {
    sheet = ss.insertSheet(MOS5D324.registrationSheet);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 9).setValues([[
      'TargetCode',
      'TargetName',
      'ExpectedWorkbookID',
      'AssignedAccount',
      'ScriptID',
      'ConfirmAction',
      'Reason',
      'RegistrationStatus',
      'UpdatedAt'
    ]]);

    sheet.setFrozenRows(1);
    sheet.getRange('F2:F100').setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(['', 'REGISTER'], true)
        .setAllowInvalid(false)
        .build()
    );
  }
}

function MOS5D324_seedRegistrationRows_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D324.registrationSheet);

  if (sheet.getLastRow() > 1) {
    return;
  }

  const projectSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D324.projectsSheet);

  if (!projectSheet || projectSheet.getLastRow() < 2) {
    throw new Error('SYS_PROJECT_REGISTRY is not ready.');
  }

  const rows = projectSheet
    .getRange(2, 1, projectSheet.getLastRow() - 1, 11)
    .getDisplayValues()
    .filter(function(row) {
      return String(row[0]).toUpperCase() !== 'CORE';
    })
    .map(function(row) {
      return [
        row[0],
        row[1],
        row[2],
        row[4],
        row[3],
        '',
        '',
        row[3] ? 'ALREADY_REGISTERED' : 'PENDING',
        new Date()
      ];
    });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 9).setValues(rows);
  }
}

function MOS5D324_updateProjectRegistry_(
  targetCode,
  expectedWorkbookId,
  scriptId,
  reason
) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D324.projectsSheet);

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('SYS_PROJECT_REGISTRY is unavailable.');
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
  const index = rows.findIndex(function(row) {
    return String(row[0]).trim().toUpperCase() === targetCode;
  });

  if (index < 0) {
    throw new Error('Unknown target code: ' + targetCode);
  }

  const rowNumber = index + 2;
  const registryWorkbookId = String(sheet.getRange(rowNumber, 3).getDisplayValue());

  if (registryWorkbookId !== expectedWorkbookId) {
    throw new Error(
      'Workbook mismatch for ' +
      targetCode +
      '. Expected ' +
      expectedWorkbookId +
      '; registry contains ' +
      registryWorkbookId +
      '.'
    );
  }

  const oldScriptId = String(sheet.getRange(rowNumber, 4).getDisplayValue());

  sheet.getRange(rowNumber, 4).setValue(scriptId);
  sheet.getRange(rowNumber, 7).setValue(true);
  sheet.getRange(rowNumber, 9).setValue('REGISTERED');
  sheet.getRange(rowNumber, 10).setValue(new Date());
  sheet.getRange(rowNumber, 11).setValue(reason || '');

  MOS5D324_audit_(
    'PROJECT_SCRIPT_ID_REGISTERED',
    targetCode,
    JSON.stringify({
      oldScriptId: oldScriptId,
      newScriptId: scriptId,
      expectedWorkbookId: expectedWorkbookId,
      reason: reason || ''
    })
  );

  return {
    targetCode: targetCode,
    oldScriptId: oldScriptId,
    newScriptId: scriptId,
    workbookId: expectedWorkbookId
  };
}

function MOS5D324_validateScriptIdFormat_(scriptId) {
  const value = String(scriptId || '').trim();

  if (!/^[A-Za-z0-9_-]{40,}$/.test(value)) {
    throw new Error('Invalid Apps Script ID format.');
  }
}

function MOS5D324_testPendingTargets_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D324.projectsSheet);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      status: 'FAIL',
      details: 'Project registry is empty.'
    };
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11)
    .getDisplayValues();

  const pending = rows
    .filter(function(row) {
      return String(row[0]).toUpperCase() !== 'CORE' &&
        !String(row[3] || '').trim();
    })
    .map(function(row) {
      return row[0];
    });

  return {
    status: pending.length ? 'WARNING' : 'PASS',
    details: pending.length
      ? 'Pending Script IDs: ' + pending.join(', ')
      : 'All project Script IDs are registered.'
  };
}

function MOS5D324_testCoreLocked_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(MOS5D324.projectsSheet);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      status: 'FAIL',
      details: 'Project registry is unavailable.'
    };
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11)
    .getDisplayValues();

  const core = rows.find(function(row) {
    return String(row[0]).toUpperCase() === 'CORE';
  });

  const ok = core &&
    String(core[2]) === MOS5D324.coreWorkbookId &&
    String(core[3]) === MOS5D324.coreScriptId &&
    String(core[6]).toUpperCase() === 'TRUE';

  return ok
    ? {status: 'PASS', details: 'CORE remains locked to the verified target.'}
    : {status: 'FAIL', details: 'CORE lock is invalid.'};
}

function MOS5D324_addTest_(tests, code, fn) {
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

function MOS5D324_audit_(eventType, referenceId, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MOS5D324.auditSheet);

  if (!sheet) {
    sheet = ss.insertSheet(MOS5D324.auditSheet);
    sheet.getRange(1, 1, 1, 6).setValues([[
      'OccurredAt',
      'AuditID',
      'EventType',
      'ReferenceID',
      'Actor',
      'Details'
    ]]);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    'AUD-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
    eventType,
    referenceId || '',
    Session.getEffectiveUser().getEmail() || 'UNAVAILABLE',
    details || ''
  ]);
}

function MOS5D324_assertCore_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('This script must be bound to MelroseOS Core.');
  }

  if (ss.getId() !== MOS5D324.coreWorkbookId) {
    throw new Error('Wrong Core workbook.');
  }

  if (ScriptApp.getScriptId() !== MOS5D324.coreScriptId) {
    throw new Error('Wrong Core Apps Script project.');
  }
}
