/**
 * ================================================================
 * MELROSEOS 4.0 — CORE COMMON SERVICES
 * Version 4.0.0
 *
 * Shared services:
 * - Command Center access
 * - Standard IDs
 * - Retry handling
 * - Lock handling
 * - Safe spreadsheet reads and writes
 * - Sheet/schema management
 * - Object-based row operations
 * - String, number, boolean and date helpers
 * - Core activity and error logging
 *
 * All public and private functions use the m4_ prefix to prevent
 * collisions with existing MelroseOS functions.
 * ================================================================
 */

const M4_CORE = Object.freeze({
  VERSION: '4.0.1',
  NAME: 'MelroseOS',
  ENVIRONMENT: 'PRODUCTION',
  TIMEZONE: 'America/Chicago',

  SHEETS: Object.freeze({
    SETTINGS: 'MelroseOS_Settings',
    REGISTRY: 'MelroseOS_Registry',
    ACTIVITY: 'MelroseOS_ActivityLog',
    ERRORS: 'MelroseOS_ErrorLog',
    HEALTH: 'MelroseOS_Health'
  }),

  COLORS: Object.freeze({
    NAVY: '#0B1F3A',
    NAVY_LIGHT: '#29476D',
    GOLD: '#C9A227',
    GOLD_LIGHT: '#F5E8B8',
    WHITE: '#FFFFFF',
    BLACK: '#111111',
    GRAY: '#E8EAED',
    GRAY_LIGHT: '#F7F8FA',
    GREEN: '#188038',
    GREEN_LIGHT: '#DDF4E4',
    YELLOW: '#F9AB00',
    YELLOW_LIGHT: '#FFF4CC',
    RED: '#D93025',
    RED_LIGHT: '#FCE8E6',
    BLUE_LIGHT: '#DDEAF7'
  }),

  LOCK_WAIT_MS: 5000,
  RETRY_ATTEMPTS: 5,
  RETRY_DELAY_MS: 1000,
  HEADER_CACHE_TTL_MS: 300000
});

var M4_CORE_CACHE_ = {
  headerMaps: {},
  commandCenter: null,
  commandCenterAt: 0
};


/* =================================================================
   FOUNDATION INSTALLER
================================================================= */

/**
 * Installs the initial MelroseOS 4.0 core foundation.
 *
 * Safe to rerun.
 */
function setupMelroseCoreFoundation() {
  const startedAt = Date.now();

  try {
    const ss = m4_getCommandCenter_();

    m4_ensureCoreActivitySheet_(ss);
    m4_ensureCoreErrorSheet_(ss);
    m4_ensureCoreHealthSheet_(ss);

    if (
      typeof setupMelroseCoreSettings ===
      'function'
    ) {
      setupMelroseCoreSettings();
    }

    if (
      typeof setupMelroseCoreRegistry ===
      'function'
    ) {
      setupMelroseCoreRegistry();
    }

    const health =
      runMelroseCoreFoundationHealthCheck();

    m4_logActivity_({
      module: 'CORE_COMMON',
      action: 'CORE_FOUNDATION_SETUP',
      status:
        health.overallStatus === 'PASS'
          ? 'SUCCESS'
          : 'WARNING',
      details:
        `MelroseOS ${M4_CORE.VERSION} core foundation installed.`,
      durationMS:
        Date.now() - startedAt
    });

    return {
      success: true,
      version: M4_CORE.VERSION,
      commandCenterID: ss.getId(),
      health
    };

  } catch (error) {
    m4_logError_(
      'setupMelroseCoreFoundation',
      error,
      'CORE_COMMON'
    );

    throw error;
  }
}


/* =================================================================
   COMMAND CENTER
================================================================= */

/**
 * Returns the MelroseOS Command Center spreadsheet.
 *
 * Priority:
 * 1. Existing getCommandCenter_()
 * 2. Existing getMelroseSetting_()
 * 3. Script property
 * 4. Active spreadsheet
 */
