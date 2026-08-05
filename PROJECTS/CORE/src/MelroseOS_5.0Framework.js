/**
 * MELROSEOS 5.0 — SHARED FRAMEWORK
 * Full Overwrite v5.0.0
 *
 * Install in the MelroseOS Core Apps Script project.
 *
 * Run:
 * 1. setupM5FrameworkStep1()
 * 2. setupM5FrameworkStep2()
 * 3. setupM5FrameworkFinalize()
 * 4. testM5Framework()
 * 5. installM5QueueProcessorTrigger()
 */

var M5_FRAMEWORK = Object.freeze({
  VERSION: '5.0.0',
  CORE_ID: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',

  WORKBOOKS: Object.freeze({
    CORE: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
    CRM: '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
    MARKETING: '1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo',
    WEBSITE: '1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc',
    ANALYTICS: '1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU',
    ARCHIVE: '1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk'
  }),

  SHEETS: Object.freeze({
    CONFIG: 'M5_Config',
    COMPONENTS: 'M5_ComponentRegistry',
    VERSIONS: 'M5_VersionHistory',
    QUEUE: 'M5_Queue',
    HISTORY: 'M5_QueueHistory',
    LOG: 'M5_Log',
    ERRORS: 'M5_ErrorLog',
    HEALTH: 'M5_Health',
    EVENTS: 'M5_Events'
  })
});


function setupM5FrameworkStep1() {
  var core = m5OpenWorkbook_('CORE');

  m5EnsureSheet_(core, M5_FRAMEWORK.SHEETS.CONFIG, [
    'ConfigKey','ConfigValue','ValueType','Category',
    'Description','Required','Active','UpdatedAt','UpdatedBy'
  ]);

  m5EnsureSheet_(core, M5_FRAMEWORK.SHEETS.COMPONENTS, [
    'ComponentID','ComponentName','Module','ComponentType',
    'Version','WorkbookKey','SpreadsheetID','Status',
    'Dependencies','InstalledAt','UpdatedAt','Notes'
  ]);

  m5EnsureSheet_(core, M5_FRAMEWORK.SHEETS.VERSIONS, [
    'VersionID','ComponentID','ComponentName','OldVersion',
    'NewVersion','Action','Status','Message','RecordedAt','RecordedBy'
  ]);

  m5SeedConfig_();
  m5RegisterCoreComponents_();

  return {
    success: true,
    step: 1,
    nextFunction: 'setupM5FrameworkStep2'
  };
}


function setupM5FrameworkStep2() {
  var core = m5OpenWorkbook_('CORE');

  m5EnsureSheet_(core, M5_FRAMEWORK.SHEETS.QUEUE, [
    'QueueID','QueueType','Module','HandlerFunction',
    'WorkbookKey','ReferenceID','Priority','PayloadJSON',
    'Status','AttemptCount','MaxAttempts','ScheduledAt',
    'StartedAt','CompletedAt','LastError','CreatedAt','UpdatedAt'
  ]);

  m5EnsureSheet_(core, M5_FRAMEWORK.SHEETS.HISTORY, [
    'HistoryID','QueueID','QueueType','Module',
    'HandlerFunction','ReferenceID','Status','AttemptCount',
    'Message','StartedAt','CompletedAt','RecordedAt'
  ]);

  m5EnsureSheet_(core, M5_FRAMEWORK.SHEETS.LOG, [
    'LogID','Level','Module','FunctionName','Action',
    'Status','WorkbookKey','ReferenceID','Message',
    'DataJSON','RecordedAt','RecordedBy'
  ]);

  m5EnsureSheet_(core, M5_FRAMEWORK.SHEETS.ERRORS, [
    'ErrorID','Module','FunctionName','WorkbookKey',
    'ReferenceID','ErrorMessage','StackTrace',
    'ContextJSON','AttemptCount','Resolved',
    'ResolvedAt','Resolution','OccurredAt'
  ]);

  m5EnsureSheet_(core, M5_FRAMEWORK.SHEETS.HEALTH, [
    'HealthID','ComponentID','ComponentName','Module',
    'WorkbookKey','Status','LastCheckedAt','LastSuccessAt',
    'FailureCount','ResponseTimeMs','Message','Version'
  ]);

  m5EnsureSheet_(core, M5_FRAMEWORK.SHEETS.EVENTS, [
    'EventID','EventType','Module','WorkbookKey',
    'ReferenceID','PayloadJSON','Status','CreatedAt',
    'ProcessedAt','Message'
  ]);

  return {
    success: true,
    step: 2,
    nextFunction: 'setupM5FrameworkFinalize'
  };
}


