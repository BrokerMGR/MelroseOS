/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-000_Common
 * Release: MOS5-021
 * Version: 1.0.0
 */

const REC_RELEASE = 'MOS5-021';
const REC_VERSION = '1.0.0';

const REC_CONFIG = Object.freeze({
  mode: 'SANDBOX',
  outboundEnabled: false,
  sourceSpreadsheetId: '1JK4xYqsic18U_VQ6LrZU_Qg09yDiWkmRpAFdHTMrBIQ',
  senderAccount: 'melrosegrouprealty@gmail.com',
  logoDriveId: '1ds9bSeq8BBigKZeH3RqEW6zcqXOrqNCT',
  cadenceDays: 5,
  skipSundays: true,
  skipHolidays: true,
  replyStopsCampaign: true,
  unsubscribeStopsCampaign: true,
  dncStopsCampaign: true,
  activeLicenseStopsPrelicense: true,
  activeAgentHandoff: true,
  timezone: 'America/Chicago',
  sendWindowStartHour: 10,
  sendWindowEndHour: 18
});

function REC_getConfig() {
  return JSON.parse(JSON.stringify(REC_CONFIG));
}

function REC_assertSafeMode() {
  if (REC_CONFIG.outboundEnabled === true) {
    throw new Error('MOS5-021 safety gate: outbound sending must remain disabled during foundation build.');
  }
  if (REC_CONFIG.mode !== 'SANDBOX') {
    throw new Error('MOS5-021 safety gate: MODE must remain SANDBOX during foundation build.');
  }
  return true;
}

function REC_now() {
  return new Date();
}

function REC_formatDate(date) {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), REC_CONFIG.timezone, 'yyyy-MM-dd');
}

function REC_formatDateTime(date) {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), REC_CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss');
}

function REC_normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function REC_normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function REC_normalizeText(value) {
  return String(value || '').trim();
}

function REC_makeRecruitId_(rowNumber, email, licenseNumber) {
  const seed = [
    REC_RELEASE,
    rowNumber || '',
    REC_normalizeEmail(email),
    REC_normalizeText(licenseNumber)
  ].join('|');

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    seed,
    Utilities.Charset.UTF_8
  );

  const hex = digest.map(function(b) {
    const n = (b < 0 ? b + 256 : b).toString(16);
    return n.length === 1 ? '0' + n : n;
  }).join('');

  return 'REC-' + hex.substring(0, 16).toUpperCase();
}

function REC_isSunday(date) {
  return new Date(date).getDay() === 0;
}

function REC_getHolidayKeys_() {
  const year = Number(
    Utilities.formatDate(new Date(), REC_CONFIG.timezone, 'yyyy')
  );

  const keys = [
    year + '-01-01',
    year + '-07-04',
    year + '-11-11',
    year + '-12-25'
  ];

  const propertyValue = PropertiesService.getScriptProperties()
    .getProperty('REC_EXTRA_HOLIDAYS');

  if (propertyValue) {
    propertyValue.split(',').forEach(function(item) {
      const trimmed = item.trim();
      if (trimmed) keys.push(trimmed);
    });
  }

  return Array.from(new Set(keys));
}

function REC_isConfiguredHoliday(date) {
  const key = REC_formatDate(date);
  return REC_getHolidayKeys_().indexOf(key) !== -1;
}

function REC_isPermittedSendDate(date) {
  const d = new Date(date);
  if (REC_CONFIG.skipSundays && REC_isSunday(d)) return false;
  if (REC_CONFIG.skipHolidays && REC_isConfiguredHoliday(d)) return false;
  return true;
}

function REC_nextPermittedSendDate(date) {
  const d = new Date(date);
  while (!REC_isPermittedSendDate(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function REC_calculateNextTouch(lastTouch) {
  const base = lastTouch ? new Date(lastTouch) : REC_now();
  const next = new Date(base);
  next.setDate(next.getDate() + REC_CONFIG.cadenceDays);
  return REC_nextPermittedSendDate(next);
}

function REC_log(level, moduleName, message, details) {
  const payload = {
    release: REC_RELEASE,
    version: REC_VERSION,
    timestamp: REC_formatDateTime(REC_now()),
    level: level || 'INFO',
    module: moduleName || 'UNKNOWN',
    message: message || '',
    details: details || null
  };
  console.log(JSON.stringify(payload));
  return payload;
}

function REC_result(success, data, error) {
  return {
    success: Boolean(success),
    release: REC_RELEASE,
    version: REC_VERSION,
    data: data || null,
    error: error ? String(error) : null
  };
}

function REC_runFoundationDiagnostics() {
  REC_assertSafeMode();

  const checks = [];
  const add = function(name, pass, detail) {
    checks.push({ name: name, pass: Boolean(pass), detail: detail || '' });
  };

  add('Release', REC_RELEASE === 'MOS5-021', REC_RELEASE);
  add('Mode', REC_CONFIG.mode === 'SANDBOX', REC_CONFIG.mode);
  add('Outbound disabled', REC_CONFIG.outboundEnabled === false, String(REC_CONFIG.outboundEnabled));
  add('Source spreadsheet configured', Boolean(REC_CONFIG.sourceSpreadsheetId), REC_CONFIG.sourceSpreadsheetId);
  add('Sender configured', Boolean(REC_CONFIG.senderAccount), REC_CONFIG.senderAccount);
  add('Logo configured', Boolean(REC_CONFIG.logoDriveId), REC_CONFIG.logoDriveId);
  add('Cadence', REC_CONFIG.cadenceDays === 5, String(REC_CONFIG.cadenceDays));

  const failed = checks.filter(function(c) { return !c.pass; });

  REC_log(
    failed.length ? 'FAIL' : 'PASS',
    'REC-000_Common',
    'Foundation diagnostics complete.',
    { checks: checks }
  );

  return REC_result(failed.length === 0, {
    checks: checks,
    failedCount: failed.length
  }, failed.length ? 'Foundation diagnostics failed.' : null);
}
