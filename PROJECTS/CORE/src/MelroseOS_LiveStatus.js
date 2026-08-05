/**
 * MELROSEOS 4.2 — LIVE INSTALLER STATUS REPAIR
 *
 * Add this file to MelroseOS Core.
 *
 * Run once:
 *   installMelroseInstallerLiveStatusTrigger()
 *
 * Manual refresh:
 *   refreshMelroseInstallerLiveStatus()
 *
 * This does not alter deployment data. It only recalculates
 * Installer_Status from the three installer queue sheets.
 */

function installMelroseInstallerLiveStatusTrigger() {
  removeMelroseInstallerLiveStatusTrigger();

  ScriptApp.newTrigger('refreshMelroseInstallerLiveStatus')
    .timeBased()
    .everyMinutes(5)
    .create();

  refreshMelroseInstallerLiveStatus();

  return {
    success: true,
    triggerInstalled: true
  };
}


function removeMelroseInstallerLiveStatusTrigger() {
  var removed = 0;

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (
      trigger.getHandlerFunction() ===
      'refreshMelroseInstallerLiveStatus'
    ) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  return {
    success: true,
    removed: removed
  };
}


function refreshMelroseInstallerLiveStatus() {
  var core = SpreadsheetApp.openById(
    '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64'
  );

  var statusSheet = core.getSheetByName('Installer_Status');

  if (!statusSheet) {
    throw new Error('Installer_Status is missing.');
  }

  var stages = [
    {
      stage: 'CODE_DEPLOYMENT',
      sheetName: 'Installer_CodeQueue'
    },
    {
      stage: 'WORKBOOK_STRUCTURE',
      sheetName: 'Installer_StructureQueue'
    },
    {
      stage: 'DATA_MIGRATION',
      sheetName: 'Installer_MigrationQueue'
    }
  ];

  var results = [];

  stages.forEach(function (definition) {
    var queueSheet = core.getSheetByName(definition.sheetName);
    var summary = melroseLiveQueueSummary_(queueSheet);

    var status;

    if (summary.total === 0) {
      status = 'NOT_STARTED';
    } else if (summary.failed > 0) {
      status = 'FAILED';
    } else if (summary.pending > 0 || summary.inProgress > 0 || summary.retry > 0) {
      status = 'RUNNING';
    } else if (summary.warnings > 0) {
      status = 'WARNING';
    } else {
      status = 'COMPLETE';
    }

    var completed =
      summary.verified +
      summary.warnings;

    melroseLiveUpsertStatus_(statusSheet, {
      Stage: definition.stage,
      Status: status,
      TotalItems: summary.total,
      CompletedItems: completed,
      WarningItems: summary.warnings,
      FailedItems: summary.failed,
      LastUpdatedAt: new Date(),
      Message: melroseLiveStatusMessage_(
        definition.stage,
        status,
        summary
      )
    });

    results.push({
      stage: definition.stage,
      status: status,
      total: summary.total,
      completed: completed,
      pending: summary.pending,
      inProgress: summary.inProgress,
      retry: summary.retry,
      warnings: summary.warnings,
      failed: summary.failed
    });
  });

  return {
    success: true,
    refreshedAt: new Date(),
    stages: results
  };
}


function melroseLiveQueueSummary_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return {
      total: 0,
      pending: 0,
      inProgress: 0,
      retry: 0,
      verified: 0,
      warnings: 0,
      failed: 0
    };
  }

  var values = sheet.getRange(
    1,
    1,
    sheet.getLastRow(),
    sheet.getLastColumn()
  ).getDisplayValues();

  var headers = values[0].map(function (value) {
    return String(value || '').trim();
  });

  var statusIndex = headers.indexOf('Status');

  if (statusIndex < 0) {
    throw new Error(
      sheet.getName() + ' does not contain a Status column.'
    );
  }

  var statuses = values.slice(1)
    .map(function (row) {
      return String(row[statusIndex] || '')
        .trim()
        .toUpperCase();
    })
    .filter(function (status) {
      return Boolean(status);
    });

  function count(allowed) {
    return statuses.filter(function (status) {
      return allowed.indexOf(status) >= 0;
    }).length;
  }

  return {
    total: statuses.length,
    pending: count(['PENDING']),
    inProgress: count(['IN_PROGRESS']),
    retry: count(['RETRY']),
    verified: count(['VERIFIED']),
    warnings: count([
      'WARNING',
      'COPIED_WITH_WARNING',
      'DEPLOYED_WITH_WARNING'
    ]),
    failed: count(['FAILED'])
  };
}


function melroseLiveStatusMessage_(stage, status, summary) {
  if (status === 'NOT_STARTED') {
    return stage + ' has not been queued.';
  }

  if (status === 'RUNNING') {
    return (
      (summary.verified + summary.warnings) +
      ' of ' +
      summary.total +
      ' completed; ' +
      summary.pending +
      ' pending; ' +
      summary.inProgress +
      ' in progress; ' +
      summary.retry +
      ' retrying.'
    );
  }

  if (status === 'FAILED') {
    return (
      summary.failed +
      ' item(s) failed; ' +
      (summary.verified + summary.warnings) +
      ' of ' +
      summary.total +
      ' completed.'
    );
  }

  if (status === 'WARNING') {
    return (
      summary.verified +
      ' verified and ' +
      summary.warnings +
      ' completed with warning.'
    );
  }

  return (
    summary.total +
    ' of ' +
    summary.total +
    ' completed.'
  );
}


function melroseLiveUpsertStatus_(sheet, incoming) {
  var values = sheet.getRange(
    1,
    1,
    Math.max(1, sheet.getLastRow()),
    sheet.getLastColumn()
  ).getValues();

  var headers = values[0].map(function (value) {
    return String(value || '').trim();
  });

  var stageIndex = headers.indexOf('Stage');

  if (stageIndex < 0) {
    throw new Error(
      'Installer_Status does not contain a Stage column.'
    );
  }

  var targetRow = -1;

  for (var i = 1; i < values.length; i++) {
    if (
      String(values[i][stageIndex] || '').trim() ===
      incoming.Stage
    ) {
      targetRow = i + 1;
      break;
    }
  }

  var row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(incoming, header)
      ? incoming[header]
      : '';
  });

  if (targetRow > 0) {
    sheet.getRange(
      targetRow,
      1,
      1,
      headers.length
    ).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}