function m4_getCommandCenter_() {
  const now = Date.now();

  if (
    M4_CORE_CACHE_.commandCenter &&
    now - M4_CORE_CACHE_.commandCenterAt <
      M4_CORE.HEADER_CACHE_TTL_MS
  ) {
    return M4_CORE_CACHE_.commandCenter;
  }

  let ss = null;

  if (typeof getCommandCenter_ === 'function') {
    try {
      ss = getCommandCenter_();
    } catch (ignored) {}
  }

  if (!ss && typeof getMelroseSetting_ === 'function') {
    try {
      const configuredID = getMelroseSetting_(
        'COMMAND_CENTER_SPREADSHEET_ID',
        ''
      );

      if (configuredID) {
        ss = m4_withRetry_(
          () => SpreadsheetApp.openById(
            String(configuredID).trim()
          ),
          { attempts: 4, delayMS: 1000 }
        );
      }
    } catch (ignored) {}
  }

  if (!ss) {
    const propertyID = PropertiesService
      .getScriptProperties()
      .getProperty('M4_COMMAND_CENTER_SPREADSHEET_ID');

    if (propertyID) {
      ss = m4_withRetry_(
        () => SpreadsheetApp.openById(propertyID),
        { attempts: 4, delayMS: 1000 }
      );
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    throw new Error(
      'MelroseOS could not locate the Command Center spreadsheet.'
    );
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(
      'M4_COMMAND_CENTER_SPREADSHEET_ID',
      ss.getId()
    );

  M4_CORE_CACHE_.commandCenter = ss;
  M4_CORE_CACHE_.commandCenterAt = now;

  return ss;
}


/**
 * Saves the Command Center ID for future background executions.
 */
function setMelroseCoreCommandCenter() {
  const active =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!active) {
    throw new Error(
      'Open the Command Center spreadsheet before running this function.'
    );
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(
      'M4_COMMAND_CENTER_SPREADSHEET_ID',
      active.getId()
    );

  return {
    success: true,
    spreadsheetID: active.getId(),
    spreadsheetName: active.getName()
  };
}


/* =================================================================
   RETRY FRAMEWORK
================================================================= */

/**
 * Executes a callback with retry protection.
 */
function m4_withRetry_(
  callback,
  options
) {
  if (
    typeof callback !== 'function'
  ) {
    throw new Error(
      'm4_withRetry_ requires a callback function.'
    );
  }

  const settings =
    options &&
    typeof options === 'object'
      ? options
      : {};

  const attempts =
    Math.max(
      1,
      Number(
        settings.attempts ||
        M4_CORE.RETRY_ATTEMPTS
      )
    );

  const delayMS =
    Math.max(
      0,
      Number(
        settings.delayMS ||
        M4_CORE.RETRY_DELAY_MS
      )
    );

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt++
  ) {
    try {
      return callback(attempt);

    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        Utilities.sleep(
          delayMS * attempt
        );
      }
    }
  }

  throw lastError ||
    new Error(
      'The retry operation failed.'
    );
}


/* =================================================================
   LOCK FRAMEWORK
================================================================= */

/**
 * Executes a callback inside a document lock.
 */
function m4_withDocumentLock_(
  callback,
  options
) {
  return m4_withLock_(
    LockService.getDocumentLock(),
    callback,
    options
  );
}


/**
 * Executes a callback inside a script lock.
 */
function m4_withScriptLock_(
  callback,
  options
) {
  return m4_withLock_(
    LockService.getScriptLock(),
    callback,
    options
  );
}


/**
 * Executes a callback inside a user lock.
 */
function m4_withUserLock_(
  callback,
  options
) {
  return m4_withLock_(
    LockService.getUserLock(),
    callback,
    options
  );
}


function m4_withLock_(
  lock,
  callback,
  options
) {
  if (
    typeof callback !== 'function'
  ) {
    throw new Error(
      'A lock callback is required.'
    );
  }

  const settings =
    options &&
    typeof options === 'object'
      ? options
      : {};

  const waitMS =
    Math.max(
      1,
      Number(
        settings.waitMS ||
        M4_CORE.LOCK_WAIT_MS
      )
    );

  if (!lock.tryLock(waitMS)) {
    if (
      settings.deferOnFailure === true
    ) {
      return {
        success: true,
        deferred: true,
        reason:
          'Another MelroseOS process currently holds the lock.'
      };
    }

    throw new Error(
      'MelroseOS could not obtain the required lock.'
    );
  }

  try {
    return callback();

  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {
      // Lock was already released.
    }
  }
}


/* =================================================================
   STANDARD IDS
================================================================= */

/**
 * Creates a standardized MelroseOS ID.
 *
 * Example:
 * ASSET-20260713-203012-4821
 */
function m4_createID_(
  prefix
) {
  const safePrefix =
    m4_slugify_(
      prefix || 'MELROSE'
    )
      .replace(/-/g, '')
      .toUpperCase() ||
    'MELROSE';

  const timestamp =
    Utilities.formatDate(
      new Date(),
      m4_timezone_(),
      'yyyyMMdd-HHmmss'
    );

  const random =
    Math.floor(
      1000 +
      Math.random() * 9000
    );

  return [
    safePrefix,
    timestamp,
    random
  ].join('-');
}


/* =================================================================
   SHEET AND SCHEMA SERVICES
================================================================= */

