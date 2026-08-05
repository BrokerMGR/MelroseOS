/******************************************************************************
 * MelroseOS Enterprise
 * System Integration & Cutover
 * File: CO-03_ShadowValidator.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Validates that migrated modules are operating safely in SHADOW mode before
 *   any cutover to LIVE processing.
 *
 * Requires:
 *   CO-01_Core.gs
 *   CO-02_HealthCheck.gs
 *   AE-01 through AE-10
 *   LI-01 through LI-07
 *   NF-01 through NF-06
 *   AP-01 through AP-06
 ******************************************************************************/

const CO_SHADOW_VALIDATION_SHEET = "CO_SHADOW_VALIDATION";

function CO_initializeShadowValidator() {
  CO_initializeCore();

  const sheet = createSheetIfMissing_(
    workbook_(),
    CO_SHADOW_VALIDATION_SHEET
  );

  CO_setHeadersIfEmpty_(sheet, [
    "ValidationID",
    "CheckName",
    "Status",
    "Details",
    "CheckedAt"
  ]);

  return true;
}

function CO_runShadowValidation() {
  CO_initializeShadowValidator();
  CO_forceShadowMode();

  const checks = [];

  CO_addShadowCheck_(
    checks,
    "Cutover State",
    CO_getState() === "SHADOW",
    "Cutover controller state is " + CO_getState() + "."
  );

  CO_addShadowCheck_(
    checks,
    "Assignment Engine Mode",
    typeof AE_getMode === "function" && AE_getMode() === "SHADOW",
    "Assignment Engine mode is " +
      (typeof AE_getMode === "function" ? AE_getMode() : "UNKNOWN") + "."
  );

  CO_addShadowCheck_(
    checks,
    "Notification Engine Mode",
    typeof NF_getMode === "function" && NF_getMode() === "SHADOW",
    "Notification Engine mode is " +
      (typeof NF_getMode === "function" ? NF_getMode() : "UNKNOWN") + "."
  );

  CO_addShadowCheck_(
    checks,
    "Appointment Engine Mode",
    typeof AP_getMode === "function" && AP_getMode() === "SHADOW",
    "Appointment Engine mode is " +
      (typeof AP_getMode === "function" ? AP_getMode() : "UNKNOWN") + "."
  );

  if (typeof AE_getShadowMigrationStatus === "function") {
    const shadow = AE_getShadowMigrationStatus();

    CO_addShadowCheck_(
      checks,
      "Assignment Shadow Results",
      Number(shadow.totalResults || 0) > 0,
      Number(shadow.totalResults || 0) +
        " assignment shadow result(s) are available.",
      true
    );
  }

if (typeof NF_getSendEngineStatus === "function") {
  const send = NF_getSendEngineStatus();

  CO_addShadowCheck_(
    checks,
    "Notification Engine Shadow Safety",
    typeof NF_getMode === "function" &&
      NF_getMode() === "SHADOW",
    Number(send.sent || 0) +
      " historical LIVE notification(s) exist. " +
      "Current Notification Engine mode is " +
      (
        typeof NF_getMode === "function"
          ? NF_getMode()
          : "UNKNOWN"
      ) +
      "."
  );
}

  if (typeof AP_getCoreStatus === "function") {
    CO_addShadowCheck_(
      checks,
      "Appointment Module Available",
      true,
      "Appointment module is available in SHADOW mode."
    );
  }

  const health = CO_runHealthCheck();

  CO_addShadowCheck_(
    checks,
    "System Health",
    health.success,
    health.failed +
      " failed health check(s) and " +
      health.warnings +
      " warning(s)."
  );

  CO_writeShadowValidation_(checks);

  const failed = checks.filter(function(check) {
    return check.status === "FAILED";
  });

  const warnings = checks.filter(function(check) {
    return check.status === "WARNING";
  });

  setDocProperty_(
    "CO_SHADOW_VALIDATION_PASSED",
    failed.length ? "FALSE" : "TRUE"
  );

  setDocProperty_(
    "CO_SHADOW_VALIDATION_AT",
    new Date().toISOString()
  );

  CO_log_(
    failed.length
      ? "SHADOW_VALIDATION_FAILED"
      : "SHADOW_VALIDATION_PASSED",
    "SHADOW",
    "SHADOW",
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

function CO_addShadowCheck_(
  checks,
  checkName,
  passed,
  details,
  warningIfFalse
) {
  checks.push({
    id: "SV-" +
      Utilities
        .getUuid()
        .substring(0, 8)
        .toUpperCase(),
    name: checkName,
    status: passed
      ? "PASSED"
      : warningIfFalse
        ? "WARNING"
        : "FAILED",
    details: details
  });
}

function CO_writeShadowValidation_(checks) {
  const sheet = workbook_().getSheetByName(
    CO_SHADOW_VALIDATION_SHEET
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
      check.name,
      check.status,
      check.details,
      timestamp_()
    ];
  });

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, 5)
      .setValues(rows);
  }

  autoResize_(sheet);
}

function CO_getShadowValidationStatus() {
  return {
    passed:
      getDocProperty_(
        "CO_SHADOW_VALIDATION_PASSED"
      ) || "FALSE",

    validatedAt:
      getDocProperty_(
        "CO_SHADOW_VALIDATION_AT"
      ) || "",

    state: CO_getState()
  };
}

function CO_testShadowValidator() {
  const result = CO_runShadowValidation();

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      CO_getShadowValidationStatus()
    )
  );

  if (!result.success) {
    throw new Error(
      "Shadow validation failed. Review CO_SHADOW_VALIDATION."
    );
  }

  return true;
}
