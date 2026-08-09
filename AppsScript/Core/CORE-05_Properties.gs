/**
 * MelroseOS Enterprise Core
 * File: CORE-05_Properties.gs
 * Release: MOS5-CORE-05
 * Version: 1.0.0
 * Purpose: Centralized Script Properties access and namespacing.
 */

const MGR_PROPERTY_PREFIX = 'MGR_';

function MGR_getScriptProperty(key, fallback) {
  MGR_require(key, 'Property key');

  const value =
    PropertiesService
      .getScriptProperties()
      .getProperty(MGR_propertyKey_(key));

  return value === null ? fallback : value;
}

function MGR_setScriptProperty(key, value) {
  MGR_require(key, 'Property key');

  PropertiesService
    .getScriptProperties()
    .setProperty(
      MGR_propertyKey_(key),
      String(value === undefined || value === null ? '' : value)
    );

  return true;
}

function MGR_setScriptProperties(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('MGR_setScriptProperties requires an object.');
  }

  const payload = {};

  Object.keys(values).forEach(function (key) {
    payload[MGR_propertyKey_(key)] =
      String(values[key] === undefined || values[key] === null ? '' : values[key]);
  });

  PropertiesService
    .getScriptProperties()
    .setProperties(payload, false);

  return true;
}

function MGR_deleteScriptProperty(key) {
  MGR_require(key, 'Property key');

  PropertiesService
    .getScriptProperties()
    .deleteProperty(MGR_propertyKey_(key));

  return true;
}

function MGR_getAllScriptProperties(options) {
  options = options || {};

  const properties =
    PropertiesService
      .getScriptProperties()
      .getProperties();

  if (options.includeNonMgr === true) {
    return properties;
  }

  return Object.keys(properties).reduce(function (result, key) {
    if (key.indexOf(MGR_PROPERTY_PREFIX) === 0) {
      result[key] = properties[key];
    }

    return result;
  }, {});
}

function MGR_getJsonProperty(key, fallback) {
  const raw = MGR_getScriptProperty(key, null);

  if (raw === null) {
    return fallback;
  }

  return MGR_safeJsonParse(raw, fallback);
}

function MGR_setJsonProperty(key, value) {
  return MGR_setScriptProperty(
    key,
    MGR_safeJsonStringify(value, '{}')
  );
}

function MGR_propertyExists(key) {
  return MGR_getScriptProperty(key, null) !== null;
}

function MGR_propertyKey_(key) {
  const normalized = String(key).trim().toUpperCase();

  return normalized.indexOf(MGR_PROPERTY_PREFIX) === 0
    ? normalized
    : MGR_PROPERTY_PREFIX + normalized;
}
