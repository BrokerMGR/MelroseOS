/**
 * MelroseOS Recruiting
 * File: RECRUIT-01_LREC_AffiliationMigration.gs
 * Release: MOS5-RECRUIT-01
 * Version: 1.0.0
 *
 * Purpose:
 * - Migrate New/Pending Agent recruiting leads to Active Agents immediately
 *   when LREC verification shows a brokerage affiliation.
 * - Prevent any future New Agent communication after affiliation is detected.
 * - Preserve the complete lead record plus transition metadata.
 * - Provide a daily 1 PM Central verification trigger.
 *
 * IMPORTANT INTEGRATION:
 * Existing LREC verification code can call:
 *
 *   MGR_LREC_handleVerificationResult(verificationResult)
 *
 * after each license lookup.
 *
 * Expected verificationResult fields (aliases supported):
 *   credentialNumber / licenseNumber / credential / license
 *   email
 *   phone
 *   affiliated (boolean)
 *   brokerageName / brokerage / company
 *   raw / metadata
 */

const MGR_LREC_PATCH_VERSION = '1.0.0';

const MGR_LREC_CONFIG = Object.freeze({
  ACTIVE_AGENT_WORKBOOK_ID: '1_IFq26kN310GZtuKDCFKTuDqxD2kx-ntlqio1bp1L0c',
  ACTIVE_AGENT_TAB: 'Active Agents',
  AUDIT_TAB: 'LREC_AFFILIATION_AUDIT',

  // Source New/Pending workbook is intentionally read from Script Properties
  // so this patch can attach to the current recruiting deployment without
  // hardcoding an unverified workbook ID.
  NEW_AGENT_WORKBOOK_PROPERTY: 'MGR_NEW_AGENT_WORKBOOK_ID',
  NEW_AGENT_TAB_PROPERTY: 'MGR_NEW_AGENT_TAB_NAME',
  DEFAULT_NEW_AGENT_TAB: 'New Agents',

  // Name of the already-existing LREC verifier function.
  // Configure once with:
  // MGR_LREC_setVerifierFunction('YOUR_EXISTING_FUNCTION_NAME')
  VERIFIER_FUNCTION_PROPERTY: 'MGR_LREC_VERIFIER_FUNCTION',

  DAILY_TRIGGER_FUNCTION: 'MGR_LREC_runDailyAffiliationSweep',
  DAILY_TRIGGER_HOUR: 13,
  DAILY_TRIGGER_NEAR_MINUTE: 15,

  TRANSITION_STATUS: 'ACTIVE_AGENT',
  PREVIOUS_SEGMENT: 'NEW_AGENT'
});

/**
 * Primary integration hook.
 *
 * Call this immediately after any LREC lookup. If the agent is now affiliated,
 * this function moves the complete lead record to Active Agents and removes it
 * from the New Agent operational sheet.
 *
 * @param {Object} verificationResult
 * @return {Object}
 */
function MGR_LREC_handleVerificationResult(verificationResult) {
  MGR_LREC_assertObject_(verificationResult, 'verificationResult');

  const normalized = MGR_LREC_normalizeVerification_(verificationResult);

  if (!normalized.affiliated) {
    return {
      success: true,
      moved: false,
      reason: 'NOT_AFFILIATED',
      credentialNumber: normalized.credentialNumber || ''
    };
  }

  return MGR_LREC_migrateAffiliatedAgent_(normalized);
}

/**
 * Daily sweep of all New/Pending Agent rows.
 *
 * Uses the currently configured verifier function, then immediately migrates
 * any lead that is now affiliated.
 *
 * @return {Object}
 */
