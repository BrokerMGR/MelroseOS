/**
 * MelroseOS CRM
 * File: CRM-116_MultiAccountSenderPool.gs
 * Version: 1.0.0
 *
 * Central sender-pool controller.
 *
 * CRM owns:
 * - sender registry
 * - outbound queue
 * - dedupe state
 * - rolling 24-hour local send ledger
 * - sender selection / rotation
 *
 * Sender accounts own:
 * - their Google execution identity
 * - their Google Apps Script email quota
 * - actual compliant delivery through the CORE library
 */

const MGR_SENDER_POOL_VERSION = '1.0.0';

const MGR_SENDER_POOL = Object.freeze({
  CRM_WORKBOOK_ID:
    '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
  REGISTRY_SHEET: 'EMAIL_SENDER_REGISTRY',
  OUTBOX_SHEET: 'EMAIL_OUTBOX',
  LEDGER_SHEET: 'EMAIL_SEND_LEDGER',
  PER_ACCOUNT_24H_CAP: 75,
  GOOGLE_QUOTA_RESERVE: 20,
  WINDOW_HOURS: 24
});

const MGR_SENDER_DEFAULTS = Object.freeze([
  Object.freeze({
    email: 'melrosegrouprealty@gmail.com',
    priority: 1
  }),
  Object.freeze({
    email: 'melrosegroupstaff@gmail.com',
    priority: 2
  }),
  Object.freeze({
    email: 'melrosegroupleads@gmail.com',
    priority: 3
  }),
  Object.freeze({
    email: 'agentleadcentral@gmail.com',
    priority: 4
  })
]);

function MGR_SENDER_installPool() {
  const ss = SpreadsheetApp.openById(
    MGR_SENDER_POOL.CRM_WORKBOOK_ID
  );

  const registry = MGR_SENDER_ensureSheet_(
    ss,
    MGR_SENDER_POOL.REGISTRY_SHEET,
    [
      'SenderEmail',
      'Priority',
      'Active',
      'Local24hCap',
      'LastHeartbeatAt',
      'GoogleQuotaRemaining',
      'LastAssignedAt',
      'NodeInstalled',
      'Notes',
      'UpdatedAt'
    ]
  );

  MGR_SENDER_ensureSheet_(
    ss,
    MGR_SENDER_POOL.OUTBOX_SHEET,
    [
      'MessageID',
      'DedupeKey',
      'CreatedAt',
      'Status',
      'AssignedSender',
      'AssignedAt',
      'AttemptCount',
      'To',
      'Cc',
      'Bcc',
      'Subject',
      'HtmlBody',
      'Campaign',
      'MessageClass',
      'LeadID',
      'Sequence',
      'LastError',
      'SentAt',
      'UpdatedAt'
    ]
  );

  MGR_SENDER_ensureSheet_(
    ss,
    MGR_SENDER_POOL.LEDGER_SHEET,
    [
      'SentAt',
      'SenderEmail',
      'MessageID',
      'RecipientCost',
      'Campaign',
      'LeadID',
      'Sequence',
      'Result'
    ]
  );

  MGR_SENDER_DEFAULTS.forEach(function(sender) {
    MGR_SENDER_upsertRegistry_(
      registry,
      sender.email,
      sender.priority,
      true,
      MGR_SENDER_POOL.PER_ACCOUNT_24H_CAP,
      false,
      'Default production sender'
    );
  });

  return MGR_SENDER_getPoolStatus();
}

function MGR_SENDER_addAccount(email, priority) {
  const normalized =
    MGR_SENDER_normalizeEmail_(email);

  if (!MGR_SENDER_validEmail_(normalized)) {
    throw new Error('Valid sender email required.');
  }

  const ss = SpreadsheetApp.openById(
    MGR_SENDER_POOL.CRM_WORKBOOK_ID
  );

  const registry = MGR_SENDER_ensureSheet_(
    ss,
    MGR_SENDER_POOL.REGISTRY_SHEET,
    [
      'SenderEmail','Priority','Active','Local24hCap',
      'LastHeartbeatAt','GoogleQuotaRemaining',
      'LastAssignedAt','NodeInstalled','Notes','UpdatedAt'
    ]
  );

  MGR_SENDER_upsertRegistry_(
    registry,
    normalized,
    Number(priority || 99),
    true,
    MGR_SENDER_POOL.PER_ACCOUNT_24H_CAP,
    false,
    'Added sender'
  );

  return MGR_SENDER_getPoolStatus();
}

