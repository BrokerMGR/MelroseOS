/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-013_BrokerDashboard
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Produces broker recruiting metrics and optional dashboard sheet.
 */

function REC_getBrokerDashboardMetrics() {
  REC_assertSafeMode();
  REC_installSystemColumns();

  const recruits = REC_readRecruitRows(10000);
  const now = REC_now();
  const today = REC_formatDate(now);

  const metrics = {
    generatedAt: REC_formatDateTime(now),
    totalRecruits: recruits.length,
    preLicense: 0,
    nurturing: 0,
    dueNow: 0,
    sentToday: 0,
    replies: 0,
    brokerFollowUpRequired: 0,
    unsubscribed: 0,
    dnc: 0,
    activeLicense: 0,
    activeWithBrokerage: 0,
    activeAgentHandoff: 0,
    joinedMGR: 0,
    contactable: 0
  };

  recruits.forEach(function(recruit) {
    const stage = String(recruit.recruitStage || '').toUpperCase();

    if (stage === 'PRE_LICENSE') metrics.preLicense++;
    if (stage === 'NURTURING') metrics.nurturing++;
    if (stage === 'BROKER_FOLLOW_UP_REQUIRED') metrics.brokerFollowUpRequired++;
    if (stage === 'ACTIVE_LICENSE') metrics.activeLicense++;
    if (stage === 'ACTIVE_WITH_BROKERAGE') metrics.activeWithBrokerage++;
    if (stage === 'ACTIVE_AGENT_HANDOFF') metrics.activeAgentHandoff++;
    if (stage === 'JOINED_MGR') metrics.joinedMGR++;

    if (recruit.replyDetected) metrics.replies++;
    if (recruit.unsubscribed) metrics.unsubscribed++;
    if (recruit.doNotContact) metrics.dnc++;
    if (recruit.isContactable) metrics.contactable++;

    if (recruit.lastEmailSent && REC_formatDate(recruit.lastEmailSent) === today) {
      metrics.sentToday++;
    }

    try {
      if (recruit.isContactable && REC_isRecruitDue_(recruit, now)) {
        metrics.dueNow++;
      }
    } catch (e) {
      // Dashboard remains available even when one record has a malformed date.
    }
  });

  return metrics;
}

function REC_refreshBrokerDashboardSheet() {
  REC_assertSafeMode();

  const ss = REC_openRecruitingSpreadsheet();
  const name = 'MGR_RECRUITING_DASHBOARD';
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  const m = REC_getBrokerDashboardMetrics();

  const rows = [
    ['MelroseOS Recruiting Dashboard', ''],
    ['Generated At', m.generatedAt],
    ['', ''],
    ['Metric', 'Count'],
    ['Total Recruits', m.totalRecruits],
    ['Pre-License', m.preLicense],
    ['Nurturing', m.nurturing],
    ['Due Now', m.dueNow],
    ['Sent Today', m.sentToday],
    ['Replies', m.replies],
    ['Broker Follow-Up Required', m.brokerFollowUpRequired],
    ['Unsubscribed', m.unsubscribed],
    ['Do Not Contact', m.dnc],
    ['Active License', m.activeLicense],
    ['Active With Brokerage', m.activeWithBrokerage],
    ['Active-Agent Handoff', m.activeAgentHandoff],
    ['Joined MGR', m.joinedMGR],
    ['Currently Contactable', m.contactable]
  ];

  sheet.clear();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange('A1:B1').merge();
  sheet.getRange('A1').setFontWeight('bold').setFontSize(16);
  sheet.getRange('A4:B4').setFontWeight('bold');
  sheet.autoResizeColumns(1, 2);
  sheet.setFrozenRows(4);

  REC_log('PASS', 'REC-013_BrokerDashboard', 'Broker dashboard refreshed.', m);

  return REC_result(true, {
    sheetName: name,
    metrics: m
  });
}
