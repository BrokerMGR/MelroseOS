/**
 * MelroseOS Sender Node
 * File: SENDER-01_MultiAccountCompliantWorker.gs
 * Version: 1.0.0
 *
 * Deploy one copy under EACH sending Google account.
 *
 * Each node:
 * - executes as its own Google account
 * - checks its own Google remaining daily quota
 * - obeys MelroseOS rolling 75-message/24h cap
 * - polls the shared CRM outbox
 * - sends only jobs assigned to its own email
 * - delivers through the MGRCORE global compliance library
 */

const MGR_SENDER_NODE = Object.freeze({
  CRM_WORKBOOK_ID:
    '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
  REGISTRY_SHEET: 'EMAIL_SENDER_REGISTRY',
  OUTBOX_SHEET: 'EMAIL_OUTBOX',
  LEDGER_SHEET: 'EMAIL_SEND_LEDGER',
  LOCAL_24H_CAP: 75,
  GOOGLE_QUOTA_RESERVE: 20,
  POLL_MINUTES: 5
});

function MGR_SENDER_NODE_install() {
  const email =
    MGR_SENDER_NODE_identity_();

  if (!email) {
    throw new Error(
      'Unable to determine sender account email.'
    );
  }

  MGR_SENDER_NODE_ensureTrigger_();

  const quota =
    MailApp.getRemainingDailyQuota();

  MGR_SENDER_NODE_heartbeat_(
    email,
    quota,
    true
  );

  return {
    success: true,
    senderEmail: email,
    googleQuotaRemaining: quota,
    local24hCount:
      MGR_SENDER_NODE_count24h_(email),
    local24hCap:
      MGR_SENDER_NODE.LOCAL_24H_CAP,
    triggerMinutes:
      MGR_SENDER_NODE.POLL_MINUTES,
    timestamp: new Date().toISOString()
  };
}

function MGR_SENDER_NODE_run() {
  const email =
    MGR_SENDER_NODE_identity_();

  if (!email) {
    throw new Error(
      'Sender identity unavailable.'
    );
  }

  const googleRemaining =
    MailApp.getRemainingDailyQuota();

  const localCount =
    MGR_SENDER_NODE_count24h_(email);

  MGR_SENDER_NODE_heartbeat_(
    email,
    googleRemaining,
    true
  );

  if (
    localCount >=
    MGR_SENDER_NODE.LOCAL_24H_CAP
  ) {
    return {
      success: true,
      sent: false,
      reason: 'LOCAL_75_CAP_REACHED',
      senderEmail: email,
      local24hCount: localCount
    };
  }

  if (
    googleRemaining <=
    MGR_SENDER_NODE.GOOGLE_QUOTA_RESERVE
  ) {
    return {
      success: true,
      sent: false,
      reason:
        'GOOGLE_QUOTA_RESERVE_PROTECTED',
      senderEmail: email,
      googleQuotaRemaining:
        googleRemaining
    };
  }

  const job =
    MGR_SENDER_NODE_nextAssignedJob_(
      email
    );

  if (!job) {
    return {
      success: true,
      sent: false,
      reason: 'NO_ASSIGNED_JOB',
      senderEmail: email
    };
  }

  try {
    const result =
      MGRCORE.MGR_CORE_sendCompliantEmail({
        to: job.to,
        cc: job.cc,
        bcc: job.bcc,
        subject: job.subject,
        htmlBody: job.htmlBody,
        messageClass:
          job.messageClass,
        campaign: job.campaign,
        message: {
          campaign: job.campaign,
          leadId: job.leadId,
          sequence: job.sequence,
          senderPoolMessageId:
            job.messageId
        }
      });

    MGR_SENDER_NODE_recordResult_({
      messageId: job.messageId,
      senderEmail: email,
      campaign: job.campaign,
      leadId: job.leadId,
      sequence: job.sequence,
      result: 'SENT',
      error: ''
    });

    MGR_SENDER_NODE_heartbeat_(
      email,
      MailApp.getRemainingDailyQuota(),
      true
    );

    return {
      success: true,
      sent: true,
      senderEmail: email,
      messageId: job.messageId,
      result: result
    };
  } catch (err) {
    const text = String(
      err && err.message
        ? err.message
        : err
    );

    const quotaLike =
      text.indexOf('EMAIL_QUOTA_PAUSED') >= 0 ||
      text.indexOf(
        'too many times for one day'
      ) >= 0;

    MGR_SENDER_NODE_recordResult_({
      messageId: job.messageId,
      senderEmail: email,
      campaign: job.campaign,
      leadId: job.leadId,
      sequence: job.sequence,
      result:
        quotaLike
          ? 'REQUEUE'
          : 'FAILED',
      error: text
    });

    return {
      success: false,
      sent: false,
      requeued: quotaLike,
      senderEmail: email,
      messageId: job.messageId,
      error: text
    };
  }
}

