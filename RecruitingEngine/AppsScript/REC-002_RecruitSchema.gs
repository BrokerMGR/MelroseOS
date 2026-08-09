/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-002_RecruitSchema
 * Release: MOS5-021
 * Version: 1.0.0
 */

const REC_DEFAULT_STAGE = 'PRE_LICENSE';
const REC_DEFAULT_CAMPAIGN_STATUS = 'ACTIVE';

function REC_getCellByColumn_(row, columnNumber) {
  if (!columnNumber || columnNumber < 1) return '';
  return row[columnNumber - 1];
}

function REC_getSystemColumnNumber_(headerMap, columnName) {
  return headerMap.map[String(columnName).toLowerCase()] || null;
}

function REC_toBoolean_(value) {
  if (value === true) return true;
  if (value === false || value === null || typeof value === 'undefined') return false;
  const text = String(value).trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'x'].indexOf(text) !== -1;
}

function REC_isRecruitContactable(recruit) {
  if (!recruit) return false;
  if (!REC_normalizeEmail(recruit.email)) return false;
  if (recruit.replyDetected) return false;
  if (recruit.unsubscribed) return false;
  if (recruit.doNotContact) return false;

  const stage = String(recruit.recruitStage || '').toUpperCase();
  if ([
    'REPLIED',
    'UNSUBSCRIBED',
    'DNC',
    'ACTIVE_LICENSE',
    'ACTIVE_WITH_BROKERAGE',
    'ACTIVE_AGENT_HANDOFF',
    'JOINED_MGR',
    'STOPPED'
  ].indexOf(stage) !== -1) {
    return false;
  }
  return true;
}

function REC_mapSheetRowToRecruit(row, rowNumber, sourceColumns, headerMap) {
  const email = REC_normalizeEmail(REC_getCellByColumn_(row, sourceColumns.email));
  const licenseNumber = REC_normalizeText(REC_getCellByColumn_(row, sourceColumns.licenseNumber));

  const systemValue = function(name) {
    const column = REC_getSystemColumnNumber_(headerMap, name);
    return REC_getCellByColumn_(row, column);
  };

  const recruitId = REC_normalizeText(systemValue('RecruitID')) ||
    REC_makeRecruitId_(rowNumber, email, licenseNumber);

  const recruit = {
    recruitId: recruitId,
    rowNumber: rowNumber,
    firstName: REC_normalizeText(REC_getCellByColumn_(row, sourceColumns.firstName)),
    lastName: REC_normalizeText(REC_getCellByColumn_(row, sourceColumns.lastName)),
    email: email,
    phone: REC_normalizePhone(REC_getCellByColumn_(row, sourceColumns.phone)),
    city: REC_normalizeText(REC_getCellByColumn_(row, sourceColumns.city)),
    parish: REC_normalizeText(REC_getCellByColumn_(row, sourceColumns.parish)),
    licenseNumber: licenseNumber,
    applicationDate: REC_getCellByColumn_(row, sourceColumns.applicationDate),

    recruitStage: REC_normalizeText(systemValue('RecruitStage')) || REC_DEFAULT_STAGE,
    campaignStatus: REC_normalizeText(systemValue('CampaignStatus')) || REC_DEFAULT_CAMPAIGN_STATUS,

    sequenceNumber: Number(systemValue('SequenceNumber') || 0),
    lastEmailSent: systemValue('LastEmailSent') || '',
    nextEmailDate: systemValue('NextEmailDate') || '',
    emailCount: Number(systemValue('EmailCount') || 0),
    lastTemplateSent: REC_normalizeText(systemValue('LastTemplateSent')),

    lrecStatus: REC_normalizeText(systemValue('LRECStatus')) || 'UNKNOWN',
    sponsoringBroker: REC_normalizeText(systemValue('SponsoringBroker')),
    lrecLastChecked: systemValue('LRECLastChecked') || '',

    replyDetected: REC_toBoolean_(systemValue('ReplyDetected')),
    unsubscribed: REC_toBoolean_(systemValue('Unsubscribed')),
    doNotContact: REC_toBoolean_(systemValue('DoNotContact')),
    activeRecruitingQueue: REC_toBoolean_(systemValue('ActiveRecruitingQueue')),
    campaignNotes: REC_normalizeText(systemValue('CampaignNotes'))
  };

  recruit.fullName = [recruit.firstName, recruit.lastName].filter(Boolean).join(' ');
  recruit.isContactable = REC_isRecruitContactable(recruit);
  recruit.nextCalculatedTouch = recruit.nextEmailDate ||
    REC_calculateNextTouch(recruit.lastEmailSent || REC_now());

  return recruit;
}

function REC_validateRecruit(recruit) {
  const errors = [];
  const warnings = [];

  if (!recruit.recruitId) errors.push('RecruitID missing.');
  if (!recruit.firstName) errors.push('First name missing.');
  if (!recruit.lastName) warnings.push('Last name missing.');
  if (!recruit.email) errors.push('Email missing.');

  if (recruit.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recruit.email)) {
    errors.push('Email format invalid.');
  }

  if (!recruit.licenseNumber) {
    warnings.push('License/Credential number unavailable; LREC verification will require name fallback.');
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

function REC_getRecruitPreview(limit) {
  REC_assertSafeMode();
  REC_installSystemColumns();

  const recruits = REC_readRecruitRows(limit || 10);

  return recruits.map(function(recruit) {
    return {
      recruitId: recruit.recruitId,
      rowNumber: recruit.rowNumber,
      fullName: recruit.fullName,
      email: recruit.email,
      city: recruit.city,
      parish: recruit.parish,
      licenseNumber: recruit.licenseNumber,
      recruitStage: recruit.recruitStage,
      campaignStatus: recruit.campaignStatus,
      lrecStatus: recruit.lrecStatus,
      isContactable: recruit.isContactable,
      validation: REC_validateRecruit(recruit)
    };
  });
}

function REC_runSchemaDiagnostics() {
  REC_assertSafeMode();
  REC_installSystemColumns();

  const recruits = REC_readRecruitRows(25);
  const validations = recruits.map(function(recruit) {
    return {
      recruitId: recruit.recruitId,
      rowNumber: recruit.rowNumber,
      validation: REC_validateRecruit(recruit)
    };
  });

  const invalid = validations.filter(function(v) {
    return !v.validation.valid;
  });

  REC_log(
    invalid.length ? 'WARN' : 'PASS',
    'REC-002_RecruitSchema',
    'Recruit schema diagnostics complete.',
    { sampled: recruits.length, invalidCount: invalid.length }
  );

  return REC_result(true, {
    sampled: recruits.length,
    invalidCount: invalid.length,
    validations: validations
  });
}
