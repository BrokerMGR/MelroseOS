/**
 * =====================================================================
 * MELROSEOS 5.0 — MODULE INSTALLER & DEPLOYMENT MANAGER
 * Full Overwrite
 * Version 5.0.0
 *
 * INSTALL LOCATION
 * - MelroseOS Core Apps Script project
 *
 * DEPENDENCIES
 * - MelroseOS 5.0 Shared Framework
 * - MelroseOS 5.0 Command Center
 *
 * RUN IN ORDER
 * 1. setupM5ModuleInstaller()
 * 2. seedM5ModuleCatalog()
 * 3. installM5DeploymentProcessorTrigger()
 * 4. refreshM5CommandCenter()
 * 5. testM5ModuleInstaller()
 *
 * PURPOSE
 * - Register all MelroseOS modules in one catalog
 * - Validate dependencies before activation
 * - Queue deployments and upgrades
 * - Track deployment history
 * - Activate, pause, repair, and roll back module metadata
 * - Call installed module setup functions safely
 *
 * NOTE
 * - This manager deploys modules whose Apps Script code is already present
 *   in the Core project or callable through registered installer functions.
 * - Cross-project source-code deployment will be enabled after Script Project
 *   IDs are registered for each workbook.
 * =====================================================================
 */


var M5_INSTALLER = Object.freeze({
  VERSION: '5.0.0',

  SHEETS: Object.freeze({
    CATALOG: 'M5_ModuleCatalog',
    DEPLOYMENTS: 'M5_DeploymentQueue',
    HISTORY: 'M5_DeploymentHistory',
    DEPENDENCIES: 'M5_DependencyMap',
    SNAPSHOTS: 'M5_ModuleSnapshots'
  }),

  STATUS: Object.freeze({
    AVAILABLE: 'AVAILABLE',
    QUEUED: 'QUEUED',
    VALIDATING: 'VALIDATING',
    INSTALLING: 'INSTALLING',
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    RETRY: 'RETRY',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED',
    ROLLED_BACK: 'ROLLED_BACK'
  })
});


/* =====================================================================
   INSTALLATION
===================================================================== */

function setupM5ModuleInstaller() {
  m5InstallerRequireFramework_();

  var core = m5OpenWorkbook_('CORE');

  m5EnsureSheet_(core, M5_INSTALLER.SHEETS.CATALOG, [
    'ModuleID',
    'ModuleName',
    'Category',
    'Version',
    'WorkbookKey',
    'InstallerFunction',
    'HealthFunction',
    'Dependencies',
    'Status',
    'AutoActivate',
    'Description',
    'InstalledVersion',
    'InstalledAt',
    'UpdatedAt'
  ]);

  m5EnsureSheet_(core, M5_INSTALLER.SHEETS.DEPLOYMENTS, [
    'DeploymentID',
    'ModuleID',
    'RequestedVersion',
    'DeploymentType',
    'Priority',
    'Status',
    'AttemptCount',
    'MaxAttempts',
    'RequestedBy',
    'RequestedAt',
    'StartedAt',
    'CompletedAt',
    'LastError',
    'Notes'
  ]);

  m5EnsureSheet_(core, M5_INSTALLER.SHEETS.HISTORY, [
    'HistoryID',
    'DeploymentID',
    'ModuleID',
    'OldVersion',
    'NewVersion',
    'DeploymentType',
    'Status',
    'Message',
    'StartedAt',
    'CompletedAt',
    'RecordedAt',
    'RecordedBy'
  ]);

  m5EnsureSheet_(core, M5_INSTALLER.SHEETS.DEPENDENCIES, [
    'DependencyID',
    'ModuleID',
    'RequiredModuleID',
    'MinimumVersion',
    'RequiredStatus',
    'ValidationStatus',
    'Message',
    'LastCheckedAt'
  ]);

  m5EnsureSheet_(core, M5_INSTALLER.SHEETS.SNAPSHOTS, [
    'SnapshotID',
    'ModuleID',
    'Version',
    'Status',
    'WorkbookKey',
    'InstallerFunction',
    'HealthFunction',
    'Dependencies',
    'SnapshotJSON',
    'CreatedAt',
    'CreatedBy'
  ]);

  m5RegisterComponent({
    componentId: 'M5-MODULE-INSTALLER',
    componentName: 'MelroseOS Module Installer',
    module: 'SYSTEM',
    componentType: 'APPLICATION',
    version: M5_INSTALLER.VERSION,
    workbookKey: 'CORE',
    status: 'ACTIVE',
    dependencies: 'M5-CONFIG,M5-QUEUE,M5-LOGGER,M5-COMMAND-CENTER'
  });

  return {
    success: true,
    version: M5_INSTALLER.VERSION,
    nextFunction: 'seedM5ModuleCatalog'
  };
}