function MGR_LREC_runDailyAffiliationSweep() {
  const startedAt = new Date();
  const source = MGR_LREC_getNewAgentSource_();
  const sheet = source.sheet;
  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    return {
      success: true,
      checked: 0,
      moved: 0,
      failed: 0,
      message: 'No New/Pending Agent rows found.',
      timestamp: startedAt.toISOString()
    };
  }

  const headers = values[0].map(MGR_LREC_header_);
  const credentialColumn = MGR_LREC_findHeaderIndex_(headers, [
    'Credential Number',
    'CredentialNumber',
    'License Number',
    'LicenseNumber',
    'Credential',
    'License'
  ]);

  if (credentialColumn < 0) {
    throw new Error(
      'New Agent sheet must contain Credential Number or License Number.'
    );
  }

  const results = [];
  let checked = 0;
  let moved = 0;
  let failed = 0;

  // Bottom-up because successful migrations delete source rows.
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
    const rowValues = values[rowIndex];

    if (MGR_LREC_rowIsBlank_(rowValues)) {
      continue;
    }

    const rowObject = MGR_LREC_rowToObject_(headers, rowValues);
    const credential = String(rowValues[credentialColumn] || '').trim();

    if (!credential) {
      results.push({
        row: rowIndex + 1,
        success: false,
        moved: false,
        reason: 'MISSING_CREDENTIAL'
      });
      failed++;
      continue;
    }

    checked++;

    try {
      const verification = MGR_LREC_callConfiguredVerifier_(
        credential,
        rowObject
      );

      const normalized = MGR_LREC_normalizeVerification_(
        MGR_LREC_merge_(
          verification || {},
          {
            credentialNumber: credential,
            sourceRow: rowIndex + 1,
            sourceRecord: rowObject
          }
        )
      );

      if (normalized.affiliated) {
        const transition = MGR_LREC_migrateAffiliatedAgent_(
          normalized,
          rowIndex + 1,
          rowObject
        );

        if (transition.moved) {
          moved++;
        }

        results.push(transition);
      } else {
        results.push({
          row: rowIndex + 1,
          success: true,
          moved: false,
          credentialNumber: credential,
          reason: 'STILL_UNAFFILIATED'
        });
      }
    } catch (err) {
      failed++;

      const failure = {
        row: rowIndex + 1,
        success: false,
        moved: false,
        credentialNumber: credential,
        error: err && err.message ? String(err.message) : String(err)
      };

      results.push(failure);
      MGR_LREC_log_('ERROR', 'DAILY_SWEEP_ROW', failure);
    }
  }

  const report = {
    success: failed === 0,
    checked: checked,
    moved: moved,
    failed: failed,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    results: results
  };

  MGR_LREC_log_(
    report.success ? 'INFO' : 'WARN',
    'DAILY_SWEEP_COMPLETE',
    report
  );

  return report;
}

/**
 * Hard stop for New Agent communications.
 *
 * Add this guard immediately before every New Agent send:
 *
 *   MGR_LREC_assertNewAgentCommunicationAllowed(lead)
 *
 * @param {Object} lead
 * @return {boolean}
 */
function MGR_LREC_assertNewAgentCommunicationAllowed(lead) {
  MGR_LREC_assertObject_(lead, 'lead');

  const credential = MGR_LREC_first_(lead, [
    'Credential Number',
    'CredentialNumber',
    'License Number',
    'LicenseNumber',
    'Credential',
    'License'
  ]);

  const email = MGR_LREC_first_(lead, ['Email', 'email']);
  const phone = MGR_LREC_first_(lead, ['Phone', 'phone']);

  if (
    MGR_LREC_isAlreadyActive_({
      credentialNumber: credential,
      email: email,
      phone: phone
    })
  ) {
    throw new Error(
      'NEW_AGENT_SEND_BLOCKED: Agent is already in Active Agents.'
    );
  }

  return true;
}

/**
 * Non-throwing version for queue filters.
 *
 * @param {Object} lead
 * @return {boolean}
 */
function MGR_LREC_canSendNewAgentCommunication(lead) {
  try {
    return MGR_LREC_assertNewAgentCommunicationAllowed(lead) === true;
  } catch (err) {
    return false;
  }
}

/**
 * Install/replace the daily LREC affiliation sweep trigger.
 *
 * Runs daily at approximately 1:15 PM Central, safely within the requested
 * 1 PM–9 PM verification window.
 *
 * @return {Object}
 */
