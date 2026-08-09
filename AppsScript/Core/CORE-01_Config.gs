/**
 * MelroseOS Enterprise Core
 * File: CORE-01_Config.gs
 * Module: Enterprise Core
 * Release: MOS5-CORE-01
 * Version: 1.0.0
 *
 * Purpose:
 * - Centralize immutable system configuration
 * - Register core accounts and workbook IDs
 * - Expose safe configuration accessors
 * - Provide environment-aware settings
 * - Provide broker/system identity helpers
 */

const MGR_CONFIG_VERSION = '1.0.0';

const MGR_CONFIG = Object.freeze({
  SYSTEM_NAME: 'MelroseOS',
  SYSTEM_CODE: 'MOS5',
  ENVIRONMENT: 'DEV',
  TIMEZONE: 'America/Chicago',
  LOCALE: 'en_US',

  BROKER_NAME: 'Ulysses A. Barnes, Jr.',
  BROKER_AGENT_ID: 'BROKER-001',
  BROKER_EMAIL: 'melrosegroupbroker@gmail.com',

  BROKERAGE_EMAIL: 'melrosegrouprealty@gmail.com',
  LEAD_DISTRIBUTION_EMAIL: 'agentleadcentral@gmail.com',
  STAFF_OPERATIONS_EMAIL: 'melrosegroupstaff@gmail.com',
  LEADS_VAULT_EMAIL: 'melrosegroupleads@gmail.com',

  COMMAND_CENTER_SHEET_ID: '19hd0-ICZrsaczBS58R7nPyVbJrZkg_vprF5foIIPgPw',
  CORE_WORKBOOK_ID: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  CRM_WORKBOOK_ID: '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
  MARKETING_WORKBOOK_ID: '1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo',
  WEBSITE_WORKBOOK_ID: '1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc',
  ANALYTICS_WORKBOOK_ID: '1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU',
  ARCHIVE_WORKBOOK_ID: '1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk',
  FEATURED_LISTINGS_SHEET_ID: '1KJ5XA3Yx_Zhl3fJhAQQz8Gs-1eRGwL27vTgV4BwwepU',

  BUSINESS_CARD_DRIVE_ID: '1jqKjYqgOB9B_r5owweR-b9q9SyFDlfR5',

  DEFAULT_DAILY_LEAD_CAP: 25,
  DEFAULT_LEAD_ROUTE: 'ROUND_ROBIN',
  RECRUITING_ROUTE: 'BROKER_ONLY',
  CLEVER_ROUTE: 'BROKER_ONLY',
  FALLBACK_ROUTE: 'BROKER_ONLY',

  CONSULTATION_DURATION_MINUTES: 30,
  AGENT_SESSION_HOURS: 6,
  AGENT_OTP_HOURS: 4,

  COMPLIANCE_FOOTER:
    'Licensed in Louisiana • (985) 250-0071 • Mandeville, LA',

  WEBSITE_PRIMARY: 'https://melrosegrouprealty.com',
  WEBSITE_SECONDARY: 'https://mgrhomesnearme.com',
  BOOK_NOW_PATH: '/book-now'
});

const MGR_ACCOUNT_REGISTRY = Object.freeze({
  broker_core: Object.freeze({
    alias: 'broker_core',
    email: 'melrosegroupbroker@gmail.com',
    role: 'BROKER_CORE',
    priority: 1,
    active: true
  }),

  brokerage_shared: Object.freeze({
    alias: 'brokerage_shared',
    email: 'melrosegrouprealty@gmail.com',
    role: 'BROKERAGE_SHARED',
    priority: 2,
    active: true
  }),

  lead_distribution: Object.freeze({
    alias: 'lead_distribution',
    email: 'agentleadcentral@gmail.com',
    role: 'LEAD_DISTRIBUTION',
    priority: 3,
    active: true
  }),

  staff_operations: Object.freeze({
    alias: 'staff_operations',
    email: 'melrosegroupstaff@gmail.com',
    role: 'STAFF_OPERATIONS',
    priority: 4,
    active: true
  }),

  leads_vault: Object.freeze({
    alias: 'leads_vault',
    email: 'melrosegroupleads@gmail.com',
    role: 'LEADS_VAULT',
    priority: 5,
    active: true
  })
});

