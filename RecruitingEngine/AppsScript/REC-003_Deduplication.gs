/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-003_Deduplication
 * Release: MOS5-021
 * Version: 1.0.0
 */

function REC_buildDuplicateIndex(recruits) {
  const index = {
    emails: {},
    phones: {},
    licenses: {}
  };

  (recruits || []).forEach(function(recruit) {
    const email = REC_normalizeEmail(recruit.email);
    const phone = REC_normalizePhone(recruit.phone);
    const license = REC_normalizeText(recruit.licenseNumber).toUpperCase();

    if (email) {
      if (!index.emails[email]) index.emails[email] = [];
      index.emails[email].push(recruit.recruitId);
    }

    if (phone) {
      if (!index.phones[phone]) index.phones[phone] = [];
      index.phones[phone].push(recruit.recruitId);
    }

    if (license) {
      if (!index.licenses[license]) index.licenses[license] = [];
      index.licenses[license].push(recruit.recruitId);
    }
  });

  return index;
}

function REC_findDuplicateReasons(recruit, index) {
  const reasons = [];
  const email = REC_normalizeEmail(recruit.email);
  const phone = REC_normalizePhone(recruit.phone);
  const license = REC_normalizeText(recruit.licenseNumber).toUpperCase();

  if (email && index.emails[email] && index.emails[email].length > 1) {
    reasons.push('DUPLICATE_EMAIL');
  }
  if (phone && index.phones[phone] && index.phones[phone].length > 1) {
    reasons.push('DUPLICATE_PHONE');
  }
  if (license && index.licenses[license] && index.licenses[license].length > 1) {
    reasons.push('DUPLICATE_LICENSE');
  }

  return reasons;
}

function REC_runDuplicateAudit(limit) {
  REC_assertSafeMode();
  REC_installSystemColumns();

  const recruits = REC_readRecruitRows(limit || 5000);
  const index = REC_buildDuplicateIndex(recruits);

  const duplicates = recruits.map(function(recruit) {
    return {
      recruitId: recruit.recruitId,
      rowNumber: recruit.rowNumber,
      email: recruit.email,
      phone: recruit.phone,
      licenseNumber: recruit.licenseNumber,
      duplicateReasons: REC_findDuplicateReasons(recruit, index)
    };
  }).filter(function(item) {
    return item.duplicateReasons.length > 0;
  });

  REC_log(
    duplicates.length ? 'WARN' : 'PASS',
    'REC-003_Deduplication',
    'Duplicate audit complete.',
    { duplicateCount: duplicates.length }
  );

  return REC_result(true, {
    duplicateCount: duplicates.length,
    duplicates: duplicates
  });
}
