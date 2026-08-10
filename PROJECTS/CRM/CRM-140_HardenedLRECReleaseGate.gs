/**
 * MelroseOS CRM
 * File: CRM-140_HardenedLRECReleaseGate.gs
 * Version: 1.0.0
 */

const MGR_LREC_140 = Object.freeze({
  VERSION: '1.0.0',
  ROSTER_ID: '1JK4xYqsic18U_VQ6LrZU_Qg09yDiWkmRpAFdHTMrBIQ',
  ROSTER_SHEET: 'Prospects',
  CRM_ID: '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
  OUTBOX_SHEET: 'EMAIL_OUTBOX',
  CAMPAIGN: 'RECRUIT_MENTORSHIP',
  CANARY_MAX_AGE_MINUTES: 60,
  AUDIT_MAX_AGE_MINUTES: 30,
  CANARY_PROPERTY: 'MGR_LREC_140_CANARY',
  AUDIT_PROPERTY: 'MGR_LREC_140_LAST_AUDIT'
});

function RUN_LREC_140_CANARY_CERTIFICATION() {
  const positive = MGR_RECRUIT_LREC_lookup({
    firstName: 'Clarissa',
    lastName: 'Brown',
    credentialNumber: '995720225'
  });

  const negative = MGR_RECRUIT_LREC_lookup({
    firstName: 'Zzzmelroseosnorecord',
    lastName: 'Zzzvalidation',
    credentialNumber: '999999999999999'
  });

  const result = {
    success:
      positive &&
      positive.success === true &&
      positive.recordFound === true &&
      negative &&
      negative.success === true &&
      negative.noResults === true,

    positiveControl: {
      success: !!(positive && positive.success),
      recordFound: !!(positive && positive.recordFound),
      licenseNumber: String(positive && positive.licenseNumber || ''),
      licenseStatus: String(positive && positive.licenseStatus || ''),
      ownerName: String(positive && positive.ownerName || ''),
      companyName: String(positive && positive.companyName || ''),
      detailUrlFound: !!(positive && positive.detailUrl),
      error: String(positive && positive.error || '')
    },

    negativeControl: {
      success: !!(negative && negative.success),
      noResults: !!(negative && negative.noResults),
      error: String(negative && negative.error || '')
    },

    timestamp: new Date().toISOString()
  };

  PropertiesService.getScriptProperties().setProperty(
    MGR_LREC_140.CANARY_PROPERTY,
    JSON.stringify(result)
  );

  console.log(
    'RUN_LREC_140_CANARY_CERTIFICATION\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

function RUN_RECRUIT_LREC_HARDENED_AUDIT() {
  const canary = MGR_LREC_140_getFreshCanary_();

  if (!canary.success) {
    throw new Error(
      'LREC_HARDENED_AUDIT_BLOCKED: known-positive/negative canary did not pass.'
    );
  }

  const crm = SpreadsheetApp.openById(MGR_LREC_140.CRM_ID);
  const outbox = crm.getSheetByName(MGR_LREC_140.OUTBOX_SHEET);

  if (!outbox) throw new Error('EMAIL_OUTBOX missing.');

  const rosterSS = SpreadsheetApp.openById(MGR_LREC_140.ROSTER_ID);
  const roster = rosterSS.getSheetByName(MGR_LREC_140.ROSTER_SHEET);

  if (!roster) throw new Error('Prospects roster missing.');

  MGR_LREC_140_quarantineOutbox_(outbox);

  const emails = MGR_LREC_140_campaignEmails_(outbox);

  let checked = 0;
  let pendingCertified = 0;
  let licensedMigrated = 0;
  let held = 0;
  let notInProspects = 0;

  const details = [];

  emails.forEach(function(email) {
    const recruit = MGR_LREC_140_findProspect_(roster, email);

    if (!recruit) {
      notInProspects += 1;
      return;
    }

    checked += 1;

    const lookup = MGR_RECRUIT_LREC_lookup(recruit);

    if (
      typeof MGR_RECRUIT_138_writeLiveResult_ === 'function'
    ) {
      MGR_RECRUIT_138_writeLiveResult_(
        roster,
        recruit.row,
        lookup
      );
    }

    if (lookup.success === true && lookup.recordFound === true) {
      MGR_LREC_140_cancelUnsentForEmail_(
        outbox,
        email,
        'CANCELLED_LREC_LICENSED'
      );

      let migration = null;

      if (
        typeof MGR_RECRUIT_138_moveToActiveAgents_ === 'function'
      ) {
        migration = MGR_RECRUIT_138_moveToActiveAgents_(
          roster,
          recruit,
          lookup
        );
      }

      licensedMigrated += 1;

      details.push({
        email: email,
        decision: 'LICENSE_RECORD_FOUND',
        license: lookup.licenseNumber || '',
        status: lookup.licenseStatus || '',
        migrated: !!(migration && migration.success)
      });

      return;
    }

    if (lookup.success === true && lookup.noResults === true) {
      MGR_LREC_140_certifyUnsentForEmail_(outbox, email);

      pendingCertified += 1;

      details.push({
        email: email,
        decision: 'EXPLICIT_NO_RESULT_PENDING'
      });

      return;
    }

    MGR_LREC_140_holdUnsentForEmail_(
      outbox,
      email,
      lookup.error || 'LREC_UNSAFE_OR_AMBIGUOUS_RESULT'
    );

    held += 1;

    details.push({
      email: email,
      decision: 'HOLD',
      error: lookup.error || ''
    });
  });

  const audit = {
    success: held === 0 && canary.success === true,
    releaseReady: held === 0 && canary.success === true,
    version: MGR_LREC_140.VERSION,
    campaignEmails: emails.length,
    checkedProspects: checked,
    pendingCertified: pendingCertified,
    licensedMigrated: licensedMigrated,
    held: held,
    notInProspects: notInProspects,
    canaryTimestamp: canary.timestamp || '',
    timestamp: new Date().toISOString(),
    details: details
  };

  PropertiesService.getScriptProperties().setProperty(
    MGR_LREC_140.AUDIT_PROPERTY,
    JSON.stringify(audit)
  );

  console.log(
    'RUN_RECRUIT_LREC_HARDENED_AUDIT\n' +
    JSON.stringify({
      success: audit.success,
      releaseReady: audit.releaseReady,
      campaignEmails: audit.campaignEmails,
      checkedProspects: audit.checkedProspects,
      pendingCertified: audit.pendingCertified,
      licensedMigrated: audit.licensedMigrated,
      held: audit.held,
      notInProspects: audit.notInProspects,
      timestamp: audit.timestamp
    }, null, 2)
  );

  return audit;
}

function RELEASE_RECRUIT_QUEUE_AFTER_LREC_HARDENED_AUDIT() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(MGR_LREC_140.AUDIT_PROPERTY);

  if (!raw) {
    throw new Error('RELEASE_BLOCKED: No hardened LREC audit found.');
  }

  const audit = JSON.parse(raw);

  const ageMs =
    Date.now() -
    new Date(audit.timestamp || 0).getTime();

  const maxAge =
    MGR_LREC_140.AUDIT_MAX_AGE_MINUTES *
    60 *
    1000;

  if (
    audit.releaseReady !== true ||
    !isFinite(ageMs) ||
    ageMs < 0 ||
    ageMs > maxAge
  ) {
    throw new Error(
      'RELEASE_BLOCKED: Audit is not PASS or is older than ' +
      MGR_LREC_140.AUDIT_MAX_AGE_MINUTES +
      ' minutes.'
    );
  }

  const routed = MGR_SENDER_routePendingQueue();

  const result = {
    success: true,
    released: routed && routed.assigned || 0,
    auditTimestamp: audit.timestamp,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RELEASE_RECRUIT_QUEUE_AFTER_LREC_HARDENED_AUDIT\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

function MGR_RECRUIT_LREC_140_queueCertificationTick() {
  const canary = MGR_LREC_140_getFreshCanary_();

  if (!canary.success) {
    return {
      success: false,
      blocked: true,
      reason: 'LREC_CANARY_FAILED'
    };
  }

  const audit = RUN_RECRUIT_LREC_HARDENED_AUDIT();

  if (!audit.releaseReady) {
    return audit;
  }

  return RELEASE_RECRUIT_QUEUE_AFTER_LREC_HARDENED_AUDIT();
}

function INSTALL_RECRUIT_LREC_HARDENED_QUEUE_TRIGGER() {
  const handler =
    'MGR_RECRUIT_LREC_140_queueCertificationTick';

  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyMinutes(10)
    .create();

  const result = {
    success: true,
    handler: handler,
    cadenceMinutes: 10,
    timestamp: new Date().toISOString()
  };

  console.log(
    'INSTALL_RECRUIT_LREC_HARDENED_QUEUE_TRIGGER\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

function MGR_LREC_140_getFreshCanary_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(MGR_LREC_140.CANARY_PROPERTY);

  if (raw) {
    try {
      const cached = JSON.parse(raw);
      const age =
        Date.now() -
        new Date(cached.timestamp || 0).getTime();

      if (
        cached.success === true &&
        isFinite(age) &&
        age >= 0 &&
        age <=
          MGR_LREC_140.CANARY_MAX_AGE_MINUTES *
          60 *
          1000
      ) {
        return cached;
      }
    } catch (e) {}
  }

  return RUN_LREC_140_CANARY_CERTIFICATION();
}

function MGR_LREC_140_quarantineOutbox_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return 0;

  const range = sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    sheet.getLastColumn()
  );

  const values = range.getValues();

  let changed = 0;

  values.forEach(function(row) {
    const status =
      String(row[3] || '').toUpperCase();

    const campaign =
      String(row[12] || '');

    if (campaign !== MGR_LREC_140.CAMPAIGN) return;

    if (
      [
        'SENT',
        'CANCELLED_LREC_LICENSED',
        'FAILED',
        'CANCELLED'
      ].indexOf(status) >= 0
    ) {
      return;
    }

    row[3] = 'LREC_AUDIT_HOLD';
    row[4] = '';
    row[5] = '';
    row[18] = new Date().toISOString();
    changed += 1;
  });

  range.setValues(values);

  return changed;
}

function MGR_LREC_140_campaignEmails_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    sheet.getLastColumn()
  ).getValues();

  const seen = {};
  const emails = [];

  values.forEach(function(row) {
    const campaign = String(row[12] || '');
    const email =
      String(row[7] || '').trim().toLowerCase();

    if (
      campaign === MGR_LREC_140.CAMPAIGN &&
      email &&
      !seen[email]
    ) {
      seen[email] = true;
      emails.push(email);
    }
  });

  return emails;
}

