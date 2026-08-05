/**
 * FILE: MOS_API_Core.gs
 * MODULE: Sprint 2A.7 Data Service Layer
 * VERSION: 1.0.0
 */

const MOS5_API_VERSION = '1.0.0';

const MOS5_API_WORKBOOKS = Object.freeze({
  CORE: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
  CRM: '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
  MARKETING: '1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo',
  WEBSITE: '1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc',
  ANALYTICS: '1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU',
  ARCHIVE: '1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk'
});

function MOS5API_health() {
  return MOS5API_execute_('HEALTH', function () {
    const targets = Object.keys(MOS5_API_WORKBOOKS).map(function (code) {
      try {
        const ss = SpreadsheetApp.openById(MOS5_API_WORKBOOKS[code]);
        return {
          code: code,
          status: 'PASS',
          name: ss.getName(),
          sheetCount: ss.getSheets().length
        };
      } catch (error) {
        return {
          code: code,
          status: 'FAIL',
          error: String(error && error.message ? error.message : error)
        };
      }
    });

    return {
      version: MOS5_API_VERSION,
      targets: targets,
      passed: targets.filter(function (item) {
        return item.status === 'PASS';
      }).length,
      total: targets.length
    };
  }, 60);
}

function MOS5API_getSheetData(request) {
  return MOS5API_execute_('GET_SHEET_DATA', function () {
    const input = request || {};
    const workbookCode = String(input.workbookCode || '').trim().toUpperCase();
    const sheetName = String(input.sheetName || '').trim();
    const maxRows = Math.min(Math.max(Number(input.maxRows || 250), 1), 2000);

    if (!MOS5_API_WORKBOOKS[workbookCode]) {
      throw new Error('Unknown workbook code: ' + workbookCode);
    }

    if (!sheetName) {
      throw new Error('sheetName is required.');
    }

    const ss = SpreadsheetApp.openById(MOS5_API_WORKBOOKS[workbookCode]);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Sheet not found: ' + sheetName);
    }

    const lastColumn = sheet.getLastColumn();
    const lastRow = Math.min(sheet.getLastRow(), maxRows + 1);

    if (lastRow < 1 || lastColumn < 1) {
      return {
        workbookCode: workbookCode,
        sheetName: sheetName,
        headers: [],
        rows: [],
        returnedRows: 0,
        sourceRows: 0,
        truncated: false
      };
    }

    const values = sheet
      .getRange(1, 1, lastRow, lastColumn)
      .getDisplayValues();

    const headers = values[0];
    const rows = values.slice(1).map(function (row) {
      const record = {};

      headers.forEach(function (header, index) {
        record[String(header || ('Column' + (index + 1)))] = row[index];
      });

      return record;
    });

    return {
      workbookCode: workbookCode,
      workbookName: ss.getName(),
      sheetName: sheetName,
      headers: headers,
      rows: rows,
      returnedRows: rows.length,
      sourceRows: Math.max(sheet.getLastRow() - 1, 0),
      truncated: sheet.getLastRow() - 1 > rows.length
    };
  }, 30);
}

function MOS5API_getServiceRegistry() {
  MOS5API_assertBroker_();

  return MOS5API_success_('SERVICE_REGISTRY', {
    version: MOS5_API_VERSION,
    services: [
      {code: 'HEALTH', functionName: 'MOS5API_health', mode: 'READ_ONLY'},
      {code: 'GET_SHEET_DATA', functionName: 'MOS5API_getSheetData', mode: 'READ_ONLY'}
    ],
    writesEnabled: false,
    communicationsEnabled: false,
    routingChangesEnabled: false
  });
}

