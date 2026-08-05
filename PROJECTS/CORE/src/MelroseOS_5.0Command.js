/**
 * =====================================================================
 * MELROSEOS 5.0 — COMMAND CENTER
 * Full Overwrite
 * Version 5.0.0
 *
 * INSTALL LOCATION
 * - MelroseOS Core Apps Script project
 *
 * DEPENDENCY
 * - MelroseOS 5.0 Shared Framework must already be installed.
 *
 * RUN IN ORDER
 * 1. setupM5CommandCenter()
 * 2. installM5CommandCenterTriggers()
 * 3. refreshM5CommandCenter()
 * 4. testM5CommandCenter()
 *
 * FEATURES
 * - Brokerage command dashboard
 * - Workbook connectivity monitoring
 * - Module registry summary
 * - Queue monitoring
 * - Error monitoring
 * - Trigger inventory
 * - One-click health refresh
 * - One-click queue processing
 * - Spreadsheet menu
 * - Sidebar control panel
 * =====================================================================
 */


var M5_COMMAND_CENTER = Object.freeze({
  VERSION: '5.0.0',

  SHEETS: Object.freeze({
    DASHBOARD: 'M5_CommandCenter',
    WORKBOOKS: 'M5_WorkbookHealth',
    MODULES: 'M5_ModuleStatus',
    TRIGGERS: 'M5_TriggerStatus',
    ACTIONS: 'M5_ActionLog'
  }),

  STATUS: Object.freeze({
    HEALTHY: 'HEALTHY',
    WARNING: 'WARNING',
    CRITICAL: 'CRITICAL',
    UNKNOWN: 'UNKNOWN'
  })
});


/* =====================================================================
   INSTALLATION
===================================================================== */

function setupM5CommandCenter() {
  m5CommandCenterRequireFramework_();

  var core = m5OpenWorkbook_('CORE');

  m5EnsureSheet_(core, M5_COMMAND_CENTER.SHEETS.DASHBOARD, [
    'Section',
    'Metric',
    'Value',
    'Status',
    'Details',
    'UpdatedAt'
  ]);

  m5EnsureSheet_(core, M5_COMMAND_CENTER.SHEETS.WORKBOOKS, [
    'WorkbookKey',
    'WorkbookName',
    'SpreadsheetID',
    'Accessible',
    'SheetCount',
    'CellCount',
    'Status',
    'Message',
    'LastCheckedAt'
  ]);

  m5EnsureSheet_(core, M5_COMMAND_CENTER.SHEETS.MODULES, [
    'ComponentID',
    'ComponentName',
    'Module',
    'ComponentType',
    'Version',
    'WorkbookKey',
    'Status',
    'HealthStatus',
    'UpdatedAt',
    'Notes'
  ]);

  m5EnsureSheet_(core, M5_COMMAND_CENTER.SHEETS.TRIGGERS, [
    'TriggerID',
    'HandlerFunction',
    'EventType',
    'Source',
    'Status',
    'LastCheckedAt',
    'Notes'
  ]);

  m5EnsureSheet_(core, M5_COMMAND_CENTER.SHEETS.ACTIONS, [
    'ActionID',
    'ActionName',
    'RequestedBy',
    'Status',
    'Message',
    'StartedAt',
    'CompletedAt'
  ]);

  m5RegisterComponent({
    componentId: 'M5-COMMAND-CENTER',
    componentName: 'MelroseOS Command Center',
    module: 'SYSTEM',
    componentType: 'APPLICATION',
    version: M5_COMMAND_CENTER.VERSION,
    workbookKey: 'CORE',
    status: 'ACTIVE',
    dependencies: 'M5-CONFIG,M5-LOGGER,M5-HEALTH,M5-QUEUE'
  });

  refreshM5CommandCenter();

  return {
    success: true,
    version: M5_COMMAND_CENTER.VERSION,
    nextFunction: 'installM5CommandCenterTriggers'
  };
}


function installM5CommandCenterTriggers() {
  m5DeleteTriggersByHandler_('refreshM5CommandCenter');

  ScriptApp.newTrigger('refreshM5CommandCenter')
    .timeBased()
    .everyMinutes(15)
    .create();

  return {
    success: true,
    triggerInstalled: true,
    frequency: 'Every 15 minutes'
  };
}


