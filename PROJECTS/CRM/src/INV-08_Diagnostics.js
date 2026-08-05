/******************************************************************************
 * MelroseOS Enterprise
 * Module 0 - Inventory & Diagnostics
 * File: INV-08_Diagnostics.gs
 * Version: 1.0.0
 *
 * Aggregates findings from inventory, data profile, relationships, automation,
 * and migration analysis into a prioritized diagnostics report.
 *
 * Requires:
 *   INV-01_Core.gs
 *   INV-05_DataProfiler.gs
 *   INV-06_RelationshipScanner.gs
 *   INV-07_AutomationScanner.gs
 ******************************************************************************/

const M5_DIAGNOSTICS_SHEET = "DIAGNOSTICS";
const M5_DIAGNOSTICS_SUMMARY_SHEET = "DIAGNOSTIC_SUMMARY";

function M5_runDiagnostics() {
  const ss = workbook_();
  const diagnosticsSheet = createSheetIfMissing_(ss, M5_DIAGNOSTICS_SHEET);
  const summarySheet = createSheetIfMissing_(ss, M5_DIAGNOSTICS_SUMMARY_SHEET);

  clearSheet_(diagnosticsSheet);
  clearSheet_(summarySheet);

  const headers = [
    "DiagnosticID",
    "Severity",
    "Category",
    "Source Sheet",
    "Source Record",
    "Issue Type",
    "Details",
    "Impact",
    "Recommended Action",
    "Status",
    "Detected"
  ];

  const summaryHeaders = [
    "Metric",
    "Value",
    "Status",
    "Updated"
  ];

  setHeaders_(diagnosticsSheet, headers);
  setHeaders_(summarySheet, summaryHeaders);

  const rows = [];

  M5_collectDataQualityDiagnostics_(ss, rows);
  M5_collectRelationshipDiagnostics_(ss, rows);
  M5_collectAutomationDiagnostics_(ss, rows);
  M5_collectMigrationDiagnostics_(ss, rows);

  rows.sort(function(a, b) {
    return M5_severityRank_(a[1]) - M5_severityRank_(b[1]);
  });

  if (rows.length) {
    diagnosticsSheet
      .getRange(2, 1, rows.length, headers.length)
      .setValues(rows);
  }

  const summaryRows = M5_buildDiagnosticSummary_(rows);

  if (summaryRows.length) {
    summarySheet
      .getRange(2, 1, summaryRows.length, summaryHeaders.length)
      .setValues(summaryRows);
  }

  M5_formatDiagnosticsSheet_(diagnosticsSheet);
  M5_formatDiagnosticsSheet_(summarySheet);

  setDocProperty_("M5_LAST_DIAGNOSTICS_RUN", new Date().toISOString());
  setDocProperty_("M5_DIAGNOSTIC_COUNT", String(rows.length));

  const criticalCount = rows.filter(function(r) {
    return r[1] === "CRITICAL";
  }).length;

  const highCount = rows.filter(function(r) {
    return r[1] === "HIGH";
  }).length;

  return {
    success: true,
    diagnosticsFound: rows.length,
    critical: criticalCount,
    high: highCount
  };
}

function M5_collectDataQualityDiagnostics_(ss, rows) {
  const sheet = ss.getSheetByName(
    typeof M5_PROFILE_ISSUES_SHEET !== "undefined"
      ? M5_PROFILE_ISSUES_SHEET
      : "DATA_QUALITY_ISSUES"
  );

  if (!sheet || sheet.getLastRow() < 2) return;

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues();

  values.forEach(function(row) {
    const severity = row[1] || "MEDIUM";
    const sourceSheet = row[3] || "";
    const sourceRecord = row[4] || "";
    const issueType = row[7] || "DATA_QUALITY";
    const affectedCount = row[8] || 0;
    const examples = row[9] || "";
    const recommendation = row[10] || "";

    rows.push([
      M5_diagId_(),
      severity,
      "DATA_QUALITY",
      sourceSheet,
      sourceRecord,
      issueType,
      "Affected: " + affectedCount + (examples ? " | Examples: " + examples : ""),
      M5_dataIssueImpact_(severity, issueType),
      recommendation,
      "OPEN",
      timestamp_()
    ]);
  });
}