function MGR_LREC_installDailyTrigger() {
  const functionName = MGR_LREC_CONFIG.DAILY_TRIGGER_FUNCTION;

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(MGR_LREC_CONFIG.DAILY_TRIGGER_HOUR)
    .nearMinute(MGR_LREC_CONFIG.DAILY_TRIGGER_NEAR_MINUTE)
    .everyDays(1)
    .inTimezone('America/Chicago')
    .create();

  return {
    success: true,
    functionName: functionName,
    hour: MGR_LREC_CONFIG.DAILY_TRIGGER_HOUR,
    nearMinute: MGR_LREC_CONFIG.DAILY_TRIGGER_NEAR_MINUTE,
    timezone: 'America/Chicago'
  };
}

/**
 * Store the name of the currently-existing LREC verifier function.
 *
 * The verifier will be called as:
 *   verifier(credentialNumber, rowObject)
 *
 * @param {string} functionName
 * @return {Object}
 */
function MGR_LREC_setVerifierFunction(functionName) {
  if (!functionName || !String(functionName).trim()) {
    throw new Error('Verifier function name is required.');
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(
      MGR_LREC_CONFIG.VERIFIER_FUNCTION_PROPERTY,
      String(functionName).trim()
    );

  return {
    success: true,
    verifierFunction: String(functionName).trim()
  };
}

/**
 * Configure the New/Pending Agent workbook and tab.
 *
 * @param {string} workbookId
 * @param {string=} tabName
 * @return {Object}
 */
function MGR_LREC_setNewAgentSource(workbookId, tabName) {
  if (!workbookId || !String(workbookId).trim()) {
    throw new Error('New Agent workbook ID is required.');
  }

  const props = PropertiesService.getScriptProperties();

  props.setProperty(
    MGR_LREC_CONFIG.NEW_AGENT_WORKBOOK_PROPERTY,
    String(workbookId).trim()
  );

  props.setProperty(
    MGR_LREC_CONFIG.NEW_AGENT_TAB_PROPERTY,
    String(tabName || MGR_LREC_CONFIG.DEFAULT_NEW_AGENT_TAB).trim()
  );

  return MGR_LREC_getNewAgentSourceConfig();
}

/**
 * Return configured source details.
 *
 * @return {Object}
 */
function MGR_LREC_getNewAgentSourceConfig() {
  const props = PropertiesService.getScriptProperties();

  return {
    workbookId:
      props.getProperty(
        MGR_LREC_CONFIG.NEW_AGENT_WORKBOOK_PROPERTY
      ) || '',
    tabName:
      props.getProperty(
        MGR_LREC_CONFIG.NEW_AGENT_TAB_PROPERTY
      ) || MGR_LREC_CONFIG.DEFAULT_NEW_AGENT_TAB
  };
}

/**
 * Diagnostics without modifying recruiting rows.
 *
 * @return {Object}
 */
function MGR_LREC_affiliationPatchDiagnostics() {
  const sourceConfig = MGR_LREC_getNewAgentSourceConfig();

  let sourceReady = false;
  let sourceError = '';

  try {
    if (sourceConfig.workbookId) {
      MGR_LREC_getNewAgentSource_();
      sourceReady = true;
    }
  } catch (err) {
    sourceError = err && err.message ? String(err.message) : String(err);
  }

  const verifierName =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        MGR_LREC_CONFIG.VERIFIER_FUNCTION_PROPERTY
      ) || '';

  const triggerCount =
    ScriptApp.getProjectTriggers()
      .filter(function (trigger) {
        return (
          trigger.getHandlerFunction() ===
          MGR_LREC_CONFIG.DAILY_TRIGGER_FUNCTION
        );
      })
      .length;

  return {
    success:
      !!sourceConfig.workbookId &&
      sourceReady &&
      !!verifierName &&
      triggerCount === 1,
    version: MGR_LREC_PATCH_VERSION,
    activeAgentWorkbookId:
      MGR_LREC_CONFIG.ACTIVE_AGENT_WORKBOOK_ID,
    newAgentSource: sourceConfig,
    sourceReady: sourceReady,
    sourceError: sourceError,
    verifierFunction: verifierName,
    dailyTriggerCount: triggerCount,
    timestamp: new Date().toISOString()
  };
}

/**
 * Internal migration.
 *
 * @private
 */
