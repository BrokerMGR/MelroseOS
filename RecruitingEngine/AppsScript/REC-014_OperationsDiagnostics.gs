/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-014_OperationsDiagnostics
 * Release: MOS5-021
 * Version: 1.0.0
 */

function REC_runOperationsDiagnostics() {
  REC_assertSafeMode();

  const queue = REC_buildCampaignQueue(100);
  const metrics = REC_getBrokerDashboardMetrics();
  const policy = REC_runSuppressionDiagnostics();

  const checks = [
    {
      name: 'Queue builds',
      pass: Boolean(queue && queue.success),
      detail: queue && queue.data ? String(queue.data.eligibleCount) : ''
    },
    {
      name: 'Dashboard metrics build',
      pass: Boolean(metrics && typeof metrics.totalRecruits === 'number'),
      detail: metrics ? String(metrics.totalRecruits) : ''
    },
    {
      name: 'Send policy',
      pass: Boolean(policy && policy.success),
      detail: 'Monday-Saturday 10:00-16:00 Central'
    },
    {
      name: 'Outbound remains disabled',
      pass: REC_CONFIG.outboundEnabled === false,
      detail: String(REC_CONFIG.outboundEnabled)
    }
  ];

  const failed = checks.filter(function(c) { return !c.pass; });

  REC_log(
    failed.length ? 'FAIL' : 'PASS',
    'REC-014_OperationsDiagnostics',
    'Operations diagnostics complete.',
    { checks: checks }
  );

  return REC_result(
    failed.length === 0,
    {
      checks: checks,
      queuePreview: queue.data,
      dashboard: metrics
    },
    failed.length ? 'Operations diagnostics failed.' : null
  );
}