function setupM5FrameworkFinalize() {
  PropertiesService.getScriptProperties().setProperties({
    M5_FRAMEWORK_VERSION: M5_FRAMEWORK.VERSION,
    M5_CORE_SPREADSHEET_ID: M5_FRAMEWORK.CORE_ID,
    M5_FRAMEWORK_INSTALLED_AT: new Date().toISOString()
  }, false);

  m5Log_({
    level: 'INFO',
    module: 'SYSTEM',
    functionName: 'setupM5FrameworkFinalize',
    action: 'INSTALL_FRAMEWORK',
    status: 'SUCCESS',
    workbookKey: 'CORE',
    message: 'MelroseOS 5.0 Shared Framework installed.'
  });

  m5RunFrameworkHealthCheck();

  return {
    success: true,
    version: M5_FRAMEWORK.VERSION,
    nextFunction: 'testM5Framework'
  };
}


function m5SeedConfig_() {
  var core = m5OpenWorkbook_('CORE');
  var sheet = core.getSheetByName(M5_FRAMEWORK.SHEETS.CONFIG);

  var rows = [
    m5ConfigRow_('SYSTEM_VERSION', M5_FRAMEWORK.VERSION, 'STRING',
      'SYSTEM', 'Current MelroseOS platform version.', true),
    m5ConfigRow_('SYSTEM_TIMEZONE', 'America/Chicago', 'STRING',
      'SYSTEM', 'Default system timezone.', true),
    m5ConfigRow_('QUEUE_MAX_ATTEMPTS', 5, 'NUMBER',
      'AUTOMATION', 'Default queue retry limit.', true),
    m5ConfigRow_('QUEUE_RETRY_DELAY_MS', 1000, 'NUMBER',
      'AUTOMATION', 'Default exponential retry delay.', true)
  ];

  Object.keys(M5_FRAMEWORK.WORKBOOKS).forEach(function (key) {
    rows.push(
      m5ConfigRow_(
        'WORKBOOK_' + key + '_SPREADSHEET_ID',
        M5_FRAMEWORK.WORKBOOKS[key],
        'STRING',
        'SYSTEM',
        key + ' workbook ID.',
        true
      )
    );
  });

  m5UpsertBatch_(sheet, 'ConfigKey', rows);
}


function m5ConfigRow_(key, value, type, category, description, required) {
  return {
    ConfigKey: key,
    ConfigValue: value,
    ValueType: type,
    Category: category,
    Description: description,
    Required: required,
    Active: true,
    UpdatedAt: new Date(),
    UpdatedBy: m5CurrentUser_()
  };
}


function m5GetConfig(key, fallbackValue) {
  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_FRAMEWORK.SHEETS.CONFIG);

  var row = m5ReadObjects_(sheet).find(function (record) {
    return String(record.ConfigKey || '') === String(key || '') &&
      m5Boolean_(record.Active);
  });

  if (!row) return fallbackValue;

  var type = String(row.ValueType || 'STRING').toUpperCase();

  if (type === 'NUMBER') return Number(row.ConfigValue || 0);
  if (type === 'BOOLEAN') return m5Boolean_(row.ConfigValue);
  if (type === 'JSON') return m5ParseJson_(row.ConfigValue, {});

  return row.ConfigValue;
}


function m5SetConfig(key, value, options) {
  options = options || {};

  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_FRAMEWORK.SHEETS.CONFIG);

  m5UpsertBatch_(sheet, 'ConfigKey', [
    m5ConfigRow_(
      key,
      value,
      options.valueType || 'STRING',
      options.category || 'OTHER',
      options.description || '',
      Boolean(options.required)
    )
  ]);

  return {success: true, configKey: key};
}


function m5RegisterCoreComponents_() {
  [
    ['M5-CONFIG', 'M5 Configuration', 'SYSTEM', 'FRAMEWORK'],
    ['M5-LOGGER', 'M5 Logger', 'SYSTEM', 'FRAMEWORK'],
    ['M5-RETRY', 'M5 Retry Manager', 'AUTOMATION', 'FRAMEWORK'],
    ['M5-QUEUE', 'M5 Queue Engine', 'AUTOMATION', 'FRAMEWORK'],
    ['M5-HEALTH', 'M5 Health Manager', 'SYSTEM', 'FRAMEWORK'],
    ['M5-EVENTS', 'M5 Event Bus', 'INTEGRATION', 'FRAMEWORK']
  ].forEach(function (item) {
    m5RegisterComponent({
      componentId: item[0],
      componentName: item[1],
      module: item[2],
      componentType: item[3],
      workbookKey: 'CORE'
    });
  });
}


