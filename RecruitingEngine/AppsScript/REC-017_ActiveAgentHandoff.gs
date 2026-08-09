/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-017_ActiveAgentHandoff
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Creates the future active-agent recruiting handoff queue.
 * Does not send active-agent recruiting messages yet.
 */

function REC_getActiveAgentHandoffQueue() {
  REC_installSystemColumns();

  const recruits = REC_readRecruitRows(10000);

  return recruits.filter(function(recruit) {
    return (
      recruit.activeRecruitingQueue === true ||
      String(recruit.recruitStage || '').toUpperCase() === 'ACTIVE_WITH_BROKERAGE'
    );
  }).map(function(recruit) {
    return {
      recruitId: recruit.recruitId,
      rowNumber: recruit.rowNumber,
      fullName: recruit.fullName,
      email: recruit.email,
      phone: recruit.phone,
      licenseNumber: recruit.licenseNumber,
      lrecStatus: recruit.lrecStatus,
      sponsoringBroker: recruit.sponsoringBroker,
      source: 'MOS5-021_PRELICENSE_HANDOFF'
    };
  });
}

function REC_refreshActiveAgentHandoffSheet() {
  REC_assertSafeMode();

  const ss = REC_openRecruitingSpreadsheet();
  const name = 'MGR_ACTIVE_AGENT_HANDOFF';
  let sheet = ss.getSheetByName(name);

  if (!sheet) sheet = ss.insertSheet(name);

  const queue = REC_getActiveAgentHandoffQueue();
  const headers = [
    'RecruitID',
    'FullName',
    'Email',
    'Phone',
    'LicenseNumber',
    'LRECStatus',
    'SponsoringBroker',
    'Source'
  ];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  if (queue.length) {
    const rows = queue.map(function(item) {
      return [
        item.recruitId,
        item.fullName,
        item.email,
        item.phone,
        item.licenseNumber,
        item.lrecStatus,
        item.sponsoringBroker,
        item.source
      ];
    });

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  return REC_result(true, {
    sheetName: name,
    handoffCount: queue.length
  });
}