/**
 * Ensures a sheet exists and has the supplied headers.
 *
 * Existing rows are preserved.
 * Missing columns are added to the end.
 */
function m4_ensureSheet_(
  ss,
  sheetName,
  headers,
  options
) {
  if (!ss) {
    throw new Error('A spreadsheet is required.');
  }

  const cleanName = m4_trim_(sheetName);
  if (!cleanName) {
    throw new Error('A sheet name is required.');
  }

  const expectedHeaders = Array.isArray(headers)
    ? headers.map(m4_trim_).filter(Boolean)
    : [];

  const settings =
    options && typeof options === 'object'
      ? options
      : {};

  let sheet = m4_withRetry_(
    () => ss.getSheetByName(cleanName),
    { attempts: 4, delayMS: 900 }
  );

  if (!sheet) {
    sheet = m4_withRetry_(
      () => ss.insertSheet(cleanName),
      { attempts: 5, delayMS: 1200 }
    );
  }

  if (expectedHeaders.length) {
    m4_ensureColumns_(sheet, expectedHeaders.length);

    const readColumnCount = Math.max(
      expectedHeaders.length,
      m4_withRetry_(
        () => sheet.getLastColumn(),
        { attempts: 4, delayMS: 900 }
      )
    );

    const existingHeaders = m4_withRetry_(
      () => sheet
        .getRange(1, 1, 1, readColumnCount)
        .getDisplayValues()[0]
        .map(m4_trim_),
      { attempts: 5, delayMS: 1000 }
    );

    const hasHeaders = existingHeaders.some(Boolean);

    if (!hasHeaders) {
      m4_withRetry_(
        () => sheet
          .getRange(1, 1, 1, expectedHeaders.length)
          .setValues([expectedHeaders]),
        { attempts: 5, delayMS: 1100 }
      );
    } else {
      const missing = expectedHeaders.filter(
        header => !existingHeaders.includes(header)
      );

      if (missing.length) {
        const startColumn = Math.max(
          1,
          m4_withRetry_(
            () => sheet.getLastColumn(),
            { attempts: 4, delayMS: 900 }
          ) + 1
        );

        m4_ensureColumns_(
          sheet,
          startColumn + missing.length - 1
        );

        m4_withRetry_(
          () => sheet
            .getRange(1, startColumn, 1, missing.length)
            .setValues([missing]),
          { attempts: 5, delayMS: 1100 }
        );
      }
    }

    m4_clearHeaderCache_(sheet);

    if (settings.skipFormatting !== true) {
      m4_formatHeader_(
        sheet,
        m4_withRetry_(
          () => sheet.getLastColumn(),
          { attempts: 4, delayMS: 900 }
        ),
        settings
      );
    }
  }

  if (settings.frozenRows !== false) {
    try {
      sheet.setFrozenRows(
        Number(settings.frozenRows || 1)
      );
    } catch (ignored) {}
  }

  return sheet;
}


/**
 * Ensures a sheet contains at least the required number of columns.
 */
function m4_ensureColumns_(
  sheet,
  requiredColumns
) {
  const required = Math.max(
    1,
    Number(requiredColumns || 1)
  );

  const existing = m4_withRetry_(
    () => sheet.getMaxColumns(),
    { attempts: 5, delayMS: 1000 }
  );

  if (existing >= required) {
    return sheet;
  }

  m4_withRetry_(
    () => sheet.insertColumnsAfter(
      existing,
      required - existing
    ),
    { attempts: 5, delayMS: 1400 }
  );

  m4_clearHeaderCache_(sheet);
  return sheet;
}


/**
 * Ensures a sheet contains at least the required number of rows.
 */
function m4_ensureRows_(
  sheet,
  requiredRows
) {
  const required = Math.max(
    1,
    Number(requiredRows || 1)
  );

  const existing = m4_withRetry_(
    () => sheet.getMaxRows(),
    { attempts: 5, delayMS: 1000 }
  );

  if (existing >= required) {
    return sheet;
  }

  m4_withRetry_(
    () => sheet.insertRowsAfter(
      existing,
      required - existing
    ),
    { attempts: 5, delayMS: 1400 }
  );

  return sheet;
}


/**
 * Returns a map of header names to 1-based column numbers.
 */
