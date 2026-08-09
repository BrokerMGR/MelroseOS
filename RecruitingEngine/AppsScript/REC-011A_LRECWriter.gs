/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-011A_LRECWriter
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Applies verified LREC results to the recruiting spreadsheet.
 */

function REC_applyLRECResultToRecruit_(recruit, verification) {
  const sheet = REC_getRecruitingSheet();
  const state = REC_transitionForLRECStatus(recruit, verification);

  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'LRECStatus', verification.status);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'SponsoringBroker', verification.sponsoringBroker || '');
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'LRECLastChecked', REC_now());

  if (verification.status === 'ACTIVE') {
    REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'RecruitStage', state.recruitStage);
    REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'CampaignStatus', 'STOPPED');
    REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'ActiveRecruitingQueue', state.activeRecruitingQueue);
  }

  REC_setSystemValueByRow_(
    sheet,
    recruit.rowNumber,
    'CampaignNotes',
    REC_appendNote_(
      recruit.campaignNotes || '',
      'LREC verification: status=' + verification.status +
      '; confidence=' + verification.confidence +
      '; broker=' + (verification.sponsoringBroker || '(none)') +
      '; reason=' + verification.reason
    )
  );

  return state;
}

function REC_runLRECVerificationWorker(maxCount) {
  // This worker changes only the recruiting spreadsheet.
  // It does not send email.
  const cap = Math.max(1, Math.min(Number(maxCount || 10), 25));
  const candidates = REC_getLRECVerificationCandidates(5000).slice(0, cap);
  const results = [];

  candidates.forEach(function(recruit) {
    const verification = REC_verifyRecruitWithLREC(recruit);
    const state = REC_applyLRECResultToRecruit_(recruit, verification);

    results.push({
      recruitId: recruit.recruitId,
      rowNumber: recruit.rowNumber,
      status: verification.status,
      sponsoringBroker: verification.sponsoringBroker,
      confidence: verification.confidence,
      resultingStage: state.recruitStage
    });
  });

  REC_refreshBrokerDashboardSheet();

  REC_log('PASS', 'REC-011A_LRECWriter', 'LREC worker complete.', {
    checked: results.length
  });

  return REC_result(true, {
    checkedCount: results.length,
    results: results
  });
}