/* =====================================================================
   MODULE CATALOG
===================================================================== */

function seedM5ModuleCatalog() {
  var modules = [
    {
      ModuleID: 'M5-FRAMEWORK',
      ModuleName: 'Shared Framework',
      Category: 'SYSTEM',
      Version: M5_FRAMEWORK.VERSION,
      WorkbookKey: 'CORE',
      InstallerFunction: 'setupM5FrameworkFinalize',
      HealthFunction: 'm5RunFrameworkHealthCheck',
      Dependencies: '',
      Status: 'ACTIVE',
      AutoActivate: true,
      Description: 'Shared MelroseOS configuration, queue, logging and health foundation.'
    },
    {
      ModuleID: 'M5-COMMAND-CENTER',
      ModuleName: 'Command Center',
      Category: 'SYSTEM',
      Version: M5_COMMAND_CENTER.VERSION,
      WorkbookKey: 'CORE',
      InstallerFunction: 'setupM5CommandCenter',
      HealthFunction: 'testM5CommandCenter',
      Dependencies: 'M5-FRAMEWORK',
      Status: 'ACTIVE',
      AutoActivate: true,
      Description: 'Central monitoring and management dashboard.'
    },
    {
      ModuleID: 'M5-MODULE-INSTALLER',
      ModuleName: 'Module Installer',
      Category: 'SYSTEM',
      Version: M5_INSTALLER.VERSION,
      WorkbookKey: 'CORE',
      InstallerFunction: 'setupM5ModuleInstaller',
      HealthFunction: 'testM5ModuleInstaller',
      Dependencies: 'M5-FRAMEWORK,M5-COMMAND-CENTER',
      Status: 'ACTIVE',
      AutoActivate: true,
      Description: 'Module catalog, dependency validation and deployment manager.'
    },
    {
      ModuleID: 'M5-CRM',
      ModuleName: 'CRM Operating System',
      Category: 'CRM',
      Version: '5.0.0',
      WorkbookKey: 'CRM',
      InstallerFunction: 'setupM5CRM',
      HealthFunction: 'testM5CRM',
      Dependencies: 'M5-FRAMEWORK,M5-MODULE-INSTALLER',
      Status: 'AVAILABLE',
      AutoActivate: false,
      Description: 'Lead, contact, assignment, appointment and follow-up management.'
    },
    {
      ModuleID: 'M5-MARKETING',
      ModuleName: 'Marketing Operating System',
      Category: 'MARKETING',
      Version: '5.0.0',
      WorkbookKey: 'MARKETING',
      InstallerFunction: 'setupM5Marketing',
      HealthFunction: 'testM5Marketing',
      Dependencies: 'M5-FRAMEWORK,M5-MODULE-INSTALLER',
      Status: 'AVAILABLE',
      AutoActivate: false,
      Description: 'Campaigns, email, social media and content production.'
    },
    {
      ModuleID: 'M5-WEBSITE',
      ModuleName: 'Website Operating System',
      Category: 'WEBSITE',
      Version: '5.0.0',
      WorkbookKey: 'WEBSITE',
      InstallerFunction: 'setupM5Website',
      HealthFunction: 'testM5Website',
      Dependencies: 'M5-FRAMEWORK,M5-MODULE-INSTALLER',
      Status: 'AVAILABLE',
      AutoActivate: false,
      Description: 'Website data feeds, listings, agents and lead forms.'
    },
    {
      ModuleID: 'M5-ANALYTICS',
      ModuleName: 'Analytics Operating System',
      Category: 'ANALYTICS',
      Version: '5.0.0',
      WorkbookKey: 'ANALYTICS',
      InstallerFunction: 'setupM5Analytics',
      HealthFunction: 'testM5Analytics',
      Dependencies: 'M5-FRAMEWORK,M5-MODULE-INSTALLER',
      Status: 'AVAILABLE',
      AutoActivate: false,
      Description: 'Brokerage reporting, KPIs, scorecards and forecasting.'
    }
  ];

  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_INSTALLER.SHEETS.CATALOG);

  modules.forEach(function (module) {
    module.InstalledVersion =
      module.Status === 'ACTIVE' ? module.Version : '';
    module.InstalledAt =
      module.Status === 'ACTIVE' ? new Date() : '';
    module.UpdatedAt = new Date();
  });

  m5UpsertBatch_(sheet, 'ModuleID', modules);
  rebuildM5DependencyMap();

  return {
    success: true,
    modulesRegistered: modules.length
  };
}


