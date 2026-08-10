/**
 * MOS5 CRM-121 - Recruit Production Configuration
 * Production activation is intentionally separate from whole-system cutover.
 */
const MGR_RECRUIT_PROD = Object.freeze({
  VERSION: '1.0.0',
  CAMPAIGN: 'RECRUIT_MENTORSHIP',
  ENABLED_KEY: 'MGR_RECRUIT_PRODUCTION_ENABLED',
  START_KEY: 'MGR_RECRUIT_PRODUCTION_START_AT',
  CADENCE_DAYS: 5,
  DAILY_SENDER_CAP: 75,
  GOOGLE_QUOTA_RESERVE: 20,
  SEND_START_HOUR: 10,
  SEND_END_HOUR: 18,
  SKIP_SUNDAYS: true,
  TEST_MODE_KEY: 'MGR_RECRUIT_TEST_MODE'
});

function MGR_RECRUIT_getProductionState() {
  const p = PropertiesService.getScriptProperties();
  return {
    success: true,
    version: MGR_RECRUIT_PROD.VERSION,
    enabled: p.getProperty(MGR_RECRUIT_PROD.ENABLED_KEY) === 'true',
    testMode: p.getProperty(MGR_RECRUIT_PROD.TEST_MODE_KEY) !== 'false',
    startAt: p.getProperty(MGR_RECRUIT_PROD.START_KEY) || '',
    cadenceDays: MGR_RECRUIT_PROD.CADENCE_DAYS,
    perSender24hCap: MGR_RECRUIT_PROD.DAILY_SENDER_CAP
  };
}