const MGR_WORKBOOK_REGISTRY = Object.freeze({
  command_center: Object.freeze({
    key: 'command_center',
    id: MGR_CONFIG.COMMAND_CENTER_SHEET_ID,
    role: 'LEGACY_COMMAND_CENTER'
  }),

  core: Object.freeze({
    key: 'core',
    id: MGR_CONFIG.CORE_WORKBOOK_ID,
    role: 'CORE'
  }),

  crm: Object.freeze({
    key: 'crm',
    id: MGR_CONFIG.CRM_WORKBOOK_ID,
    role: 'CRM'
  }),

  marketing: Object.freeze({
    key: 'marketing',
    id: MGR_CONFIG.MARKETING_WORKBOOK_ID,
    role: 'MARKETING'
  }),

  website: Object.freeze({
    key: 'website',
    id: MGR_CONFIG.WEBSITE_WORKBOOK_ID,
    role: 'WEBSITE'
  }),

  analytics: Object.freeze({
    key: 'analytics',
    id: MGR_CONFIG.ANALYTICS_WORKBOOK_ID,
    role: 'ANALYTICS'
  }),

  archive: Object.freeze({
    key: 'archive',
    id: MGR_CONFIG.ARCHIVE_WORKBOOK_ID,
    role: 'ARCHIVE'
  }),

  featured_listings: Object.freeze({
    key: 'featured_listings',
    id: MGR_CONFIG.FEATURED_LISTINGS_SHEET_ID,
    role: 'FEATURED_LISTINGS'
  })
});

/**
 * Return a config value.
 *
 * @param {string=} key
 * @param {*=} fallback
 * @return {*}
 */
function MGR_getConfig(key, fallback) {
  if (!key) {
    return MGR_cloneConfigValue_(MGR_CONFIG);
  }

  if (Object.prototype.hasOwnProperty.call(MGR_CONFIG, key)) {
    return MGR_CONFIG[key];
  }

  if (arguments.length > 1) {
    return fallback;
  }

  throw new Error('Unknown MelroseOS config key: ' + key);
}

/**
 * Return config value overridden by Script Properties when present.
 *
 * Script Property naming:
 * MGR_CFG_<KEY>
 *
 * @param {string} key
 * @param {*=} fallback
 * @return {*}
 */
function MGR_getEffectiveConfig(key, fallback) {
  MGR_requireConfigKey_(key);

  const propertyKey = 'MGR_CFG_' + String(key).toUpperCase();

  try {
    const value =
      PropertiesService.getScriptProperties().getProperty(propertyKey);

    if (value !== null && value !== '') {
      return MGR_parseConfigOverride_(value);
    }
  } catch (err) {
    // Fall back to static config.
  }

  return MGR_getConfig(key, fallback);
}

/**
 * Get all registered MelroseOS accounts.
 *
 * @return {Object}
 */
function MGR_getAccountRegistry() {
  return MGR_cloneConfigValue_(MGR_ACCOUNT_REGISTRY);
}

/**
 * Get one registered account.
 *
 * @param {string} alias
 * @return {Object}
 */
function MGR_getAccount(alias) {
  MGR_requireConfigKey_(alias);

  if (!Object.prototype.hasOwnProperty.call(MGR_ACCOUNT_REGISTRY, alias)) {
    throw new Error('Unknown MelroseOS account alias: ' + alias);
  }

  return MGR_cloneConfigValue_(MGR_ACCOUNT_REGISTRY[alias]);
}

/**
 * Return active accounts ordered by priority.
 *
 * @return {Array<Object>}
 */
function MGR_getActiveAccounts() {
  return Object.keys(MGR_ACCOUNT_REGISTRY)
    .map(function (key) {
      return MGR_ACCOUNT_REGISTRY[key];
    })
    .filter(function (account) {
      return account.active === true;
    })
    .sort(function (a, b) {
      return a.priority - b.priority;
    })
    .map(MGR_cloneConfigValue_);
}

/**
 * Get all workbook registry entries.
 *
 * @return {Object}
 */
function MGR_getWorkbookRegistry() {
  return MGR_cloneConfigValue_(MGR_WORKBOOK_REGISTRY);
}

/**
 * Get one workbook registry entry.
 *
 * @param {string} key
 * @return {Object}
 */
function MGR_getWorkbookConfig(key) {
  MGR_requireConfigKey_(key);

  if (!Object.prototype.hasOwnProperty.call(MGR_WORKBOOK_REGISTRY, key)) {
    throw new Error('Unknown MelroseOS workbook key: ' + key);
  }

  return MGR_cloneConfigValue_(MGR_WORKBOOK_REGISTRY[key]);
}