function MGR_LREC_140_findProspect_(sheet, email) {
  if (!sheet || sheet.getLastRow() < 2) return null;

  const values = sheet.getDataRange().getValues();

  const headers = values[0].map(function(h) {
    return String(h || '').trim();
  });

  const map = {};

  headers.forEach(function(h, i) {
    map[
      String(h)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    ] = i;
  });

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    const rowEmail =
      String(row[map.email] || '')
        .trim()
        .toLowerCase();

    if (rowEmail !== email) continue;

    const sourceRecord = {};

    headers.forEach(function(h, j) {
      if (h) sourceRecord[h] = row[j];
    });

    return {
      row: i + 1,
      email: rowEmail,
      firstName: String(row[map.firstname] || '').trim(),
      lastName: String(row[map.lastname] || '').trim(),
      phone: String(row[map.phone] || '').trim(),
      credentialNumber:
        String(row[map.credentialnumber] || '').trim(),
      sourceRecord: sourceRecord
    };
  }

  return null;
}

function MGR_LREC_140_forEmailRows_(sheet, email, callback) {
  if (!sheet || sheet.getLastRow() < 2) return;

  const values = sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    sheet.getLastColumn()
  ).getValues();

  values.forEach(function(row, index) {
    const campaign = String(row[12] || '');
    const to =
      String(row[7] || '').trim().toLowerCase();

    if (
      campaign === MGR_LREC_140.CAMPAIGN &&
      to === email
    ) {
      callback(row, index + 2);
    }
  });
}

