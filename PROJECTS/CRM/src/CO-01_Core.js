/******************************************************************************
 * MelroseOS Enterprise
 * System Integration & Cutover
 * File: CO-01_Core.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Central cutover controller for the migrated Inventory, Assignment,
 *   Lead Intake, Notification, and Appointment modules.
 *
 * Safety:
 *   Initializes all supported operational modules in SHADOW mode.
 *
 * Requires:
 *   AE-01 through AE-10
 *   LI-01 through LI-07
 *   NF-01 through NF-06
 *   AP-01 through AP-06
 ******************************************************************************/

const CO = {
  VERSION: "1.0.0",
  STATE_PROPERTY: "M5_CUTOVER_STATE",
  DEFAULT_STATE: "SHADOW",
  SHEETS: {
    STATUS: "CO_SYSTEM_STATUS",
    AUDIT: "CO_AUDIT_LOG"
  }
};

function CO_initializeCore() {
  const ss = workbook_();

  Object.keys(CO.SHEETS).forEach(function(key) {
    createSheetIfMissing_(ss, CO.SHEETS[key]);
  });

  CO_setHeadersIfEmpty_(
    ss.getSheetByName(CO.SHEETS.STATUS),
    [
      "Module",
      "Installed",
      "Mode",
      "Status",
      "Details",
      "CheckedAt"
    ]
  );

  CO_setHeadersIfEmpty_(
    ss.getSheetByName(CO.SHEETS.AUDIT),
    [
      "AuditID",
      "EventType",
      "PreviousState",
      "NewState",
      "Details",
      "CreatedAt"
    ]
  );

  if (!getDocProperty_(CO.STATE_PROPERTY)) {
    setDocProperty_(
      CO.STATE_PROPERTY,
      CO.DEFAULT_STATE
    );
  }

 if (!getDocProperty_(CO.STATE_PROPERTY)) {
  setDocProperty_(
    CO.STATE_PROPERTY,
    CO.DEFAULT_STATE
  );
}

  CO_log_(
    "CORE_INITIALIZED",
    "",
    CO_getState(),
    "Cutover controller initialized."
  );

  return {
    success: true,
    version: CO.VERSION,
    state: CO_getState()
  };
}

function CO_setHeadersIfEmpty_(sheet, headers) {
  if (!sheet) {
    throw new Error("Required Cutover sheet is missing.");
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    sheet.setFrozenRows(1);
    autoResize_(sheet);
    return;
  }

  const width = Math.max(
    sheet.getLastColumn(),
    headers.length
  );

  const existing = sheet
    .getRange(1, 1, 1, width)
    .getDisplayValues()[0];

  const hasHeaders = existing.some(function(value) {
    return String(value || "").trim() !== "";
  });

  if (!hasHeaders) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    sheet.setFrozenRows(1);
    autoResize_(sheet);
  }
}

function CO_getState() {
  return String(
    getDocProperty_(CO.STATE_PROPERTY) ||
    CO.DEFAULT_STATE
  ).toUpperCase();
}

function CO_forceShadowMode() {
  const previous = CO_getState();

  if (typeof AE_setShadowMode === "function") {
    AE_setShadowMode();
  }

  if (typeof NF_setShadowMode === "function") {
    NF_setShadowMode();
  }

  if (typeof AP_setShadowMode === "function") {
    AP_setShadowMode();
  }

  setDocProperty_(
    CO.STATE_PROPERTY,
    "SHADOW"
  );

  if (previous !== "SHADOW") {
    CO_log_(
      "SHADOW_MODE_ENABLED",
      previous,
      "SHADOW",
      "Operational modules were placed in SHADOW mode."
    );
  }

  return "SHADOW";
}

function CO_pauseSystem() {
  const previous = CO_getState();

  if (typeof NF_pause === "function") {
    NF_pause();
  }

  if (typeof AP_pause === "function") {
    AP_pause();
  }

  setDocProperty_(
    CO.STATE_PROPERTY,
    "PAUSED"
  );

  CO_log_(
    "SYSTEM_PAUSED",
    previous,
    "PAUSED",
    "Notification and appointment processing paused."
  );

  return {
    success: true,
    state: "PAUSED"
  };
}

function CO_refreshSystemStatus() {
  CO_initializeStatusDependencies_();

  const status = CO_collectSystemStatus_();
  const sheet = workbook_().getSheetByName(
    CO.SHEETS.STATUS
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

  const rows = status.map(function(item) {
    return [
      item.module,
      item.installed,
      item.mode,
      item.status,
      item.details,
      timestamp_()
    ];
  });

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, 6)
      .setValues(rows);
  }

  autoResize_(sheet);

  return {
    success: true,
    state: CO_getState(),
    modules: status
  };
}

