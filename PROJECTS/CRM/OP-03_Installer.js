/******************************************************************************
 * MelroseOS Enterprise
 * Master Operations & Automation
 * File: OP-03_Installer.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Installs and validates the Master Operations & Automation layer.
 *   Does NOT install the recurring operations trigger automatically.
 *
 * Requires:
 *   OP-01_Orchestrator.gs
 *   OP-02_TriggerManager.gs
 *   CO-01 through CO-07
 ******************************************************************************/

const OP_INSTALL_STATUS_SHEET = "OP_INSTALL_STATUS";

function OP_installOperationsModule() {
  OP_initializeCore();
  OP_initializeTriggerManager();

  const sheet = createSheetIfMissing_(
    workbook_(),
    OP_INSTALL_STATUS_SHEET
  );

  clearSheet_(sheet);

  const headers = [
    "Check",
    "Status",
    "Details",
    "UpdatedAt"
  ];

  setHeaders_(sheet, headers);

  const checks = OP_runInstallChecks_();

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
    "OP_INSTALLED",
    failed.length ? "FALSE" : "TRUE"
  );

  setDocProperty_(
    "OP_INSTALL_DATE",
    new Date().toISOString()
  );

  setDocProperty_(
    "OP_INSTALL_FAILURES",
    String(failed.length)
  );

  setDocProperty_(
    "OP_INSTALL_WARNINGS",
    String(warnings.length)
  );

  return {
    success: failed.length === 0,
    checks: checks.length,
    failed: failed.length,
    warnings: warnings.length,
    cutoverState:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN"
  };
}

function OP_runInstallChecks_() {
  const checks = [];

  [
    ["OP_initializeCore", "OP-01 Orchestrator"],
    ["OP_runOperationsCycle", "Operations Cycle"],
    ["OP_initializeTriggerManager", "OP-02 Trigger Manager"],
    ["OP_installOperationsTrigger", "Trigger Installer"],
    ["CO_getState", "Cutover Controller"]
  ].forEach(function(item) {
    const exists = OP_functionExists_(item[0]);

    checks.push({
      name: item[1],
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? item[0] + " is available."
        : item[0] + " is missing."
    });
  });

  [
    OP.SHEETS.RUNS,
    OP.SHEETS.STATUS,
    OP_TRIGGER_STATUS_SHEET
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

  const state =
    typeof CO_getState === "function"
      ? CO_getState()
      : "UNKNOWN";

  checks.push({
    name: "Cutover Safety State",
    status:
      state === "SHADOW"
        ? "PASSED"
        : "WARNING",
    details:
      "Current cutover state is " +
      state +
      "."
  });

  const triggerStatus =
    OP_getTriggerManagerStatus();

  checks.push({
    name: "Operations Trigger",
    status:
      triggerStatus.operationsTriggerCount <= 1
        ? "PASSED"
        : "WARNING",
    details:
      triggerStatus.operationsTriggerCount +
      " managed operations trigger(s) currently exist."
  });

  return checks;
}

function OP_functionExists_(name) {
  try {
    return typeof this[name] === "function";
  } catch (error) {
    return false;
  }
}

function OP_runOperationsSetup() {
  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const install =
    OP_installOperationsModule();

  if (!install.success) {
    throw new Error(
      "Operations module installation failed. Review OP_INSTALL_STATUS."
    );
  }

  OP_refreshStatus();
  OP_refreshTriggerStatus();

  setDocProperty_(
    "OP_SETUP_COMPLETE",
    "TRUE"
  );

  setDocProperty_(
    "OP_SETUP_COMPLETED_AT",
    new Date().toISOString()
  );

  return {
    success: true,
    cutoverState:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN",
    install: install,
    status: OP_getStatus(),
    triggers: OP_getTriggerManagerStatus()
  };
}

function OP_getInstallStatus() {
  return {
    installed:
      getDocProperty_("OP_INSTALLED") || "FALSE",

    installedAt:
      getDocProperty_("OP_INSTALL_DATE") || "",

    failures:
      Number(
        getDocProperty_("OP_INSTALL_FAILURES") || 0
      ),

    warnings:
      Number(
        getDocProperty_("OP_INSTALL_WARNINGS") || 0
      ),

    setupComplete:
      getDocProperty_("OP_SETUP_COMPLETE") || "FALSE",

    setupCompletedAt:
      getDocProperty_("OP_SETUP_COMPLETED_AT") || "",

    cutoverState:
      typeof CO_getState === "function"
        ? CO_getState()
        : "UNKNOWN"
  };
}

function OP_testInstaller() {
  if (typeof CO_forceShadowMode === "function") {
    CO_forceShadowMode();
  }

  const result =
    OP_installOperationsModule();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(
    OP_getInstallStatus()
  ));

  if (!result.success) {
    throw new Error(
      "Operations installer failed. Review OP_INSTALL_STATUS."
    );
  }

  return true;
}
