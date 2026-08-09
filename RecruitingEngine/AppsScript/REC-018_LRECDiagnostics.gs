/**
 * MOS5-021 LREC integration diagnostics.
 */
function REC_runLRECDiagnostics() {
  REC_assertSafeMode();

  const candidates = REC_getLRECVerificationCandidates(100);
  const checks = [
    {
      name: 'Public search URL configured',
      pass: REC_LREC.publicSearchUrl === 'https://portal.lrec.gov/public/search',
      detail: REC_LREC.publicSearchUrl
    },
    {
      name: 'Conservative rate limit',
      pass: REC_LREC.minDelayMs >= 2000,
      detail: String(REC_LREC.minDelayMs)
    },
    {
      name: 'Candidate selector',
      pass: Array.isArray(candidates),
      detail: String(candidates.length)
    },
    {
      name: 'Outbound production remains disabled',
      pass: REC_CONFIG.outboundEnabled === false,
      detail: String(REC_CONFIG.outboundEnabled)
    }
  ];

  return REC_result(
    checks.every(function(c) { return c.pass; }),
    {
      checks: checks,
      candidateCount: candidates.length
    }
  );
}
