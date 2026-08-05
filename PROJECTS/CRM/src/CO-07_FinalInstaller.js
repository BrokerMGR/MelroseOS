/******************************************************************************
 * MelroseOS Enterprise
 * System Integration & Cutover
 * File: CO-07_FinalInstaller.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Final installer and validation runner for the System Integration & Cutover
 *   phase. This file DOES NOT activate LIVE mode.
 *
 * Requires:
 *   CO-01 through CO-06
 ******************************************************************************/

const CO_FINAL_STATUS_SHEET = "CO_FINAL_STATUS";

function CO_runFinalInstallation() {
  CO_forceShadowMode();

  const install = CO_installCutoverModule();
  const setup = CO_runCutoverSetup();
  const readiness = CO_generateLiveReadinessReport();

  const sheet = createSheetIfMissing_(
    workbook_(),
    CO_FINAL_STATUS_SHEET
  );

  clearSheet_(sheet);

  const headers = [
    "Component",
    "Status",
    "Details",
    "UpdatedAt"
  ];

  setHeaders_(sheet, headers);

  const checks = [
    {
      component: "Cutover Installation",
      passed: install.success,
      details:
        install.failed + " failure(s), " +
        install.warnings + " warning(s)."
    },
    {
      component: "Cutover Setup",
      passed: setup.success,
      details: "System state: " + setup.state + "."
    },
    {
      component: "Live Readiness Report",
      passed: readiness.success,
      details:
        readiness.blocked + " blocked item(s)."
    },
    {
      component: "Safety State",
      passed: CO_getState() === "SHADOW",
      details:
        "Final installation leaves system in " +
        CO_getState() + " mode."
    }
  ];

  const rows = checks.map(function(check) {
    return [
      check.component,
      check.passed ? "PASSED" : "FAILED",
      check.details,
      timestamp_()
    ];
  });

  sheet
    .getRange(2, 1, rows.length, headers.length)
    .setValues(rows);

  sheet.setFrozenRows(1);
  autoResize_(sheet);

  const failed = checks.filter(function(check) {
    return !check.passed;
  });

  const success = failed.length === 0;

  setDocProperty_(
    "CO_FINAL_INSTALL_COMPLETE",
    success ? "TRUE" : "FALSE"
  );

  setDocProperty_(
    "CO_FINAL_INSTALL_AT",
    new Date().toISOString()
  );

  CO_log_(
    success
      ? "FINAL_INSTALL_COMPLETE"
      : "FINAL_INSTALL_FAILED",
    CO_getState(),
    CO_getState(),
    success
      ? "Final cutover installation passed. System remains in SHADOW mode."
      : failed.length + " final installation check(s) failed."
  );

  return {
    success: success,
    state: CO_getState(),
    failed: failed.length,
    install: install,
    setup: setup,
    readiness: readiness
  };
}

function CO_getFinalInstallationStatus() {
  return {
    complete:
      getDocProperty_(
        "CO_FINAL_INSTALL_COMPLETE"
      ) || "FALSE",

    completedAt:
      getDocProperty_(
        "CO_FINAL_INSTALL_AT"
      ) || "",

    state: CO_getState(),

    gate:
      typeof CO_getCutoverGateStatus === "function"
        ? CO_getCutoverGateStatus()
        : {},

    readiness:
      typeof CO_getLiveReadinessReportStatus === "function"
        ? CO_getLiveReadinessReportStatus()
        : {}
  };
}

function CO_testFinalInstaller() {
  CO_forceShadowMode();

  const result = CO_runFinalInstallation();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(
    CO_getFinalInstallationStatus()
  ));

  if (!result.success) {
    throw new Error(
      "Final installation failed. Review CO_FINAL_STATUS, CO_HEALTH_CHECK, CO_SHADOW_VALIDATION, and CO_LIVE_READINESS."
    );
  }

  if (CO_getState() !== "SHADOW") {
    throw new Error(
      "Final installer safety failure: system is not in SHADOW mode."
    );
  }

  return true;
}