function MGR_LREC_migrateAffiliatedAgent_(
  normalized,
  explicitSourceRow,
  explicitSourceRecord
) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (MGR_LREC_isAlreadyActive_(normalized)) {
      const duplicateSource = MGR_LREC_findSourceLead_(
        normalized,
        explicitSourceRow,
        explicitSourceRecord
      );

      if (duplicateSource && duplicateSource.row > 1) {
        duplicateSource.sheet.deleteRow(duplicateSource.row);
      }

      return {
        success: true,
        moved: false,
        alreadyActive: true,
        sourceRemoved: !!duplicateSource,
        credentialNumber: normalized.credentialNumber || '',
        reason: 'ALREADY_ACTIVE'
      };
    }

    const source = MGR_LREC_findSourceLead_(
      normalized,
      explicitSourceRow,
      explicitSourceRecord
    );

    if (!source) {
      throw new Error(
        'Affiliated agent was verified but no matching New Agent row was found.'
      );
    }

    const destination = MGR_LREC_getActiveAgentSheet_();
    const snapshot = MGR_LREC_merge_(
      {},
      source.record,
      {
        RecruitingSegment: MGR_LREC_CONFIG.TRANSITION_STATUS,
        PreviousRecruitingSegment: MGR_LREC_CONFIG.PREVIOUS_SEGMENT,
        AffiliationDetectedAt: new Date().toISOString(),
        LRECVerifiedAt: normalized.verifiedAt,
        AffiliatedBrokerage: normalized.brokerageName || '',
        LRECCredentialNumber:
          normalized.credentialNumber || '',
        LRECRawVerificationJSON:
          JSON.stringify(normalized.raw || {})
      }
    );

    const destinationRow =
      MGR_LREC_appendObjectPreservingHeaders_(
        destination,
        snapshot
      );

    // Verify destination write before deleting source.
    const verifyCredential = MGR_LREC_first_(snapshot, [
      'LRECCredentialNumber',
      'Credential Number',
      'CredentialNumber',
      'License Number',
      'LicenseNumber'
    ]);

    if (
      verifyCredential &&
      !MGR_LREC_findActiveRow_({
        credentialNumber: verifyCredential,
        email: MGR_LREC_first_(snapshot, ['Email', 'email']),
        phone: MGR_LREC_first_(snapshot, ['Phone', 'phone'])
      })
    ) {
      throw new Error(
        'Destination verification failed; source row was NOT removed.'
      );
    }

    MGR_LREC_writeAudit_({
      event: 'NEW_AGENT_TO_ACTIVE_AGENT',
      sourceWorkbookId: source.workbookId,
      sourceSheet: source.sheet.getName(),
      sourceRow: source.row,
      destinationWorkbookId:
        MGR_LREC_CONFIG.ACTIVE_AGENT_WORKBOOK_ID,
      destinationSheet: destination.getName(),
      destinationRow: destinationRow,
      credentialNumber:
        normalized.credentialNumber || verifyCredential || '',
      email:
        normalized.email ||
        MGR_LREC_first_(snapshot, ['Email', 'email']) ||
        '',
      brokerageName: normalized.brokerageName || '',
      snapshot: snapshot
    });

    // Delete only after destination + audit both succeed.
    source.sheet.deleteRow(source.row);

    const result = {
      success: true,
      moved: true,
      credentialNumber:
        normalized.credentialNumber || verifyCredential || '',
      brokerageName: normalized.brokerageName || '',
      sourceRow: source.row,
      destinationRow: destinationRow,
      timestamp: new Date().toISOString()
    };

    MGR_LREC_log_('INFO', 'AGENT_MIGRATED', result);

    return result;
  } finally {
    lock.releaseLock();
  }
}

function MGR_LREC_getNewAgentSource_() {
  const config = MGR_LREC_getNewAgentSourceConfig();

  if (!config.workbookId) {
    throw new Error(
      'New Agent workbook is not configured. Run ' +
      'MGR_LREC_setNewAgentSource(workbookId, tabName) once.'
    );
  }

  const workbook =
    SpreadsheetApp.openById(config.workbookId);

  const sheet =
    workbook.getSheetByName(config.tabName);

  if (!sheet) {
    throw new Error(
      'New Agent tab not found: ' + config.tabName
    );
  }

  return {
    workbook: workbook,
    workbookId: config.workbookId,
    sheet: sheet
  };
}