/* =====================================================================
   MENU
===================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MelroseOS')
    .addItem('Open Command Center', 'openM5CommandCenterSidebar')
    .addSeparator()
    .addItem('Refresh Dashboard', 'refreshM5CommandCenter')
    .addItem('Run Health Check', 'runM5CommandCenterHealthCheck')
    .addItem('Process Next Queue Item', 'runM5CommandCenterQueueNow')
    .addSeparator()
    .addItem('Open Dashboard Sheet', 'openM5CommandCenterSheet')
    .addToUi();
}


function openM5CommandCenterSheet() {
  var core = m5OpenWorkbook_('CORE');
  var sheet = core.getSheetByName(M5_COMMAND_CENTER.SHEETS.DASHBOARD);

  core.setActiveSheet(sheet);

  return {
    success: true,
    sheetName: sheet.getName()
  };
}


/* =====================================================================
   REFRESH ENGINE
===================================================================== */

function refreshM5CommandCenter() {
  var actionId = m5CommandCenterStartAction_('REFRESH_COMMAND_CENTER');

  try {
    var workbookResults = m5CommandCenterRefreshWorkbooks_();
    var moduleResults = m5CommandCenterRefreshModules_();
    var triggerResults = m5CommandCenterRefreshTriggers_();
    var summary = m5CommandCenterBuildDashboard_(
      workbookResults,
      moduleResults,
      triggerResults
    );

    m5CommandCenterFinishAction_(
      actionId,
      'SUCCESS',
      'Command Center refreshed successfully.'
    );

    m5Log_({
      level: 'INFO',
      module: 'SYSTEM',
      functionName: 'refreshM5CommandCenter',
      action: 'REFRESH_COMMAND_CENTER',
      status: 'SUCCESS',
      workbookKey: 'CORE',
      message: 'Command Center refreshed.',
      data: summary
    });

    return {
      success: true,
      summary: summary
    };
  } catch (error) {
    m5CommandCenterFinishAction_(
      actionId,
      'FAILED',
      error.message || String(error)
    );

    m5RecordError_(error, {
      module: 'SYSTEM',
      functionName: 'refreshM5CommandCenter',
      workbookKey: 'CORE',
      referenceId: actionId
    });

    throw error;
  }
}


function m5CommandCenterRefreshWorkbooks_() {
  var core = m5OpenWorkbook_('CORE');
  var sheet = core.getSheetByName(M5_COMMAND_CENTER.SHEETS.WORKBOOKS);

  var results = Object.keys(M5_FRAMEWORK.WORKBOOKS).map(function (key) {
    var spreadsheetId = M5_FRAMEWORK.WORKBOOKS[key];
    var started = Date.now();

    try {
      var workbook = SpreadsheetApp.openById(spreadsheetId);
      var sheets = workbook.getSheets();
      var cellCount = sheets.reduce(function (total, currentSheet) {
        return total +
          currentSheet.getMaxRows() *
          currentSheet.getMaxColumns();
      }, 0);

      return {
        WorkbookKey: key,
        WorkbookName: workbook.getName(),
        SpreadsheetID: spreadsheetId,
        Accessible: true,
        SheetCount: sheets.length,
        CellCount: cellCount,
        Status: 'HEALTHY',
        Message: 'Workbook accessible.',
        LastCheckedAt: new Date(),
        _responseTimeMs: Date.now() - started
      };
    } catch (error) {
      return {
        WorkbookKey: key,
        WorkbookName: '',
        SpreadsheetID: spreadsheetId,
        Accessible: false,
        SheetCount: 0,
        CellCount: 0,
        Status: 'CRITICAL',
        Message: error.message || String(error),
        LastCheckedAt: new Date(),
        _responseTimeMs: Date.now() - started
      };
    }
  });

  m5UpsertBatch_(sheet, 'WorkbookKey', results);

  return results;
}