function CO_initializeStatusDependencies_() {
  if (typeof AE_initializeConfig === "function") {
    AE_initializeConfig();
  }

  if (typeof LI_initializeCore === "function") {
    LI_initializeCore();
  }

  if (typeof NF_initializeCore === "function") {
    NF_initializeCore();
  }

  if (typeof AP_initializeCore === "function") {
    AP_initializeCore();
  }
}

function CO_collectSystemStatus_() {
  return [
    CO_moduleStatus_(
      "Assignment Engine",
      typeof AE_getMode === "function",
      typeof AE_getMode === "function"
        ? AE_getMode()
        : "UNKNOWN"
    ),

    CO_moduleStatus_(
      "Lead Intake",
      typeof LI_getInstallStatus === "function",
      "N/A"
    ),

    CO_moduleStatus_(
      "Notifications",
      typeof NF_getMode === "function",
      typeof NF_getMode === "function"
        ? NF_getMode()
        : "UNKNOWN"
    ),

    CO_moduleStatus_(
      "Appointments",
      typeof AP_getMode === "function",
      typeof AP_getMode === "function"
        ? AP_getMode()
        : "UNKNOWN"
    )
  ];
}

function CO_moduleStatus_(
  moduleName,
  installed,
  mode
) {
  let status = installed
    ? "READY"
    : "MISSING";

  let details = installed
    ? "Module dependency is available."
    : "Required module dependency is unavailable.";

  if (
    installed &&
    mode !== "N/A" &&
    mode !== "SHADOW"
  ) {
    status = "WARNING";
    details =
      "Module is available but current mode is " +
      mode +
      ".";
  }

  return {
    module: moduleName,
    installed: installed ? "TRUE" : "FALSE",
    mode: mode,
    status: status,
    details: details
  };
}

function CO_runPreCutoverCheck() {
  const refreshed =
    CO_refreshSystemStatus();

  const failures =
    refreshed.modules.filter(function(item) {
      return (
        item.status === "MISSING" ||
        item.status === "WARNING"
      );
    });

  const result = {
    success: failures.length === 0,
    state: CO_getState(),
    checks: refreshed.modules.length,
    issues: failures.length,
    modules: refreshed.modules
  };

  CO_log_(
    result.success
      ? "PRECUTOVER_CHECK_PASSED"
      : "PRECUTOVER_CHECK_FAILED",
    CO_getState(),
    CO_getState(),
    result.success
      ? "All registered modules passed the pre-cutover check."
      : failures.length +
        " module issue(s) require review."
  );

  return result;
}

function CO_getSystemSummary() {
  return {
    version: CO.VERSION,
    state: CO_getState(),

    assignmentMode:
      typeof AE_getMode === "function"
        ? AE_getMode()
        : "UNKNOWN",

    notificationMode:
      typeof NF_getMode === "function"
        ? NF_getMode()
        : "UNKNOWN",

    appointmentMode:
      typeof AP_getMode === "function"
        ? AP_getMode()
        : "UNKNOWN",

    intake:
      typeof LI_getQueueStatus === "function"
        ? LI_getQueueStatus()
        : {},

    notifications:
      typeof NF_getSendEngineStatus === "function"
        ? NF_getSendEngineStatus()
        : {},

    appointments:
      typeof AP_getCoreStatus === "function"
        ? AP_getCoreStatus()
        : {}
  };
}

function CO_log_(
  eventType,
  previousState,
  newState,
  details
) {
  const sheet = workbook_().getSheetByName(
    CO.SHEETS.AUDIT
  );

  if (!sheet) {
    return;
  }

  sheet.appendRow([
    "CO-AUD-" +
      Utilities
        .getUuid()
        .substring(0, 8)
        .toUpperCase(),
    String(eventType || ""),
    String(previousState || ""),
    String(newState || ""),
    String(details || ""),
    timestamp_()
  ]);
}

function CO_testCore() {
  CO_initializeCore();

  const result =
    CO_runPreCutoverCheck();

  if (CO_getState() !== "SHADOW") {
    throw new Error(
      "Cutover Core self-test failed: system is not in SHADOW mode."
    );
  }

  if (!result.success) {
    throw new Error(
      "Cutover Core self-test found module issues. Review CO_SYSTEM_STATUS."
    );
  }

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      CO_getSystemSummary()
    )
  );

  return true;
}
