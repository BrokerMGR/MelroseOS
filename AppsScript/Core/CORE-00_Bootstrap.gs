/**
 * MelroseOS Enterprise Core
 * File: CORE-00_Bootstrap.gs
 * Module: Enterprise Core
 * Release: MOS5-CORE-00
 * Version: 1.0.0
 *
 * Purpose:
 * - Establish MelroseOS runtime identity
 * - Perform startup dependency checks
 * - Expose health/runtime diagnostics
 * - Standardize initialization and fatal error handling
 * - Provide a single bootstrap entry point for dependent modules
 */

const MGR_CORE_RELEASE = 'MOS5-CORE-00';
const MGR_CORE_VERSION = '1.0.0';
const MGR_CORE_MODULE = 'ENTERPRISE_CORE';

/**
 * Primary MelroseOS bootstrap.
 *
 * @param {Object=} options Optional runtime controls.
 * @return {Object} Structured bootstrap result.
 */
function MGR_bootstrapCore(options) {
  options = options || {};

  const startedAt = new Date();
  const context = MGR_buildCoreExecutionContext_(options);

  const result = {
    success: false,
    system: 'MelroseOS',
    module: MGR_CORE_MODULE,
    release: MGR_CORE_RELEASE,
    version: MGR_CORE_VERSION,
    environment: context.environment,
    timezone: context.timezone,
    effectiveUser: context.effectiveUser,
    activeUser: context.activeUser,
    scriptId: context.scriptId,
    startedAt: startedAt.toISOString(),
    completedAt: '',
    durationMs: 0,
    checks: [],
    warnings: [],
    error: null
  };

  try {
    result.checks = MGR_runCoreBootstrapChecks_(context);

    result.success = result.checks.every(function (check) {
      return check.pass === true;
    });

    result.warnings = result.checks
      .filter(function (check) {
        return check.pass !== true && check.severity === 'WARN';
      })
      .map(function (check) {
        return check.name + ': ' + (check.message || 'Warning');
      });

    result.completedAt = new Date().toISOString();
    result.durationMs = new Date().getTime() - startedAt.getTime();

    MGR_safeCoreLog_(
      result.success ? 'INFO' : 'WARN',
      'MGR_bootstrapCore',
      result
    );

    return result;
  } catch (err) {
    result.success = false;
    result.error = MGR_coreErrorToObject_(err);
    result.completedAt = new Date().toISOString();
    result.durationMs = new Date().getTime() - startedAt.getTime();

    MGR_safeCoreLog_('ERROR', 'MGR_bootstrapCore', result);

    if (options.throwOnFailure === true) {
      throw err;
    }

    return result;
  }
}

/**
 * Lightweight health check intended for diagnostics and monitoring.
 *
 * @return {Object}
 */
function MGR_coreHealthCheck() {
  const bootstrap = MGR_bootstrapCore({
    healthCheck: true,
    throwOnFailure: false
  });

  return {
    success: bootstrap.success,
    system: bootstrap.system,
    module: bootstrap.module,
    release: bootstrap.release,
    version: bootstrap.version,
    environment: bootstrap.environment,
    timezone: bootstrap.timezone,
    effectiveUser: bootstrap.effectiveUser,
    scriptId: bootstrap.scriptId,
    timestamp: new Date().toISOString(),
    durationMs: bootstrap.durationMs,
    checks: bootstrap.checks,
    warnings: bootstrap.warnings,
    error: bootstrap.error
  };
}

/**
 * Returns immutable runtime identity details.
 *
 * @return {Object}
 */
function MGR_getCoreRuntimeInfo() {
  const context = MGR_buildCoreExecutionContext_({});

  return {
    system: 'MelroseOS',
    module: MGR_CORE_MODULE,
    release: MGR_CORE_RELEASE,
    version: MGR_CORE_VERSION,
    environment: context.environment,
    timezone: context.timezone,
    scriptId: context.scriptId,
    effectiveUser: context.effectiveUser,
    activeUser: context.activeUser,
    timestamp: new Date().toISOString()
  };
}

