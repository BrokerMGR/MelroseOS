/**
 * MelroseOS Enterprise Core
 * File: CORE-04_Logging.gs
 * Release: MOS5-CORE-04
 * Version: 1.0.0
 * Purpose: Structured logging, timing, correlation IDs, and redaction.
 */

function MGR_logInfo(source, payload) {
  return MGR_writeLog_('INFO', source, payload);
}

function MGR_logWarn(source, payload) {
  return MGR_writeLog_('WARN', source, payload);
}

function MGR_logError(source, error, context) {
  return MGR_writeLog_('ERROR', source, {
    error: {
      name: error && error.name ? String(error.name) : 'Error',
      message:
        error && error.message
          ? String(error.message)
          : String(error || ''),
      stack: error && error.stack ? String(error.stack) : ''
    },
    context: context === undefined ? null : context
  });
}

function MGR_logDebug(source, payload) {
  const environment =
    typeof MGR_getConfig === 'function'
      ? MGR_getConfig('ENVIRONMENT', 'DEV')
      : 'DEV';

  if (String(environment).toUpperCase() !== 'DEV') {
    return null;
  }

  return MGR_writeLog_('DEBUG', source, payload);
}

function MGR_writeLog_(level, source, payload) {
  const entry = {
    logId: MGR_createCorrelationId_(),
    level: String(level || 'INFO').toUpperCase(),
    source: String(source || ''),
    timestamp: new Date().toISOString(),
    effectiveUser:
      typeof MGR_getCoreEffectiveUserEmail_ === 'function'
        ? MGR_getCoreEffectiveUserEmail_()
        : '',
    payload:
      payload === undefined
        ? null
        : MGR_sanitizeLogPayload_(payload)
  };

  const line = JSON.stringify(entry);

  if (entry.level === 'ERROR') {
    console.error(line);
  } else if (entry.level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }

  return entry;
}

function MGR_withTiming(source, fn) {
  if (typeof fn !== 'function') {
    throw new Error('MGR_withTiming requires a function.');
  }

  const started = new Date().getTime();

  try {
    const result = fn();

    MGR_logInfo(source, {
      event: 'TIMING',
      success: true,
      durationMs: new Date().getTime() - started
    });

    return result;
  } catch (err) {
    MGR_logError(source, err, {
      event: 'TIMING',
      success: false,
      durationMs: new Date().getTime() - started
    });

    throw err;
  }
}

function MGR_createCorrelationId_() {
  try {
    return (
      'LOG-' +
      Utilities.getUuid()
        .replace(/-/g, '')
        .substring(0, 16)
        .toUpperCase()
    );
  } catch (err) {
    return 'LOG-' + new Date().getTime();
  }
}

function MGR_sanitizeLogPayload_(value) {
  const sensitive = [
    'password',
    'passwd',
    'token',
    'secret',
    'authorization',
    'apikey',
    'api_key',
    'ssn'
  ];

  function scrub(item) {
    if (Array.isArray(item)) {
      return item.map(scrub);
    }

    if (item && typeof item === 'object') {
      const result = {};

      Object.keys(item).forEach(function (key) {
        const normalized = String(key).toLowerCase();

        result[key] =
          sensitive.indexOf(normalized) !== -1
            ? '[REDACTED]'
            : scrub(item[key]);
      });

      return result;
    }

    return item;
  }

  try {
    return scrub(value);
  } catch (err) {
    return String(value);
  }
}