function m4_headerMap_(sheet) {
  if (!sheet) {
    throw new Error('A sheet is required.');
  }

  const cacheKey =
    `${sheet.getParent().getId()}::${sheet.getSheetId()}`;

  const cached = M4_CORE_CACHE_.headerMaps[cacheKey];

  if (
    cached &&
    Date.now() - cached.at <
      M4_CORE.HEADER_CACHE_TTL_MS
  ) {
    return Object.assign({}, cached.map);
  }

  const lastColumn = m4_withRetry_(
    () => sheet.getLastColumn(),
    { attempts: 4, delayMS: 900 }
  );

  if (lastColumn < 1) {
    return {};
  }

  const headers = m4_withRetry_(
    () => sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0],
    { attempts: 5, delayMS: 1000 }
  );

  const map = {};

  headers.forEach((header, index) => {
    const name = m4_trim_(header);
    if (name) {
      map[name] = index + 1;
    }
  });

  M4_CORE_CACHE_.headerMaps[cacheKey] = {
    at: Date.now(),
    map: map
  };

  return Object.assign({}, map);
}


/**
 * Reads sheet rows as objects with retry protection.
 */
function m4_readObjects_(sheet, options) {
  if (!sheet) {
    return [];
  }

  const settings =
    options && typeof options === 'object'
      ? options
      : {};

  const lastRow = m4_withRetry_(
    () => sheet.getLastRow(),
    { attempts: 4, delayMS: 900 }
  );

  const lastColumn = m4_withRetry_(
    () => sheet.getLastColumn(),
    { attempts: 4, delayMS: 900 }
  );

  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const values = m4_withRetry_(
    () => sheet
      .getRange(1, 1, lastRow, lastColumn)
      .getValues(),
    { attempts: 5, delayMS: 1200 }
  );

  const headers = values[0].map(m4_trim_);

  return values
    .slice(1)
    .map((row, index) => {
      const record = {};

      headers.forEach((header, columnIndex) => {
        if (header) {
          record[header] = row[columnIndex];
        }
      });

      if (settings.includeRowNumber === true) {
        record._rowNumber = index + 2;
      }

      return record;
    })
    .filter(record => {
      if (settings.includeBlankRows === true) {
        return true;
      }

      return Object.keys(record)
        .filter(key => key !== '_rowNumber')
        .some(
          key =>
            String(record[key] ?? '').trim() !== ''
        );
    });
}


/**
 * Finds a row using a header name and exact value.
 */
function m4_findRow_(
  sheet,
  headerName,
  value
) {
  if (!sheet) {
    return 0;
  }

  const lastRow = m4_withRetry_(
    () => sheet.getLastRow(),
    { attempts: 4, delayMS: 900 }
  );

  if (lastRow < 2) {
    return 0;
  }

  const map = m4_headerMap_(sheet);
  const column = map[headerName];

  if (!column) {
    throw new Error(
      `Column "${headerName}" was not found in ${sheet.getName()}.`
    );
  }

  const target = String(value ?? '').trim();

  const values = m4_withRetry_(
    () => sheet
      .getRange(2, column, lastRow - 1, 1)
      .getDisplayValues()
      .flat(),
    { attempts: 5, delayMS: 1000 }
  );

  const index = values.findIndex(
    current => String(current).trim() === target
  );

  return index >= 0 ? index + 2 : 0;
}


/**
 * Reads one row as an object.
 */
function m4_readRowObject_(
  sheet,
  rowNumber
) {
  const row = Number(rowNumber || 0);

  if (!sheet || row < 2) {
    return {};
  }

  const lastRow = m4_withRetry_(
    () => sheet.getLastRow(),
    { attempts: 4, delayMS: 900 }
  );

  if (row > lastRow) {
    return {};
  }

  const headers = m4_getHeaders_(sheet);

  const values = m4_withRetry_(
    () => sheet
      .getRange(row, 1, 1, headers.length)
      .getValues()[0],
    { attempts: 5, delayMS: 1000 }
  );

  const record = { _rowNumber: row };

  headers.forEach((header, index) => {
    if (header) {
      record[header] = values[index];
    }
  });

  return record;
}


/**
 * Appends an object by matching its keys to sheet headers.
 */
function m4_appendObject_(
  sheet,
  record
) {
  if (
    !sheet ||
    !record ||
    typeof record !== 'object'
  ) {
    throw new Error(
      'A sheet and record object are required.'
    );
  }

  const headers = m4_getHeaders_(sheet);

  const values = headers.map(
    header =>
      Object.prototype.hasOwnProperty.call(
        record,
        header
      )
        ? record[header]
        : ''
  );

  const row = Math.max(
    2,
    m4_withRetry_(
      () => sheet.getLastRow(),
      { attempts: 4, delayMS: 900 }
    ) + 1
  );

  m4_ensureRows_(sheet, row);

  m4_withRetry_(
    () => sheet
      .getRange(row, 1, 1, headers.length)
      .setValues([values]),
    { attempts: 5, delayMS: 1200 }
  );

  return row;
}


/**
 * Updates selected fields in one row.
 */
