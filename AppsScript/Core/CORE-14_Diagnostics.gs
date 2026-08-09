/**
 * MelroseOS Enterprise Core
 * File: CORE-14_Diagnostics.gs
 * Release: MOS5-CORE-14
 * Version: 1.0.0
 * Purpose: Unified Enterprise Core diagnostics and readiness report.
 */

function MGR_runCoreDiagnostics() {
  const started = new Date().getTime();
  const tests = [];

  tests.push(MGR_diagRun_('BOOTSTRAP', function() {
    const result = MGR_coreHealthCheck();
    // Config/logging warnings from CORE-00 are no longer expected once full core is installed.
    return result.success;
  }));

  tests.push(MGR_diagRun_('CONFIG', function() {
    return MGR_configDiagnostics().success;
  }));

  tests.push(MGR_diagRun_('CONSTANTS', function() {
    return MGR_constant('LEAD_TYPE.BUYER') === 'BUYER';
  }));

  tests.push(MGR_diagRun_('UTILITIES', function() {
    return MGR_normalizeEmail(' Test@Example.COM ') === 'test@example.com';
  }));

  tests.push(MGR_diagRun_('PROPERTIES', function() {
    const key = 'DIAG_' + new Date().getTime();
    MGR_setScriptProperty(key, 'PASS');
    const pass = MGR_getScriptProperty(key) === 'PASS';
    MGR_deleteScriptProperty(key);
    return pass;
  }));

  tests.push(MGR_diagRun_('VALIDATION', function() {
    return MGR_isValidEmail('test@example.com') && MGR_isValidPhone('(985) 250-0071');
  }));

  tests.push(MGR_diagRun_('AUDIT', function() {
    const event = MGR_auditEvent('DIAGNOSTIC', { pass: true }, { source: 'CORE-14' });
    return !!event.auditId;
  }));

  tests.push(MGR_diagRun_('LOCKING', function() {
    return MGR_lockDiagnostics().success;
  }));

  tests.push(MGR_diagRun_('IDS', function() {
    return MGR_idDiagnostics().success;
  }));

  tests.push(MGR_diagRun_('DATETIME', function() {
    return MGR_dateTimeDiagnostics().success;
  }));

  tests.push(MGR_diagRun_('SCHEMA', function() {
    return MGR_schemaDiagnostics().success;
  }));

  tests.push(MGR_diagRun_('REGISTRY', function() {
    return MGR_registryDiagnostics().success;
  }));

  const passed = tests.filter(function(test) { return test.pass; }).length;
  const failed = tests.length - passed;

  const report = {
    success: failed === 0,
    system: 'MelroseOS',
    suite: 'ENTERPRISE_CORE',
    version: '1.0.0',
    passed: passed,
    failed: failed,
    total: tests.length,
    durationMs: new Date().getTime() - started,
    timestamp: MGR_nowIso(),
    tests: tests
  };

  if (report.success) {
    MGR_logInfo('MGR_runCoreDiagnostics', report);
  } else {
    MGR_logWarn('MGR_runCoreDiagnostics', report);
  }

  return report;
}

function MGR_assertCoreDiagnostics() {
  const report = MGR_runCoreDiagnostics();

  if (!report.success) {
    throw new Error(
      'MelroseOS Enterprise Core diagnostics failed: ' +
      MGR_safeJsonStringify(report)
    );
  }

  return report;
}

function MGR_diagRun_(name, fn) {
  const started = new Date().getTime();

  try {
    const value = fn();
    return {
      name: name,
      pass: value === true,
      value: value,
      durationMs: new Date().getTime() - started
    };
  } catch (err) {
    return {
      name: name,
      pass: false,
      error: {
        name: err && err.name ? String(err.name) : 'Error',
        message: err && err.message ? String(err.message) : String(err || '')
      },
      durationMs: new Date().getTime() - started
    };
  }
}