function m5RegisterComponent(options) {
  options = options || {};

  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_FRAMEWORK.SHEETS.COMPONENTS);

  var componentId = options.componentId || 'COMP-' + Utilities.getUuid();
  var existing = m5ReadObjects_(sheet).find(function (row) {
    return row.ComponentID === componentId;
  });

  var record = {
    ComponentID: componentId,
    ComponentName: options.componentName || componentId,
    Module: options.module || 'OTHER',
    ComponentType: options.componentType || 'COMPONENT',
    Version: options.version || M5_FRAMEWORK.VERSION,
    WorkbookKey: options.workbookKey || 'CORE',
    SpreadsheetID:
      M5_FRAMEWORK.WORKBOOKS[options.workbookKey || 'CORE'] || '',
    Status: options.status || 'ACTIVE',
    Dependencies: options.dependencies || '',
    InstalledAt: existing ? existing.InstalledAt : new Date(),
    UpdatedAt: new Date(),
    Notes: options.notes || ''
  };

  m5UpsertBatch_(sheet, 'ComponentID', [record]);

  if (existing && existing.Version !== record.Version) {
    var versionSheet = m5OpenWorkbook_('CORE')
      .getSheetByName(M5_FRAMEWORK.SHEETS.VERSIONS);

    m5AppendObject_(versionSheet, {
      VersionID: 'VERSION-' + Utilities.getUuid(),
      ComponentID: componentId,
      ComponentName: record.ComponentName,
      OldVersion: existing.Version,
      NewVersion: record.Version,
      Action: 'UPDATE',
      Status: 'SUCCESS',
      Message: 'Component version updated.',
      RecordedAt: new Date(),
      RecordedBy: m5CurrentUser_()
    });
  }

  return {success: true, componentId: componentId};
}


function m5Log_(options) {
  options = options || {};

  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_FRAMEWORK.SHEETS.LOG);

  if (!sheet) return;

  m5AppendObject_(sheet, {
    LogID: 'LOG-' + Utilities.getUuid(),
    Level: options.level || 'INFO',
    Module: options.module || 'OTHER',
    FunctionName: options.functionName || '',
    Action: options.action || '',
    Status: options.status || '',
    WorkbookKey: options.workbookKey || 'CORE',
    ReferenceID: options.referenceId || '',
    Message: m5Truncate_(options.message || '', 1000),
    DataJSON: m5SafeJson_(options.data || ''),
    RecordedAt: new Date(),
    RecordedBy: m5CurrentUser_()
  });
}


function m5RecordError_(error, context) {
  context = context || {};

  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_FRAMEWORK.SHEETS.ERRORS);

  var errorId = 'ERROR-' + Utilities.getUuid();

  m5AppendObject_(sheet, {
    ErrorID: errorId,
    Module: context.module || 'OTHER',
    FunctionName: context.functionName || '',
    WorkbookKey: context.workbookKey || 'CORE',
    ReferenceID: context.referenceId || '',
    ErrorMessage: m5Truncate_(
      error && error.message ? error.message : String(error),
      1000
    ),
    StackTrace: m5Truncate_(
      error && error.stack ? error.stack : '',
      5000
    ),
    ContextJSON: m5SafeJson_(context),
    AttemptCount: Number(context.attemptCount || 0),
    Resolved: false,
    ResolvedAt: '',
    Resolution: '',
    OccurredAt: new Date()
  });

  return errorId;
}


function m5WithRetry_(callback, options) {
  options = options || {};

  var maxAttempts = Number(
    options.maxAttempts || m5GetConfig('QUEUE_MAX_ATTEMPTS', 5)
  );

  var baseDelay = Number(
    options.baseDelayMs || m5GetConfig('QUEUE_RETRY_DELAY_MS', 1000)
  );

  var lastError = null;

  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return callback(attempt);
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        Utilities.sleep(baseDelay * Math.pow(2, attempt - 1));
      }
    }
  }

  m5RecordError_(lastError, {
    module: options.module || 'OTHER',
    functionName: options.functionName || '',
    workbookKey: options.workbookKey || 'CORE',
    referenceId: options.referenceId || '',
    attemptCount: maxAttempts
  });

  throw lastError;
}


