/**
 * MelroseOS Enterprise Core
 * File: CORE-08_Locking.gs
 * Release: MOS5-CORE-08
 * Version: 1.0.0
 * Purpose: Standard lock acquisition, guarded execution, and lock diagnostics.
 */

const MGR_DEFAULT_LOCK_TIMEOUT_MS = 30000;

function MGR_withScriptLock(source, fn, timeoutMs) {
  return MGR_withLock_(
    LockService.getScriptLock(),
    source,
    fn,
    timeoutMs
  );
}

function MGR_withUserLock(source, fn, timeoutMs) {
  return MGR_withLock_(
    LockService.getUserLock(),
    source,
    fn,
    timeoutMs
  );
}

function MGR_tryWithScriptLock(source, fn, timeoutMs) {
  MGR_require(source, 'Lock source');

  if (typeof fn !== 'function') {
    throw new Error('Lock callback must be a function.');
  }

  const lock = LockService.getScriptLock();
  const timeout = Math.max(0, Number(timeoutMs) || MGR_DEFAULT_LOCK_TIMEOUT_MS);
  const acquired = lock.tryLock(timeout);

  if (!acquired) {
    return {
      success: false,
      acquired: false,
      source: source,
      error: 'LOCK_TIMEOUT'
    };
  }

  try {
    return {
      success: true,
      acquired: true,
      source: source,
      value: fn()
    };
  } finally {
    lock.releaseLock();
  }
}

function MGR_withLock_(lock, source, fn, timeoutMs) {
  MGR_require(source, 'Lock source');

  if (typeof fn !== 'function') {
    throw new Error('Lock callback must be a function.');
  }

  const timeout = Math.max(1, Number(timeoutMs) || MGR_DEFAULT_LOCK_TIMEOUT_MS);
  const started = new Date().getTime();

  lock.waitLock(timeout);

  try {
    if (typeof MGR_logDebug === 'function') {
      MGR_logDebug('LOCK_ACQUIRED', {
        source: source,
        waitMs: new Date().getTime() - started
      });
    }

    return fn();
  } finally {
    lock.releaseLock();

    if (typeof MGR_logDebug === 'function') {
      MGR_logDebug('LOCK_RELEASED', {
        source: source,
        totalMs: new Date().getTime() - started
      });
    }
  }
}

function MGR_lockDiagnostics() {
  const result = {
    success: false,
    scriptLock: false,
    userLock: false,
    timestamp: MGR_nowIso()
  };

  const scriptLock = LockService.getScriptLock();
  const userLock = LockService.getUserLock();

  if (scriptLock.tryLock(1000)) {
    result.scriptLock = true;
    scriptLock.releaseLock();
  }

  if (userLock.tryLock(1000)) {
    result.userLock = true;
    userLock.releaseLock();
  }

  result.success = result.scriptLock && result.userLock;
  return result;
}
