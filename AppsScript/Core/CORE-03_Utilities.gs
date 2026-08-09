/**
 * MelroseOS Enterprise Core
 * File: CORE-03_Utilities.gs
 * Release: MOS5-CORE-03
 * Version: 1.0.0
 * Purpose: Shared normalization, parsing, collection, hashing, and formatting helpers.
 */

function MGR_nowIso() {
  return new Date().toISOString();
}

function MGR_normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function MGR_normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function MGR_normalizeText(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}

function MGR_normalizeKey(value) {
  return MGR_normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function MGR_require(value, label) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  ) {
    throw new Error((label || 'Value') + ' is required.');
  }

  return value;
}

function MGR_safeJsonParse(value, fallback) {
  try {
    if (typeof value !== 'string') return value;
    return JSON.parse(value);
  } catch (err) {
    return arguments.length > 1 ? fallback : null;
  }
}

function MGR_safeJsonStringify(value, fallback) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return arguments.length > 1 ? fallback : '';
  }
}

function MGR_toBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;

  const normalized = String(
    value === undefined || value === null ? '' : value
  ).trim().toUpperCase();

  if (['TRUE', 'YES', 'Y', '1', 'ON'].indexOf(normalized) !== -1) {
    return true;
  }

  if (['FALSE', 'NO', 'N', '0', 'OFF'].indexOf(normalized) !== -1) {
    return false;
  }

  return arguments.length > 1 ? fallback : false;
}

function MGR_toNumber(value, fallback) {
  const number = Number(value);
  return isFinite(number)
    ? number
    : (arguments.length > 1 ? fallback : 0);
}

function MGR_unique(values) {
  return Array.from(
    new Set(
      (values || []).filter(function (value) {
        return (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ''
        );
      })
    )
  );
}

function MGR_chunk(values, size) {
  const array = Array.isArray(values) ? values : [];
  const chunkSize = Math.max(1, Number(size) || 1);
  const output = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    output.push(array.slice(i, i + chunkSize));
  }

  return output;
}

function MGR_pick(object, keys) {
  const source = object || {};

  return (keys || []).reduce(function (result, key) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }

    return result;
  }, {});
}

function MGR_mergeObjects() {
  const args = Array.prototype.slice.call(arguments);

  return args.reduce(function (result, item) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.keys(item).forEach(function (key) {
        result[key] = item[key];
      });
    }

    return result;
  }, {});
}

function MGR_hashText(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value === undefined || value === null ? '' : value),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function (byte) {
    const normalized = (byte + 256) % 256;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function MGR_formatLocalDate(date, pattern) {
  const value = date instanceof Date ? date : new Date(date || new Date());
  const timezone =
    typeof MGR_getConfig === 'function'
      ? MGR_getConfig('TIMEZONE', 'America/Chicago')
      : 'America/Chicago';

  return Utilities.formatDate(
    value,
    timezone,
    pattern || 'yyyy-MM-dd HH:mm:ss'
  );
}

function MGR_safeTrim(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function MGR_isBlank(value) {
  return MGR_safeTrim(value) === '';
}

function MGR_coalesce() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = arguments[i];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return value;
    }
  }

  return null;
}
