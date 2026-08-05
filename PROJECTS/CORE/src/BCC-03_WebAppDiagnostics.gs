function MOS5BCC_runWebAppDiagnostics() {
  MOS5BCC_assertCore_();

  const tests = [];

  MOS5BCC_test_(tests, 'PUBLIC_DOGET_PRESENT', function() {
    return typeof doGet === 'function';
  }, 'Public doGet() router is present.');

  const legacyAvailable =
    typeof MOS5BCC_legacyDoGet_ === 'function';

  tests.push({
    code: 'LEGACY_ROUTE_STATUS',
    status: legacyAvailable ? 'PASS' : 'WARNING',
    details: legacyAvailable
      ? 'Previous doGet() is preserved as the legacy route.'
      : 'No previous doGet() was present in synchronized Core source; safe fallback route is active.'
  });

  MOS5BCC_test_(tests, 'WEBAPP_RENDERER_PRESENT', function() {
    return typeof MOS5BCC_renderWebApp_ === 'function';
  }, 'Broker Command Center web-app renderer is present.');

  MOS5BCC_test_(tests, 'BROKER_ACCESS_GATE', function() {
    const email = String(
      Session.getEffectiveUser().getEmail() || ''
    ).toLowerCase();

    return MOS5BCC_CONFIG.brokerEmails.indexOf(email) !== -1;
  }, 'Effective user is authorized as a broker.');

  MOS5BCC_test_(tests, 'ROUTE_PARAMETER', function() {
    return MOS5BCC_getWebAppRouteInfo().routeParameter === 'app=bcc';
  }, 'Broker Command Center route is app=bcc.');

  const passed = tests.filter(function(test) {
    return test.status === 'PASS';
  }).length;

  const warnings = tests.filter(function(test) {
    return test.status === 'WARNING';
  }).length;

  const failed = tests.filter(function(test) {
    return test.status === 'FAIL';
  }).length;

  const result = {
    release: 'MOS5-SPRINT1-BCC-LEGACY-ROUTE-HOTFIX',
    version: '1.0.3',
    overallStatus: failed
      ? 'FAIL'
      : warnings ? 'WARNING' : 'PASS',
    passed: passed,
    warnings: warnings,
    failed: failed,
    tests: tests,
    completedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
