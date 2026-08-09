/**
 * MelroseOS Enterprise Core
 * File: CORE-06_Validation.gs
 * Release: MOS5-CORE-06
 * Version: 1.0.0
 * Purpose: Shared validation and assertion helpers.
 */

function MGR_isValidEmail(value) {
  const email = MGR_normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function MGR_isValidPhone(value) {
  const digits = MGR_normalizePhone(value);
  return digits.length >= 10 && digits.length <= 15;
}

function MGR_assertEmail(value, label) {
  if (!MGR_isValidEmail(value)) {
    throw new Error((label || 'Email') + ' is invalid.');
  }

  return MGR_normalizeEmail(value);
}

function MGR_assertPhone(value, label) {
  if (!MGR_isValidPhone(value)) {
    throw new Error((label || 'Phone') + ' is invalid.');
  }

  return MGR_normalizePhone(value);
}

function MGR_assertOneOf(value, allowed, label) {
  if (!Array.isArray(allowed) || allowed.indexOf(value) === -1) {
    throw new Error(
      (label || 'Value') +
      ' is not allowed: ' +
      String(value)
    );
  }

  return value;
}

function MGR_assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error((label || 'Value') + ' must be an object.');
  }

  return value;
}

function MGR_assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error((label || 'Value') + ' must be an array.');
  }

  return value;
}

function MGR_assertNonEmptyArray(value, label) {
  MGR_assertArray(value, label);

  if (value.length === 0) {
    throw new Error((label || 'Value') + ' must not be empty.');
  }

  return value;
}

function MGR_validateRequiredFields(object, fields) {
  MGR_assertObject(object, 'Object');
  MGR_assertArray(fields, 'Required fields');

  const missing = fields.filter(function (field) {
    const value = object[field];

    return (
      value === undefined ||
      value === null ||
      String(value).trim() === ''
    );
  });

  return {
    success: missing.length === 0,
    missing: missing
  };
}

function MGR_assertRequiredFields(object, fields) {
  const result = MGR_validateRequiredFields(object, fields);

  if (!result.success) {
    throw new Error(
      'Missing required fields: ' +
      result.missing.join(', ')
    );
  }

  return true;
}

function MGR_validateLeadType(value) {
  if (
    typeof MGR_isKnownLeadType === 'function' &&
    !MGR_isKnownLeadType(value)
  ) {
    throw new Error('Invalid lead type: ' + value);
  }

  return value;
}