function m5Enqueue(options) {
  options = options || {};

  if (!options.handlerFunction) {
    throw new Error('handlerFunction is required.');
  }

  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_FRAMEWORK.SHEETS.QUEUE);

  var queueId = options.queueId || 'QUEUE-' + Utilities.getUuid();

  m5AppendObject_(sheet, {
    QueueID: queueId,
    QueueType: options.queueType || 'GENERAL',
    Module: options.module || 'OTHER',
    HandlerFunction: options.handlerFunction,
    WorkbookKey: options.workbookKey || 'CORE',
    ReferenceID: options.referenceId || '',
    Priority: Number(options.priority || 100),
    PayloadJSON: m5SafeJson_(options.payload || {}),
    Status: 'PENDING',
    AttemptCount: 0,
    MaxAttempts: Number(options.maxAttempts || 5),
    ScheduledAt: options.scheduledAt || new Date(),
    StartedAt: '',
    CompletedAt: '',
    LastError: '',
    CreatedAt: new Date(),
    UpdatedAt: new Date()
  });

  return {success: true, queueId: queueId};
}


function m5ProcessNextQueueItem() {
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    return {success: false, skipped: true};
  }

  try {
    var sheet = m5OpenWorkbook_('CORE')
      .getSheetByName(M5_FRAMEWORK.SHEETS.QUEUE);

    var item = m5ReadObjects_(sheet, true)
      .filter(function (row) {
        var status = String(row.Status || '').toUpperCase();
        var scheduled = row.ScheduledAt ?
          new Date(row.ScheduledAt).getTime() : 0;

        return ['PENDING', 'RETRY'].indexOf(status) >= 0 &&
          scheduled <= Date.now();
      })
      .sort(function (a, b) {
        return Number(a.Priority || 100) - Number(b.Priority || 100);
      })[0];

    if (!item) {
      return {success: true, complete: true};
    }

    return m5ExecuteQueueItem_(sheet, item);
  } finally {
    lock.releaseLock();
  }
}


function m5ExecuteQueueItem_(sheet, item) {
  var attempt = Number(item.AttemptCount || 0) + 1;
  var maximum = Number(item.MaxAttempts || 5);

  m5UpdateRow_(sheet, item._rowNumber, {
    Status: 'IN_PROGRESS',
    AttemptCount: attempt,
    StartedAt: item.StartedAt || new Date(),
    LastError: '',
    UpdatedAt: new Date()
  });

  try {
    var handler = this[String(item.HandlerFunction || '').trim()];

    if (typeof handler !== 'function') {
      throw new Error('Missing queue handler: ' + item.HandlerFunction);
    }

    var result = handler(
      m5ParseJson_(item.PayloadJSON, {}),
      item
    );

    m5UpdateRow_(sheet, item._rowNumber, {
      Status: 'COMPLETE',
      CompletedAt: new Date(),
      LastError: '',
      UpdatedAt: new Date()
    });

    m5ArchiveQueue_(item, 'COMPLETE', '');

    return {success: true, queueId: item.QueueID, result: result};
  } catch (error) {
    var finalFailure = attempt >= maximum;

    m5UpdateRow_(sheet, item._rowNumber, {
      Status: finalFailure ? 'FAILED' : 'RETRY',
      LastError: m5Truncate_(error.message || String(error), 1000),
      CompletedAt: finalFailure ? new Date() : '',
      UpdatedAt: new Date()
    });

    m5ArchiveQueue_(
      item,
      finalFailure ? 'FAILED' : 'RETRY',
      error.message || String(error)
    );

    m5RecordError_(error, {
      module: item.Module,
      functionName: item.HandlerFunction,
      workbookKey: item.WorkbookKey,
      referenceId: item.ReferenceID || item.QueueID,
      attemptCount: attempt
    });

    return {
      success: false,
      retry: !finalFailure,
      failed: finalFailure,
      error: error.message || String(error)
    };
  }
}


function m5ArchiveQueue_(item, status, message) {
  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_FRAMEWORK.SHEETS.HISTORY);

  m5AppendObject_(sheet, {
    HistoryID: 'HISTORY-' + Utilities.getUuid(),
    QueueID: item.QueueID,
    QueueType: item.QueueType,
    Module: item.Module,
    HandlerFunction: item.HandlerFunction,
    ReferenceID: item.ReferenceID,
    Status: status,
    AttemptCount: Number(item.AttemptCount || 0) + 1,
    Message: m5Truncate_(message || '', 1000),
    StartedAt: item.StartedAt || new Date(),
    CompletedAt: status === 'COMPLETE' || status === 'FAILED' ?
      new Date() : '',
    RecordedAt: new Date()
  });
}


