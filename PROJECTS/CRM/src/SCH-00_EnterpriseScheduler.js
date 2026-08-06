/******************************************************************************
 * MelroseOS Enterprise
 * File: SCH-00_EnterpriseScheduler.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Central managed scheduler for MelroseOS background workers.
 *
 * Safety:
 *   - Uses one Apps Script trigger.
 *   - Prevents duplicate scheduler triggers.
 *   - Runs only enabled jobs that are due.
 *   - Isolates job failures.
 *   - Uses a script lock to prevent overlapping scheduler runs.
 *   - Does not activate routing or communications.
 ******************************************************************************/

const MOS5_SCHEDULER_VERSION = "1.0.0";

const MOS5_SCHEDULER = Object.freeze({
  SHEET: "SYS_SCHEDULED_JOBS",

  TRIGGER_HANDLER:
    "MOS5SCH_runEnterpriseScheduler",

  LOCK_TIMEOUT_MS: 10000,

  DEFAULT_TRIGGER_MINUTES: 5,

  MAX_JOBS_PER_RUN: 25,

  HEADERS: Object.freeze([
    "JobID",
    "JobName",
    "HandlerFunction",
    "Enabled",
    "IntervalMinutes",
    "BatchSize",
    "Priority",
    "LastRunAt",
    "NextRunAt",
    "LastStatus",
    "LastDurationMs",
    "LastError",
    "ConsecutiveFailures",
    "CreatedAt",
    "UpdatedAt"
  ])
});

/**
 * Initializes the scheduler and registers default jobs.
 *
 * Does not install the trigger.
 *
 * @return {Object}
 */
function MOS5SCH_initializeScheduler() {
  const sheet =
    MOS5SCH_ensureSchedulerSheet_();

  MOS5SCH_defaultJobs_()
    .forEach(function(job) {
      MOS5SCH_registerJob(job);
    });

  return {
    success: true,
    status: "INITIALIZED",
    release:
      "MOS5-ENTERPRISE-SCHEDULER",
    version:
      MOS5_SCHEDULER_VERSION,
    jobs:
      MOS5SCH_sheetObjects_(sheet).length,
    triggerInstalled:
      MOS5SCH_getSchedulerTriggerStatus()
        .installed,
    productionChanged:
      false,
    completedAt:
      new Date().toISOString()
  };
}

/**
 * Registers or updates one scheduled job.
 *
 * @param {Object} job
 * @return {Object}
 */
function MOS5SCH_registerJob(job) {
  const input = job || {};

  const handlerFunction = String(
    input.HandlerFunction ||
    input.handlerFunction ||
    ""
  ).trim();

  if (!handlerFunction) {
    throw new Error(
      "HandlerFunction is required."
    );
  }

  const jobName = String(
    input.JobName ||
    input.jobName ||
    handlerFunction
  ).trim();

  const sheet =
    MOS5SCH_ensureSchedulerSheet_();

  const existing =
    MOS5SCH_findJob_(
      sheet,
      handlerFunction
    );

  const now = new Date();

  const intervalMinutes = Math.max(
    1,
    Number(
      input.IntervalMinutes !== undefined
        ? input.IntervalMinutes
        : input.intervalMinutes !== undefined
          ? input.intervalMinutes
          : 5
    )
  );

  const record = {
    JobID:
      existing
        ? existing.JobID
        : MOS5SCH_id_("JOB"),

    JobName:
      jobName,

    HandlerFunction:
      handlerFunction,

    Enabled:
      input.Enabled !== undefined
        ? MOS5SCH_isTrue_(input.Enabled)
        : input.enabled !== undefined
          ? MOS5SCH_isTrue_(input.enabled)
          : true,

    IntervalMinutes:
      intervalMinutes,

    BatchSize:
      Math.max(
        1,
        Number(
          input.BatchSize !== undefined
            ? input.BatchSize
            : input.batchSize !== undefined
              ? input.batchSize
              : 25
        )
      ),

    Priority:
      Number(
        input.Priority !== undefined
          ? input.Priority
          : input.priority !== undefined
            ? input.priority
            : 100
      ),

    LastRunAt:
      existing
        ? existing.LastRunAt
        : "",

    NextRunAt:
      existing &&
      existing.NextRunAt
        ? existing.NextRunAt
        : now,

    LastStatus:
      existing
        ? existing.LastStatus
        : "",

    LastDurationMs:
      existing
        ? existing.LastDurationMs
        : "",

    LastError:
      existing
        ? existing.LastError
        : "",

    ConsecutiveFailures:
      existing
        ? Number(
            existing.ConsecutiveFailures ||
            0
          )
        : 0,

    CreatedAt:
      existing
        ? existing.CreatedAt
        : now,

    UpdatedAt:
      now
  };

  if (existing) {
    MOS5SCH_updateRow_(
      sheet,
      existing._row,
      record
    );
  } else {
    MOS5SCH_appendRow_(
      sheet,
      record
    );
  }

  return {
    success: true,
    status:
      existing
        ? "UPDATED"
        : "REGISTERED",
    jobId:
      record.JobID,
    jobName:
      record.JobName,
    handlerFunction:
      record.HandlerFunction,
    enabled:
      record.Enabled,
    intervalMinutes:
      record.IntervalMinutes,
    batchSize:
      record.BatchSize,
    productionChanged:
      false
  };
}