function registerM5Module(options) {
  options = options || {};

  if (!options.moduleId) {
    throw new Error('moduleId is required.');
  }

  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_INSTALLER.SHEETS.CATALOG);

  var row = {
    ModuleID: options.moduleId,
    ModuleName: options.moduleName || options.moduleId,
    Category: options.category || 'OTHER',
    Version: options.version || '5.0.0',
    WorkbookKey: options.workbookKey || 'CORE',
    InstallerFunction: options.installerFunction || '',
    HealthFunction: options.healthFunction || '',
    Dependencies: options.dependencies || '',
    Status: options.status || 'AVAILABLE',
    AutoActivate: Boolean(options.autoActivate),
    Description: options.description || '',
    InstalledVersion: options.installedVersion || '',
    InstalledAt: options.installedAt || '',
    UpdatedAt: new Date()
  };

  m5UpsertBatch_(sheet, 'ModuleID', [row]);
  rebuildM5DependencyMap();

  return {
    success: true,
    moduleId: options.moduleId
  };
}


function rebuildM5DependencyMap() {
  var core = m5OpenWorkbook_('CORE');
  var catalog = core.getSheetByName(M5_INSTALLER.SHEETS.CATALOG);
  var dependencies = core.getSheetByName(
    M5_INSTALLER.SHEETS.DEPENDENCIES
  );

  var rows = [];

  m5ReadObjects_(catalog).forEach(function (module) {
    String(module.Dependencies || '')
      .split(',')
      .map(function (value) {
        return value.trim();
      })
      .filter(Boolean)
      .forEach(function (dependencyId) {
        rows.push({
          DependencyID: module.ModuleID + '::' + dependencyId,
          ModuleID: module.ModuleID,
          RequiredModuleID: dependencyId,
          MinimumVersion: '5.0.0',
          RequiredStatus: 'ACTIVE',
          ValidationStatus: 'PENDING',
          Message: '',
          LastCheckedAt: ''
        });
      });
  });

  m5ReplaceAllObjects_(
    dependencies,
    rows,
    [
      'DependencyID',
      'ModuleID',
      'RequiredModuleID',
      'MinimumVersion',
      'RequiredStatus',
      'ValidationStatus',
      'Message',
      'LastCheckedAt'
    ]
  );

  return {
    success: true,
    dependencies: rows.length
  };
}


/* =====================================================================
   DEPLOYMENT QUEUE
===================================================================== */

function queueM5ModuleDeployment(moduleId, deploymentType) {
  deploymentType = deploymentType || 'INSTALL';

  var module = m5GetCatalogModule_(moduleId);

  if (!module) {
    throw new Error('Unknown module: ' + moduleId);
  }

  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_INSTALLER.SHEETS.DEPLOYMENTS);

  var deploymentId = 'DEPLOY-' + Utilities.getUuid();

  m5AppendObject_(sheet, {
    DeploymentID: deploymentId,
    ModuleID: moduleId,
    RequestedVersion: module.Version,
    DeploymentType: deploymentType,
    Priority: 100,
    Status: 'QUEUED',
    AttemptCount: 0,
    MaxAttempts: 3,
    RequestedBy: m5CurrentUser_(),
    RequestedAt: new Date(),
    StartedAt: '',
    CompletedAt: '',
    LastError: '',
    Notes: ''
  });

  return {
    success: true,
    deploymentId: deploymentId,
    moduleId: moduleId,
    deploymentType: deploymentType
  };
}


function processNextM5Deployment() {
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    return {
      success: false,
      skipped: true,
      message: 'Deployment processor already running.'
    };
  }

  try {
    var sheet = m5OpenWorkbook_('CORE')
      .getSheetByName(M5_INSTALLER.SHEETS.DEPLOYMENTS);

    var deployment = m5ReadObjects_(sheet, true)
      .filter(function (row) {
        return ['QUEUED', 'RETRY'].indexOf(
          String(row.Status || '').toUpperCase()
        ) >= 0;
      })
      .sort(function (a, b) {
        return Number(a.Priority || 100) - Number(b.Priority || 100);
      })[0];

    if (!deployment) {
      return {
        success: true,
        complete: true,
        message: 'No queued module deployments.'
      };
    }

    return m5ExecuteDeployment_(sheet, deployment);
  } finally {
    lock.releaseLock();
  }
}


