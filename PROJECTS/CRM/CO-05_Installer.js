/******************************************************************************
 * MelroseOS Enterprise
 * System Integration & Cutover
 * File: CO-05_Installer.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Installs and validates the System Integration & Cutover module.
 *
 * Requires:
 *   CO-01 through CO-04
 ******************************************************************************/

const CO_INSTALL_STATUS_SHEET = "CO_INSTALL_STATUS";

function CO_installCutoverModule() {
  CO_initializeCore();
  CO_initializeHealthCheck();
  CO_initializeShadowValidator();

  const sheet = createSheetIfMissing_(
    workbook_(),
    CO_INSTALL_STATUS_SHEET
  );

  clearSheet_(sheet);

  const headers = [
    "Check",
    "Status",
    "Details",
    "UpdatedAt"
  ];

  setHeaders_(sheet, headers);

  const checks = CO_runInstallChecks_();

  const rows = checks.map(function(check) {
    return [
      check.name,
      check.status,
      check.details,
      timestamp_()
    ];
  });

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, headers.length)
      .setValues(rows);
  }

  sheet.setFrozenRows(1);
  autoResize_(sheet);

  const failed = checks.filter(function(check) {
    return check.status === "FAILED";
  });

  const warnings = checks.filter(function(check) {
    return check.status === "WARNING";
  });

  setDocProperty_(
    "CO_INSTALLED",
    failed.length ? "FALSE" : "TRUE"
  );

  setDocProperty_(
    "CO_INSTALL_DATE",
    new Date().toISOString()
  );

  CO_log_(
    failed.length
      ? "INSTALL_FAILED"
      : "INSTALL_COMPLETE",
    CO_getState(),
    CO_getState(),
    failed.length
      ? failed.length + " cutover installation check(s) failed."
      : "Cutover module installation checks passed."
  );

  return {
    success: failed.length === 0,
    checks: checks.length,
    failed: failed.length,
    warnings: warnings.length,
    state: CO_getState()
  };
}

function CO_runInstallChecks_() {
  const checks = [];

  [
    ["CO_initializeCore", "CO-01 Core"],
    ["CO_runHealthCheck", "CO-02 Health Check"],
    ["CO_runShadowValidation", "CO-03 Shadow Validator"],
    ["CO_evaluateCutoverReadiness", "CO-04 Cutover Gate"]
  ].forEach(function(item) {
    const exists = CO_functionExists_(item[0]);

    checks.push({
      name: item[1],
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? item[0] + " is available."
        : item[0] + " is missing."
    });
  });

  [
    CO.SHEETS.STATUS,
    CO.SHEETS.AUDIT,
    CO_HEALTH_SHEET,
    CO_SHADOW_VALIDATION_SHEET
  ].forEach(function(name) {
    const exists = !!workbook_().getSheetByName(name);

    checks.push({
      name: "Sheet: " + name,
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? "Required sheet exists."
        : "Required sheet is missing."
    });
  });

  checks.push({
    name: "Cutover Safety State",
    status: CO_getState() === "SHADOW"
      ? "PASSED"
      : "WARNING",
    details: "Current cutover state is " + CO_getState() + "."
  });

  return checks;
}

function CO_functionExists_(name) {
  try {
    return typeof this[name] === "function";
  } catch (error) {
    return false;
  }
}

function CO_runCutoverSetup() {
  const install = CO_installCutoverModule();

  if (!install.success) {
    throw new Error(
      "Cutover module installation failed. Review CO_INSTALL_STATUS."
    );
  }

  CO_forceShadowMode();

  const health = CO_runHealthCheck();
  const shadow = CO_runShadowValidation();
  const readiness = CO_evaluateCutoverReadiness();

  setDocProperty_(
    "CO_SETUP_COMPLETE",
    "TRUE"
  );

  setDocProperty_(
    "CO_SETUP_COMPLETED_AT",
    new Date().toISOString()
  );

  return {
    success:
      install.success &&
      health.success &&
      shadow.success &&
      readiness.ready,
    state: CO_getState(),
    install: install,
    health: health,
    shadow: shadow,
    readiness: readiness
  };
}

function CO_getInstallStatus() {
  return {
    installed:
      getDocProperty_("CO_INSTALLED") || "FALSE",
    installedAt:
      getDocProperty_("CO_INSTALL_DATE") || "",
    setupComplete:
      getDocProperty_("CO_SETUP_COMPLETE") || "FALSE",
    setupCompletedAt:
      getDocProperty_("CO_SETUP_COMPLETED_AT") || "",
    state: CO_getState()
  };
}

function CO_testInstaller() {
  CO_forceShadowMode();

  const result = CO_installCutoverModule();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(CO_getInstallStatus()));

  if (!result.success) {
    throw new Error(
      "Cutover installer failed. Review CO_INSTALL_STATUS."
    );
  }

  return true;
}
