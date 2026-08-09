/******************************************************************************
 * MelroseOS Enterprise
 * Appointment Confirmation & Reschedule Migration
 * File: AP-06_Installer.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Installs and validates the Appointment Confirmation & Reschedule module.
 *
 * Requires:
 *   AP-01 through AP-05
 *   NF-01 through NF-06
 ******************************************************************************/

const AP_INSTALL_STATUS_SHEET = "AP_INSTALL_STATUS";

function AP_installAppointmentModule() {
  AP_initializeCore();
  AP_initializeNotificationBridge();

  const ss = workbook_();
  const sheet = createSheetIfMissing_(ss, AP_INSTALL_STATUS_SHEET);

  clearSheet_(sheet);

  const headers = [
    "Check",
    "Status",
    "Details",
    "UpdatedAt"
  ];

  setHeaders_(sheet, headers);

  const checks = AP_runInstallChecks_();

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
    "AP_INSTALLED",
    failed.length ? "FALSE" : "TRUE"
  );

  setDocProperty_(
    "AP_INSTALL_DATE",
    new Date().toISOString()
  );

  setDocProperty_(
    "AP_INSTALL_FAILURES",
    String(failed.length)
  );

  setDocProperty_(
    "AP_INSTALL_WARNINGS",
    String(warnings.length)
  );

  AP_log_(
    failed.length
      ? "INSTALL_FAILED"
      : "INSTALL_COMPLETE",
    "",
    "",
    "",
    failed.length
      ? failed.length + " installation check(s) failed."
      : "Appointment module installation checks passed."
  );

  return {
    success: failed.length === 0,
    checks: checks.length,
    failed: failed.length,
    warnings: warnings.length,
    appointmentMode: AP_getMode(),
    notificationMode: NF_getMode()
  };
}

function AP_runInstallChecks_() {
  const checks = [];

  const functions = [
    ["AP_initializeCore", "AP-01 Core"],
    ["AP_confirmByToken", "AP-02 Confirmation Engine"],
    ["AP_requestRescheduleByToken", "AP-03 Reschedule Engine"],
    ["AP_syncAppointmentToCalendar", "AP-04 Calendar Sync"],
    ["AP_initializeNotificationBridge", "AP-05 Notification Bridge"]
  ];

  functions.forEach(function(item) {
    const exists = AP_installerFunctionExists_(item[0]);

    checks.push({
      name: item[1],
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? item[0] + " is available."
        : item[0] + " is missing."
    });
  });

  const ss = workbook_();

  [
    AP.SHEETS.APPOINTMENTS,
    AP.SHEETS.ACTIONS,
    AP.SHEETS.AUDIT
  ].forEach(function(name) {
    const exists = !!ss.getSheetByName(name);

    checks.push({
      name: "Sheet: " + name,
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? "Required sheet exists."
        : "Required sheet is missing."
    });
  });

  const apMode = AP_getMode();

  checks.push({
    name: "Appointment Safety Mode",
    status: apMode === "SHADOW"
      ? "PASSED"
      : "WARNING",
    details: "Current Appointment mode is " + apMode + "."
  });

  const nfAvailable =
    typeof NF !== "undefined" &&
    typeof NF_queueNotification === "function";

  checks.push({
    name: "Notification Bridge Dependency",
    status: nfAvailable ? "PASSED" : "FAILED",
    details: nfAvailable
      ? "Notification module is available."
      : "Notification module dependency is unavailable."
  });

  const calendarAvailable =
    typeof CalendarApp !== "undefined";

  checks.push({
    name: "Google Calendar Service",
    status: calendarAvailable ? "PASSED" : "FAILED",
    details: calendarAvailable
      ? "CalendarApp service is available."
      : "CalendarApp service is unavailable."
  });

  return checks;
}

function AP_installerFunctionExists_(name) {
  try {
    return typeof this[name] === "function";
  } catch (error) {
    return false;
  }
}

function AP_runAppointmentSetup() {
  const install = AP_installAppointmentModule();

  if (!install.success) {
    throw new Error(
      "Appointment module installation failed. Review AP_INSTALL_STATUS."
    );
  }

  AP_setShadowMode();
  NF_setShadowMode();

  setDocProperty_(
    "AP_SETUP_COMPLETE",
    "TRUE"
  );

  setDocProperty_(
    "AP_SETUP_COMPLETED_AT",
    new Date().toISOString()
  );

  AP_log_(
    "SETUP_COMPLETE",
    "",
    "",
    "",
    "Appointment setup completed in SHADOW mode."
  );

  return {
    success: true,
    appointmentMode: AP_getMode(),
    notificationMode: NF_getMode(),
    install: install,
    core: AP_getCoreStatus()
  };
}

function AP_getInstallStatus() {
  return {
    installed:
      getDocProperty_("AP_INSTALLED") || "FALSE",

    installedAt:
      getDocProperty_("AP_INSTALL_DATE") || "",

    failures:
      Number(
        getDocProperty_("AP_INSTALL_FAILURES") || 0
      ),

    warnings:
      Number(
        getDocProperty_("AP_INSTALL_WARNINGS") || 0
      ),

    setupComplete:
      getDocProperty_("AP_SETUP_COMPLETE") || "FALSE",

    setupCompletedAt:
      getDocProperty_("AP_SETUP_COMPLETED_AT") || "",

    appointmentMode:
      typeof AP_getMode === "function"
        ? AP_getMode()
        : "UNKNOWN",

    notificationMode:
      typeof NF_getMode === "function"
        ? NF_getMode()
        : "UNKNOWN"
  };
}

function AP_testInstaller() {
  const result = AP_installAppointmentModule();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(AP_getInstallStatus()));

  if (!result.success) {
    throw new Error(
      "Appointment installer failed. Review AP_INSTALL_STATUS."
    );
  }

  return true;
}
