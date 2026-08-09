/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-009_GmailSender
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Controlled production sender.
 * Requires explicit production enablement through Script Properties.
 * Enforces Monday-Saturday, 10:00 AM-4:00 PM Central, non-holiday policy.
 */

function REC_isProductionEnabled_() {
  const props = PropertiesService.getScriptProperties();
  return (
    String(props.getProperty('REC_PRODUCTION_ENABLED') || '').toUpperCase() === 'TRUE' &&
    String(props.getProperty('REC_PRODUCTION_APPROVED') || '').toUpperCase() === 'TRUE'
  );
}

function REC_assertProductionSendAllowed_() {
  if (!REC_isProductionEnabled_()) {
    throw new Error(
      'Production recruiting email is disabled. Both REC_PRODUCTION_ENABLED and REC_PRODUCTION_APPROVED must be TRUE.'
    );
  }

  const effective = REC_normalizeEmail(Session.getEffectiveUser().getEmail());
  const expected = REC_normalizeEmail(REC_CONFIG.senderAccount);

  if (effective && effective !== expected) {
    throw new Error(
      'Recruiting sender must execute as ' + expected + '. Effective user is ' + effective + '.'
    );
  }

  const now = REC_now();
  if (!REC_isWithinSendWindow(now)) {
    throw new Error(
      'Recruiting email may only send Monday-Saturday between 10:00 AM and 4:00 PM Central on non-holidays.'
    );
  }

  return true;
}

function REC_getRecruitByRow_(rowNumber) {
  const sheet = REC_getRecruitingSheet();
  const source = REC_resolveSourceColumns(sheet);
  const headerMap = REC_getHeaderMap(sheet);
  const lastColumn = sheet.getLastColumn();

  if (rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error('Recruit row number is out of range.');
  }

  const row = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
  return REC_mapSheetRowToRecruit(row, rowNumber, source.resolved, headerMap);
}

function REC_setSystemValueByRow_(sheet, rowNumber, columnName, value) {
  const col = REC_getSystemHeaderColumn_(sheet, columnName);
  if (!col) throw new Error('Missing system column: ' + columnName);
  sheet.getRange(rowNumber, col).setValue(value);
}

function REC_recordSuccessfulSend_(recruit, templateId) {
  const sheet = REC_getRecruitingSheet();
  const now = REC_now();
  const next = REC_calculateNextTouch(now);

  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'RecruitStage', 'NURTURING');
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'CampaignStatus', 'ACTIVE');
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'SequenceNumber', Number(recruit.sequenceNumber || 0) + 1);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'LastEmailSent', now);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'NextEmailDate', next);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'EmailCount', Number(recruit.emailCount || 0) + 1);
  REC_setSystemValueByRow_(sheet, recruit.rowNumber, 'LastTemplateSent', templateId || 'PRELICENSE_BASE');
}

function REC_sendRecruitByRow(rowNumber) {
  REC_assertProductionSendAllowed_();

  const recruit = REC_getRecruitByRow_(Number(rowNumber));
  const all = REC_readRecruitRows(10000);
  const duplicateIndex = REC_buildDuplicateIndex(all);
  const duplicateReasons = REC_findDuplicateReasons(recruit, duplicateIndex);
  const gate = REC_canSendRecruitingMessage(recruit, duplicateReasons, REC_now());

  if (!gate.allowed) {
    throw new Error(
      'Recruit is not eligible to send: ' +
      JSON.stringify(gate.suppression.reasons || ['OUTSIDE_SEND_WINDOW'])
    );
  }

  const assets = REC_getBrandAssetBlobs();
  const email = REC_buildPreLicenseEmail(recruit, {
    logoCid: 'mgrLogo',
    businessCardCid: 'brokerCard',
    consultationUrl: 'https://melrosegrouprealty.com/book-now',
    academyUrl: 'https://melrosegrouprealty.com',
    unsubscribeUrl: 'https://melrosegrouprealty.com'
  });

  GmailApp.sendEmail(
    recruit.email,
    email.subject,
    email.plainText,
    {
      htmlBody: email.html,
      inlineImages: assets,
      name: 'Melrose Group Realty',
      replyTo: REC_CONFIG.senderAccount
    }
  );

  REC_recordSuccessfulSend_(recruit, 'PRELICENSE_BASE');

  REC_log('PASS', 'REC-009_GmailSender', 'Recruiting email sent.', {
    recruitId: recruit.recruitId,
    rowNumber: recruit.rowNumber,
    email: recruit.email
  });

  return REC_result(true, {
    recruitId: recruit.recruitId,
    rowNumber: recruit.rowNumber,
    email: recruit.email,
    sentAt: REC_formatDateTime(REC_now())
  });
}

function REC_sendDueRecruitBatch(maxCount) {
  REC_assertProductionSendAllowed_();

  const cap = Math.max(1, Math.min(Number(maxCount || 10), 25));
  const queue = REC_buildCampaignQueue(10000);

  const due = (queue.data.queue || []).filter(function(item) {
    return item.sendNowAllowed;
  }).slice(0, cap);

  const results = [];

  due.forEach(function(item) {
    try {
      results.push({
        rowNumber: item.rowNumber,
        result: REC_sendRecruitByRow(item.rowNumber)
      });
    } catch (e) {
      REC_log('FAIL', 'REC-009_GmailSender', 'Send failed.', {
        rowNumber: item.rowNumber,
        error: e.message
      });

      results.push({
        rowNumber: item.rowNumber,
        result: REC_result(false, null, e.message)
      });
    }
  });

  return REC_result(true, {
    requestedMax: cap,
    attempted: due.length,
    results: results
  });
}