function m4_updateObject_(
  sheet,
  rowNumber,
  updates
) {
  const row = Number(rowNumber || 0);

  if (
    !sheet ||
    row < 2 ||
    !updates ||
    typeof updates !== 'object'
  ) {
    throw new Error(
      'A valid sheet, row and updates object are required.'
    );
  }

  const headers = m4_getHeaders_(sheet);

  const current = m4_withRetry_(
    () => sheet
      .getRange(row, 1, 1, headers.length)
      .getValues()[0],
    { attempts: 5, delayMS: 1000 }
  );

  const headerSet = new Set(headers);

  Object.keys(updates).forEach(header => {
    if (!headerSet.has(header)) {
      throw new Error(
        `Column "${header}" was not found in ${sheet.getName()}.`
      );
    }
  });

  headers.forEach((header, index) => {
    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        header
      )
    ) {
      current[index] = updates[header];
    }
  });

  m4_withRetry_(
    () => sheet
      .getRange(row, 1, 1, headers.length)
      .setValues([current]),
    { attempts: 5, delayMS: 1200 }
  );

  return {
    success: true,
    rowNumber: row,
    updatedFields: Object.keys(updates)
  };
}


/**
 * Upserts a record by a primary-key field.
 */
function m4_upsertObject_(
  sheet,
  primaryKeyHeader,
  record
) {
  if (
    !record ||
    !Object.prototype.hasOwnProperty.call(
      record,
      primaryKeyHeader
    )
  ) {
    throw new Error(
      `The record must contain ${primaryKeyHeader}.`
    );
  }

  const row = m4_findRow_(
    sheet,
    primaryKeyHeader,
    record[primaryKeyHeader]
  );

  if (row) {
    m4_updateObject_(sheet, row, record);

    return {
      success: true,
      created: false,
      rowNumber: row
    };
  }

  const newRow = m4_appendObject_(sheet, record);

  return {
    success: true,
    created: true,
    rowNumber: newRow
  };
}




/**
 * Clears cached headers for one sheet or all sheets.
 */
function m4_clearHeaderCache_(sheet) {
  if (!sheet) {
    M4_CORE_CACHE_.headerMaps = {};
    return;
  }

  try {
    const key =
      `${sheet.getParent().getId()}::${sheet.getSheetId()}`;

    delete M4_CORE_CACHE_.headerMaps[key];
  } catch (ignored) {}
}


/**
 * Returns the current header row with retry protection.
 */
function m4_getHeaders_(sheet) {
  const lastColumn = m4_withRetry_(
    () => sheet.getLastColumn(),
    { attempts: 4, delayMS: 900 }
  );

  if (lastColumn < 1) {
    return [];
  }

  return m4_withRetry_(
    () => sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(m4_trim_),
    { attempts: 5, delayMS: 1000 }
  );
}


/**
 * Appends multiple objects with one physical write.
 */
function m4_appendObjects_(sheet, records) {
  if (
    !sheet ||
    !Array.isArray(records) ||
    !records.length
  ) {
    return {
      success: true,
      appended: 0
    };
  }

  const headers = m4_getHeaders_(sheet);

  const values = records.map(record =>
    headers.map(header =>
      Object.prototype.hasOwnProperty.call(
        record,
        header
      )
        ? record[header]
        : ''
    )
  );

  const startRow = Math.max(
    2,
    m4_withRetry_(
      () => sheet.getLastRow(),
      { attempts: 4, delayMS: 900 }
    ) + 1
  );

  m4_ensureRows_(
    sheet,
    startRow + values.length - 1
  );

  m4_withRetry_(
    () => sheet
      .getRange(
        startRow,
        1,
        values.length,
        headers.length
      )
      .setValues(values),
    { attempts: 5, delayMS: 1200 }
  );

  return {
    success: true,
    appended: values.length,
    startRow: startRow
  };
}


/**
 * Upserts many records by primary key using one read and one write.
 */
function m4_upsertObjects_(
  sheet,
  primaryKeyHeader,
  records
) {
  if (!Array.isArray(records) || !records.length) {
    return {
      success: true,
      written: 0
    };
  }

  const headers = m4_getHeaders_(sheet);
  const existing = m4_readObjects_(sheet);
  const map = new Map();

  existing.forEach(record => {
    const key = String(
      record[primaryKeyHeader] || ''
    ).trim();

    if (key) {
      map.set(key, record);
    }
  });

  records.forEach(record => {
    const key = String(
      record[primaryKeyHeader] || ''
    ).trim();

    if (!key) {
      return;
    }

    map.set(
      key,
      Object.assign(
        {},
        map.get(key) || {},
        record
      )
    );
  });

  const output = Array.from(map.values());
  const lastRow = m4_withRetry_(
    () => sheet.getLastRow(),
    { attempts: 4, delayMS: 900 }
  );

  if (lastRow >= 2) {
    m4_withRetry_(
      () => sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          headers.length
        )
        .clearContent(),
      { attempts: 4, delayMS: 1000 }
    );
  }

  if (output.length) {
    const values = output.map(record =>
      headers.map(header =>
        Object.prototype.hasOwnProperty.call(
          record,
          header
        )
          ? record[header]
          : ''
      )
    );

    m4_ensureRows_(sheet, values.length + 1);

    m4_withRetry_(
      () => sheet
        .getRange(
          2,
          1,
          values.length,
          headers.length
        )
        .setValues(values),
      { attempts: 5, delayMS: 1200 }
    );
  }

  return {
    success: true,
    written: output.length
  };
}