function MGR_SENDER_NODE_nextAssignedJob_(
  email
) {
  const ss = SpreadsheetApp.openById(
    MGR_SENDER_NODE.CRM_WORKBOOK_ID
  );

  const sheet = ss.getSheetByName(
    MGR_SENDER_NODE.OUTBOX_SHEET
  );

  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const data = sheet
    .getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      sheet.getLastColumn()
    )
    .getValues();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    if (
      String(row[3] || '')
        .toUpperCase() === 'ASSIGNED' &&
      String(row[4] || '')
        .toLowerCase() === email
    ) {
      sheet
        .getRange(i + 2, 4)
        .setValue('SENDING');

      sheet
        .getRange(i + 2, 7)
        .setValue(
          Number(row[6] || 0) + 1
        );

      return {
        row: i + 2,
        messageId: String(row[0] || ''),
        to: String(row[7] || ''),
        cc: String(row[8] || ''),
        bcc: String(row[9] || ''),
        subject: String(row[10] || ''),
        htmlBody: String(row[11] || ''),
        campaign: String(row[12] || ''),
        messageClass:
          String(row[13] || ''),
        leadId: String(row[14] || ''),
        sequence: String(row[15] || '')
      };
    }
  }

  return null;
}

function MGR_SENDER_NODE_recordResult_(r) {
  const ss = SpreadsheetApp.openById(
    MGR_SENDER_NODE.CRM_WORKBOOK_ID
  );

  const ledger = ss.getSheetByName(
    MGR_SENDER_NODE.LEDGER_SHEET
  );

  const outbox = ss.getSheetByName(
    MGR_SENDER_NODE.OUTBOX_SHEET
  );

  const now = new Date().toISOString();

  if (
    String(r.result).toUpperCase() ===
    'SENT'
  ) {
    ledger.appendRow([
      now,
      r.senderEmail,
      r.messageId,
      1,
      r.campaign || '',
      r.leadId || '',
      r.sequence || '',
      'SENT'
    ]);
  }

  const finder = outbox
    .getRange(
      2,
      1,
      Math.max(
        1,
        outbox.getLastRow() - 1
      ),
      1
    )
    .createTextFinder(
      String(r.messageId)
    )
    .matchEntireCell(true)
    .findNext();

  if (finder) {
    const row = finder.getRow();
    const result =
      String(r.result || '').toUpperCase();

    outbox
      .getRange(row, 4)
      .setValue(result);

    if (result === 'REQUEUE') {
      outbox.getRange(row, 5).setValue('');
      outbox.getRange(row, 6).setValue('');
    }

    outbox
      .getRange(row, 17)
      .setValue(String(r.error || ''));

    if (result === 'SENT') {
      outbox.getRange(row, 18).setValue(now);
    }

    outbox.getRange(row, 19).setValue(now);
  }
}

function MGR_SENDER_NODE_heartbeat_(
  email,
  quota,
  installed
) {
  const ss = SpreadsheetApp.openById(
    MGR_SENDER_NODE.CRM_WORKBOOK_ID
  );

  const registry = ss.getSheetByName(
    MGR_SENDER_NODE.REGISTRY_SHEET
  );

  if (!registry) {
    throw new Error(
      'EMAIL_SENDER_REGISTRY missing. ' +
      'Run MGR_SENDER_installPool in CRM first.'
    );
  }

  let row = 0;

  if (registry.getLastRow() >= 2) {
    const match = registry
      .getRange(
        2,
        1,
        registry.getLastRow() - 1,
        1
      )
      .createTextFinder(email)
      .matchEntireCell(true)
      .findNext();

    row = match ? match.getRow() : 0;
  }

  const now = new Date().toISOString();

  if (!row) {
    registry.appendRow([
      email,
      99,
      true,
      MGR_SENDER_NODE.LOCAL_24H_CAP,
      now,
      quota,
      '',
      installed !== false,
      'Auto-enrolled sender node',
      now
    ]);
    return;
  }

  registry.getRange(row, 5).setValue(now);
  registry.getRange(row, 6).setValue(quota);
  registry
    .getRange(row, 8)
    .setValue(installed !== false);
  registry.getRange(row, 10).setValue(now);
}

function MGR_SENDER_NODE_count24h_(email) {
  const ss = SpreadsheetApp.openById(
    MGR_SENDER_NODE.CRM_WORKBOOK_ID
  );

  const ledger = ss.getSheetByName(
    MGR_SENDER_NODE.LEDGER_SHEET
  );

  if (!ledger || ledger.getLastRow() < 2) {
    return 0;
  }

  const cutoff =
    Date.now() -
    24 * 60 * 60 * 1000;

  const values = ledger
    .getRange(
      2,
      1,
      ledger.getLastRow() - 1,
      2
    )
    .getValues();

  return values.filter(function(row) {
    return (
      String(row[1] || '')
        .toLowerCase() === email &&
      new Date(row[0]).getTime() >= cutoff
    );
  }).length;
}

function MGR_SENDER_NODE_identity_() {
  return String(
    Session.getEffectiveUser().getEmail() ||
    Session.getActiveUser().getEmail() ||
    ''
  )
    .trim()
    .toLowerCase();
}

function MGR_SENDER_NODE_ensureTrigger_() {
  const name = 'MGR_SENDER_NODE_run';

  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return (
        trigger.getHandlerFunction() ===
        name
      );
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger(name)
    .timeBased()
    .everyMinutes(
      MGR_SENDER_NODE.POLL_MINUTES
    )
    .create();
}
