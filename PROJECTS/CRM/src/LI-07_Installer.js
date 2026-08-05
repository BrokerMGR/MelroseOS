/******************************************************************************
 * MelroseOS Enterprise
 * Lead Intake Migration
 * File: LI-07_Installer.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Installs and validates the Lead Intake Migration module.
 *
 * Requires:
 *   LI-01_Core.gs
 *   LI-02_SourceRegistry.gs
 *   LI-03_DedupeEngine.gs
 *   LI-04_QueueProcessor.gs
 *   LI-05_LegacyImporter.gs
 *   LI-06_IntakeRouter.gs
 *   AE-01 through AE-10
 ******************************************************************************/

const LI_INSTALL_STATUS_SHEET = "LI_INSTALL_STATUS";

function LI_installLeadIntakeModule() {
  LI_initializeCore();
  LI_initializeSourceRegistry();
  LI_initializeDedupeEngine();
  LI_initializeLegacyImporter();

  const ss = workbook_();
  const sheet = createSheetIfMissing_(ss, LI_INSTALL_STATUS_SHEET);

  clearSheet_(sheet);

  const headers = [
    "Check",
    "Status",
    "Details",
    "UpdatedAt"
  ];

  setHeaders_(sheet, headers);

  const checks = LI_runInstallChecks_();

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
    "LI_INSTALLED",
    failed.length ? "FALSE" : "TRUE"
  );

  setDocProperty_(
    "LI_INSTALL_DATE",
    new Date().toISOString()
  );

  setDocProperty_(
    "LI_INSTALL_FAILURES",
    String(failed.length)
  );

  setDocProperty_(
    "LI_INSTALL_WARNINGS",
    String(warnings.length)
  );

  LI_log_(
    failed.length
      ? "INSTALL_FAILED"
      : "INSTALL_COMPLETE",
    "",
    failed.length
      ? failed.length + " installation check(s) failed."
      : "Lead Intake installation checks passed.",
    ""
  );

  return {
    success: failed.length === 0,
    checks: checks.length,
    failed: failed.length,
    warnings: warnings.length
  };
}

function LI_runInstallChecks_() {
  const checks = [];

  const functions = [
    ["LI_initializeCore", "LI-01 Core"],
    ["LI_initializeSourceRegistry", "LI-02 Source Registry"],
    ["LI_findDuplicateLead", "LI-03 Dedupe Engine"],
    ["LI_processIntakeQueue", "LI-04 Queue Processor"],
    ["LI_importLegacySheet", "LI-05 Legacy Importer"],
    ["LI_routeIncomingLead", "LI-06 Intake Router"]
  ];

  functions.forEach(function(item) {
    const exists = LI_installerFunctionExists_(item[0]);

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
    LI.SHEETS.INTAKE,
    LI.SHEETS.REJECTED,
    LI.SHEETS.AUDIT,
    LI_SOURCE_SHEET,
    LI_DUPLICATE_LOG_SHEET,
    LI_LEGACY_IMPORT_LOG_SHEET
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

  const aeAvailable =
    typeof AE !== "undefined" &&
    typeof AE_assignLead === "function";

  checks.push({
    name: "Assignment Engine Connection",
    status: aeAvailable ? "PASSED" : "FAILED",
    details: aeAvailable
      ? "Lead Intake can route into the Assignment Engine."
      : "Assignment Engine dependency is unavailable."
  });

  const mode = aeAvailable
    ? AE_getMode()
    : "UNKNOWN";

  checks.push({
    name: "Assignment Engine Safety Mode",
    status: mode === "SHADOW"
      ? "PASSED"
      : "WARNING",
    details: "Current Assignment Engine mode is " + mode + "."
  });

  return checks;
}

function LI_installerFunctionExists_(name) {
  try {
    return typeof this[name] === "function";
  } catch (error) {
    return false;
  }
}

function LI_runLeadIntakeSetup() {
  const install = LI_installLeadIntakeModule();

  if (!install.success) {
    throw new Error(
      "Lead Intake installation failed. Review LI_INSTALL_STATUS."
    );
  }

  AE_setShadowMode();

  const sources = LI_registerDefaultSources();

  setDocProperty_(
    "LI_SETUP_COMPLETE",
    "TRUE"
  );

  setDocProperty_(
    "LI_SETUP_COMPLETED_AT",
    new Date().toISOString()
  );

  LI_log_(
    "SETUP_COMPLETE",
    "",
    "Lead Intake setup completed with Assignment Engine in SHADOW mode.",
    ""
  );

  return {
    success: true,
    assignmentMode: AE_getMode(),
    install: install,
    sources: sources,
    intake: LI_getIntakeSummary(),
    queue: LI_getQueueStatus(),
    duplicates: LI_getDuplicateSummary()
  };
}

function LI_getInstallStatus() {
  return {
    installed:
      getDocProperty_("LI_INSTALLED") || "FALSE",

    installedAt:
      getDocProperty_("LI_INSTALL_DATE") || "",

    failures:
      Number(
        getDocProperty_("LI_INSTALL_FAILURES") || 0
      ),

    warnings:
      Number(
        getDocProperty_("LI_INSTALL_WARNINGS") || 0
      ),

    setupComplete:
      getDocProperty_("LI_SETUP_COMPLETE") || "FALSE",

    setupCompletedAt:
      getDocProperty_("LI_SETUP_COMPLETED_AT") || "",

    assignmentMode:
      typeof AE_getMode === "function"
        ? AE_getMode()
        : "UNKNOWN"
  };
}

function LI_testInstaller() {
  const result = LI_installLeadIntakeModule();

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      LI_getInstallStatus()
    )
  );

  if (!result.success) {
    throw new Error(
      "Lead Intake installer failed. Review LI_INSTALL_STATUS."
    );
  }

  return true;
}