/**
 * Runs all enabled jobs that are due.
 *
 * @return {Object}
 */
function MOS5SCH_runEnterpriseScheduler() {
  const startedAt = new Date();
  const lock =
    LockService.getScriptLock();

  if (
    !lock.tryLock(
      MOS5_SCHEDULER.LOCK_TIMEOUT_MS
    )
  ) {
    return {
      success: false,
      status: "SCHEDULER_BUSY",
      processed: 0,
      completed: 0,
      failed: 0,
      startedAt:
        startedAt.toISOString(),
      completedAt:
        new Date().toISOString()
    };
  }

  try {
    const sheet =
      MOS5SCH_ensureSchedulerSheet_();

    const now =
      new Date();

    const jobs =
      MOS5SCH_sheetObjects_(sheet)
        .filter(function(job) {
          return (
            MOS5SCH_isTrue_(
              job.Enabled
            ) &&
            MOS5SCH_dateNumber_(
              job.NextRunAt
            ) <= now.getTime()
          );
        })
        .sort(function(a, b) {
          return (
            Number(
              a.Priority || 100
            ) -
            Number(
              b.Priority || 100
            )
          );
        })
        .slice(
          0,
          MOS5_SCHEDULER
            .MAX_JOBS_PER_RUN
        );

    const results =
      jobs.map(function(job) {
        return MOS5SCH_executeJob_(
          sheet,
          job
        );
      });

    const completed =
      results.filter(function(result) {
        return result.success === true;
      }).length;

    const failed =
      results.length - completed;

    return {
      success:
        failed === 0,

      status:
        results.length === 0
          ? "IDLE"
          : failed === 0
            ? "COMPLETE"
            : completed > 0
              ? "PARTIAL"
              : "FAILED",

      release:
        "MOS5-ENTERPRISE-SCHEDULER",

      version:
        MOS5_SCHEDULER_VERSION,

      processed:
        results.length,

      completed:
        completed,

      failed:
        failed,

      results:
        results,

      productionChanged:
        completed > 0,

      startedAt:
        startedAt.toISOString(),

      completedAt:
        new Date().toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Executes one scheduled job safely.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} job
 * @return {Object}
 */
function MOS5SCH_executeJob_(
  sheet,
  job
) {
  const startedAt =
    new Date();

  const handlerName =
    String(
      job.HandlerFunction || ""
    ).trim();

  const handler =
    globalThis[handlerName];

  const intervalMinutes =
    Math.max(
      1,
      Number(
        job.IntervalMinutes || 5
      )
    );

  const nextRunAt =
    new Date(
      startedAt.getTime() +
      intervalMinutes *
      60 *
      1000
    );

  if (
    typeof handler !== "function"
  ) {
    const failures =
      Number(
        job.ConsecutiveFailures || 0
      ) + 1;

    MOS5SCH_updateRow_(
      sheet,
      job._row,
      {
        LastRunAt:
          startedAt,
        NextRunAt:
          nextRunAt,
        LastStatus:
          "HANDLER_UNAVAILABLE",
        LastDurationMs:
          0,
        LastError:
          "Scheduled handler is unavailable.",
        ConsecutiveFailures:
          failures,
        UpdatedAt:
          new Date()
      }
    );

    return {
      success: false,
      status:
        "HANDLER_UNAVAILABLE",
      jobId:
        job.JobID,
      jobName:
        job.JobName,
      handlerFunction:
        handlerName,
      error:
        "Scheduled handler is unavailable."
    };
  }

  try {
    const response =
      handler(
        Math.max(
          1,
          Number(
            job.BatchSize || 25
          )
        )
      );

    const durationMs =
      new Date().getTime() -
      startedAt.getTime();

    MOS5SCH_updateRow_(
      sheet,
      job._row,
      {
        LastRunAt:
          startedAt,
        NextRunAt:
          nextRunAt,
        LastStatus:
          "COMPLETED",
        LastDurationMs:
          durationMs,
        LastError:
          "",
        ConsecutiveFailures:
          0,
        UpdatedAt:
          new Date()
      }
    );

    return {
      success: true,
      status: "COMPLETED",
      jobId:
        job.JobID,
      jobName:
        job.JobName,
      handlerFunction:
        handlerName,
      durationMs:
        durationMs,
      response:
        response === undefined
          ? null
          : response
    };
  } catch (error) {
    const durationMs =
      new Date().getTime() -
      startedAt.getTime();

    const message =
      String(
        error &&
        error.message
          ? error.message
          : error
      );

    const failures =
      Number(
        job.ConsecutiveFailures || 0
      ) + 1;

    MOS5SCH_updateRow_(
      sheet,
      job._row,
      {
        LastRunAt:
          startedAt,
        NextRunAt:
          nextRunAt,
        LastStatus:
          "FAILED",
        LastDurationMs:
          durationMs,
        LastError:
          message,
        ConsecutiveFailures:
          failures,
        UpdatedAt:
          new Date()
      }
    );

    return {
      success: false,
      status: "FAILED",
      jobId:
        job.JobID,
      jobName:
        job.JobName,
      handlerFunction:
        handlerName,
      durationMs:
        durationMs,
      error:
        message
    };
  }
}

/**
 * Installs exactly one enterprise scheduler trigger.
 *
 * @param {number=} intervalMinutes
 * @return {Object}
 */
function MOS5SCH_installSchedulerTrigger(
  intervalMinutes
) {
  const interval =
    MOS5SCH_normalizeTriggerInterval_(
      intervalMinutes
    );

  const removed =
    MOS5SCH_deleteSchedulerTriggers_();

  const trigger =
    ScriptApp
      .newTrigger(
        MOS5_SCHEDULER
          .TRIGGER_HANDLER
      )
      .timeBased()
      .everyMinutes(interval)
      .create();

  PropertiesService
    .getScriptProperties()
    .setProperties(
      {
        MOS5_SCHEDULER_INTERVAL_MINUTES:
          String(interval),
        MOS5_SCHEDULER_UPDATED_AT:
          new Date().toISOString()
      },
      false
    );

  return {
    success: true,
    status: "INSTALLED",
    handler:
      MOS5_SCHEDULER
        .TRIGGER_HANDLER,
    intervalMinutes:
      interval,
    removedDuplicateTriggers:
      removed,
    triggerUniqueId:
      MOS5SCH_triggerId_(trigger),
    communicationsChanged:
      false,
    routingChanged:
      false,
    completedAt:
      new Date().toISOString()
  };
}

/**
 * Removes the enterprise scheduler trigger.
 *
 * @return {Object}
 */
function MOS5SCH_removeSchedulerTrigger() {
  const removed =
    MOS5SCH_deleteSchedulerTriggers_();

  return {
    success: true,
    status: "REMOVED",
    removed:
      removed,
    completedAt:
      new Date().toISOString()
  };
}

/**
 * Enables or disables a scheduler job.
 *
 * @param {string} jobIdOrHandler
 * @param {boolean} enabled
 * @return {Object}
 */
function MOS5SCH_setJobEnabled(
  jobIdOrHandler,
  enabled
) {
  const sheet =
    MOS5SCH_ensureSchedulerSheet_();

  const target =
    String(
      jobIdOrHandler || ""
    ).trim();

  const job =
    MOS5SCH_sheetObjects_(sheet)
      .find(function(record) {
        return (
          String(
            record.JobID || ""
          ).trim() === target ||
          String(
            record.HandlerFunction || ""
          ).trim() === target
        );
      });

  if (!job) {
    throw new Error(
      "Scheduled job not found: " +
      target
    );
  }

  const normalizedEnabled =
    MOS5SCH_isTrue_(enabled);

  MOS5SCH_updateRow_(
    sheet,
    job._row,
    {
      Enabled:
        normalizedEnabled,
      NextRunAt:
        normalizedEnabled
          ? new Date()
          : job.NextRunAt,
      UpdatedAt:
        new Date()
    }
  );

  return {
    success: true,
    jobId:
      job.JobID,
    handlerFunction:
      job.HandlerFunction,
    enabled:
      normalizedEnabled,
    productionChanged:
      true
  };
}

/**
 * Returns scheduler status.
 *
 * @return {Object}
 */
function MOS5SCH_getSchedulerStatus() {
  const jobs =
    MOS5SCH_sheetObjects_(
      MOS5SCH_ensureSchedulerSheet_()
    );

  const trigger =
    MOS5SCH_getSchedulerTriggerStatus();

  return {
    release:
      "MOS5-ENTERPRISE-SCHEDULER",
    version:
      MOS5_SCHEDULER_VERSION,
    totalJobs:
      jobs.length,
    enabledJobs:
      jobs.filter(function(job) {
        return MOS5SCH_isTrue_(
          job.Enabled
        );
      }).length,
    disabledJobs:
      jobs.filter(function(job) {
        return !MOS5SCH_isTrue_(
          job.Enabled
        );
      }).length,
    failedJobs:
      jobs.filter(function(job) {
        return String(
          job.LastStatus || ""
        )
          .trim()
          .toUpperCase() ===
          "FAILED";
      }).length,
    trigger:
      trigger,
    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Returns trigger status.
 *
 * @return {Object}
 */
function MOS5SCH_getSchedulerTriggerStatus() {
  const triggers =
    ScriptApp
      .getProjectTriggers()
      .filter(function(trigger) {
        return (
          trigger.getHandlerFunction() ===
          MOS5_SCHEDULER
            .TRIGGER_HANDLER
        );
      });

  return {
    installed:
      triggers.length > 0,
    triggerCount:
      triggers.length,
    duplicateTriggers:
      Math.max(
        0,
        triggers.length - 1
      ),
    triggerUniqueIds:
      triggers.map(function(trigger) {
        return MOS5SCH_triggerId_(
          trigger
        );
      })
  };
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function MOS5SCH_runDiagnostics() {
  const requirements = [
    "MOS5_processEventQueue",
    "LI_processIntakeQueue",
    "MOS5NF_processNotificationQueue"
  ];

  const tests =
    requirements.map(function(name) {
      return {
        code:
          name,
        status:
          typeof globalThis[name] ===
          "function"
            ? "PASS"
            : "FAIL"
      };
    });

  const trigger =
    MOS5SCH_getSchedulerTriggerStatus();

  tests.push({
    code:
      "NO_DUPLICATE_SCHEDULER_TRIGGERS",
    status:
      trigger.duplicateTriggers === 0
        ? "PASS"
        : "FAIL"
  });

  const failed =
    tests.filter(function(test) {
      return test.status === "FAIL";
    }).length;

  return {
    release:
      "MOS5-ENTERPRISE-SCHEDULER",
    version:
      MOS5_SCHEDULER_VERSION,
    overallStatus:
      failed
        ? "FAIL"
        : "PASS",
    passed:
      tests.length - failed,
    failed:
      failed,
    tests:
      tests,
    scheduler:
      MOS5SCH_getSchedulerStatus(),
    productionChanged:
      false,
    completedAt:
      new Date().toISOString()
  };
}

function MOS5SCH_defaultJobs_() {
  return [
    {
      JobName:
        "Lead Intake Queue",
      HandlerFunction:
        "LI_processIntakeQueue",
      Enabled:
        false,
      IntervalMinutes:
        5,
      BatchSize:
        25,
      Priority:
        10
    },

    {
      JobName:
        "Enterprise Event Queue",
      HandlerFunction:
        "MOS5_processEventQueue",
      Enabled:
        false,
      IntervalMinutes:
        5,
      BatchSize:
        50,
      Priority:
        20
    },

    {
      JobName:
        "Notification Send Queue",
      HandlerFunction:
        "MOS5NF_processNotificationQueue",
      Enabled:
        false,
      IntervalMinutes:
        5,
      BatchSize:
        25,
      Priority:
        30
    }
  ];
}

function MOS5SCH_ensureSchedulerSheet_() {
  const ss =
    typeof workbook_ === "function"
      ? workbook_()
      : SpreadsheetApp
          .getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      MOS5_SCHEDULER.SHEET
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        MOS5_SCHEDULER.SHEET
      );
  }

  MOS5SCH_ensureHeaders_(
    sheet,
    MOS5_SCHEDULER.HEADERS
  );

  return sheet;
}

function MOS5SCH_ensureHeaders_(
  sheet,
  requiredHeaders
) {
  if (
    sheet.getLastRow() === 0 ||
    sheet.getLastColumn() === 0
  ) {
    sheet
      .getRange(
        1,
        1,
        1,
        requiredHeaders.length
      )
      .setValues([
        requiredHeaders
      ]);

    sheet.setFrozenRows(1);
    return;
  }

  const current =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0]
      .map(function(value) {
        return String(
          value || ""
        ).trim();
      });

  const missing =
    requiredHeaders.filter(
      function(header) {
        return (
          current.indexOf(
            header
          ) === -1
        );
      }
    );

  if (missing.length) {
    sheet
      .getRange(
        1,
        current.length + 1,
        1,
        missing.length
      )
      .setValues([
        missing
      ]);
  }

  sheet.setFrozenRows(1);
}

function MOS5SCH_sheetObjects_(sheet) {
  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return [];
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0]
      .map(function(value) {
        return String(
          value || ""
        ).trim();
      });

  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        headers.length
      )
      .getValues();

  return values.map(
    function(row, index) {
      const record = {
        _row:
          index + 2
      };

      headers.forEach(
        function(header, column) {
          record[header] =
            row[column];
        }
      );

      return record;
    }
  );
}