function m5ExecuteDeployment_(sheet, deployment) {
  var module = m5GetCatalogModule_(deployment.ModuleID);

  if (!module) {
    throw new Error(
      'Catalog record missing for module: ' + deployment.ModuleID
    );
  }

  var attempt = Number(deployment.AttemptCount || 0) + 1;
  var maximum = Number(deployment.MaxAttempts || 3);
  var oldVersion = module.InstalledVersion || '';

  m5UpdateRow_(sheet, deployment._rowNumber, {
    Status: 'VALIDATING',
    AttemptCount: attempt,
    StartedAt: deployment.StartedAt || new Date(),
    LastError: ''
  });

  try {
    var dependencyResult = validateM5ModuleDependencies(
      deployment.ModuleID
    );

    if (!dependencyResult.success) {
      throw new Error(
        'Dependency validation failed: ' +
        dependencyResult.failures.join('; ')
      );
    }

    m5CreateModuleSnapshot_(module);

    m5UpdateRow_(sheet, deployment._rowNumber, {
      Status: 'INSTALLING'
    });

    var installerFunction = String(
      module.InstallerFunction || ''
    ).trim();

    if (!installerFunction) {
      throw new Error(
        'Installer function is not registered for ' +
        deployment.ModuleID
      );
    }

    var installer = this[installerFunction];

    if (typeof installer !== 'function') {
      throw new Error(
        'Installer function is not currently loaded: ' +
        installerFunction
      );
    }

    var result = installer();

    m5ActivateCatalogModule_(
      deployment.ModuleID,
      deployment.RequestedVersion
    );

    m5UpdateRow_(sheet, deployment._rowNumber, {
      Status: 'COMPLETE',
      CompletedAt: new Date(),
      LastError: ''
    });

    m5RecordDeploymentHistory_({
      deploymentId: deployment.DeploymentID,
      moduleId: deployment.ModuleID,
      oldVersion: oldVersion,
      newVersion: deployment.RequestedVersion,
      deploymentType: deployment.DeploymentType,
      status: 'COMPLETE',
      message: 'Module deployment completed.',
      startedAt: deployment.StartedAt || new Date(),
      completedAt: new Date()
    });

    refreshM5CommandCenter();

    return {
      success: true,
      deploymentId: deployment.DeploymentID,
      moduleId: deployment.ModuleID,
      result: result
    };
  } catch (error) {
    var finalFailure = attempt >= maximum;
    var nextStatus = finalFailure ? 'FAILED' : 'RETRY';

    m5UpdateRow_(sheet, deployment._rowNumber, {
      Status: nextStatus,
      LastError: m5Truncate_(error.message || String(error), 1000),
      CompletedAt: finalFailure ? new Date() : ''
    });

    m5RecordDeploymentHistory_({
      deploymentId: deployment.DeploymentID,
      moduleId: deployment.ModuleID,
      oldVersion: oldVersion,
      newVersion: deployment.RequestedVersion,
      deploymentType: deployment.DeploymentType,
      status: nextStatus,
      message: error.message || String(error),
      startedAt: deployment.StartedAt || new Date(),
      completedAt: finalFailure ? new Date() : ''
    });

    m5RecordError_(error, {
      module: 'SYSTEM',
      functionName: 'm5ExecuteDeployment_',
      workbookKey: module.WorkbookKey || 'CORE',
      referenceId: deployment.DeploymentID,
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


function installM5DeploymentProcessorTrigger() {
  m5DeleteTriggersByHandler_('processNextM5Deployment');

  ScriptApp.newTrigger('processNextM5Deployment')
    .timeBased()
    .everyMinutes(5)
    .create();

  return {
    success: true,
    triggerInstalled: true,
    frequency: 'Every 5 minutes'
  };
}


/* =====================================================================
   DEPENDENCY VALIDATION
===================================================================== */

function validateM5ModuleDependencies(moduleId) {
  var core = m5OpenWorkbook_('CORE');
  var dependencySheet = core.getSheetByName(
    M5_INSTALLER.SHEETS.DEPENDENCIES
  );

  var rows = m5ReadObjects_(dependencySheet, true)
    .filter(function (row) {
      return String(row.ModuleID || '') === String(moduleId || '');
    });

  var failures = [];

  rows.forEach(function (dependency) {
    var required = m5GetCatalogModule_(
      dependency.RequiredModuleID
    );

    var success = Boolean(required) &&
      String(required.Status || '').toUpperCase() ===
        String(dependency.RequiredStatus || 'ACTIVE').toUpperCase() &&
      m5CompareVersions_(
        required.InstalledVersion || required.Version,
        dependency.MinimumVersion || '0.0.0'
      ) >= 0;

    var message = success
      ? 'Dependency satisfied.'
      : 'Required module ' + dependency.RequiredModuleID +
        ' must be ACTIVE at version ' +
        dependency.MinimumVersion + ' or newer.';

    m5UpdateRow_(dependencySheet, dependency._rowNumber, {
      ValidationStatus: success ? 'PASS' : 'FAIL',
      Message: message,
      LastCheckedAt: new Date()
    });

    if (!success) {
      failures.push(message);
    }
  });

  return {
    success: failures.length === 0,
    moduleId: moduleId,
    checked: rows.length,
    failures: failures
  };
}


/* =====================================================================
   MODULE CONTROLS
===================================================================== */

function pauseM5Module(moduleId) {
  return m5SetCatalogModuleStatus_(moduleId, 'PAUSED');
}


function activateM5Module(moduleId) {
  var validation = validateM5ModuleDependencies(moduleId);

  if (!validation.success) {
    throw new Error(validation.failures.join('; '));
  }

  return m5SetCatalogModuleStatus_(moduleId, 'ACTIVE');
}


function repairM5Module(moduleId) {
  return queueM5ModuleDeployment(moduleId, 'REPAIR');
}


function upgradeM5Module(moduleId) {
  return queueM5ModuleDeployment(moduleId, 'UPGRADE');
}


function rollbackM5Module(moduleId) {
  var core = m5OpenWorkbook_('CORE');
  var snapshotSheet = core.getSheetByName(
    M5_INSTALLER.SHEETS.SNAPSHOTS
  );

  var snapshot = m5ReadObjects_(snapshotSheet)
    .filter(function (row) {
      return String(row.ModuleID || '') === String(moduleId || '');
    })
    .sort(function (a, b) {
      return new Date(b.CreatedAt).getTime() -
        new Date(a.CreatedAt).getTime();
    })[0];

  if (!snapshot) {
    throw new Error('No rollback snapshot exists for ' + moduleId);
  }

  var payload = m5ParseJson_(snapshot.SnapshotJSON, {});

  if (!payload.ModuleID) {
    throw new Error('Rollback snapshot is invalid.');
  }

  var catalog = core.getSheetByName(M5_INSTALLER.SHEETS.CATALOG);
  m5UpsertBatch_(catalog, 'ModuleID', [payload]);

  m5RecordDeploymentHistory_({
    deploymentId: 'ROLLBACK-' + Utilities.getUuid(),
    moduleId: moduleId,
    oldVersion: '',
    newVersion: payload.InstalledVersion || payload.Version,
    deploymentType: 'ROLLBACK',
    status: 'ROLLED_BACK',
    message: 'Module catalog state restored from snapshot.',
    startedAt: new Date(),
    completedAt: new Date()
  });

  refreshM5CommandCenter();

  return {
    success: true,
    moduleId: moduleId,
    restoredVersion: payload.InstalledVersion || payload.Version
  };
}


/* =====================================================================
   INTERNAL HELPERS
===================================================================== */

function m5GetCatalogModule_(moduleId) {
  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_INSTALLER.SHEETS.CATALOG);

  return m5ReadObjects_(sheet).find(function (row) {
    return String(row.ModuleID || '') === String(moduleId || '');
  }) || null;
}


function m5ActivateCatalogModule_(moduleId, installedVersion) {
  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_INSTALLER.SHEETS.CATALOG);

  var row = m5ReadObjects_(sheet, true).find(function (record) {
    return String(record.ModuleID || '') === String(moduleId || '');
  });

  if (!row) {
    throw new Error('Catalog module not found: ' + moduleId);
  }

  m5UpdateRow_(sheet, row._rowNumber, {
    Status: 'ACTIVE',
    InstalledVersion: installedVersion || row.Version,
    InstalledAt: row.InstalledAt || new Date(),
    UpdatedAt: new Date()
  });

  m5RegisterComponent({
    componentId: moduleId,
    componentName: row.ModuleName,
    module: row.Category,
    componentType: 'MODULE',
    version: installedVersion || row.Version,
    workbookKey: row.WorkbookKey,
    status: 'ACTIVE',
    dependencies: row.Dependencies
  });
}


function m5SetCatalogModuleStatus_(moduleId, status) {
  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_INSTALLER.SHEETS.CATALOG);

  var row = m5ReadObjects_(sheet, true).find(function (record) {
    return String(record.ModuleID || '') === String(moduleId || '');
  });

  if (!row) {
    throw new Error('Catalog module not found: ' + moduleId);
  }

  m5UpdateRow_(sheet, row._rowNumber, {
    Status: status,
    UpdatedAt: new Date()
  });

  refreshM5CommandCenter();

  return {
    success: true,
    moduleId: moduleId,
    status: status
  };
}


function m5CreateModuleSnapshot_(module) {
  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_INSTALLER.SHEETS.SNAPSHOTS);

  m5AppendObject_(sheet, {
    SnapshotID: 'SNAPSHOT-' + Utilities.getUuid(),
    ModuleID: module.ModuleID,
    Version: module.InstalledVersion || module.Version,
    Status: module.Status,
    WorkbookKey: module.WorkbookKey,
    InstallerFunction: module.InstallerFunction,
    HealthFunction: module.HealthFunction,
    Dependencies: module.Dependencies,
    SnapshotJSON: m5SafeJson_(module),
    CreatedAt: new Date(),
    CreatedBy: m5CurrentUser_()
  });
}


