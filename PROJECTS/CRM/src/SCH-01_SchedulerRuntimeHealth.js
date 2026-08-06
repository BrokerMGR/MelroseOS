/******************************************************************************
 * MelroseOS Enterprise
 * File: SCH-01_SchedulerRuntimeHealth.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Read-only health monitoring for the Enterprise Scheduler.
 *
 * Safety:
 *   - Does not install triggers.
 *   - Does not enable or disable jobs.
 *   - Does not run scheduled jobs.
 *   - Does not change routing or communications.
 ******************************************************************************/

const MOS5_SCHEDULER_HEALTH_VERSION = "1.0.0";

const MOS5_SCHEDULER_HEALTH = Object.freeze({
  OVERDUE_GRACE_MINUTES: 10,
  FAILURE_WARNING_THRESHOLD: 2,
  FAILURE_ERROR_THRESHOLD: 5
});

/**
 * Returns full Enterprise Scheduler runtime health.
 *
 * @return {Object}
 */
function MOS5SCH_getRuntimeHealth() {
  const startedAt = new Date();

  const schedulerAvailable =
    typeof MOS5SCH_getSchedulerStatus ===
    "function";

  const triggerStatusAvailable =
    typeof MOS5SCH_getSchedulerTriggerStatus ===
    "function";

  const schedulerStatus =
    schedulerAvailable
      ? MOS5SCH_safeInvoke_(
          "MOS5SCH_getSchedulerStatus"
        )
      : null;

  const triggerStatus =
    triggerStatusAvailable
      ? MOS5SCH_safeInvoke_(
          "MOS5SCH_getSchedulerTriggerStatus"
        )
      : null;

  const jobs =
    MOS5SCH_getRuntimeJobs_();

  const handlerHealth =
    MOS5SCH_evaluateHandlerHealth_(
      jobs
    );

  const overdueJobs =
    MOS5SCH_findOverdueJobs_(
      jobs
    );

  const failedJobs =
    MOS5SCH_findFailedJobs_(
      jobs
    );

  const issues =
    MOS5SCH_collectRuntimeIssues_({
      schedulerAvailable:
        schedulerAvailable,

      triggerStatusAvailable:
        triggerStatusAvailable,

      schedulerStatus:
        schedulerStatus,

      triggerStatus:
        triggerStatus,

      jobs:
        jobs,

      handlerHealth:
        handlerHealth,

      overdueJobs:
        overdueJobs,

      failedJobs:
        failedJobs
    });

  const errors =
    issues.filter(function(issue) {
      return issue.severity === "ERROR";
    }).length;

  const warnings =
    issues.filter(function(issue) {
      return issue.severity === "WARNING";
    }).length;

  return {
    release:
      "MOS5-SCH01-SCHEDULER-RUNTIME-HEALTH",

    version:
      MOS5_SCHEDULER_HEALTH_VERSION,

    overallStatus:
      errors > 0
        ? "FAIL"
        : warnings > 0
          ? "WARNING"
          : "PASS",

    healthy:
      errors === 0,

    ready:
      errors === 0 &&
      schedulerAvailable &&
      triggerStatusAvailable,

    schedulerAvailable:
      schedulerAvailable,

    triggerStatusAvailable:
      triggerStatusAvailable,

    scheduler:
      schedulerStatus,

    trigger:
      triggerStatus,

    totalJobs:
      jobs.length,

    enabledJobs:
      jobs.filter(function(job) {
        return MOS5SCH_healthIsTrue_(
          job.Enabled
        );
      }).length,

    disabledJobs:
      jobs.filter(function(job) {
        return !MOS5SCH_healthIsTrue_(
          job.Enabled
        );
      }).length,

    overdueJobs:
      overdueJobs.length,

    failedJobs:
      failedJobs.length,

    unavailableHandlers:
      handlerHealth.filter(
        function(handler) {
          return !handler.available;
        }
      ).length,

    errors:
      errors,

    warnings:
      warnings,

    jobs:
      jobs.map(
        MOS5SCH_publicJobHealth_
      ),

    handlerHealth:
      handlerHealth,

    overdue:
      overdueJobs.map(
        MOS5SCH_publicJobHealth_
      ),

    failures:
      failedJobs.map(
        MOS5SCH_publicJobHealth_
      ),

    issues:
      issues,

    productionChanged:
      false,

    startedAt:
      startedAt.toISOString(),

    completedAt:
      new Date().toISOString()
  };
}