function M5_collectRelationshipDiagnostics_(ss, rows) {
  const relationshipSheet = ss.getSheetByName(
    typeof M5_RELATIONSHIP_SHEET !== "undefined"
      ? M5_RELATIONSHIP_SHEET
      : "RELATIONSHIPS"
  );

  if (relationshipSheet && relationshipSheet.getLastRow() > 1) {
    const values = relationshipSheet
      .getRange(
        2,
        1,
        relationshipSheet.getLastRow() - 1,
        relationshipSheet.getLastColumn()
      )
      .getValues();

    values.forEach(function(row) {
      const relationshipId = row[0] || "";
      const parentSheet = row[2] || "";
      const childSheet = row[7] || "";
      const orphanCount = Number(row[16] || 0);
      const confidence = Number(row[18] || 0);
      const status = row[22] || "";

      if (orphanCount > 0) {
        rows.push([
          M5_diagId_(),
          orphanCount >= 20 ? "HIGH" : "MEDIUM",
          "RELATIONSHIP",
          childSheet,
          relationshipId,
          "ORPHAN_RECORDS",
          orphanCount + " orphan records reference " + parentSheet + ".",
          "Migration may create broken references or incomplete assignments.",
          "Resolve orphan values before enforcing referential integrity.",
          "OPEN",
          timestamp_()
        ]);
      }

      if (confidence < 70) {
        rows.push([
          M5_diagId_(),
          confidence < 55 ? "HIGH" : "MEDIUM",
          "RELATIONSHIP",
          childSheet,
          relationshipId,
          "LOW_CONFIDENCE_RELATIONSHIP",
          "Relationship confidence is " + confidence + "%.",
          "Incorrect relationship mapping could produce an invalid migration order.",
          "Manually validate this relationship before migration.",
          status || "REVIEW",
          timestamp_()
        ]);
      }
    });
  }

  const migrationSheet = ss.getSheetByName(
    typeof M5_MIGRATION_ORDER_SHEET !== "undefined"
      ? M5_MIGRATION_ORDER_SHEET
      : "MIGRATION_ORDER"
  );

  if (!migrationSheet || migrationSheet.getLastRow() < 2) return;

  const migrationValues = migrationSheet
    .getRange(2, 1, migrationSheet.getLastRow() - 1, migrationSheet.getLastColumn())
    .getValues();

  migrationValues.forEach(function(row) {
    const sheetName = row[2] || "";
    const cycleDetected = row[6] === true || String(row[6]).toUpperCase() === "TRUE";

    if (cycleDetected) {
      rows.push([
        M5_diagId_(),
        "CRITICAL",
        "MIGRATION",
        sheetName,
        "",
        "CIRCULAR_DEPENDENCY",
        "Circular dependency detected in migration graph.",
        "Automated migration order cannot be guaranteed safely.",
        "Resolve circular references or create a controlled staged migration.",
        "OPEN",
        timestamp_()
      ]);
    }
  });
}

function M5_collectAutomationDiagnostics_(ss, rows) {
  const warningSheet = ss.getSheetByName(
    typeof M5_AUTOMATION_WARNING_SHEET !== "undefined"
      ? M5_AUTOMATION_WARNING_SHEET
      : "AUTOMATION_WARNINGS"
  );

  if (!warningSheet || warningSheet.getLastRow() < 2) return;

  const values = warningSheet
    .getRange(2, 1, warningSheet.getLastRow() - 1, warningSheet.getLastColumn())
    .getValues();

  values.forEach(function(row) {
    rows.push([
      M5_diagId_(),
      row[1] || "MEDIUM",
      "AUTOMATION",
      "",
      row[2] || "",
      row[3] || "AUTOMATION_WARNING",
      row[4] || "",
      "Automation reliability, duplicate execution, or migration behavior may be affected.",
      row[5] || "Review automation configuration.",
      "OPEN",
      timestamp_()
    ]);
  });
}

function M5_collectMigrationDiagnostics_(ss, rows) {
  const profileSheet = ss.getSheetByName(
    typeof M5_PROFILE_SHEET !== "undefined"
      ? M5_PROFILE_SHEET
      : "DATA_PROFILE"
  );

  if (!profileSheet || profileSheet.getLastRow() < 2) return;

  const values = profileSheet
    .getRange(2, 1, profileSheet.getLastRow() - 1, profileSheet.getLastColumn())
    .getValues();

  values.forEach(function(row) {
    const sheetName = row[2] || "";
    const header = row[6] || "";
    const completeness = Number(row[11] || 0);
    const status = row[25] || "";

    if (status === "EMPTY") {
      rows.push([
        M5_diagId_(),
        "LOW",
        "MIGRATION",
        sheetName,
        header,
        "EMPTY_COLUMN",
        "Column is completely empty.",
        "Unused columns increase migration complexity and schema noise.",
        "Confirm whether the column should be removed before migration.",
        "OPEN",
        timestamp_()
      ]);
    }

    if (completeness < 50 && status === "INCOMPLETE") {
      rows.push([
        M5_diagId_(),
        "MEDIUM",
        "MIGRATION",
        sheetName,
        header,
        "LOW_COLUMN_COMPLETENESS",
        "Column completeness is " + completeness + "%.",
        "Sparse fields may not be suitable as required destination fields.",
        "Review destination schema requirements before migration.",
        "OPEN",
        timestamp_()
      ]);
    }
  });
}