function m5CommandCenterRefreshModules_() {
  var core = m5OpenWorkbook_('CORE');
  var sourceSheet = core.getSheetByName(M5_FRAMEWORK.SHEETS.COMPONENTS);
  var destinationSheet = core.getSheetByName(
    M5_COMMAND_CENTER.SHEETS.MODULES
  );

  var healthSheet = core.getSheetByName(M5_FRAMEWORK.SHEETS.HEALTH);
  var healthRows = m5ReadObjects_(healthSheet);

  var healthMap = {};

  healthRows.forEach(function (row) {
    healthMap[String(row.ComponentID || '')] = row;
  });

  var results = m5ReadObjects_(sourceSheet).map(function (component) {
    var health = healthMap[String(component.ComponentID || '')] || {};

    return {
      ComponentID: component.ComponentID,
      ComponentName: component.ComponentName,
      Module: component.Module,
      ComponentType: component.ComponentType,
      Version: component.Version,
      WorkbookKey: component.WorkbookKey,
      Status: component.Status,
      HealthStatus: health.Status || 'UNKNOWN',
      UpdatedAt: component.UpdatedAt || new Date(),
      Notes: component.Notes || ''
    };
  });

  m5UpsertBatch_(destinationSheet, 'ComponentID', results);

  return results;
}


function m5CommandCenterRefreshTriggers_() {
  var core = m5OpenWorkbook_('CORE');
  var sheet = core.getSheetByName(M5_COMMAND_CENTER.SHEETS.TRIGGERS);
  var triggers = ScriptApp.getProjectTriggers();

  var results = triggers.map(function (trigger) {
    var triggerId = '';
    var source = '';

    try {
      triggerId = trigger.getUniqueId();
    } catch (ignored) {
      triggerId = Utilities.getUuid();
    }

    try {
      source = String(trigger.getTriggerSource());
    } catch (ignored2) {
      source = '';
    }

    return {
      TriggerID: triggerId,
      HandlerFunction: trigger.getHandlerFunction(),
      EventType: String(trigger.getEventType()),
      Source: source,
      Status: 'ACTIVE',
      LastCheckedAt: new Date(),
      Notes: ''
    };
  });

  m5ReplaceAllObjects_(
    sheet,
    results,
    [
      'TriggerID',
      'HandlerFunction',
      'EventType',
      'Source',
      'Status',
      'LastCheckedAt',
      'Notes'
    ]
  );

  return results;
}