function installM5QueueProcessorTrigger() {
  m5DeleteTriggersByHandler_('m5ProcessNextQueueItem');

  ScriptApp.newTrigger('m5ProcessNextQueueItem')
    .timeBased()
    .everyMinutes(5)
    .create();

  return {success: true, triggerInstalled: true};
}


function m5PublishEvent(options) {
  options = options || {};

  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_FRAMEWORK.SHEETS.EVENTS);

  var eventId = options.eventId || 'EVENT-' + Utilities.getUuid();

  m5AppendObject_(sheet, {
    EventID: eventId,
    EventType: options.eventType || 'GENERAL',
    Module: options.module || 'OTHER',
    WorkbookKey: options.workbookKey || 'CORE',
    ReferenceID: options.referenceId || '',
    PayloadJSON: m5SafeJson_(options.payload || {}),
    Status: 'PENDING',
    CreatedAt: new Date(),
    ProcessedAt: '',
    Message: options.message || ''
  });

  return {success: true, eventId: eventId};
}


function m5RunFrameworkHealthCheck() {
  var core = m5OpenWorkbook_('CORE');
  var componentSheet = core.getSheetByName(
    M5_FRAMEWORK.SHEETS.COMPONENTS
  );
  var healthSheet = core.getSheetByName(
    M5_FRAMEWORK.SHEETS.HEALTH
  );

  var results = m5ReadObjects_(componentSheet)
    .filter(function (row) {
      return String(row.ComponentID || '').indexOf('M5-') === 0;
    })
    .map(function (component) {
      var started = Date.now();
      var status = 'PASS';
      var message = 'Component available.';

      try {
        m5OpenWorkbook_(component.WorkbookKey || 'CORE');
      } catch (error) {
        status = 'FAIL';
        message = error.message || String(error);
      }

      return {
        HealthID: 'HEALTH-' + component.ComponentID,
        ComponentID: component.ComponentID,
        ComponentName: component.ComponentName,
        Module: component.Module,
        WorkbookKey: component.WorkbookKey,
        Status: status,
        LastCheckedAt: new Date(),
        LastSuccessAt: status === 'PASS' ? new Date() : '',
        FailureCount: status === 'PASS' ? 0 : 1,
        ResponseTimeMs: Date.now() - started,
        Message: message,
        Version: component.Version
      };
    });

  m5UpsertBatch_(healthSheet, 'HealthID', results);

  return {
    success: results.every(function (row) {
      return row.Status === 'PASS';
    }),
    checked: results.length
  };
}


function m5OpenWorkbook_(workbookKey) {
  var key = String(workbookKey || '').trim().toUpperCase();
  var spreadsheetId = M5_FRAMEWORK.WORKBOOKS[key];

  if (!spreadsheetId) {
    throw new Error('Unknown workbook key: ' + workbookKey);
  }

  return SpreadsheetApp.openById(spreadsheetId);
}


function m5EnsureSheet_(spreadsheet, sheetName, headers) {
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  var range = sheet.getRange(1, 1, 1, headers.length);
  var current = range.getDisplayValues()[0];

  headers.forEach(function (header, index) {
    if (!current[index]) current[index] = header;
  });

  range.setValues([current]);
  sheet.setFrozenRows(1);

  return sheet;
}


function m5ReadObjects_(sheet, includeRowNumber) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  var values = sheet.getRange(
    1, 1, sheet.getLastRow(), sheet.getLastColumn()
  ).getValues();

  var headers = values[0].map(function (value) {
    return String(value || '').trim();
  });

  return values.slice(1).map(function (row, index) {
    var record = {};

    headers.forEach(function (header, columnIndex) {
      if (header) record[header] = row[columnIndex];
    });

    if (includeRowNumber) record._rowNumber = index + 2;

    return record;
  }).filter(function (record) {
    return Object.keys(record).filter(function (key) {
      return key !== '_rowNumber';
    }).some(function (key) {
      return String(record[key] || '').trim() !== '';
    });
  });
}