function MGR_SENDER_enqueue(message) {
  const m = message || {};
  const to = String(m.to || '').trim();
  const subject = String(m.subject || '').trim();
  const html = String(m.htmlBody || '').trim();

  if (!to || !subject || !html) {
    throw new Error(
      'EMAIL_OUTBOX_INVALID: to, subject and htmlBody are required.'
    );
  }

  const ss = SpreadsheetApp.openById(
    MGR_SENDER_POOL.CRM_WORKBOOK_ID
  );

  const outbox = ss.getSheetByName(
    MGR_SENDER_POOL.OUTBOX_SHEET
  );

  if (!outbox) {
    MGR_SENDER_installPool();
    return MGR_SENDER_enqueue(message);
  }

  const now = new Date().toISOString();
  const messageId =
    String(m.messageId || MGR_SENDER_uuid_()).trim();

  const dedupeKey = String(
    m.dedupeKey ||
    [
      String(m.campaign || ''),
      String(m.leadId || ''),
      String(m.sequence || ''),
      to.toLowerCase(),
      subject
    ].join('|')
  ).trim();

  const duplicate =
    MGR_SENDER_findOutboxByDedupe_(outbox, dedupeKey);

  if (duplicate) {
    return {
      success: true,
      queued: false,
      duplicate: true,
      messageId: duplicate.messageId,
      dedupeKey: dedupeKey
    };
  }

  outbox.appendRow([
    messageId,
    dedupeKey,
    now,
    'PENDING',
    '',
    '',
    0,
    to,
    String(m.cc || ''),
    String(m.bcc || ''),
    subject,
    html,
    String(m.campaign || ''),
    String(m.messageClass || m.campaign || 'STANDARD'),
    String(m.leadId || ''),
    String(m.sequence || ''),
    '',
    '',
    now
  ]);

  MGR_SENDER_routePendingQueue();

  return {
    success: true,
    queued: true,
    duplicate: false,
    messageId: messageId,
    dedupeKey: dedupeKey
  };
}

function MGR_SENDER_routePendingQueue() {
  const ss = SpreadsheetApp.openById(
    MGR_SENDER_POOL.CRM_WORKBOOK_ID
  );

  const outbox = ss.getSheetByName(
    MGR_SENDER_POOL.OUTBOX_SHEET
  );

  if (!outbox || outbox.getLastRow() < 2) {
    return {
      success: true,
      assigned: 0
    };
  }

  const data = outbox
    .getRange(
      2,
      1,
      outbox.getLastRow() - 1,
      outbox.getLastColumn()
    )
    .getValues();

  let assigned = 0;

  data.forEach(function(row, index) {
    const status =
      String(row[3] || '').toUpperCase();

    if (
      status !== 'PENDING' &&
      status !== 'REQUEUE'
    ) {
      return;
    }

    const sender =
      MGR_SENDER_selectAvailableSender();

    if (!sender) {
      return;
    }

    const sheetRow = index + 2;
    const now = new Date().toISOString();

    outbox.getRange(sheetRow, 4).setValue('ASSIGNED');
    outbox.getRange(sheetRow, 5).setValue(sender.email);
    outbox.getRange(sheetRow, 6).setValue(now);
    outbox.getRange(sheetRow, 19).setValue(now);

    MGR_SENDER_touchAssigned_(sender.email, now);

    assigned += 1;
  });

  return {
    success: true,
    assigned: assigned,
    timestamp: new Date().toISOString()
  };
}

function MGR_SENDER_selectAvailableSender() {
  const status = MGR_SENDER_getPoolStatus();

  const eligible = status.senders
    .filter(function(sender) {
      return (
        sender.active === true &&
        sender.nodeInstalled === true &&
        sender.local24hCount <
          sender.local24hCap &&
        sender.googleQuotaRemaining >
          MGR_SENDER_POOL.GOOGLE_QUOTA_RESERVE
      );
    })
    .sort(function(a, b) {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return String(a.lastAssignedAt || '')
        .localeCompare(
          String(b.lastAssignedAt || '')
        );
    });

  return eligible.length ? eligible[0] : null;
}

function MGR_SENDER_getPoolStatus() {
  const ss = SpreadsheetApp.openById(
    MGR_SENDER_POOL.CRM_WORKBOOK_ID
  );

  let registry = ss.getSheetByName(
    MGR_SENDER_POOL.REGISTRY_SHEET
  );

  if (!registry) {
    return MGR_SENDER_installPool();
  }

  const values =
    registry.getLastRow() >= 2
      ? registry
          .getRange(
            2,
            1,
            registry.getLastRow() - 1,
            registry.getLastColumn()
          )
          .getValues()
      : [];

  const senders = values
    .filter(function(row) {
      return String(row[0] || '').trim();
    })
    .map(function(row) {
      const email =
        MGR_SENDER_normalizeEmail_(row[0]);

      return {
        email: email,
        priority: Number(row[1] || 99),
        active:
          row[2] === true ||
          String(row[2]).toUpperCase() === 'TRUE',
        local24hCap:
          Number(
            row[3] ||
            MGR_SENDER_POOL.PER_ACCOUNT_24H_CAP
          ),
        local24hCount:
          MGR_SENDER_countLast24h_(email),
        lastHeartbeatAt:
          String(row[4] || ''),
        googleQuotaRemaining:
          Number(row[5] || 0),
        lastAssignedAt:
          String(row[6] || ''),
        nodeInstalled:
          row[7] === true ||
          String(row[7]).toUpperCase() === 'TRUE',
        notes: String(row[8] || '')
      };
    });

  return {
    success: true,
    version: MGR_SENDER_POOL_VERSION,
    perAccount24hCap:
      MGR_SENDER_POOL.PER_ACCOUNT_24H_CAP,
    googleQuotaReserve:
      MGR_SENDER_POOL.GOOGLE_QUOTA_RESERVE,
    senders: senders,
    timestamp: new Date().toISOString()
  };
}