function m5CommandCenterBuildDashboard_(
  workbookResults,
  moduleResults,
  triggerResults
) {
  var core = m5OpenWorkbook_('CORE');
  var dashboard = core.getSheetByName(
    M5_COMMAND_CENTER.SHEETS.DASHBOARD
  );

  var queueSheet = core.getSheetByName(M5_FRAMEWORK.SHEETS.QUEUE);
  var errorSheet = core.getSheetByName(M5_FRAMEWORK.SHEETS.ERRORS);
  var healthSheet = core.getSheetByName(M5_FRAMEWORK.SHEETS.HEALTH);

  var queueRows = m5ReadObjects_(queueSheet);
  var errorRows = m5ReadObjects_(errorSheet);
  var healthRows = m5ReadObjects_(healthSheet);

  var pendingQueue = queueRows.filter(function (row) {
    return ['PENDING', 'RETRY'].indexOf(
      String(row.Status || '').toUpperCase()
    ) >= 0;
  }).length;

  var failedQueue = queueRows.filter(function (row) {
    return String(row.Status || '').toUpperCase() === 'FAILED';
  }).length;

  var unresolvedErrors = errorRows.filter(function (row) {
    return !m5Boolean_(row.Resolved);
  }).length;

  var unhealthyComponents = healthRows.filter(function (row) {
    return String(row.Status || '').toUpperCase() !== 'PASS';
  }).length;

  var inaccessibleWorkbooks = workbookResults.filter(function (row) {
    return !row.Accessible;
  }).length;

  var inactiveModules = moduleResults.filter(function (row) {
    return String(row.Status || '').toUpperCase() !== 'ACTIVE';
  }).length;

  var overallStatus = 'HEALTHY';

  if (
    inaccessibleWorkbooks > 0 ||
    failedQueue > 0 ||
    unhealthyComponents > 0
  ) {
    overallStatus = 'CRITICAL';
  } else if (
    pendingQueue > 25 ||
    unresolvedErrors > 0 ||
    inactiveModules > 0
  ) {
    overallStatus = 'WARNING';
  }

  var rows = [
    m5CommandCenterMetric_(
      'SYSTEM',
      'Overall Status',
      overallStatus,
      overallStatus,
      'Current MelroseOS operating condition.'
    ),
    m5CommandCenterMetric_(
      'SYSTEM',
      'Framework Version',
      M5_FRAMEWORK.VERSION,
      'HEALTHY',
      'Installed framework version.'
    ),
    m5CommandCenterMetric_(
      'SYSTEM',
      'Command Center Version',
      M5_COMMAND_CENTER.VERSION,
      'HEALTHY',
      'Installed Command Center version.'
    ),
    m5CommandCenterMetric_(
      'WORKBOOKS',
      'Connected Workbooks',
      workbookResults.length - inaccessibleWorkbooks,
      inaccessibleWorkbooks ? 'CRITICAL' : 'HEALTHY',
      inaccessibleWorkbooks + ' inaccessible.'
    ),
    m5CommandCenterMetric_(
      'MODULES',
      'Registered Components',
      moduleResults.length,
      inactiveModules ? 'WARNING' : 'HEALTHY',
      inactiveModules + ' inactive.'
    ),
    m5CommandCenterMetric_(
      'AUTOMATION',
      'Active Triggers',
      triggerResults.length,
      triggerResults.length ? 'HEALTHY' : 'WARNING',
      'Project-level Apps Script triggers.'
    ),
    m5CommandCenterMetric_(
      'QUEUE',
      'Pending or Retrying Jobs',
      pendingQueue,
      pendingQueue > 25 ? 'WARNING' : 'HEALTHY',
      failedQueue + ' failed jobs.'
    ),
    m5CommandCenterMetric_(
      'QUEUE',
      'Failed Jobs',
      failedQueue,
      failedQueue ? 'CRITICAL' : 'HEALTHY',
      'Queue items requiring attention.'
    ),
    m5CommandCenterMetric_(
      'ERRORS',
      'Unresolved Errors',
      unresolvedErrors,
      unresolvedErrors ? 'WARNING' : 'HEALTHY',
      'Open errors in M5_ErrorLog.'
    ),
    m5CommandCenterMetric_(
      'HEALTH',
      'Unhealthy Components',
      unhealthyComponents,
      unhealthyComponents ? 'CRITICAL' : 'HEALTHY',
      'Components not currently passing health checks.'
    )
  ];

  m5ReplaceAllObjects_(
    dashboard,
    rows,
    ['Section', 'Metric', 'Value', 'Status', 'Details', 'UpdatedAt']
  );

  m5CommandCenterFormatDashboard_(dashboard);

  return {
    overallStatus: overallStatus,
    connectedWorkbooks: workbookResults.length - inaccessibleWorkbooks,
    totalWorkbooks: workbookResults.length,
    registeredComponents: moduleResults.length,
    activeTriggers: triggerResults.length,
    pendingQueue: pendingQueue,
    failedQueue: failedQueue,
    unresolvedErrors: unresolvedErrors,
    unhealthyComponents: unhealthyComponents
  };
}


function m5CommandCenterMetric_(
  section,
  metric,
  value,
  status,
  details
) {
  return {
    Section: section,
    Metric: metric,
    Value: value,
    Status: status,
    Details: details,
    UpdatedAt: new Date()
  };
}


/* =====================================================================
   USER ACTIONS
===================================================================== */

function runM5CommandCenterHealthCheck() {
  var actionId = m5CommandCenterStartAction_('RUN_HEALTH_CHECK');

  try {
    var result = m5RunFrameworkHealthCheck();
    refreshM5CommandCenter();

    m5CommandCenterFinishAction_(
      actionId,
      'SUCCESS',
      'Health check completed.'
    );

    return result;
  } catch (error) {
    m5CommandCenterFinishAction_(
      actionId,
      'FAILED',
      error.message || String(error)
    );

    throw error;
  }
}


