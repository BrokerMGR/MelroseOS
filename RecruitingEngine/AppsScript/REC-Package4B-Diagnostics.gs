/**
 * MOS5-021 Package 4B diagnostics.
 */
function REC_runPackage4BSuite() {
  REC_assertSafeMode();

  const launch = REC_getLaunchStatus();
  const senderChecks = [
    {
      name: 'Production disabled',
      pass: launch.productionEnabled === false
    },
    {
      name: 'Production approval disabled',
      pass: launch.productionApproved === false
    },
    {
      name: 'Required sender',
      pass: REC_normalizeEmail(launch.requiredSender) === 'melrosegrouprealty@gmail.com'
    }
  ];

  const results = {
    launch: launch,
    senderChecks: senderChecks,
    scheduler: REC_runSchedulerDiagnostics(),
    replyClassifierStop: REC_classifyReply('', 'unsubscribe me please'),
    replyClassifierInterested: REC_classifyReply('', 'Can we schedule a Zoom call?')
  };

  console.log(JSON.stringify(results, null, 2));
  return REC_result(
    senderChecks.every(function(c) { return c.pass; }),
    results
  );
}