/* =================================================================
   FORMATTING
================================================================= */

function m4_formatHeader_(
  sheet,
  columnCount,
  options
) {
  const settings =
    options && typeof options === 'object'
      ? options
      : {};

  const columns = Math.max(
    1,
    Number(
      columnCount ||
      m4_withRetry_(
        () => sheet.getLastColumn(),
        { attempts: 4, delayMS: 900 }
      )
    )
  );

  m4_withRetry_(
    () => sheet
      .getRange(1, 1, 1, columns)
      .setBackground(
        settings.headerBackground ||
        M4_CORE.COLORS.NAVY
      )
      .setFontColor(
        settings.headerFontColor ||
        M4_CORE.COLORS.WHITE
      )
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true),
    { attempts: 4, delayMS: 1000 }
  );

  try {
    sheet.setRowHeight(
      1,
      Number(settings.headerHeight || 42)
    );
  } catch (ignored) {}
}


/**
 * Breaks apart all merged ranges safely.
 */
function m4_unmergeAll_(
  sheet
) {
  if (!sheet) {
    return;
  }

  sheet
    .getRange(
      1,
      1,
      sheet.getMaxRows(),
      sheet.getMaxColumns()
    )
    .getMergedRanges()
    .forEach(range => {
      try {
        range.breakApart();
      } catch (ignored) {
        // Continue.
      }
    });
}


/* =================================================================
   VALIDATION HELPERS
================================================================= */

function m4_listValidation_(
  values,
  allowInvalid
) {
  return SpreadsheetApp
    .newDataValidation()
    .requireValueInList(
      Array.from(values || []),
      true
    )
    .setAllowInvalid(
      allowInvalid === true
    )
    .build();
}


function m4_checkboxRange_(
  range
) {
  range.clearDataValidations();
  range.insertCheckboxes();

  return range;
}


/* =================================================================
   STRING HELPERS
================================================================= */

function m4_trim_(
  value
) {
  return String(
    value ?? ''
  ).trim();
}


function m4_slugify_(
  value
) {
  return m4_trim_(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    );
}


function m4_titleCase_(
  value
) {
  return m4_trim_(value)
    .toLowerCase()
    .replace(
      /\b\w/g,
      character =>
        character.toUpperCase()
    );
}


function m4_normalizeEmail_(
  value
) {
  return m4_trim_(value)
    .toLowerCase();
}


function m4_normalizePhone_(
  value
) {
  return m4_trim_(value)
    .replace(/\D/g, '')
    .slice(-10);
}


function m4_truncate_(
  value,
  maximumLength
) {
  const text =
    String(value ?? '');

  const maximum =
    Math.max(
      0,
      Number(maximumLength || 0)
    );

  if (
    !maximum ||
    text.length <= maximum
  ) {
    return text;
  }

  return `${text.slice(
    0,
    Math.max(
      0,
      maximum - 1
    )
  )}…`;
}


/* =================================================================
   BOOLEAN / NUMBER / DATE HELPERS
================================================================= */

function m4_boolean_(
  value
) {
  if (
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (
    typeof value === 'number'
  ) {
    return value !== 0;
  }

  return [
    'TRUE',
    'YES',
    'Y',
    '1',
    'ON',
    'ENABLED',
    'ACTIVE'
  ].includes(
    m4_trim_(value)
      .toUpperCase()
  );
}


function m4_number_(
  value,
  fallback
) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : Number(fallback || 0);
}


function m4_divide_(
  numerator,
  denominator
) {
  const top =
    m4_number_(numerator);

  const bottom =
    m4_number_(denominator);

  return bottom === 0
    ? 0
    : top / bottom;
}


function m4_date_(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return isNaN(date.getTime())
    ? null
    : date;
}