/**
 * Returns a compact scheduler health summary.
 *
 * @return {Object}
 */
function MOS5SCH_getRuntimeHealthSummary() {
  const health =
    MOS5SCH_getRuntimeHealth();

  return {
    release:
      "MOS5-SCH01-SCHEDULER-RUNTIME-HEALTH",

    version:
      MOS5_SCHEDULER_HEALTH_VERSION,

    status:
      health.overallStatus,

    ready:
      health.ready,

    triggerInstalled:
      Boolean(
        health.trigger &&
        health.trigger.installed
      ),

    triggerCount:
      Number(
        health.trigger &&
        health.trigger.triggerCount ||
        0
      ),

    duplicateTriggers:
      Number(
        health.trigger &&
        health.trigger.duplicateTriggers ||
        0
      ),

    totalJobs:
      health.totalJobs,

    enabledJobs:
      health.enabledJobs,

    disabledJobs:
      health.disabledJobs,

    overdueJobs:
      health.overdueJobs,

    failedJobs:
      health.failedJobs,

    unavailableHandlers:
      health.unavailableHandlers,

    errors:
      health.errors,

    warnings:
      health.warnings,

    productionChanged:
      false,

    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Verifies that the scheduler runtime is structurally ready.
 *
 * A missing trigger is treated as READY_NOT_INSTALLED because trigger
 * installation is intentionally deferred until controlled activation.
 *
 * @return {Object}
 */
function MOS5SCH_assertRuntimeReady() {
  const health =
    MOS5SCH_getRuntimeHealth();

  if (
    health.errors > 0
  ) {
    throw new Error(
      "Scheduler runtime failed health verification: " +
      MOS5SCH_issueSummary_(
        health.issues
      )
    );
  }

  const triggerInstalled =
    Boolean(
      health.trigger &&
      health.trigger.installed
    );

  return {
    success: true,

    status:
      triggerInstalled
        ? "READY"
        : "READY_NOT_INSTALLED",

    triggerInstalled:
      triggerInstalled,

    enabledJobs:
      health.enabledJobs,

    health:
      health,

    productionChanged:
      false,

    completedAt:
      new Date().toISOString()
  };
}

/**
 * Returns all scheduler jobs from SYS_SCHEDULED_JOBS.
 *
 * @return {Array<Object>}
 */
function MOS5SCH_getRuntimeJobs_() {
  if (
    typeof MOS5SCH_ensureSchedulerSheet_ !==
      "function" ||
    typeof MOS5SCH_sheetObjects_ !==
      "function"
  ) {
    return [];
  }

  try {
    const sheet =
      MOS5SCH_ensureSchedulerSheet_();

    return MOS5SCH_sheetObjects_(
      sheet
    );
  } catch (error) {
    return [];
  }
}

/**
 * Evaluates whether each configured handler exists.
 *
 * @param {Array<Object>} jobs
 * @return {Array<Object>}
 */
function MOS5SCH_evaluateHandlerHealth_(
  jobs
) {
  return (
    jobs || []
  ).map(function(job) {
    const handlerName =
      String(
        job.HandlerFunction || ""
      ).trim();

    return {
      jobId:
        String(
          job.JobID || ""
        ),

      jobName:
        String(
          job.JobName || ""
        ),

      handlerFunction:
        handlerName,

      enabled:
        MOS5SCH_healthIsTrue_(
          job.Enabled
        ),

      available:
        Boolean(
          handlerName &&
          typeof globalThis[
            handlerName
          ] === "function"
        )
    };
  });
}

/**
 * Returns enabled jobs that are overdue.
 *
 * @param {Array<Object>} jobs
 * @return {Array<Object>}
 */
function MOS5SCH_findOverdueJobs_(
  jobs
) {
  const threshold =
    Date.now() -
    MOS5_SCHEDULER_HEALTH
      .OVERDUE_GRACE_MINUTES *
    60 *
    1000;

  return (
    jobs || []
  ).filter(function(job) {
    if (
      !MOS5SCH_healthIsTrue_(
        job.Enabled
      )
    ) {
      return false;
    }

    const nextRunAt =
      MOS5SCH_healthDateNumber_(
        job.NextRunAt
      );

    return (
      nextRunAt > 0 &&
      nextRunAt < threshold
    );
  });
}

/**
 * Returns jobs with failed or unavailable runtime status.
 *
 * @param {Array<Object>} jobs
 * @return {Array<Object>}
 */
function MOS5SCH_findFailedJobs_(
  jobs
) {
  return (
    jobs || []
  ).filter(function(job) {
    const status =
      String(
        job.LastStatus || ""
      )
        .trim()
        .toUpperCase();

    return (
      status === "FAILED" ||
      status === "HANDLER_UNAVAILABLE"
    );
  });
}

/**
 * Builds scheduler runtime issues.
 *
 * @param {Object} context
 * @return {Array<Object>}
 */
function MOS5SCH_collectRuntimeIssues_(
  context
) {
  const issues = [];

  if (
    !context.schedulerAvailable
  ) {
    issues.push({
      severity: "ERROR",
      code:
        "SCHEDULER_STATUS_UNAVAILABLE",
      message:
        "MOS5SCH_getSchedulerStatus is unavailable."
    });
  }

  if (
    !context.triggerStatusAvailable
  ) {
    issues.push({
      severity: "ERROR",
      code:
        "TRIGGER_STATUS_UNAVAILABLE",
      message:
        "MOS5SCH_getSchedulerTriggerStatus is unavailable."
    });
  }

  const trigger =
    context.triggerStatus || {};

  if (
    Number(
      trigger.duplicateTriggers || 0
    ) > 0
  ) {
    issues.push({
      severity: "ERROR",
      code:
        "DUPLICATE_SCHEDULER_TRIGGERS",
      message:
        String(
          trigger.duplicateTriggers
        ) +
        " duplicate scheduler trigger(s) detected."
    });
  }

  if (
    context.triggerStatusAvailable &&
    !trigger.installed
  ) {
    issues.push({
      severity: "WARNING",
      code:
        "SCHEDULER_TRIGGER_NOT_INSTALLED",
      message:
        "Enterprise Scheduler trigger is not installed."
    });
  }

  context.handlerHealth
    .filter(function(handler) {
      return (
        handler.enabled &&
        !handler.available
      );
    })
    .forEach(function(handler) {
      issues.push({
        severity: "ERROR",
        code:
          "ENABLED_JOB_HANDLER_UNAVAILABLE",
        message:
          "Enabled scheduler job handler is unavailable: " +
          handler.handlerFunction,
        jobId:
          handler.jobId
      });
    });

  context.handlerHealth
    .filter(function(handler) {
      return (
        !handler.enabled &&
        !handler.available
      );
    })
    .forEach(function(handler) {
      issues.push({
        severity: "WARNING",
        code:
          "DISABLED_JOB_HANDLER_UNAVAILABLE",
        message:
          "Disabled scheduler job handler is unavailable: " +
          handler.handlerFunction,
        jobId:
          handler.jobId
      });
    });

  context.overdueJobs
    .forEach(function(job) {
      issues.push({
        severity: "WARNING",
        code:
          "SCHEDULED_JOB_OVERDUE",
        message:
          "Scheduled job is overdue: " +
          String(
            job.JobName ||
            job.HandlerFunction ||
            job.JobID
          ),
        jobId:
          String(
            job.JobID || ""
          )
      });
    });

  context.failedJobs
    .forEach(function(job) {
      const failures =
        Number(
          job.ConsecutiveFailures ||
          0
        );

      issues.push({
        severity:
          failures >=
          MOS5_SCHEDULER_HEALTH
            .FAILURE_ERROR_THRESHOLD
            ? "ERROR"
            : "WARNING",

        code:
          failures >=
          MOS5_SCHEDULER_HEALTH
            .FAILURE_ERROR_THRESHOLD
            ? "REPEATED_JOB_FAILURE"
            : "SCHEDULED_JOB_FAILURE",

        message:
          "Scheduled job failed: " +
          String(
            job.JobName ||
            job.HandlerFunction ||
            job.JobID
          ) +
          ". Consecutive failures: " +
          failures +
          ".",

        jobId:
          String(
            job.JobID || ""
          )
      });
    });

  return issues;
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function MOS5SCH_runRuntimeHealthDiagnostics() {
  const requiredFunctions = [
    "MOS5SCH_getSchedulerStatus",
    "MOS5SCH_getSchedulerTriggerStatus",
    "MOS5SCH_ensureSchedulerSheet_",
    "MOS5SCH_sheetObjects_"
  ];

  const tests =
    requiredFunctions.map(
      function(functionName) {
        return {
          code:
            functionName,

          status:
            typeof globalThis[
              functionName
            ] === "function"
              ? "PASS"
              : "FAIL"
        };
      }
    );

  const health =
    MOS5SCH_getRuntimeHealth();

  tests.push({
    code:
      "NO_DUPLICATE_SCHEDULER_TRIGGERS",

    status:
      Number(
        health.trigger &&
        health.trigger.duplicateTriggers ||
        0
      ) === 0
        ? "PASS"
        : "FAIL"
  });

  tests.push({
    code:
      "ENABLED_JOB_HANDLERS_AVAILABLE",

    status:
      health.handlerHealth
        .filter(function(handler) {
          return (
            handler.enabled &&
            !handler.available
          );
        })
        .length === 0
        ? "PASS"
        : "FAIL"
  });

  const failed =
    tests.filter(function(test) {
      return test.status === "FAIL";
    }).length;

  return {
    release:
      "MOS5-SCH01-SCHEDULER-RUNTIME-HEALTH",

    version:
      MOS5_SCHEDULER_HEALTH_VERSION,

    overallStatus:
      failed > 0
        ? "FAIL"
        : health.warnings > 0
          ? "WARNING"
          : "PASS",

    passed:
      tests.length - failed,

    failed:
      failed,

    warnings:
      health.warnings,

    tests:
      tests,

    health:
      health,

    productionChanged:
      false,

    completedAt:
      new Date().toISOString()
  };
}

function MOS5SCH_safeInvoke_(
  functionName
) {
  const handler =
    globalThis[functionName];

  if (
    typeof handler !== "function"
  ) {
    return null;
  }

  try {
    return handler();
  } catch (error) {
    return {
      overallStatus: "FAIL",
      status: "ERROR",
      error:
        String(
          error &&
          error.message
            ? error.message
            : error
        )
    };
  }
}

function MOS5SCH_publicJobHealth_(
  job
) {
  return {
    jobId:
      String(
        job.JobID || ""
      ),

    jobName:
      String(
        job.JobName || ""
      ),

    handlerFunction:
      String(
        job.HandlerFunction || ""
      ),

    enabled:
      MOS5SCH_healthIsTrue_(
        job.Enabled
      ),

    intervalMinutes:
      Number(
        job.IntervalMinutes || 0
      ),

    batchSize:
      Number(
        job.BatchSize || 0
      ),

    priority:
      Number(
        job.Priority || 0
      ),

    lastRunAt:
      MOS5SCH_healthDateIso_(
        job.LastRunAt
      ),

    nextRunAt:
      MOS5SCH_healthDateIso_(
        job.NextRunAt
      ),

    lastStatus:
      String(
        job.LastStatus || ""
      ),

    lastDurationMs:
      Number(
        job.LastDurationMs || 0
      ),

    lastError:
      String(
        job.LastError || ""
      ),

    consecutiveFailures:
      Number(
        job.ConsecutiveFailures || 0
      ),

    handlerAvailable:
      Boolean(
        String(
          job.HandlerFunction || ""
        ).trim() &&
        typeof globalThis[
          String(
            job.HandlerFunction || ""
          ).trim()
        ] === "function"
      )
  };
}

function MOS5SCH_issueSummary_(
  issues
) {
  return (
    issues || []
  )
    .map(function(issue) {
      return (
        String(
          issue.code || "ISSUE"
        ) +
        ": " +
        String(
          issue.message || ""
        )
      );
    })
    .join("; ");
}

function MOS5SCH_healthDateNumber_(
  value
) {
  if (
    value instanceof Date
  ) {
    return value.getTime();
  }

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return 0;
  }

  const parsed =
    new Date(value);

  const result =
    parsed.getTime();

  return Number.isFinite(result)
    ? result
    : 0;
}

function MOS5SCH_healthDateIso_(
  value
) {
  const dateNumber =
    MOS5SCH_healthDateNumber_(
      value
    );

  return dateNumber
    ? new Date(
        dateNumber
      ).toISOString()
    : "";
}

function MOS5SCH_healthIsTrue_(
  value
) {
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