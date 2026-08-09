/******************************************************************************
 * MelroseOS Enterprise
 * Module 0 - Inventory & Diagnostics
 * File: INV-09_ReportBuilder.gs
 * Version: 1.0.0
 *
 * Builds the consolidated migration-readiness report from Inventory modules.
 *
 * Requires:
 *   INV-01_Core.gs
 *   INV-05_DataProfiler.gs
 *   INV-06_RelationshipScanner.gs
 *   INV-07_AutomationScanner.gs
 *   INV-08_Diagnostics.gs
 ******************************************************************************/

const M5_MIGRATION_REPORT_SHEET = "MIGRATION_REPORT";

function M5_buildMigrationReport() {
  const ss = workbook_();
  const report = createSheetIfMissing_(ss, M5_MIGRATION_REPORT_SHEET);
  clearSheet_(report);

  const generatedAt = timestamp_();
  const metrics = M5_collectMigrationReportMetrics_(ss);
  const readiness = M5_determineMigrationReadiness_(metrics);

  const rows = [
    ["MelroseOS Migration Readiness Report", "", "", ""],
    ["Generated", generatedAt, "", ""],
    ["Workbook", ss.getName(), "", ""],
    ["Inventory Version", typeof M5 !== "undefined" ? M5.VERSION : "", "", ""],
    ["", "", "", ""],
    ["READINESS", readiness.status, readiness.score, readiness.message],
    ["", "", "", ""],
    ["Metric", "Value", "Status", "Notes"],
    ["Workbook Sheets", metrics.workbookSheets, "INFO", "Non-system and system sheets combined."],
    ["Profiled Columns", metrics.profiledColumns, metrics.profiledColumns ? "OK" : "NOT RUN", "Run the Data Profiler if zero."],
    ["Data Quality Issues", metrics.dataIssues, M5_metricStatus_(metrics.dataIssues, 0, 10), "Review unresolved data-quality findings."],
    ["Relationships Found", metrics.relationships, metrics.relationships ? "OK" : "REVIEW", "Zero may be valid for a standalone workbook."],
    ["Orphan Records", metrics.orphans, metrics.orphans ? "REVIEW" : "OK", "Resolve before enforcing relationships."],
    ["Migration Steps", metrics.migrationSteps, metrics.migrationSteps ? "OK" : "NOT RUN", "Suggested dependency-based migration sequence."],
    ["Automation Triggers", metrics.triggers, "INFO", "Installable project triggers visible to this project."],
    ["Automation Warnings", metrics.automationWarnings, metrics.automationWarnings ? "REVIEW" : "OK", "Review duplicate or conflicting trigger findings."],
    ["Critical Diagnostics", metrics.critical, metrics.critical ? "BLOCKED" : "OK", "Critical findings block automated migration."],
    ["High Diagnostics", metrics.high, metrics.high ? "REVIEW" : "OK", "Resolve or formally accept before production cutover."],
    ["Medium Diagnostics", metrics.medium, metrics.medium ? "CAUTION" : "OK", "Recommended cleanup before migration."],
    ["Health Score", metrics.healthScore, M5_healthStatus_(metrics.healthScore), "100 is best."],
    ["", "", "", ""],
    ["RECOMMENDED NEXT ACTIONS", "", "", ""]
  ];

  readiness.actions.forEach(function(action, index) {
    rows.push([index + 1, action, "", ""]);
  });

  rows.push(["", "", "", ""]);
  rows.push(["MIGRATION ORDER", "", "", ""]);
  rows.push(["Step", "Sheet", "Depends On", "Priority"]);

  const migrationOrder = M5_readMigrationOrder_(ss);
  migrationOrder.forEach(function(item) {
    rows.push([
      item.step,
      item.sheet,
      item.dependsOn,
      item.priority
    ]);
  });

  report.getRange(1, 1, rows.length, 4).setValues(rows);

  M5_formatMigrationReport_(report, rows.length);

  setDocProperty_("M5_LAST_MIGRATION_REPORT", new Date().toISOString());
  setDocProperty_("M5_MIGRATION_READINESS", readiness.status);
  setDocProperty_("M5_MIGRATION_READINESS_SCORE", String(readiness.score));

  return {
    success: true,
    status: readiness.status,
    score: readiness.score,
    actions: readiness.actions.length
  };
}