function MGR_LREC_getActiveAgentSheet_() {
  const workbook =
    SpreadsheetApp.openById(
      MGR_LREC_CONFIG.ACTIVE_AGENT_WORKBOOK_ID
    );

  let sheet =
    workbook.getSheetByName(
      MGR_LREC_CONFIG.ACTIVE_AGENT_TAB
    );

  if (!sheet) {
    sheet =
      workbook.insertSheet(
        MGR_LREC_CONFIG.ACTIVE_AGENT_TAB
      );
  }

  return sheet;
}

function MGR_LREC_isAlreadyActive_(normalized) {
  return !!MGR_LREC_findActiveRow_(normalized);
}

function MGR_LREC_findActiveRow_(normalized) {
  const sheet = MGR_LREC_getActiveAgentSheet_();
  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    return null;
  }

  const headers = values[0].map(MGR_LREC_header_);

  const credentialIndexes =
    MGR_LREC_findHeaderIndexes_(headers, [
      'LRECCredentialNumber',
      'Credential Number',
      'CredentialNumber',
      'License Number',
      'LicenseNumber',
      'Credential',
      'License'
    ]);

  const emailIndexes =
    MGR_LREC_findHeaderIndexes_(headers, [
      'Email',
      'email'
    ]);

  const phoneIndexes =
    MGR_LREC_findHeaderIndexes_(headers, [
      'Phone',
      'phone'
    ]);

  for (let i = 1; i < values.length; i++) {
    if (
      normalized.credentialNumber &&
      MGR_LREC_anyCellMatches_(
        values[i],
        credentialIndexes,
        normalized.credentialNumber,
        false
      )
    ) {
      return i + 1;
    }

    if (
      normalized.email &&
      MGR_LREC_anyCellMatches_(
        values[i],
        emailIndexes,
        normalized.email,
        true
      )
    ) {
      return i + 1;
    }

    if (
      normalized.phone &&
      MGR_LREC_anyPhoneMatches_(
        values[i],
        phoneIndexes,
        normalized.phone
      )
    ) {
      return i + 1;
    }
  }

  return null;
}

function MGR_LREC_findSourceLead_(
  normalized,
  explicitSourceRow,
  explicitSourceRecord
) {
  const source = MGR_LREC_getNewAgentSource_();
  const sheet = source.sheet;

  if (
    explicitSourceRow &&
    Number(explicitSourceRow) > 1
  ) {
    const row = Number(explicitSourceRow);
    const headers =
      sheet
        .getRange(1, 1, 1, sheet.getLastColumn())
        .getValues()[0]
        .map(MGR_LREC_header_);

    const record =
      explicitSourceRecord ||
      MGR_LREC_rowToObject_(
        headers,
        sheet
          .getRange(row, 1, 1, sheet.getLastColumn())
          .getValues()[0]
      );

    return {
      workbookId: source.workbookId,
      sheet: sheet,
      row: row,
      record: record
    };
  }

  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    return null;
  }

  const headers = values[0].map(MGR_LREC_header_);

  for (let i = 1; i < values.length; i++) {
    const record =
      MGR_LREC_rowToObject_(headers, values[i]);

    if (
      MGR_LREC_recordMatches_(
        record,
        normalized
      )
    ) {
      return {
        workbookId: source.workbookId,
        sheet: sheet,
        row: i + 1,
        record: record
      };
    }
  }

  return null;
}

function MGR_LREC_recordMatches_(record, normalized) {
  const credential =
    MGR_LREC_first_(record, [
      'Credential Number',
      'CredentialNumber',
      'License Number',
      'LicenseNumber',
      'Credential',
      'License'
    ]);

  const email =
    MGR_LREC_first_(record, ['Email', 'email']);

  const phone =
    MGR_LREC_first_(record, ['Phone', 'phone']);

  if (
    normalized.credentialNumber &&
    credential &&
    String(normalized.credentialNumber).trim() ===
      String(credential).trim()
  ) {
    return true;
  }

  if (
    normalized.email &&
    email &&
    String(normalized.email).trim().toLowerCase() ===
      String(email).trim().toLowerCase()
  ) {
    return true;
  }

  if (
    normalized.phone &&
    phone &&
    MGR_LREC_digits_(normalized.phone) ===
      MGR_LREC_digits_(phone)
  ) {
    return true;
  }

  return false;
}

