/**
 * MelroseOS Enterprise Core
 * File: CORE-07_Audit.gs
 * Release: MOS5-CORE-07
 * Version: 1.0.0
 * Purpose: Immutable-style operational audit event construction and persistence.
 */

const MGR_AUDIT_VERSION = '1.0.0';
const MGR_AUDIT_PROPERTY_KEY = 'AUDIT_BUFFER';
const MGR_AUDIT_BUFFER_LIMIT = 100;

function MGR_auditEvent(action, details, options) {
  MGR_require(action, 'Audit action');
  options = options || {};

  const event = {
    auditId: MGR_createAuditId_(),
    timestamp: MGR_nowIso(),
    system: 'MelroseOS',
    action: MGR_normalizeKey(action),
    actor: MGR_resolveAuditActor_(options.actor),
    entityType: MGR_normalizeKey(options.entityType || ''),
    entityId: MGR_safeTrim(options.entityId || ''),
    correlationId: MGR_safeTrim(options.correlationId || ''),
    source: MGR_safeTrim(options.source || ''),
    details: MGR_sanitizeAuditValue_(details === undefined ? null : details)
  };

  MGR_appendAuditBuffer_(event);

  if (typeof MGR_logInfo === 'function') {
    MGR_logInfo('AUDIT:' + event.action, event);
  }

  return event;
}

function MGR_auditCreate(entityType, entityId, details, options) {
  options = MGR_mergeObjects(options || {}, {
    entityType: entityType,
    entityId: entityId
  });
  return MGR_auditEvent('CREATE', details, options);
}

function MGR_auditUpdate(entityType, entityId, before, after, options) {
  options = MGR_mergeObjects(options || {}, {
    entityType: entityType,
    entityId: entityId
  });

  return MGR_auditEvent('UPDATE', {
    before: before,
    after: after,
    changes: MGR_diffAuditObjects_(before, after)
  }, options);
}

function MGR_auditDelete(entityType, entityId, details, options) {
  options = MGR_mergeObjects(options || {}, {
    entityType: entityType,
    entityId: entityId
  });
  return MGR_auditEvent('DELETE', details, options);
}

function MGR_auditAccess(entityType, entityId, details, options) {
  options = MGR_mergeObjects(options || {}, {
    entityType: entityType,
    entityId: entityId
  });
  return MGR_auditEvent('ACCESS', details, options);
}

function MGR_getAuditBuffer(limit) {
  const events = MGR_getJsonProperty(MGR_AUDIT_PROPERTY_KEY, []);
  const safeEvents = Array.isArray(events) ? events : [];
  const count = Math.max(1, Number(limit) || MGR_AUDIT_BUFFER_LIMIT);
  return safeEvents.slice(Math.max(0, safeEvents.length - count));
}

function MGR_clearAuditBuffer() {
  MGR_deleteScriptProperty(MGR_AUDIT_PROPERTY_KEY);
  return true;
}

function MGR_appendAuditBuffer_(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    let events = MGR_getJsonProperty(MGR_AUDIT_PROPERTY_KEY, []);
    if (!Array.isArray(events)) events = [];

    events.push(event);

    if (events.length > MGR_AUDIT_BUFFER_LIMIT) {
      events = events.slice(events.length - MGR_AUDIT_BUFFER_LIMIT);
    }

    MGR_setJsonProperty(MGR_AUDIT_PROPERTY_KEY, events);
  } finally {
    lock.releaseLock();
  }
}

function MGR_resolveAuditActor_(actor) {
  if (actor) return MGR_normalizeEmail(actor);

  try {
    const effective = Session.getEffectiveUser().getEmail();
    if (effective) return MGR_normalizeEmail(effective);
  } catch (err) {}

  return 'SYSTEM';
}

function MGR_createAuditId_() {
  return 'AUD-' + Utilities.getUuid().replace(/-/g, '').substring(0, 20).toUpperCase();
}

function MGR_diffAuditObjects_(before, after) {
  const left = before && typeof before === 'object' ? before : {};
  const right = after && typeof after === 'object' ? after : {};
  const keys = MGR_unique(Object.keys(left).concat(Object.keys(right)));
  const changes = {};

  keys.forEach(function (key) {
    const a = MGR_safeJsonStringify(left[key], String(left[key]));
    const b = MGR_safeJsonStringify(right[key], String(right[key]));

    if (a !== b) {
      changes[key] = {
        before: left[key] === undefined ? null : left[key],
        after: right[key] === undefined ? null : right[key]
      };
    }
  });

  return changes;
}

function MGR_sanitizeAuditValue_(value) {
  const blocked = [
    'password', 'passwd', 'token', 'secret', 'authorization',
    'apikey', 'api_key', 'ssn'
  ];

  function scrub(item) {
    if (Array.isArray(item)) return item.map(scrub);

    if (item && typeof item === 'object') {
      const result = {};
      Object.keys(item).forEach(function (key) {
        result[key] = blocked.indexOf(String(key).toLowerCase()) !== -1
          ? '[REDACTED]'
          : scrub(item[key]);
      });
      return result;
    }

    return item;
  }

  return scrub(value);
}