function m5RecordDeploymentHistory_(options) {
  var sheet = m5OpenWorkbook_('CORE')
    .getSheetByName(M5_INSTALLER.SHEETS.HISTORY);

  m5AppendObject_(sheet, {
    HistoryID: 'DEPLOYMENT-HISTORY-' + Utilities.getUuid(),
    DeploymentID: options.deploymentId || '',
    ModuleID: options.moduleId || '',
    OldVersion: options.oldVersion || '',
    NewVersion: options.newVersion || '',
    DeploymentType: options.deploymentType || '',
    Status: options.status || '',
    Message: m5Truncate_(options.message || '', 1000),
    StartedAt: options.startedAt || '',
    CompletedAt: options.completedAt || '',
    RecordedAt: new Date(),
    RecordedBy: m5CurrentUser_()
  });
}


function m5CompareVersions_(left, right) {
  var a = String(left || '0.0.0').split('.').map(Number);
  var b = String(right || '0.0.0').split('.').map(Number);
  var length = Math.max(a.length, b.length);

  for (var index = 0; index < length; index++) {
    var av = Number(a[index] || 0);
    var bv = Number(b[index] || 0);

    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}


function m5InstallerRequireFramework_() {
  if (
    typeof M5_FRAMEWORK === 'undefined' ||
    typeof M5_COMMAND_CENTER === 'undefined' ||
    typeof m5OpenWorkbook_ !== 'function' ||
    typeof m5RegisterComponent !== 'function'
  ) {
    throw new Error(
      'Install the Shared Framework and Command Center first.'
    );
  }
}


/* =====================================================================
   TEST
===================================================================== */

function testM5ModuleInstaller() {
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

  run('Framework dependencies available', function () {
    m5InstallerRequireFramework_();
    return true;
  });

  run('Catalog available', function () {
    var sheet = m5OpenWorkbook_('CORE')
      .getSheetByName(M5_INSTALLER.SHEETS.CATALOG);

    if (!sheet) {
      throw new Error('Module catalog sheet is missing.');
    }

    return m5ReadObjects_(sheet).length;
  });

  run('Framework dependency validation', function () {
    return validateM5ModuleDependencies('M5-COMMAND-CENTER');
  });

  run('Version comparison', function () {
    if (m5CompareVersions_('5.0.0', '5.0.0') !== 0) {
      throw new Error('Equal version comparison failed.');
    }

    if (m5CompareVersions_('5.1.0', '5.0.9') !== 1) {
      throw new Error('Greater version comparison failed.');
    }

    return true;
  });

  run('Deployment processor idle check', function () {
    return processNextM5Deployment();
  });

  var failures = tests.filter(function (test) {
    return test.status === 'FAIL';
  });

  return {
    success: failures.length === 0,
    version: M5_INSTALLER.VERSION,
    passed: tests.length - failures.length,
    failed: failures.length,
    tests: tests,
    nextModule: failures.length === 0 ? 'M5-CRM' : ''
  };
}