/**
 * Returns true if the current script environment appears operational.
 *
 * @return {boolean}
 */
function MGR_isCoreReady() {
  const health = MGR_coreHealthCheck();
  return health.success === true;
}

/**
 * Throws if Enterprise Core is not operational.
 *
 * @return {boolean}
 */
function MGR_requireCoreReady() {
  const health = MGR_coreHealthCheck();

  if (!health.success) {
    throw new Error(
      'MelroseOS Enterprise Core is not ready: ' +
      JSON.stringify(health)
    );
  }

  return true;
}

/**
 * Build execution context without requiring downstream modules.
 *
 * @param {Object} options
 * @return {Object}
 * @private
 */
function MGR_buildCoreExecutionContext_(options) {
  options = options || {};

  return {
    environment: MGR_resolveCoreEnvironment_(),
    timezone: MGR_resolveCoreTimezone_(),
    scriptId: MGR_getCoreScriptId_(),
    effectiveUser: MGR_getCoreEffectiveUserEmail_(),
    activeUser: MGR_getCoreActiveUserEmail_(),
    healthCheck: options.healthCheck === true
  };
}

/**
 * Run all core bootstrap checks.
 *
 * @param {Object} context
 * @return {Array<Object>}
 * @private
 */
function MGR_runCoreBootstrapChecks_(context) {
  const checks = [];

  checks.push(
    MGR_executeCoreCheck_(
      'SCRIPT_ID',
      'ERROR',
      function () {
        return !!context.scriptId;
      },
      'Apps Script project ID is available.'
    )
  );

  checks.push(
    MGR_executeCoreCheck_(
      'TIMEZONE',
      'ERROR',
      function () {
        return !!context.timezone;
      },
      'Script timezone is available.'
    )
  );

  checks.push(
    MGR_executeCoreCheck_(
      'PROPERTIES_SERVICE',
      'ERROR',
      function () {
        const properties = PropertiesService.getScriptProperties();
        return !!properties;
      },
      'PropertiesService is available.'
    )
  );

  checks.push(
    MGR_executeCoreCheck_(
      'LOCK_SERVICE',
      'ERROR',
      function () {
        const lock = LockService.getScriptLock();
        return !!lock;
      },
      'LockService is available.'
    )
  );

  checks.push(
    MGR_executeCoreCheck_(
      'UTILITIES_SERVICE',
      'ERROR',
      function () {
        return typeof Utilities.getUuid === 'function';
      },
      'Utilities service is available.'
    )
  );

  checks.push(
    MGR_executeCoreCheck_(
      'SESSION_SERVICE',
      'WARN',
      function () {
        return typeof Session.getEffectiveUser === 'function';
      },
      'Session service is available.'
    )
  );

  checks.push(
    MGR_executeCoreCheck_(
      'CONFIG_MODULE',
      'WARN',
      function () {
        return typeof MGR_getConfig === 'function';
      },
      'CORE-01_Config.gs is loaded.'
    )
  );

  checks.push(
    MGR_executeCoreCheck_(
      'LOGGING_MODULE',
      'WARN',
      function () {
        return typeof MGR_logInfo === 'function';
      },
      'CORE-04_Logging.gs is loaded.'
    )
  );

  return checks;
}

/**
 * Execute a single bootstrap check safely.
 *
 * @param {string} name
 * @param {string} severity
 * @param {Function} fn
 * @param {string} successMessage
 * @return {Object}
 * @private
 */
function MGR_executeCoreCheck_(name, severity, fn, successMessage) {
  const started = new Date().getTime();

  try {
    const value = fn();
    const pass = value === true;

    return {
      name: name,
      severity: severity,
      pass: pass,
      value: value,
      message: pass ? successMessage : 'Check returned false.',
      durationMs: new Date().getTime() - started
    };
  } catch (err) {
    return {
      name: name,
      severity: severity,
      pass: false,
      value: null,
      message: err && err.message ? String(err.message) : String(err),
      error: MGR_coreErrorToObject_(err),
      durationMs: new Date().getTime() - started
    };
  }
}