function MOS5SCH_findJob_(
  sheet,
  handlerFunction
) {
  return (
    MOS5SCH_sheetObjects_(sheet)
      .find(function(job) {
        return (
          String(
            job.HandlerFunction || ""
          ).trim() ===
          handlerFunction
        );
      }) ||
    null
  );
}

function MOS5SCH_appendRow_(
  sheet,
  payload
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  sheet.appendRow(
    headers.map(function(header) {
      return payload[header] !== undefined
        ? payload[header]
        : "";
    })
  );

  return sheet.getLastRow();
}

function MOS5SCH_updateRow_(
  sheet,
  rowNumber,
  payload
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  const current =
    sheet
      .getRange(
        rowNumber,
        1,
        1,
        headers.length
      )
      .getValues()[0];

  const updated =
    headers.map(function(header, index) {
      return payload[header] !== undefined
        ? payload[header]
        : current[index];
    });

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      headers.length
    )
    .setValues([
      updated
    ]);

  return true;
}

function MOS5SCH_deleteSchedulerTriggers_() {
  let removed = 0;

  ScriptApp
    .getProjectTriggers()
    .filter(function(trigger) {
      return (
        trigger.getHandlerFunction() ===
        MOS5_SCHEDULER
          .TRIGGER_HANDLER
      );
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(
        trigger
      );

      removed += 1;
    });

  return removed;
}

