/******************************************************************************
 * MelroseOS Enterprise
 * Lead Lifecycle Management
 * File: LC-06_Installer.gs
 * Version: 1.0.0
 ******************************************************************************/

const LC_INSTALL_STATUS_SHEET = "LC_INSTALL_STATUS";

function LC_installLifecycleModule() {
  LC_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    LC_INSTALL_STATUS_SHEET
  );

  clearSheet_(sheet);

  const headers = [
    "Check",
    "Status",
    "Details",
    "UpdatedAt"
  ];

  setHeaders_(sheet, headers);

  const functions = [
    ["LC_initializeCore", "LC-01 Core"],
    ["LC_scanLeadReplies", "LC-02 Reply Detection"],
    ["LC_syncAppointmentLifecycle", "LC-03 Appointment Bridge"],
    ["LC_syncFollowUpLifecycle", "LC-04 Follow-Up Bridge"],
    ["LC_runLifecycleCycle", "LC-05 Operations Cycle"]
  ];

  const checks = functions.map(function(item) {
    const exists = typeof this[item[0]] === "function";

    return {
      name: item[1],
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? item[0] + " is available."
        : item[0] + " is missing."
    };
  });

  const rows = checks.map(function(check) {
    return [
      check.name,
      check.status,
      check.details,
      timestamp_()
    ];
  });

  sheet.getRange(
    2,
    1,
    rows.length,
    headers.length
  ).setValues(rows);

  sheet.setFrozenRows(1);
  autoResize_(sheet);

  const failed = checks.filter(function(check) {
    return check.status === "FAILED";
  });

  setDocProperty_(
    "LC_INSTALLED",
    failed.length ? "FALSE" : "TRUE"
  );

  setDocProperty_(
    "LC_INSTALL_AT",
    new Date().toISOString()
  );

  return {
    success: failed.length === 0,
    checks: checks.length,
    failed: failed.length
  };
}

function LC_testInstaller() {
  const result = LC_installLifecycleModule();

  Logger.log(JSON.stringify(result));

  if (!result.success) {
    throw new Error(
      "Lifecycle installation failed. Review LC_INSTALL_STATUS."
    );
  }

  return true;
}