/**
 * Get one workbook ID.
 *
 * @param {string} key
 * @return {string}
 */
function MGR_getWorkbookId(key) {
  return MGR_getWorkbookConfig(key).id;
}

/**
 * Get broker identity.
 *
 * @return {Object}
 */
function MGR_getBrokerIdentity() {
  return {
    agentId: MGR_CONFIG.BROKER_AGENT_ID,
    name: MGR_CONFIG.BROKER_NAME,
    email: MGR_CONFIG.BROKER_EMAIL
  };
}

/**
 * Get standard brokerage identity.
 *
 * @return {Object}
 */
function MGR_getBrokerageIdentity() {
  return {
    system: MGR_CONFIG.SYSTEM_NAME,
    brokerageEmail: MGR_CONFIG.BROKERAGE_EMAIL,
    brokerEmail: MGR_CONFIG.BROKER_EMAIL,
    website: MGR_CONFIG.WEBSITE_PRIMARY,
    complianceFooter: MGR_CONFIG.COMPLIANCE_FOOTER
  };
}

/**
 * Return lead routing defaults.
 *
 * @return {Object}
 */
function MGR_getLeadRoutingConfig() {
  return {
    defaultRoute: MGR_CONFIG.DEFAULT_LEAD_ROUTE,
    recruitingRoute: MGR_CONFIG.RECRUITING_ROUTE,
    cleverRoute: MGR_CONFIG.CLEVER_ROUTE,
    fallbackRoute: MGR_CONFIG.FALLBACK_ROUTE,
    defaultDailyLeadCap: MGR_CONFIG.DEFAULT_DAILY_LEAD_CAP,
    brokerAgentId: MGR_CONFIG.BROKER_AGENT_ID
  };
}

/**
 * Return authentication/session defaults.
 *
 * @return {Object}
 */
function MGR_getSessionConfig() {
  return {
    otpHours: MGR_CONFIG.AGENT_OTP_HOURS,
    sessionHours: MGR_CONFIG.AGENT_SESSION_HOURS
  };
}

/**
 * Return canonical website URLs.
 *
 * @return {Object}
 */
function MGR_getWebsiteConfig() {
  return {
    primary: MGR_CONFIG.WEBSITE_PRIMARY,
    secondary: MGR_CONFIG.WEBSITE_SECONDARY,
    bookNow:
      MGR_CONFIG.WEBSITE_PRIMARY.replace(/\/$/, '') +
      MGR_CONFIG.BOOK_NOW_PATH
  };
}

/**
 * Return a compact config diagnostic payload.
 *
 * @return {Object}
 */
function MGR_configDiagnostics() {
  const requiredKeys = [
    'SYSTEM_NAME',
    'SYSTEM_CODE',
    'TIMEZONE',
    'BROKER_EMAIL',
    'CORE_WORKBOOK_ID',
    'CRM_WORKBOOK_ID',
    'MARKETING_WORKBOOK_ID',
    'WEBSITE_WORKBOOK_ID',
    'ANALYTICS_WORKBOOK_ID',
    'ARCHIVE_WORKBOOK_ID'
  ];

  const missing = requiredKeys.filter(function (key) {
    const value = MGR_CONFIG[key];
    return value === undefined || value === null || String(value).trim() === '';
  });

  return {
    success: missing.length === 0,
    version: MGR_CONFIG_VERSION,
    environment: MGR_CONFIG.ENVIRONMENT,
    timezone: MGR_CONFIG.TIMEZONE,
    missingKeys: missing,
    accountCount: Object.keys(MGR_ACCOUNT_REGISTRY).length,
    workbookCount: Object.keys(MGR_WORKBOOK_REGISTRY).length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Parse simple Script Property overrides.
 *
 * @param {string} value
 * @return {*}
 * @private
 */
function MGR_parseConfigOverride_(value) {
  const text = String(value).trim();

  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);

  if (
    (text.charAt(0) === '{' && text.charAt(text.length - 1) === '}') ||
    (text.charAt(0) === '[' && text.charAt(text.length - 1) === ']')
  ) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return text;
    }
  }

  return text;
}

/**
 * Clone config-safe values.
 *
 * @param {*} value
 * @return {*}
 * @private
 */
function MGR_cloneConfigValue_(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Local guard so config does not depend on Utilities module.
 *
 * @param {*} value
 * @private
 */
function MGR_requireConfigKey_(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error('Configuration key is required.');
  }
}