function MGR_SENDER_heartbeat(
  email,
  googleQuotaRemaining,
  nodeInstalled
) {
  const normalized =
    MGR_SENDER_normalizeEmail_(email);

  const ss = SpreadsheetApp.openById(
    MGR_SENDER_POOL.CRM_WORKBOOK_ID
  );

  const registry = ss.getSheetByName(
    MGR_SENDER_POOL.REGISTRY_SHEET
  );

  if (!registry) {
    MGR_SENDER_installPool();
    return MGR_SENDER_heartbeat(
      normalized,
      googleQuotaRemaining,
      nodeInstalled
    );
  }

  const row =
    MGR_SENDER_findRegistryRow_(
      registry,
      normalized
    );

  if (!row) {
    MGR_SENDER_addAccount(normalized, 99);
    return MGR_SENDER_heartbeat(
      normalized,
      googleQuotaRemaining,
      nodeInstalled
    );
  }

  const now = new Date().toISOString();

  registry.getRange(row, 5).setValue(now);
  registry
    .getRange(row, 6)
    .setValue(
      Number(googleQuotaRemaining || 0)
    );
  registry
    .getRange(row, 8)
    .setValue(nodeInstalled !== false);
  registry.getRange(row, 10).setValue(now);

  MGR_SENDER_routePendingQueue();

  return {
    success: true,
    sender: normalized,
    googleQuotaRemaining:
      Number(googleQuotaRemaining || 0),
    local24hCount:
      MGR_SENDER_countLast24h_(normalized),
    timestamp: now
  };
}

function MGR_SENDER_recordDelivery(result) {
  const r = result || {};
  const email =
    MGR_SENDER_normalizeEmail_(
      r.senderEmail
    );

  if (!email || !r.messageId) {
    throw new Error(
      'senderEmail and messageId required.'
    );
  }

  const ss = SpreadsheetApp.openById(
    MGR_SENDER_POOL.CRM_WORKBOOK_ID
  );

  const ledger = ss.getSheetByName(
    MGR_SENDER_POOL.LEDGER_SHEET
  );

  const outbox = ss.getSheetByName(
    MGR_SENDER_POOL.OUTBOX_SHEET
  );

  const now = String(
    r.sentAt || new Date().toISOString()
  );

  ledger.appendRow([
    now,
    email,
    String(r.messageId),
    Number(r.recipientCost || 1),
    String(r.campaign || ''),
    String(r.leadId || ''),
    String(r.sequence || ''),
    String(r.result || 'SENT')
  ]);

  if (outbox && outbox.getLastRow() >= 2) {
    const finder = outbox
      .getRange(
        2,
        1,
        outbox.getLastRow() - 1,
        1
      )
      .createTextFinder(String(r.messageId))
      .matchEntireCell(true)
      .findNext();

    if (finder) {
      const row = finder.getRow();

      outbox
        .getRange(row, 4)
        .setValue(
          String(r.result || 'SENT')
        );

      outbox
        .getRange(row, 17)
        .setValue(
          String(r.error || '')
        );

      if (
        String(r.result || 'SENT')
          .toUpperCase() === 'SENT'
      ) {
        outbox.getRange(row, 18).setValue(now);
      }

      outbox
        .getRange(row, 19)
        .setValue(new Date().toISOString());
    }
  }

  MGR_SENDER_routePendingQueue();

  return {
    success: true,
    senderEmail: email,
    local24hCount:
      MGR_SENDER_countLast24h_(email),
    local24hCap:
      MGR_SENDER_POOL.PER_ACCOUNT_24H_CAP
  };
}