function MGR_LREC_140_cancelUnsentForEmail_(sheet, email, status) {
  MGR_LREC_140_forEmailRows_(
    sheet,
    email,
    function(row, sheetRow) {
      const current =
        String(row[3] || '').toUpperCase();

      if (current === 'SENT') return;

      sheet.getRange(sheetRow, 4).setValue(
        status || 'CANCELLED_LREC_LICENSED'
      );

      sheet.getRange(sheetRow, 5, 1, 2).clearContent();

      sheet.getRange(sheetRow, 17).setValue(
        'Blocked by hardened LREC gate: license record found.'
      );

      sheet.getRange(sheetRow, 19).setValue(
        new Date().toISOString()
      );
    }
  );
}

function MGR_LREC_140_certifyUnsentForEmail_(sheet, email) {
  MGR_LREC_140_forEmailRows_(
    sheet,
    email,
    function(row, sheetRow) {
      const current =
        String(row[3] || '').toUpperCase();

      if (
        current === 'SENT' ||
        current === 'CANCELLED_LREC_LICENSED'
      ) {
        return;
      }

      sheet.getRange(sheetRow, 4).setValue('LREC_CERTIFIED');
      sheet.getRange(sheetRow, 5, 1, 2).clearContent();
      sheet.getRange(sheetRow, 17).setValue('');
      sheet.getRange(sheetRow, 19).setValue(
        new Date().toISOString()
      );
    }
  );
}

