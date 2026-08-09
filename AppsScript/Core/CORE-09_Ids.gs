/**
 * MelroseOS Enterprise Core
 * File: CORE-09_IDs.gs
 * Release: MOS5-CORE-09
 * Version: 1.0.0
 * Purpose: Canonical identifiers for leads, agents, tasks, events, records, and releases.
 */

const MGR_ID_PREFIX = Object.freeze({
  LEAD: 'LEAD',
  AGENT: 'AGENT',
  TASK: 'TASK',
  EVENT: 'EVT',
  AUDIT: 'AUD',
  TRANSACTION: 'TXN',
  COMPLIANCE: 'CMP',
  SESSION: 'SES',
  MESSAGE: 'MSG',
  RECORD: 'REC'
});

function MGR_createId(type) {
  const normalized = MGR_normalizeKey(type);
  const prefix = MGR_ID_PREFIX[normalized] || normalized || 'REC';
  const uuid = Utilities.getUuid().replace(/-/g, '').toUpperCase();

  return prefix + '-' + uuid.substring(0, 20);
}

function MGR_createLeadId() {
  return MGR_createId('LEAD');
}

function MGR_createAgentId() {
  return MGR_createId('AGENT');
}

function MGR_createTaskId() {
  return MGR_createId('TASK');
}

function MGR_createTransactionId() {
  return MGR_createId('TRANSACTION');
}

function MGR_createComplianceId() {
  return MGR_createId('COMPLIANCE');
}

function MGR_createSessionId() {
  return MGR_createId('SESSION');
}

function MGR_createDeterministicKey(namespace, value) {
  MGR_require(namespace, 'Namespace');
  MGR_require(value, 'Value');

  const prefix = MGR_normalizeKey(namespace);
  const digest = MGR_hashText(
    prefix + '|' + MGR_normalizeText(value)
  ).substring(0, 24).toUpperCase();

  return prefix + '-' + digest;
}

function MGR_createLeadLockKey(email, phone) {
  const normalizedEmail = MGR_normalizeEmail(email);
  const normalizedPhone = MGR_normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    throw new Error('Email or phone is required to create a lead lock key.');
  }

  return MGR_createDeterministicKey(
    'LEADLOCK',
    normalizedEmail + '|' + normalizedPhone
  );
}

function MGR_isValidMelroseId(value, expectedPrefix) {
  const text = MGR_safeTrim(value).toUpperCase();

  if (!/^[A-Z0-9_]+-[A-Z0-9]{8,}$/.test(text)) {
    return false;
  }

  if (expectedPrefix) {
    return text.indexOf(MGR_normalizeKey(expectedPrefix) + '-') === 0;
  }

  return true;
}

function MGR_idDiagnostics() {
  const leadId = MGR_createLeadId();
  const taskId = MGR_createTaskId();
  const deterministicA = MGR_createDeterministicKey('TEST', 'MelroseOS');
  const deterministicB = MGR_createDeterministicKey('TEST', 'MelroseOS');

  return {
    success:
      MGR_isValidMelroseId(leadId, 'LEAD') &&
      MGR_isValidMelroseId(taskId, 'TASK') &&
      deterministicA === deterministicB,
    leadId: leadId,
    taskId: taskId,
    deterministicStable: deterministicA === deterministicB,
    timestamp: MGR_nowIso()
  };
}
