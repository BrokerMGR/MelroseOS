/******************************************************************************
 * MelroseOS Enterprise
 * System Integration & Cutover
 * File: CO-06_LiveReadinessReport.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Generates a consolidated LIVE-readiness report without activating LIVE.
 *
 * Requires:
 *   CO-01 through CO-05
 ******************************************************************************/

const CO_LIVE_READINESS_SHEET = "CO_LIVE_READINESS";

function CO_generateLiveReadinessReport() {
  CO_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    CO_LIVE_READINESS_SHEET
  );

  CO_setHeadersIfEmpty_(sheet, [
    "Category",
    "Check",
    "Status",
    "Details",
    "CheckedAt"
  ]);

  CO_forceShadowMode();

  const health = CO_runHealthCheck();
  const shadow = CO_runShadowValidation();
  const readiness = CO_evaluateCutoverReadiness();

  const rows = [];

  CO_addReadinessRow_(
    rows,
    "SYSTEM",
    "Cutover State",
    CO_getState() === "SHADOW",
    "Current state: " + CO_getState()
  );

  CO_addReadinessRow_(
    rows,
    "HEALTH",
    "System Health Check",
    health.success,
    health.failed + " failure(s), " +
      health.warnings + " warning(s)."
  );

  CO_addReadinessRow_(
    rows,
    "SHADOW",
    "Shadow Validation",
    shadow.success,
    shadow.failed + " failure(s), " +
      shadow.warnings + " warning(s)."
  );

  CO_addReadinessRow_(
    rows,
    "CUTOVER",
    "Cutover Gate",
    readiness.ready,
    readiness.ready
      ? "All cutover gates passed."
      : readiness.issues.join(" ")
  );

  if (typeof NF_getSendEngineStatus === "function") {
    const nf = NF_getSendEngineStatus();

    CO_addReadinessRow_(
      rows,
      "NOTIFICATIONS",
      "Notification Errors",
      Number(nf.errors || 0) === 0,
      Number(nf.errors || 0) +
        " notification error(s)."
    );
  }

  if (typeof LI_getQueueStatus === "function") {
    const li = LI_getQueueStatus();

    CO_addReadinessRow_(
      rows,
      "LEAD INTAKE",
      "Intake Errors",
      Number(li.error || 0) === 0,
      Number(li.error || 0) +
        " intake error(s)."
    );
  }

  if (sheet.getLastRow() > 1) {
    sheet.getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      sheet.getLastColumn()
    ).clearContent();
  }

  const values = rows.map(function(row) {
    return [
      row.category,
      row.check,
      row.status,
      row.details,
      timestamp_()
    ];
  });

  if (values.length) {
    sheet.getRange(
      2,
      1,
      values.length,
      5
    ).setValues(values);
  }

  sheet.setFrozenRows(1);
  autoResize_(sheet);

  const blocked = rows.filter(function(row) {
    return row.status === "BLOCKED";
  });

  setDocProperty_(
    "CO_LIVE_READINESS_REPORT",
    blocked.length ? "BLOCKED" : "READY"
  );

  setDocProperty_(
    "CO_LIVE_READINESS_REPORT_AT",
    new Date().toISOString()
  );

  CO_log_(
    blocked.length
      ? "LIVE_READINESS_BLOCKED"
      : "LIVE_READINESS_READY",
    CO_getState(),
    CO_getState(),
    blocked.length
      ? blocked.length + " readiness item(s) blocked."
      : "Live readiness report passed. System remains in SHADOW mode."
  );

  return {
    success: blocked.length === 0,
    ready: blocked.length === 0,
    state: CO_getState(),
    blocked: blocked.length,
    checks: rows.length
  };
}

function CO_addReadinessRow_(
  rows,
  category,
  check,
  passed,
  details
) {
  rows.push({
    category: category,
    check: check,
    status: passed ? "READY" : "BLOCKED",
    details: details
  });
}

function CO_getLiveReadinessReportStatus() {
  return {
    reportStatus:
      getDocProperty_(
        "CO_LIVE_READINESS_REPORT"
      ) || "NOT_RUN",

    reportAt:
      getDocProperty_(
        "CO_LIVE_READINESS_REPORT_AT"
      ) || "",

    state: CO_getState()
  };
}

function CO_testLiveReadinessReport() {
  CO_forceShadowMode();

  const result =
    CO_generateLiveReadinessReport();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(
    CO_getLiveReadinessReportStatus()
  ));

  if (!result.success) {
    throw new Error(
      "Live readiness report is BLOCKED. Review CO_LIVE_READINESS."
    );
  }

  if (CO_getState() !== "SHADOW") {
    throw new Error(
      "Live readiness test changed the system out of SHADOW mode."
    );
  }

  return true;
}