function M5_buildDiagnosticSummary_(rows) {
  const counts = {
    TOTAL: rows.length,
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0
  };

  rows.forEach(function(row) {
    const severity = String(row[1] || "INFO").toUpperCase();
    if (counts.hasOwnProperty(severity)) {
      counts[severity]++;
    }
  });

  const healthScore = M5_calculateHealthScore_(counts);
  const overallStatus =
    counts.CRITICAL > 0
      ? "BLOCKED"
      : counts.HIGH > 0
        ? "REVIEW REQUIRED"
        : counts.MEDIUM > 0
          ? "CAUTION"
          : "READY";

  return [
    ["Total Diagnostics", counts.TOTAL, overallStatus, timestamp_()],
    ["Critical", counts.CRITICAL, counts.CRITICAL ? "ACTION REQUIRED" : "OK", timestamp_()],
    ["High", counts.HIGH, counts.HIGH ? "REVIEW" : "OK", timestamp_()],
    ["Medium", counts.MEDIUM, counts.MEDIUM ? "REVIEW" : "OK", timestamp_()],
    ["Low", counts.LOW, "INFORMATIONAL", timestamp_()],
    ["Info", counts.INFO, "INFORMATIONAL", timestamp_()],
    ["System Health Score", healthScore, overallStatus, timestamp_()]
  ];
}

function M5_calculateHealthScore_(counts) {
  let score = 100;

  score -= counts.CRITICAL * 20;
  score -= counts.HIGH * 8;
  score -= counts.MEDIUM * 3;
  score -= counts.LOW * 1;

  return Math.max(0, Math.min(100, score));
}

function M5_dataIssueImpact_(severity, issueType) {
  if (severity === "CRITICAL") {
    return "Can block migration or create duplicate/broken production records.";
  }

  if (severity === "HIGH") {
    return "May cause failed routing, invalid records, or unreliable automation.";
  }

  if (String(issueType).indexOf("DUPLICATE") !== -1) {
    return "Duplicate data may create inconsistent assignments or repeated communications.";
  }

  return "May reduce data quality or require cleanup during migration.";
}

function M5_severityRank_(severity) {
  const ranks = {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4,
    INFO: 5
  };

  return ranks[String(severity || "INFO").toUpperCase()] || 99;
}

function M5_diagId_() {
  return "DIA-" + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function M5_formatDiagnosticsSheet_(sheet) {
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() > 1 && !sheet.getFilter()) {
    sheet.getDataRange().createFilter();
  }

  autoResize_(sheet);
}

function M5_getDiagnosticsSummary() {
  const ss = workbook_();
  const diagnosticsSheet = ss.getSheetByName(M5_DIAGNOSTICS_SHEET);
  const summarySheet = ss.getSheetByName(M5_DIAGNOSTICS_SUMMARY_SHEET);

  return {
    lastRun: getDocProperty_("M5_LAST_DIAGNOSTICS_RUN") || "",
    diagnosticsFound: diagnosticsSheet
      ? Math.max(diagnosticsSheet.getLastRow() - 1, 0)
      : 0,
    summaryMetrics: summarySheet
      ? Math.max(summarySheet.getLastRow() - 1, 0)
      : 0
  };
}

function M5_resetDiagnostics() {
  const ss = workbook_();

  [M5_DIAGNOSTICS_SHEET, M5_DIAGNOSTICS_SUMMARY_SHEET].forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet) clearSheet_(sheet);
  });

  setDocProperty_("M5_LAST_DIAGNOSTICS_RUN", "");
  setDocProperty_("M5_DIAGNOSTIC_COUNT", "0");

  return true;
}

function M5_testDiagnostics() {
  const result = M5_runDiagnostics();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(M5_getDiagnosticsSummary()));

  if (!result.success) {
    throw new Error("Diagnostics engine failed.");
  }

  return true;
}