function m4_timezone_() {
  if (
    typeof m4_getSetting_ ===
    'function'
  ) {
    try {
      return m4_getSetting_(
        'SYSTEM_TIMEZONE',
        M4_CORE.TIMEZONE
      );
    } catch (ignored) {
      // Use default.
    }
  }

  return M4_CORE.TIMEZONE;
}


function m4_formatDate_(
  value,
  pattern
) {
  const date =
    m4_date_(value);

  if (!date) {
    return '';
  }

  return Utilities.formatDate(
    date,
    m4_timezone_(),
    pattern ||
    'MMM d, yyyy h:mm a'
  );
}


/* =================================================================
   EMAIL / URL CHECKS
================================================================= */

function m4_isEmail_(
  value
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      m4_trim_(value)
    );
}


function m4_isURL_(
  value
) {
  try {
    const text =
      m4_trim_(value);

    return /^https?:\/\//i
      .test(text);
  } catch (ignored) {
    return false;
  }
}


/* =================================================================
   CORE LOGGING SHEETS
================================================================= */

function m4_ensureCoreActivitySheet_(
  ss
) {
  return m4_ensureSheet_(
    ss,
    M4_CORE.SHEETS.ACTIVITY,
    [
      'ActivityID',
      'Timestamp',
      'Module',
      'Action',
      'Status',
      'Details',
      'DurationMS',
      'UserEmail',
      'Source',
      'SystemVersion'
    ]
  );
}


function m4_ensureCoreErrorSheet_(
  ss
) {
  return m4_ensureSheet_(
    ss,
    M4_CORE.SHEETS.ERRORS,
    [
      'ErrorID',
      'Timestamp',
      'Module',
      'FunctionName',
      'ErrorMessage',
      'StackTrace',
      'UserEmail',
      'Resolved',
      'ResolutionNotes',
      'SystemVersion'
    ]
  );
}


function m4_ensureCoreHealthSheet_(
  ss
) {
  return m4_ensureSheet_(
    ss,
    M4_CORE.SHEETS.HEALTH,
    [
      'HealthCheckID',
      'CheckedAt',
      'Component',
      'CheckType',
      'Expected',
      'Actual',
      'HealthStatus',
      'RecommendedAction',
      'SystemVersion'
    ]
  );
}


/**
 * Writes an activity record.
 */
function m4_logActivity_(
  record
) {
  try {
    const ss =
      m4_getCommandCenter_();

    const sheet =
      m4_ensureCoreActivitySheet_(ss);

    m4_appendObject_(
      sheet,
      {
        ActivityID:
          m4_createID_('ACTIVITY'),
        Timestamp:
          new Date(),
        Module:
          record.module ||
          'CORE',
        Action:
          record.action ||
          'ACTIVITY',
        Status:
          record.status ||
          'SUCCESS',
        Details:
          record.details || '',
        DurationMS:
          m4_number_(
            record.durationMS
          ),
        UserEmail:
          m4_currentUser_(),
        Source:
          record.source ||
          record.module ||
          'MELROSEOS',
        SystemVersion:
          M4_CORE.VERSION
      }
    );

  } catch (error) {
    console.error(
      `m4_logActivity_: ${
        error.message || error
      }`
    );
  }
}


/**
 * Writes an error record.
 */
function m4_logError_(
  functionName,
  error,
  moduleName
) {
  try {
    const ss =
      m4_getCommandCenter_();

    const sheet =
      m4_ensureCoreErrorSheet_(ss);

    m4_appendObject_(
      sheet,
      {
        ErrorID:
          m4_createID_('ERROR'),
        Timestamp:
          new Date(),
        Module:
          moduleName ||
          'CORE',
        FunctionName:
          functionName || '',
        ErrorMessage:
          error &&
          error.message
            ? error.message
            : String(error || ''),
        StackTrace:
          error &&
          error.stack
            ? error.stack
            : '',
        UserEmail:
          m4_currentUser_(),
        Resolved:
          false,
        ResolutionNotes: '',
        SystemVersion:
          M4_CORE.VERSION
      }
    );

  } catch (loggingError) {
    console.error(
      `${functionName}: ${
        error &&
        error.message
          ? error.message
          : error
      }`
    );

    console.error(
      `Error logging failed: ${
        loggingError.message ||
        loggingError
      }`
    );
  }
}


/* =================================================================
   FOUNDATION HEALTH CHECK
================================================================= */

