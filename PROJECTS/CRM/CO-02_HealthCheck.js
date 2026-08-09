/******************************************************************************
 * MelroseOS Enterprise
 * System Integration & Cutover
 * File: CO-02_HealthCheck.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Runs non-destructive health checks across the migrated MelroseOS modules.
 *
 * Requires:
 *   CO-01_Core.gs
 ******************************************************************************/

const CO_HEALTH_SHEET = "CO_HEALTH_CHECK";

function CO_initializeHealthCheck() {
  CO_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    CO_HEALTH_SHEET
  );

  CO_setHeadersIfEmpty_(sheet, [
    "CheckID",
    "Category",
    "CheckName",
    "Status",
    "Details",
    "CheckedAt"
  ]);

  return true;
}

function CO_runHealthCheck() {
  CO_initializeHealthCheck();

  const checks = [];

const currentState = CO_getState();

CO_addHealthCheck_(
  checks,
  "SYSTEM",
  "Cutover State",
  ["SHADOW", "LIVE"].indexOf(currentState) !== -1,
  "Current cutover state is " + currentState + "."
);

  CO_addHealthCheck_(
    checks,
    "ASSIGNMENT",
    "Assignment Engine Available",
    typeof AE_assignLead === "function",
    typeof AE_assignLead === "function"
      ? "Assignment Engine is available."
      : "Assignment Engine is missing."
  );

  CO_addHealthCheck_(
    checks,
    "LEAD INTAKE",
    "Lead Intake Queue Available",
    typeof LI_getQueueStatus === "function",
    typeof LI_getQueueStatus === "function"
      ? "Lead Intake Queue is available."
      : "Lead Intake Queue is missing."
  );

  CO_addHealthCheck_(
    checks,
    "NOTIFICATIONS",
    "Notification Send Engine Available",
    typeof NF_processSendQueue === "function",
    typeof NF_processSendQueue === "function"
      ? "Notification Send Engine is available."
      : "Notification Send Engine is missing."
  );

  CO_addHealthCheck_(
    checks,
    "APPOINTMENTS",
    "Appointment Engine Available",
    typeof AP_getCoreStatus === "function",
    typeof AP_getCoreStatus === "function"
      ? "Appointment Engine is available."
      : "Appointment Engine is missing."
  );

  if (typeof LI_getQueueStatus === "function") {
    const queue = LI_getQueueStatus();

    CO_addHealthCheck_(
      checks,
      "LEAD INTAKE",
      "Queue Errors",
      Number(queue.error || 0) === 0,
      Number(queue.error || 0) +
        " intake record(s) currently have ERROR status."
    );
  }

  if (typeof NF_getSendEngineStatus === "function") {
    const send = NF_getSendEngineStatus();

    CO_addHealthCheck_(
      checks,
      "NOTIFICATIONS",
      "Send Errors",
      Number(send.errors || 0) === 0,
      Number(send.errors || 0) +
        " notification(s) currently have ERROR status."
    );
  }

  CO_checkRequiredSheet_(
    checks,
    "LI_INTAKE"
  );

  CO_checkRequiredSheet_(
    checks,
    "AE_LEADS"
  );

  CO_checkRequiredSheet_(
    checks,
    "NF_QUEUE"
  );

  CO_checkRequiredSheet_(
    checks,
    "AP_APPOINTMENTS"
  );

  CO_writeHealthChecks_(checks);

  const failed = checks.filter(function(check) {
    return check.status === "FAILED";
  });

  const warnings = checks.filter(function(check) {
    return check.status === "WARNING";
  });

  CO_log_(
    failed.length
      ? "HEALTH_CHECK_FAILED"
      : "HEALTH_CHECK_COMPLETE",
    CO_getState(),
    CO_getState(),
    failed.length +
      " failed check(s), " +
      warnings.length +
      " warning(s)."
  );

  return {
    success: failed.length === 0,
    checks: checks.length,
    failed: failed.length,
    warnings: warnings.length,
    state: CO_getState()
  };
}

function CO_addHealthCheck_(
  checks,
  category,
  checkName,
  passed,
  details,
  warning
) {
  checks.push({
    id: "HC-" +
      Utilities.getUuid()
        .substring(0, 8)
        .toUpperCase(),
    category: category,
    name: checkName,
    status: passed
      ? "PASSED"
      : warning
        ? "WARNING"
        : "FAILED",
    details: details
  });
}

function CO_checkRequiredSheet_(checks, sheetName) {
  const exists = !!workbook_().getSheetByName(
    sheetName
  );

  CO_addHealthCheck_(
    checks,
    "DATA",
    "Sheet: " + sheetName,
    exists,
    exists
      ? "Required sheet exists."
      : "Required sheet is missing."
  );
}

function CO_writeHealthChecks_(checks) {
  const sheet = workbook_().getSheetByName(
    CO_HEALTH_SHEET
  );

  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        sheet.getLastColumn()
      )
      .clearContent();
  }

  const rows = checks.map(function(check) {
    return [
      check.id,
      check.category,
      check.name,
      check.status,
      check.details,
      timestamp_()
    ];
  });

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, 6)
      .setValues(rows);
  }

  autoResize_(sheet);
}

function CO_getHealthSummary() {
  const rows = CO_healthObjects_();

  const count = function(status) {
    return rows.filter(function(row) {
      return String(
        row.Status || ""
      ).toUpperCase() === status;
    }).length;
  };

  return {
    total: rows.length,
    passed: count("PASSED"),
    warnings: count("WARNING"),
    failed: count("FAILED"),
    healthy: count("FAILED") === 0
  };
}

function CO_healthObjects_() {
  const sheet = workbook_().getSheetByName(
    CO_HEALTH_SHEET
  );

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet
    .getDataRange()
    .getValues();

  const headers = values
    .shift()
    .map(function(header) {
      return String(header || "").trim();
    });

  return values.map(function(row) {
    const obj = {};

    headers.forEach(function(header, index) {
      obj[header] = row[index];
    });

    return obj;
  });
}

function CO_testHealthCheck() {
  CO_forceShadowMode();

  const result = CO_runHealthCheck();

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      CO_getHealthSummary()
    )
  );

  if (!result.success) {
    throw new Error(
      "System Health Check found failures. Review CO_HEALTH_CHECK."
    );
  }

  return true;
}
function OP_reactivateMelroseOSLiveNow() {
  return OP_activateMelroseOSLive(
    "ACTIVATE MELROSEOS LIVE"
  );
}
function OP_showLiveActivationReadiness() {
  const result = OP_getLiveActivationReadiness();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
function CO_showShadowValidation() {
  const result = CO_runShadowValidation();
  Logger.log(JSON.stringify(result, null, 2));

  const sheet = workbook_().getSheetByName("CO_SHADOW_VALIDATION");
  if (sheet && sheet.getLastRow() > 1) {
    const rows = sheet.getDataRange().getDisplayValues();
    Logger.log(JSON.stringify(rows, null, 2));
  }

  return result;
}