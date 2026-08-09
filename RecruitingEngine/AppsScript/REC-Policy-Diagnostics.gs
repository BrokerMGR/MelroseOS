/**
 * MOS5-021 policy diagnostics.
 */
function REC_runPolicySuite() {
  REC_assertSafeMode();

  const testRecruit = {
    firstName: 'Test',
    lastName: 'Recruit',
    email: 'test@example.com',
    phone: '',
    licenseNumber: '',
    recruitStage: 'PRE_LICENSE',
    lrecStatus: 'UNKNOWN',
    sponsoringBroker: '',
    replyDetected: false,
    unsubscribed: false,
    doNotContact: false
  };

  const email = REC_buildPreLicenseEmail(testRecruit, {
    consultationUrl: 'https://example.com/meeting',
    academyUrl: 'https://example.com/academy',
    unsubscribeUrl: 'https://example.com/unsubscribe'
  });

  const stopReply = REC_classifyReply('', 'Please unsubscribe me.');
  const interestedReply = REC_classifyReply('', 'I would like to schedule a Zoom call.');
  const suppression = REC_evaluateSuppression(testRecruit, []);

  const results = {
    sendPolicy: REC_runSuppressionDiagnostics(),
    emailBuilder: {
      success: Boolean(email.subject && email.html && email.plainText),
      subject: email.subject
    },
    stopReply: stopReply,
    interestedReply: interestedReply,
    suppression: suppression
  };

  console.log(JSON.stringify(results, null, 2));
  return results;
}