function MGR_LREC_appendObjectPreservingHeaders_(
  sheet,
  object
) {
  const lastColumn = sheet.getLastColumn();

  let headers =
    lastColumn > 0
      ? sheet
          .getRange(1, 1, 1, lastColumn)
          .getValues()[0]
          .map(MGR_LREC_header_)
      : [];

  const missing =
    Object.keys(object).filter(function (key) {
      return headers.indexOf(key) === -1;
    });

  if (missing.length) {
    const startColumn = headers.length + 1;

    sheet
      .getRange(1, startColumn, 1, missing.length)
      .setValues([missing]);

    headers = headers.concat(missing);
  }

  const rowValues =
    headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(
        object,
        header
      )
        ? object[header]
        : '';
    });

  sheet.appendRow(rowValues);
  sheet.setFrozenRows(1);

  return sheet.getLastRow();
}

function MGR_LREC_writeAudit_(entry) {
  const workbook =
    SpreadsheetApp.openById(
      MGR_LREC_CONFIG.ACTIVE_AGENT_WORKBOOK_ID
    );

  let sheet =
    workbook.getSheetByName(
      MGR_LREC_CONFIG.AUDIT_TAB
    );

  if (!sheet) {
    sheet =
      workbook.insertSheet(
        MGR_LREC_CONFIG.AUDIT_TAB
      );
  }

  const audit = {
    Timestamp: new Date().toISOString(),
    Event: entry.event || '',
    CredentialNumber:
      entry.credentialNumber || '',
    Email: entry.email || '',
    BrokerageName:
      entry.brokerageName || '',
    SourceWorkbookID:
      entry.sourceWorkbookId || '',
    SourceSheet:
      entry.sourceSheet || '',
    SourceRow:
      entry.sourceRow || '',
    DestinationWorkbookID:
      entry.destinationWorkbookId || '',
    DestinationSheet:
      entry.destinationSheet || '',
    DestinationRow:
      entry.destinationRow || '',
    SnapshotJSON:
      JSON.stringify(entry.snapshot || {})
  };

  MGR_LREC_appendObjectPreservingHeaders_(
    sheet,
    audit
  );

  return true;
}

function MGR_LREC_callConfiguredVerifier_(
  credentialNumber,
  rowObject
) {
  const functionName =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        MGR_LREC_CONFIG.VERIFIER_FUNCTION_PROPERTY
      );

  if (!functionName) {
    throw new Error(
      'LREC verifier function is not configured. ' +
      'Run MGR_LREC_setVerifierFunction(functionName) once.'
    );
  }

  const root =
    typeof globalThis !== 'undefined'
      ? globalThis
      : this;

  const verifier = root[functionName];

  if (typeof verifier !== 'function') {
    throw new Error(
      'Configured LREC verifier function was not found: ' +
      functionName
    );
  }

  return verifier(
    credentialNumber,
    rowObject
  );
}

function MGR_LREC_normalizeVerification_(result) {
  const credential =
    MGR_LREC_first_(result, [
      'credentialNumber',
      'licenseNumber',
      'credential',
      'license',
      'Credential Number',
      'License Number'
    ]);

  const brokerageName =
    MGR_LREC_first_(result, [
      'brokerageName',
      'brokerage',
      'company',
      'firm',
      'Brokerage',
      'Company'
    ]);

  let affiliated =
    MGR_LREC_first_(result, [
      'affiliated',
      'isAffiliated',
      'activeAffiliation'
    ]);

  if (typeof affiliated !== 'boolean') {
    affiliated =
      !!String(brokerageName || '').trim();
  }

  return {
    credentialNumber:
      String(credential || '').trim(),
    email:
      String(
        MGR_LREC_first_(result, [
          'email',
          'Email'
        ]) || ''
      ).trim().toLowerCase(),
    phone:
      MGR_LREC_digits_(
        MGR_LREC_first_(result, [
          'phone',
          'Phone'
        ]) || ''
      ),
    affiliated: affiliated === true,
    brokerageName:
      String(brokerageName || '').trim(),
    verifiedAt:
      String(
        MGR_LREC_first_(result, [
          'verifiedAt',
          'checkedAt'
        ]) ||
        new Date().toISOString()
      ),
    sourceRow: result.sourceRow || null,
    sourceRecord: result.sourceRecord || null,
    raw:
      result.raw ||
      result.metadata ||
      result
  };
}