function M5_collectMigrationReportMetrics_(ss) {
  const diagnostics = ss.getSheetByName("DIAGNOSTICS");
  const diagnosticSummary = ss.getSheetByName("DIAGNOSTIC_SUMMARY");

  const severityCounts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0
  };

  if (diagnostics && diagnostics.getLastRow() > 1) {
    const values = diagnostics
      .getRange(2, 2, diagnostics.getLastRow() - 1, 1)
      .getDisplayValues();

    values.forEach(function(row) {
      const severity = String(row[0] || "").toUpperCase();
      if (severityCounts.hasOwnProperty(severity)) {
        severityCounts[severity]++;
      }
    });
  }

  let healthScore = 100;

  if (diagnosticSummary && diagnosticSummary.getLastRow() > 1) {
    const values = diagnosticSummary
      .getRange(2, 1, diagnosticSummary.getLastRow() - 1, 2)
      .getValues();

    values.some(function(row) {
      if (row[0] === "System Health Score") {
        healthScore = Number(row[1] || 0);
        return true;
      }
      return false;
    });
  } else {
    healthScore = Math.max(
      0,
      100 -
        severityCounts.CRITICAL * 20 -
        severityCounts.HIGH * 8 -
        severityCounts.MEDIUM * 3 -
        severityCounts.LOW
    );
  }

  return {
    workbookSheets: ss.getSheets().length,
    profiledColumns: M5_countDataRows_(ss, "DATA_PROFILE"),
    dataIssues: M5_countDataRows_(ss, "DATA_QUALITY_ISSUES"),
    relationships: M5_countDataRows_(ss, "RELATIONSHIPS"),
    orphans: M5_countDataRows_(ss, "ORPHAN_RECORDS"),
    migrationSteps: M5_countDataRows_(ss, "MIGRATION_ORDER"),
    triggers: M5_countDataRows_(ss, "AUTOMATION_INVENTORY"),
    automationWarnings: M5_countDataRows_(ss, "AUTOMATION_WARNINGS"),
    critical: severityCounts.CRITICAL,
    high: severityCounts.HIGH,
    medium: severityCounts.MEDIUM,
    low: severityCounts.LOW,
    healthScore: healthScore
  };
}

function M5_determineMigrationReadiness_(metrics) {
  let score = Number(metrics.healthScore || 0);
  const actions = [];

  if (!metrics.profiledColumns) {
    score = Math.min(score, 40);
    actions.push("Run M5_runDataProfiler() before migration.");
  }

  if (!metrics.migrationSteps) {
    score = Math.min(score, 50);
    actions.push("Run M5_runRelationshipScanner() to generate migration order.");
  }

  if (metrics.critical > 0) {
    score = Math.min(score, 25);
    actions.push("Resolve all CRITICAL diagnostics before production migration.");
  }

  if (metrics.high > 0) {
    score = Math.min(score, 70);
    actions.push("Review and resolve HIGH diagnostics before cutover.");
  }

  if (metrics.orphans > 0) {
    score = Math.min(score, 75);
    actions.push("Resolve orphan records or document approved exceptions.");
  }

  if (metrics.automationWarnings > 0) {
    actions.push("Review automation warnings and remove unintended duplicate triggers.");
  }

  if (metrics.dataIssues > 0) {
    actions.push("Review DATA_QUALITY_ISSUES and clean required/key fields.");
  }

  if (!actions.length) {
    actions.push("Inventory checks passed. Proceed to controlled migration validation.");
  }

  let status;
  let message;

  if (metrics.critical > 0 || score < 40) {
    status = "BLOCKED";
    message = "Do not begin production migration until blocking findings are resolved.";
  } else if (metrics.high > 0 || score < 70) {
    status = "REVIEW REQUIRED";
    message = "Migration requires remediation or documented approval.";
  } else if (score < 85 || metrics.orphans > 0) {
    status = "CONDITIONAL";
    message = "Proceed only after reviewing listed exceptions.";
  } else {
    status = "READY";
    message = "Inventory indicates the workbook is ready for controlled migration.";
  }

  return {
    status: status,
    score: Math.max(0, Math.min(100, Math.round(score))),
    message: message,
    actions: actions
  };
}

function M5_readMigrationOrder_(ss) {
  const sheet = ss.getSheetByName("MIGRATION_ORDER");
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues();

  return values.map(function(row) {
    return {
      step: row[0],
      sheet: row[2],
      dependsOn: row[4],
      priority: row[7]
    };
  });
}

function M5_countDataRows_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  return sheet ? Math.max(sheet.getLastRow() - 1, 0) : 0;
}

function M5_metricStatus_(value, goodMax, warningMax) {
  if (value <= goodMax) return "OK";
  if (value <= warningMax) return "CAUTION";
  return "REVIEW";
}

function M5_healthStatus_(score) {
  if (score >= 85) return "GOOD";
  if (score >= 70) return "CAUTION";
  if (score >= 40) return "REVIEW";
  return "BLOCKED";
}

function M5_formatMigrationReport_(sheet, rowCount) {
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 320);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 520);

  sheet.getRange(1, 1, rowCount, 4).setWrap(true).setVerticalAlignment("top");

  sheet.getRange(1, 1, 1, 4)
    .merge()
    .setFontSize(16)
    .setFontWeight("bold");

  const values = sheet.getRange(1, 1, rowCount, 1).getDisplayValues();

  values.forEach(function(row, index) {
    const label = row[0];
    if (
      label === "READINESS" ||
      label === "RECOMMENDED NEXT ACTIONS" ||
      label === "MIGRATION ORDER"
    ) {
      sheet.getRange(index + 1, 1, 1, 4).setFontWeight("bold");
    }

    if (label === "Metric" || label === "Step") {
      sheet.getRange(index + 1, 1, 1, 4).setFontWeight("bold");
    }
  });
}

function M5_getMigrationReportSummary() {
  return {
    lastRun: getDocProperty_("M5_LAST_MIGRATION_REPORT") || "",
    readiness: getDocProperty_("M5_MIGRATION_READINESS") || "",
    score: Number(getDocProperty_("M5_MIGRATION_READINESS_SCORE") || 0)
  };
}

function M5_testReportBuilder() {
  const result = M5_buildMigrationReport();
  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(M5_getMigrationReportSummary()));

  if (!result.success) {
    throw new Error("Migration report builder failed.");
  }

  return true;
}
