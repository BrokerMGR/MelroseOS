/******************************************************************************
 * MelroseOS Enterprise
 * Lead Notification & Follow-Up Migration
 * File: NF-06_Installer.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Installs and validates the Notification & Follow-Up module.
 *
 * Requires:
 *   NF-01_Core.gs
 *   NF-02_TemplateEngine.gs
 *   NF-03_NotificationBuilder.gs
 *   NF-04_SendEngine.gs
 *   NF-05_FollowUpEngine.gs
 ******************************************************************************/

const NF_INSTALL_STATUS_SHEET = "NF_INSTALL_STATUS";

function NF_installNotificationModule() {
  NF_initializeCore();
  NF_initializeTemplateEngine();

  const ss = workbook_();
  const sheet = createSheetIfMissing_(ss, NF_INSTALL_STATUS_SHEET);

  clearSheet_(sheet);

  const headers = [
    "Check",
    "Status",
    "Details",
    "UpdatedAt"
  ];

  setHeaders_(sheet, headers);

  const checks = NF_runInstallChecks_();

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
    "NF_INSTALLED",
    failed.length ? "FALSE" : "TRUE"
  );

  setDocProperty_(
    "NF_INSTALL_DATE",
    new Date().toISOString()
  );

  setDocProperty_(
    "NF_INSTALL_FAILURES",
    String(failed.length)
  );

  setDocProperty_(
    "NF_INSTALL_WARNINGS",
    String(warnings.length)
  );

  NF_log_(
    failed.length
      ? "INSTALL_FAILED"
      : "INSTALL_COMPLETE",
    "",
    "",
    "",
    failed.length
      ? failed.length + " installation check(s) failed."
      : "Notification module installation checks passed."
  );

  return {
    success: failed.length === 0,
    checks: checks.length,
    failed: failed.length,
    warnings: warnings.length,
    mode: NF_getMode()
  };
}

function NF_runInstallChecks_() {
  const checks = [];

  const functions = [
    ["NF_initializeCore", "NF-01 Core"],
    ["NF_initializeTemplateEngine", "NF-02 Template Engine"],
    ["NF_buildAssignmentNotifications", "NF-03 Notification Builder"],
    ["NF_processSendQueue", "NF-04 Send Engine"],
    ["NF_scheduleLeadFollowUps", "NF-05 Follow-Up Engine"]
  ];

  functions.forEach(function(item) {
    const exists = NF_installerFunctionExists_(item[0]);

    checks.push({
      name: item[1],
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? item[0] + " is available."
        : item[0] + " is missing."
    });
  });

  const ss = workbook_();

  const requiredSheets = [
    NF.SHEETS.QUEUE,
    NF.SHEETS.TEMPLATES,
    NF.SHEETS.AUDIT
  ];

  requiredSheets.forEach(function(name) {
    const exists = !!ss.getSheetByName(name);

    checks.push({
      name: "Sheet: " + name,
      status: exists ? "PASSED" : "FAILED",
      details: exists
        ? "Required sheet exists."
        : "Required sheet is missing."
    });
  });

  const mode = NF_getMode();

  checks.push({
    name: "Notification Safety Mode",
    status: mode === "SHADOW"
      ? "PASSED"
      : "WARNING",
    details: "Current Notification mode is " + mode + "."
  });

  const gmailAvailable = typeof GmailApp !== "undefined";

  checks.push({
    name: "Gmail Service",
    status: gmailAvailable ? "PASSED" : "FAILED",
    details: gmailAvailable
      ? "GmailApp service is available."
      : "GmailApp service is unavailable."
  });

  return checks;
}

function NF_installerFunctionExists_(name) {
  try {
    return typeof this[name] === "function";
  } catch (error) {
    return false;
  }
}

function NF_runNotificationSetup() {
  const install = NF_installNotificationModule();

  if (!install.success) {
    throw new Error(
      "Notification module installation failed. Review NF_INSTALL_STATUS."
    );
  }

  NF_setShadowMode();

  setDocProperty_(
    "NF_SETUP_COMPLETE",
    "TRUE"
  );

  setDocProperty_(
    "NF_SETUP_COMPLETED_AT",
    new Date().toISOString()
  );

  NF_log_(
    "SETUP_COMPLETE",
    "",
    "",
    "",
    "Notification setup completed in SHADOW mode."
  );

  return {
    success: true,
    mode: NF_getMode(),
    install: install,
    core: NF_getCoreStatus(),
    sendEngine: NF_getSendEngineStatus(),
    followUp: NF_getFollowUpStatus()
  };
}

function NF_getInstallStatus() {
  return {
    installed:
      getDocProperty_("NF_INSTALLED") || "FALSE",

    installedAt:
      getDocProperty_("NF_INSTALL_DATE") || "",

    failures:
      Number(
        getDocProperty_("NF_INSTALL_FAILURES") || 0
      ),

    warnings:
      Number(
        getDocProperty_("NF_INSTALL_WARNINGS") || 0
      ),

    setupComplete:
      getDocProperty_("NF_SETUP_COMPLETE") || "FALSE",

    setupCompletedAt:
      getDocProperty_("NF_SETUP_COMPLETED_AT") || "",

    mode:
      typeof NF_getMode === "function"
        ? NF_getMode()
        : "UNKNOWN"
  };
}

function NF_testInstaller() {
  const result = NF_installNotificationModule();

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      NF_getInstallStatus()
    )
  );

  if (!result.success) {
    throw new Error(
      "Notification installer failed. Review NF_INSTALL_STATUS."
    );
  }

  return true;
}