function m5UpsertBatch_(sheet, primaryKey, incoming) {
  var headers = sheet.getRange(
    1, 1, 1, sheet.getLastColumn()
  ).getDisplayValues()[0].map(function (value) {
    return String(value || '').trim();
  });

  var map = {};

  m5ReadObjects_(sheet).forEach(function (record) {
    var key = String(record[primaryKey] || '').trim();
    if (key) map[key] = record;
  });

  incoming.forEach(function (record) {
    var key = String(record[primaryKey] || '').trim();
    if (key) map[key] = Object.assign({}, map[key] || {}, record);
  });

  m5ReplaceAllObjects_(
    sheet,
    Object.keys(map).map(function (key) {
      return map[key];
    }),
    headers
  );
}


function m5ReplaceAllObjects_(sheet, records, headers) {
  headers = headers || sheet.getRange(
    1, 1, 1, sheet.getLastColumn()
  ).getDisplayValues()[0].map(function (value) {
    return String(value || '').trim();
  });

  if (sheet.getLastRow() >= 2) {
    sheet.getRange(
      2, 1, sheet.getLastRow() - 1, headers.length
    ).clearContent();
  }

  if (!records.length) return;

  var rows = records.map(function (record) {
    return headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, header)
        ? record[header] : '';
    });
  });

  if (sheet.getMaxRows() < rows.length + 1) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      rows.length + 1 - sheet.getMaxRows()
    );
  }

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}


function m5UpdateRow_(sheet, rowNumber, updates) {
  var headers = sheet.getRange(
    1, 1, 1, sheet.getLastColumn()
  ).getDisplayValues()[0].map(function (value) {
    return String(value || '').trim();
  });

  var values = sheet.getRange(
    rowNumber, 1, 1, headers.length
  ).getValues()[0];

  headers.forEach(function (header, index) {
    if (Object.prototype.hasOwnProperty.call(updates, header)) {
      values[index] = updates[header];
    }
  });

  sheet.getRange(
    rowNumber, 1, 1, headers.length
  ).setValues([values]);
}


function m5AppendObject_(sheet, record) {
  var headers = sheet.getRange(
    1, 1, 1, sheet.getLastColumn()
  ).getDisplayValues()[0].map(function (value) {
    return String(value || '').trim();
  });

  var row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(record, header)
      ? record[header] : '';
  });

  sheet.appendRow(row);
}


function m5Boolean_(value) {
  if (typeof value === 'boolean') return value;

  return ['TRUE','YES','Y','1','ACTIVE','ENABLED'].indexOf(
    String(value || '').trim().toUpperCase()
  ) >= 0;
}


function m5ParseJson_(value, fallbackValue) {
  if (value && typeof value === 'object') return value;

  try {
    return JSON.parse(String(value || ''));
  } catch (ignored) {
    return fallbackValue;
  }
}


function m5SafeJson_(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return '';
  }

  try {
    return JSON.stringify(value);
  } catch (ignored) {
    return JSON.stringify({value: String(value)});
  }
}


function m5Truncate_(value, maximumLength) {
  var text = String(value || '');
  return text.length <= maximumLength
    ? text
    : text.slice(0, maximumLength - 1) + '…';
}


function m5CurrentUser_() {
  return Session.getEffectiveUser().getEmail() || 'UNKNOWN_USER';
}


function m5DeleteTriggersByHandler_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}


function testM5Framework() {
  var tests = [];

  function run(name, callback) {
    try {
      tests.push({
        test: name,
        status: 'PASS',
        result: callback()
      });
    } catch (error) {
      tests.push({
        test: name,
        status: 'FAIL',
        error: error.message || String(error)
      });
    }
  }

  run('Open Core', function () {
    return m5OpenWorkbook_('CORE').getName();
  });

  run('Read version', function () {
    return m5GetConfig('SYSTEM_VERSION', '');
  });

  run('Run health check', function () {
    return m5RunFrameworkHealthCheck();
  });

  run('Write log', function () {
    m5Log_({
      module: 'SYSTEM',
      functionName: 'testM5Framework',
      action: 'TEST',
      status: 'SUCCESS',
      message: 'Framework test completed.'
    });
    return true;
  });

  var failed = tests.filter(function (test) {
    return test.status === 'FAIL';
  }).length;

  return {
    success: failed === 0,
    version: M5_FRAMEWORK.VERSION,
    tests: tests,
    passed: tests.length - failed,
    failed: failed,
    nextFunction: failed === 0
      ? 'installM5QueueProcessorTrigger'
      : ''
  };
}