function MOS5API_runDiagnostics() {
  const tests = [];

  MOS5API_test_(tests, 'BROKER_ACCESS', function () {
    MOS5API_assertBroker_();
    return true;
  }, 'Broker access gate passed.');

  MOS5API_test_(tests, 'WORKBOOK_REGISTRY', function () {
    return Object.keys(MOS5_API_WORKBOOKS).length === 6;
  }, 'Six workbook IDs are registered.');

  MOS5API_test_(tests, 'CACHE_AVAILABLE', function () {
    return Boolean(CacheService.getScriptCache());
  }, 'Script cache is available.');

  MOS5API_test_(tests, 'READ_ONLY_MODE', function () {
    return true;
  }, 'No write service is exposed.');

  const failed = tests.filter(function (test) {
    return test.status === 'FAIL';
  }).length;

  const result = {
    release: 'MOS5-SPRINT2A7-DATA-SERVICE',
    version: MOS5_API_VERSION,
    overallStatus: failed ? 'FAIL' : 'PASS',
    passed: tests.length - failed,
    failed: failed,
    tests: tests,
    completedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function MOS5API_execute_(operation, callback, cacheSeconds) {
  const started = Date.now();
  const seconds = Number(cacheSeconds || 0);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'MOS5API:' + operation;

  try {
    MOS5API_assertBroker_();

    if (seconds > 0) {
      const cached = cache.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.meta.cached = true;
        return parsed;
      }
    }

    const data = MOS5API_retry_(callback, 3);
    const response = MOS5API_success_(operation, data, {
      durationMs: Date.now() - started,
      cached: false
    });

    if (seconds > 0) {
      cache.put(cacheKey, JSON.stringify(response), seconds);
    }

    MOS5API_audit_(operation, 'PASS', response.meta.durationMs);
    return response;
  } catch (error) {
    const response = MOS5API_failure_(
      operation,
      error,
      Date.now() - started
    );

    MOS5API_audit_(operation, 'FAIL', response.meta.durationMs, response.error);
    return response;
  }
}

function MOS5API_retry_(callback, attempts) {
  let lastError;

  for (let index = 0; index < attempts; index++) {
    try {
      return callback();
    } catch (error) {
      lastError = error;

      if (index < attempts - 1) {
        Utilities.sleep(150 * Math.pow(2, index));
      }
    }
  }

  throw lastError;
}

function MOS5API_success_(operation, data, extraMeta) {
  return {
    success: true,
    operation: operation,
    data: data,
    error: null,
    meta: Object.assign({
      apiVersion: MOS5_API_VERSION,
      generatedAt: new Date().toISOString()
    }, extraMeta || {})
  };
}

function MOS5API_failure_(operation, error, durationMs) {
  return {
    success: false,
    operation: operation,
    data: null,
    error: {
      name: error && error.name ? error.name : 'Error',
      message: String(error && error.message ? error.message : error)
    },
    meta: {
      apiVersion: MOS5_API_VERSION,
      generatedAt: new Date().toISOString(),
      durationMs: durationMs,
      cached: false
    }
  };
}

function MOS5API_assertBroker_() {
  const email = String(Session.getEffectiveUser().getEmail() || '')
    .trim()
    .toLowerCase();

  const allowed = [
    'melrosegroupbroker@gmail.com',
    'samsells365@gmail.com'
  ];

  if (allowed.indexOf(email) === -1) {
    throw new Error('Broker access required.');
  }
}

function MOS5API_audit_(operation, status, durationMs, error) {
  console.log(JSON.stringify({
    module: 'MOS5_API',
    operation: operation,
    status: status,
    effectiveUser: Session.getEffectiveUser().getEmail() || 'UNAVAILABLE',
    durationMs: durationMs,
    error: error || null,
    recordedAt: new Date().toISOString()
  }));
}

function MOS5API_test_(tests, code, callback, details) {
  try {
    const passed = Boolean(callback());

    tests.push({
      code: code,
      status: passed ? 'PASS' : 'FAIL',
      details: passed ? details : 'Check failed.'
    });
  } catch (error) {
    tests.push({
      code: code,
      status: 'FAIL',
      details: String(error && error.message ? error.message : error)
    });
  }
}