function runMelroseCoreFoundationHealthCheck() {
  const ss =
    m4_getCommandCenter_();

  const healthSheet =
    m4_ensureCoreHealthSheet_(ss);

  if (
    healthSheet.getLastRow() >= 2
  ) {
    healthSheet
      .getRange(
        2,
        1,
        healthSheet.getLastRow() - 1,
        healthSheet.getLastColumn()
      )
      .clearContent();
  }

  const checks = [
    {
      component:
        'Command Center',
      type:
        'SPREADSHEET',
      expected:
        'Accessible spreadsheet',
      actual:
        `${ss.getName()} • ${ss.getId()}`,
      status:
        'PASS',
      action: ''
    },
    {
      component:
        M4_CORE.SHEETS.ACTIVITY,
      type:
        'SHEET',
      expected:
        'Sheet exists',
      actual:
        ss.getSheetByName(
          M4_CORE.SHEETS.ACTIVITY
        )
          ? 'Detected'
          : 'Missing',
      status:
        ss.getSheetByName(
          M4_CORE.SHEETS.ACTIVITY
        )
          ? 'PASS'
          : 'FAIL',
      action:
        'Run setupMelroseCoreFoundation.'
    },
    {
      component:
        M4_CORE.SHEETS.ERRORS,
      type:
        'SHEET',
      expected:
        'Sheet exists',
      actual:
        ss.getSheetByName(
          M4_CORE.SHEETS.ERRORS
        )
          ? 'Detected'
          : 'Missing',
      status:
        ss.getSheetByName(
          M4_CORE.SHEETS.ERRORS
        )
          ? 'PASS'
          : 'FAIL',
      action:
        'Run setupMelroseCoreFoundation.'
    },
    {
      component:
        M4_CORE.SHEETS.SETTINGS,
      type:
        'SHEET',
      expected:
        'Sheet exists',
      actual:
        ss.getSheetByName(
          M4_CORE.SHEETS.SETTINGS
        )
          ? 'Detected'
          : 'Missing',
      status:
        ss.getSheetByName(
          M4_CORE.SHEETS.SETTINGS
        )
          ? 'PASS'
          : 'WARNING',
      action:
        'Install Core_Settings.gs and run setupMelroseCoreSettings.'
    },
    {
      component:
        M4_CORE.SHEETS.REGISTRY,
      type:
        'SHEET',
      expected:
        'Sheet exists',
      actual:
        ss.getSheetByName(
          M4_CORE.SHEETS.REGISTRY
        )
          ? 'Detected'
          : 'Missing',
      status:
        ss.getSheetByName(
          M4_CORE.SHEETS.REGISTRY
        )
          ? 'PASS'
          : 'WARNING',
      action:
        'Install Core_Registry.gs when provided.'
    }
  ];

  const healthRows = checks.map(check => ({
    HealthCheckID: m4_createID_('HEALTH'),
    CheckedAt: new Date(),
    Component: check.component,
    CheckType: check.type,
    Expected: check.expected,
    Actual: check.actual,
    HealthStatus: check.status,
    RecommendedAction:
      check.status === 'PASS'
        ? ''
        : check.action,
    SystemVersion: M4_CORE.VERSION
  }));

  m4_appendObjects_(
    healthSheet,
    healthRows
  );

  const failures =
    checks.filter(
      check =>
        check.status === 'FAIL'
    ).length;

  const warnings =
    checks.filter(
      check =>
        check.status === 'WARNING'
    ).length;

  return {
    success: true,
    overallStatus:
      failures
        ? 'FAIL'
        : warnings
          ? 'WARNING'
          : 'PASS',
    checks: checks.length,
    passed:
      checks.filter(
        check =>
          check.status === 'PASS'
      ).length,
    warnings,
    failures
  };
}


/* =================================================================
   USER
================================================================= */

function m4_currentUser_() {
  try {
    return Session
      .getEffectiveUser()
      .getEmail() ||
      Session
        .getActiveUser()
        .getEmail() ||
      'UNKNOWN_USER';
  } catch (ignored) {
    return 'UNKNOWN_USER';
  }
}


/* =================================================================
   CORE TEST
================================================================= */

function testMelroseCoreCommon() {
  const ss =
    m4_getCommandCenter_();

  const testSheetName =
    'M4_CoreTest';

  const sheet =
    m4_ensureSheet_(
      ss,
      testSheetName,
      [
        'RecordID',
        'Name',
        'Active',
        'CreatedAt'
      ]
    );

  const testID =
    m4_createID_('TEST');

  const upsert =
    m4_upsertObject_(
      sheet,
      'RecordID',
      {
        RecordID:
          testID,
        Name:
          'MelroseOS Core Test',
        Active:
          true,
        CreatedAt:
          new Date()
      }
    );

  const row =
    m4_findRow_(
      sheet,
      'RecordID',
      testID
    );

  const record =
    m4_readRowObject_(
      sheet,
      row
    );

  return {
    success:
      Boolean(
        upsert.success &&
        row &&
        record.RecordID ===
          testID
      ),
    testID,
    row,
    record
  };
}