function MGR_LREC_140_holdUnsentForEmail_(sheet, email, error) {
  MGR_LREC_140_forEmailRows_(
    sheet,
    email,
    function(row, sheetRow) {
      const current =
        String(row[3] || '').toUpperCase();

      if (current === 'SENT') return;

      sheet.getRange(sheetRow, 4).setValue('HOLD_LREC_RECHECK');
      sheet.getRange(sheetRow, 5, 1, 2).clearContent();

      sheet.getRange(sheetRow, 17).setValue(
        'Hardened LREC HOLD: ' + String(error || '')
      );

      sheet.getRange(sheetRow, 19).setValue(
        new Date().toISOString()
      );
    }
  );
}

function RUN_RECRUIT_140_CERTIFICATION() {
  const canary = RUN_LREC_140_CANARY_CERTIFICATION();

  const checks = [
    {
      name: 'CRM116_RECRUIT_INTERLOCK',
      pass:
        MGR_SENDER_POOL_VERSION === '1.1.0'
    },
    {
      name: 'STRICT_LREC_RESULT_PARSER',
      pass:
        typeof MGR_LREC_139 !== 'undefined' &&
        MGR_LREC_139.VERSION === '1.1.0'
    },
    {
      name: 'KNOWN_POSITIVE_NEGATIVE_CANARY',
      pass: canary.success === true
    },
    {
      name: 'HARDENED_AUDIT_PRESENT',
      pass:
        typeof RUN_RECRUIT_LREC_HARDENED_AUDIT === 'function'
    },
    {
      name: 'SEPARATE_RELEASE_GATE',
      pass:
        typeof RELEASE_RECRUIT_QUEUE_AFTER_LREC_HARDENED_AUDIT === 'function'
    }
  ];

  const result = {
    success:
      checks.every(function(c) {
        return c.pass === true;
      }),
    version: MGR_LREC_140.VERSION,
    checks: checks,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_140_CERTIFICATION\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