function runM5CommandCenterQueueNow() {
  var actionId = m5CommandCenterStartAction_('PROCESS_QUEUE_NOW');

  try {
    var result = m5ProcessNextQueueItem();
    refreshM5CommandCenter();

    m5CommandCenterFinishAction_(
      actionId,
      'SUCCESS',
      'Queue processor completed.'
    );

    return result;
  } catch (error) {
    m5CommandCenterFinishAction_(
      actionId,
      'FAILED',
      error.message || String(error)
    );

    throw error;
  }
}


function m5CommandCenterStartAction_(actionName) {
  var actionId = 'ACTION-' + Utilities.getUuid();
  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_COMMAND_CENTER.SHEETS.ACTIONS);

  m5AppendObject_(sheet, {
    ActionID: actionId,
    ActionName: actionName,
    RequestedBy: m5CurrentUser_(),
    Status: 'RUNNING',
    Message: '',
    StartedAt: new Date(),
    CompletedAt: ''
  });

  return actionId;
}


function m5CommandCenterFinishAction_(actionId, status, message) {
  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_COMMAND_CENTER.SHEETS.ACTIONS);

  var row = m5ReadObjects_(sheet, true).find(function (record) {
    return String(record.ActionID || '') === String(actionId || '');
  });

  if (!row) {
    return;
  }

  m5UpdateRow_(sheet, row._rowNumber, {
    Status: status,
    Message: message,
    CompletedAt: new Date()
  });
}


/* =====================================================================
   SIDEBAR
===================================================================== */

function openM5CommandCenterSidebar() {
  var template = HtmlService.createTemplate(
    m5CommandCenterSidebarHtml_()
  );

  template.data = JSON.stringify(
    m5CommandCenterGetSidebarData_()
  );

  SpreadsheetApp.getUi().showSidebar(
    template.evaluate()
      .setTitle('MelroseOS Command Center')
      .setWidth(420)
  );
}