function MGR_LREC_rowToObject_(headers, row) {
  const object = {};

  headers.forEach(function (header, index) {
    if (header) {
      object[header] = row[index];
    }
  });

  return object;
}

function MGR_LREC_findHeaderIndex_(
  headers,
  candidates
) {
  for (let i = 0; i < candidates.length; i++) {
    const index =
      headers.indexOf(candidates[i]);

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function MGR_LREC_findHeaderIndexes_(
  headers,
  candidates
) {
  const indexes = [];

  candidates.forEach(function (candidate) {
    const index = headers.indexOf(candidate);

    if (index >= 0) {
      indexes.push(index);
    }
  });

  return indexes;
}

function MGR_LREC_anyCellMatches_(
  row,
  indexes,
  expected,
  ignoreCase
) {
  const target =
    ignoreCase
      ? String(expected || '').trim().toLowerCase()
      : String(expected || '').trim();

  return indexes.some(function (index) {
    const actual =
      ignoreCase
        ? String(row[index] || '').trim().toLowerCase()
        : String(row[index] || '').trim();

    return actual && actual === target;
  });
}

function MGR_LREC_anyPhoneMatches_(
  row,
  indexes,
  expected
) {
  const target = MGR_LREC_digits_(expected);

  return indexes.some(function (index) {
    return (
      MGR_LREC_digits_(row[index]) === target &&
      target !== ''
    );
  });
}

function MGR_LREC_first_(object, keys) {
  if (!object) {
    return '';
  }

  for (let i = 0; i < keys.length; i++) {
    if (
      Object.prototype.hasOwnProperty.call(
        object,
        keys[i]
      ) &&
      object[keys[i]] !== null &&
      object[keys[i]] !== undefined &&
      String(object[keys[i]]).trim() !== ''
    ) {
      return object[keys[i]];
    }
  }

  return '';
}

function MGR_LREC_rowIsBlank_(row) {
  return !row.some(function (value) {
    return String(
      value === null || value === undefined
        ? ''
        : value
    ).trim() !== '';
  });
}

function MGR_LREC_header_(value) {
  return String(
    value === null || value === undefined
      ? ''
      : value
  ).trim();
}

function MGR_LREC_digits_(value) {
  return String(value || '').replace(/\D/g, '');
}

function MGR_LREC_assertObject_(
  value,
  label
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      (label || 'Value') +
      ' must be an object.'
    );
  }

  return value;
}

function MGR_LREC_merge_() {
  const output = {};

  Array.prototype
    .slice
    .call(arguments)
    .forEach(function (object) {
      if (
        object &&
        typeof object === 'object' &&
        !Array.isArray(object)
      ) {
        Object.keys(object).forEach(
          function (key) {
            output[key] = object[key];
          }
        );
      }
    });

  return output;
}

function MGR_LREC_log_(
  level,
  source,
  payload
) {
  try {
    if (
      level === 'ERROR' &&
      typeof MGR_logError === 'function'
    ) {
      MGR_logError(
        'LREC:' + source,
        new Error(
          payload && payload.error
            ? payload.error
            : source
        ),
        payload
      );

      return;
    }

    if (
      level === 'WARN' &&
      typeof MGR_logWarn === 'function'
    ) {
      MGR_logWarn(
        'LREC:' + source,
        payload
      );

      return;
    }

    if (typeof MGR_logInfo === 'function') {
      MGR_logInfo(
        'LREC:' + source,
        payload
      );

      return;
    }

    console.log(
      JSON.stringify({
        level: level,
        source: 'LREC:' + source,
        payload: payload
      })
    );
  } catch (ignored) {}
}