/**
 * Resolve environment from config, then script properties, then DEV.
 *
 * @return {string}
 * @private
 */
function MGR_resolveCoreEnvironment_() {
  try {
    if (typeof MGR_getConfig === 'function') {
      const configured = MGR_getConfig('ENVIRONMENT', '');
      if (configured) {
        return String(configured).toUpperCase();
      }
    }
  } catch (err) {
    // Fall through.
  }

  try {
    const propertyValue =
      PropertiesService.getScriptProperties().getProperty(
        'MGR_ENVIRONMENT'
      );

    if (propertyValue) {
      return String(propertyValue).toUpperCase();
    }
  } catch (err) {
    // Fall through.
  }

  return 'DEV';
}

/**
 * Resolve timezone from config/script settings.
 *
 * @return {string}
 * @private
 */
function MGR_resolveCoreTimezone_() {
  try {
    if (typeof MGR_getConfig === 'function') {
      const configured = MGR_getConfig('TIMEZONE', '');
      if (configured) {
        return String(configured);
      }
    }
  } catch (err) {
    // Fall through.
  }

  try {
    const scriptTimezone = Session.getScriptTimeZone();
    if (scriptTimezone) {
      return scriptTimezone;
    }
  } catch (err) {
    // Fall through.
  }

  return 'America/Chicago';
}

/**
 * Get script ID safely.
 *
 * @return {string}
 * @private
 */
function MGR_getCoreScriptId_() {
  try {
    return ScriptApp.getScriptId() || '';
  } catch (err) {
    return '';
  }
}

/**
 * Get effective user safely.
 *
 * @return {string}
 * @private
 */
function MGR_getCoreEffectiveUserEmail_() {
  try {
    return Session.getEffectiveUser().getEmail() || '';
  } catch (err) {
    return '';
  }
}

/**
 * Get active user safely.
 *
 * @return {string}
 * @private
 */
function MGR_getCoreActiveUserEmail_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (err) {
    return '';
  }
}

/**
 * Safe bootstrap logging that does not require CORE-04 to exist.
 *
 * @param {string} level
 * @param {string} source
 * @param {*} payload
 * @private
 */
function MGR_safeCoreLog_(level, source, payload) {
  try {
    if (level === 'ERROR' && typeof MGR_logError === 'function') {
      const error = payload && payload.error
        ? new Error(payload.error.message || 'Core error')
        : new Error('Core error');

      MGR_logError(source, error, payload);
      return;
    }

    if (level === 'WARN' && typeof MGR_logWarn === 'function') {
      MGR_logWarn(source, payload);
      return;
    }

    if (typeof MGR_logInfo === 'function') {
      MGR_logInfo(source, payload);
      return;
    }

    const line = JSON.stringify({
      level: level,
      source: source,
      timestamp: new Date().toISOString(),
      payload: payload
    });

    if (level === 'ERROR') {
      console.error(line);
    } else if (level === 'WARN') {
      console.warn(line);
    } else {
      console.log(line);
    }
  } catch (err) {
    try {
      console.error(
        JSON.stringify({
          level: 'ERROR',
          source: 'MGR_safeCoreLog_',
          message: err && err.message ? err.message : String(err)
        })
      );
    } catch (ignored) {
      // Nothing else is safe to do here.
    }
  }
}

/**
 * Normalize Error-like values to plain objects.
 *
 * @param {*} err
 * @return {Object}
 * @private
 */
function MGR_coreErrorToObject_(err) {
  return {
    name: err && err.name ? String(err.name) : 'Error',
    message:
      err && err.message
        ? String(err.message)
        : String(err === undefined ? '' : err),
    stack: err && err.stack ? String(err.stack) : ''
  };
}