function MOS5SCH_normalizeTriggerInterval_(
  value
) {
  const allowed = [
    1,
    5,
    10,
    15,
    30
  ];

  const interval =
    Number(
      value ||
      MOS5_SCHEDULER
        .DEFAULT_TRIGGER_MINUTES
    );

  return (
    allowed.indexOf(interval) !== -1
      ? interval
      : MOS5_SCHEDULER
          .DEFAULT_TRIGGER_MINUTES
  );
}

function MOS5SCH_dateNumber_(value) {
  if (
    value instanceof Date
  ) {
    return value.getTime();
  }

  const parsed =
    new Date(value);

  const result =
    parsed.getTime();

  return Number.isFinite(result)
    ? result
    : 0;
}

function MOS5SCH_isTrue_(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  return [
    "TRUE",
    "YES",
    "Y",
    "1",
    "ON",
    "ACTIVE",
    "ENABLED"
  ].indexOf(
    String(value || "")
      .trim()
      .toUpperCase()
  ) !== -1;
}

function MOS5SCH_triggerId_(trigger) {
  try {
    return String(
      trigger.getUniqueId() || ""
    );
  } catch (error) {
    return "";
  }
}

function MOS5SCH_id_(prefix) {
  return (
    String(prefix || "JOB")
      .trim()
      .toUpperCase() +
    "-" +
    Utilities
      .getUuid()
      .replace(/-/g, "")
      .substring(0, 20)
      .toUpperCase()
  );
}