function MGR_RECRUIT_queueFirstFiveTestsToBroker() {
  if (
    typeof MGR_RECRUIT_getFirstFive_ !==
    'function'
  ) {
    throw new Error(
      'CRM-114 recruit sequence is required.'
    );
  }

  MGR_SENDER_installPool();

  const recipient =
    'melrosegroupbroker@gmail.com';

  const lead = {
    firstName: 'Ulysses',
    credentialNumber:
      '[TEST - Credential Number]',
    applicationDate:
      '[TEST - Application Date]'
  };

  const messages =
    MGR_RECRUIT_getFirstFive_(lead);

  const results = messages.map(
    function(message, index) {
      return MGR_SENDER_enqueue({
        to: recipient,
        subject:
          '[RECRUIT TEST ' +
          (index + 1) +
          '/5] ' +
          message.subject,
        htmlBody: message.html,
        campaign:
          'RECRUIT_MENTORSHIP',
        messageClass: 'RECRUITING',
        leadId: 'TEST-BROKER',
        sequence: index + 1,
        dedupeKey:
          'RECRUIT-TEST-' +
          (index + 1) +
          '-' +
          new Date()
            .toISOString()
            .slice(0, 10)
      });
    }
  );

  return {
    success: true,
    recipient: recipient,
    queued: results.length,
    results: results,
    pool: MGR_SENDER_getPoolStatus()
  };
}

function MGR_SENDER_countLast24h_(email) {
  const ss = SpreadsheetApp.openById(
    MGR_SENDER_POOL.CRM_WORKBOOK_ID
  );

  const ledger = ss.getSheetByName(
    MGR_SENDER_POOL.LEDGER_SHEET
  );

  if (!ledger || ledger.getLastRow() < 2) {
    return 0;
  }

  const cutoff =
    Date.now() -
    MGR_SENDER_POOL.WINDOW_HOURS *
      60 *
      60 *
      1000;

  const values = ledger
    .getRange(
      2,
      1,
      ledger.getLastRow() - 1,
      2
    )
    .getValues();

  return values.filter(function(row) {
    const sentAt =
      new Date(row[0]).getTime();

    const sender =
      MGR_SENDER_normalizeEmail_(row[1]);

    return (
      sender === email &&
      isFinite(sentAt) &&
      sentAt >= cutoff
    );
  }).length;
}

function MGR_SENDER_touchAssigned_(email, when) {
  const ss = SpreadsheetApp.openById(
    MGR_SENDER_POOL.CRM_WORKBOOK_ID
  );

  const registry = ss.getSheetByName(
    MGR_SENDER_POOL.REGISTRY_SHEET
  );

  const row =
    MGR_SENDER_findRegistryRow_(
      registry,
      email
    );

  if (row) {
    registry.getRange(row, 7).setValue(when);
    registry
      .getRange(row, 10)
      .setValue(new Date().toISOString());
  }
}

function MGR_SENDER_upsertRegistry_(
  sheet,
  email,
  priority,
  active,
  cap,
  installed,
  notes
) {
  const normalized =
    MGR_SENDER_normalizeEmail_(email);

  const row =
    MGR_SENDER_findRegistryRow_(
      sheet,
      normalized
    );

  const now = new Date().toISOString();

  const values = [
    normalized,
    Number(priority || 99),
    active !== false,
    Number(
      cap ||
      MGR_SENDER_POOL.PER_ACCOUNT_24H_CAP
    ),
    '',
    0,
    '',
    installed === true,
    String(notes || ''),
    now
  ];

  if (row) {
    const current =
      sheet.getRange(row, 1, 1, 10)
        .getValues()[0];

    values[4] = current[4];
    values[5] = current[5];
    values[6] = current[6];
    values[7] = current[7] || values[7];

    sheet
      .getRange(row, 1, 1, values.length)
      .setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function MGR_SENDER_findRegistryRow_(
  sheet,
  email
) {
  if (!sheet || sheet.getLastRow() < 2) {
    return 0;
  }

  const match = sheet
    .getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      1
    )
    .createTextFinder(
      MGR_SENDER_normalizeEmail_(email)
    )
    .matchEntireCell(true)
    .findNext();

  return match ? match.getRow() : 0;
}

function MGR_SENDER_findOutboxByDedupe_(
  sheet,
  dedupeKey
) {
  if (!dedupeKey || sheet.getLastRow() < 2) {
    return null;
  }

  const match = sheet
    .getRange(
      2,
      2,
      sheet.getLastRow() - 1,
      1
    )
    .createTextFinder(String(dedupeKey))
    .matchEntireCell(true)
    .findNext();

  if (!match) return null;

  return {
    row: match.getRow(),
    messageId:
      String(
        sheet.getRange(
          match.getRow(),
          1
        ).getValue()
      )
  };
}

function MGR_SENDER_ensureSheet_(
  ss,
  name,
  headers
) {
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([headers]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}

function MGR_SENDER_normalizeEmail_(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function MGR_SENDER_validEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    MGR_SENDER_normalizeEmail_(value)
  );
}

function MGR_SENDER_uuid_() {
  return Utilities.getUuid();
}