function m5CommandCenterGetSidebarData_() {
  var core = m5OpenWorkbook_('CORE');
  var dashboard = core.getSheetByName(
    M5_COMMAND_CENTER.SHEETS.DASHBOARD
  );

  var metrics = {};

  m5ReadObjects_(dashboard).forEach(function (row) {
    metrics[String(row.Metric || '')] = {
      value: row.Value,
      status: row.Status,
      details: row.Details
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: metrics
  };
}


function m5CommandCenterSidebarRefresh() {
  refreshM5CommandCenter();
  return m5CommandCenterGetSidebarData_();
}


function m5CommandCenterSidebarHealthCheck() {
  runM5CommandCenterHealthCheck();
  return m5CommandCenterGetSidebarData_();
}


function m5CommandCenterSidebarQueue() {
  runM5CommandCenterQueueNow();
  return m5CommandCenterGetSidebarData_();
}


function m5CommandCenterSidebarHtml_() {
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<base target="_top">',
    '<style>',
    'body{font-family:Arial,sans-serif;margin:0;background:#f5f7fb;color:#172033;}',
    '.wrap{padding:18px;}',
    '.title{font-size:22px;font-weight:700;margin-bottom:4px;}',
    '.sub{font-size:12px;color:#667085;margin-bottom:16px;}',
    '.card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:14px;margin-bottom:12px;}',
    '.metric{display:flex;justify-content:space-between;gap:12px;align-items:center;}',
    '.label{font-size:13px;color:#475467;}',
    '.value{font-size:22px;font-weight:700;}',
    '.status{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:5px 9px;margin-top:8px;}',
    '.HEALTHY{background:#dcfae6;color:#067647;}',
    '.WARNING{background:#fef0c7;color:#b54708;}',
    '.CRITICAL{background:#fee4e2;color:#b42318;}',
    '.UNKNOWN{background:#eaecf0;color:#344054;}',
    '.buttons{display:grid;grid-template-columns:1fr;gap:9px;margin-top:16px;}',
    'button{border:0;border-radius:9px;padding:11px 12px;font-weight:700;cursor:pointer;background:#172033;color:#fff;}',
    'button.secondary{background:#fff;color:#172033;border:1px solid #d0d5dd;}',
    '.msg{font-size:12px;margin-top:10px;color:#475467;min-height:18px;}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="wrap">',
    '<div class="title">MelroseOS</div>',
    '<div class="sub">Command Center v5.0.0</div>',
    '<div id="cards"></div>',
    '<div class="buttons">',
    '<button onclick="refreshData()">Refresh Dashboard</button>',
    '<button class="secondary" onclick="runHealth()">Run Health Check</button>',
    '<button class="secondary" onclick="runQueue()">Process Next Queue Item</button>',
    '</div>',
    '<div id="message" class="msg"></div>',
    '</div>',
    '<script>',
    'var DATA = JSON.parse(<?= JSON.stringify(data) ?>);',
    'function metric(name){return DATA.metrics[name]||{value:"—",status:"UNKNOWN",details:""};}',
    'function render(){',
    'var names=["Overall Status","Connected Workbooks","Registered Components","Active Triggers","Pending or Retrying Jobs","Failed Jobs","Unresolved Errors","Unhealthy Components"];',
    'var html="";',
    'names.forEach(function(name){',
    'var item=metric(name);',
    'html+=\'<div class="card"><div class="metric"><div class="label">\'+name+\'</div><div class="value">\'+item.value+\'</div></div><div class="status \'+item.status+\'">\'+item.status+\'</div><div class="sub" style="margin-top:8px;margin-bottom:0">\'+(item.details||"")+\'</div></div>\';',
    '});',
    'document.getElementById("cards").innerHTML=html;',
    '}',
    'function busy(text){document.getElementById("message").textContent=text;}',
    'function done(result){DATA=result;render();busy("Completed successfully.");}',
    'function fail(error){busy(error.message||String(error));}',
    'function refreshData(){busy("Refreshing...");google.script.run.withSuccessHandler(done).withFailureHandler(fail).m5CommandCenterSidebarRefresh();}',
    'function runHealth(){busy("Running health check...");google.script.run.withSuccessHandler(done).withFailureHandler(fail).m5CommandCenterSidebarHealthCheck();}',
    'function runQueue(){busy("Processing queue...");google.script.run.withSuccessHandler(done).withFailureHandler(fail).m5CommandCenterSidebarQueue();}',
    'render();',
    '</script>',
    '</body>',
    '</html>'
  ].join('');
}


/* =====================================================================
   FORMATTING
===================================================================== */

function m5CommandCenterFormatDashboard_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) {
    return;
  }

  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setFontWeight('bold');

  sheet.autoResizeColumns(1, sheet.getLastColumn());

  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 6, sheet.getLastRow() - 1, 1)
      .setNumberFormat('m/d/yyyy h:mm:ss');
  }
}


/* =====================================================================
   VALIDATION
===================================================================== */

function testM5CommandCenter() {
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

  run('Framework available', function () {
    m5CommandCenterRequireFramework_();
    return M5_FRAMEWORK.VERSION;
  });

  run('Dashboard sheet available', function () {
    var sheet = m5OpenWorkbook_('CORE')
      .getSheetByName(M5_COMMAND_CENTER.SHEETS.DASHBOARD);

    if (!sheet) {
      throw new Error('Command Center dashboard is missing.');
    }

    return sheet.getName();
  });

  run('Refresh succeeds', function () {
    return refreshM5CommandCenter();
  });

  run('Sidebar data succeeds', function () {
    return m5CommandCenterGetSidebarData_();
  });

  var failures = tests.filter(function (test) {
    return test.status === 'FAIL';
  });

  return {
    success: failures.length === 0,
    version: M5_COMMAND_CENTER.VERSION,
    passed: tests.length - failures.length,
    failed: failures.length,
    tests: tests
  };
}


function m5CommandCenterRequireFramework_() {
  if (
    typeof M5_FRAMEWORK === 'undefined' ||
    typeof m5OpenWorkbook_ !== 'function' ||
    typeof m5RegisterComponent !== 'function'
  ) {
    throw new Error(
      'MelroseOS 5.0 Shared Framework must be installed first.'
    );
  }
}
