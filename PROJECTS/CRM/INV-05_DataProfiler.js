/****************************************************************************
 * MelroseOS Enterprise
 * Module 0 - Inventory & Diagnostics
 * File: INV-05_DataProfiler.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Profiles workbook data quality by sheet and column.
 *
 * Requires:
 *   INV-01_Core.gs
 *   INV-03_SheetScanner.gs
 *   INV-04_HeaderScanner.gs
 ****************************************************************************/

const M5_PROFILE_SHEET = "DATA_PROFILE";
const M5_PROFILE_ISSUES_SHEET = "DATA_QUALITY_ISSUES";

function M5_runDataProfiler() {
  const ss = workbook_();
  const startedAt = new Date();
  const profileSheet = createSheetIfMissing_(ss, M5_PROFILE_SHEET);
  const issuesSheet = createSheetIfMissing_(ss, M5_PROFILE_ISSUES_SHEET);

  clearSheet_(profileSheet);
  clearSheet_(issuesSheet);

  const profileHeaders = [
    "Workbook", "SheetID", "Sheet Name", "ColumnID", "Column",
    "Column Letter", "Header", "Normalized Header", "Data Rows",
    "Nonblank", "Blank", "Completeness %", "Unique Nonblank",
    "Duplicate Values", "Formula Cells", "Checkbox Cells", "Text",
    "Number", "Date", "Boolean", "Email", "URL", "Likely Key",
    "Likely Required", "Suggested Type", "Status", "Scanned"
  ];

  const issueHeaders = [
    "IssueID", "Severity", "SheetID", "Sheet Name", "ColumnID",
    "Column", "Header", "Issue Type", "Affected Count", "Examples",
    "Recommendation", "Detected"
  ];

  setHeaders_(profileSheet, profileHeaders);
  setHeaders_(issuesSheet, issueHeaders);

  const profileRows = [];
  const issueRows = [];
  const excluded = getM5InventoryOutputSheets_();

  ss.getSheets().forEach(function(sheet, sheetIndex) {
    if (excluded.indexOf(sheet.getName()) !== -1) return;
    const result = profileM5Sheet_(sheet, sheetIndex + 1);
    Array.prototype.push.apply(profileRows, result.profileRows);
    Array.prototype.push.apply(issueRows, result.issueRows);
  });

  if (profileRows.length) {
    profileSheet.getRange(2, 1, profileRows.length, profileHeaders.length).setValues(profileRows);
  }
  if (issueRows.length) {
    issuesSheet.getRange(2, 1, issueRows.length, issueHeaders.length).setValues(issueRows);
  }

  formatM5ProfileSheet_(profileSheet);
  formatM5IssuesSheet_(issuesSheet);

  setDocProperty_("M5_LAST_DATA_PROFILE", startedAt.toISOString());
  setDocProperty_("M5_DATA_PROFILE_COLUMNS", String(profileRows.length));
  setDocProperty_("M5_DATA_PROFILE_ISSUES", String(issueRows.length));

  logMessage_("DATA PROFILE", "Complete. Columns: " + profileRows.length + ", Issues: " + issueRows.length);

  return {
    success: true,
    columnsProfiled: profileRows.length,
    issuesFound: issueRows.length,
    durationSeconds: Math.round((new Date() - startedAt) / 1000)
  };
}

function profileM5Sheet_(sheet, sheetNumber) {
  const profileRows = [];
  const issueRows = [];
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) return { profileRows: profileRows, issueRows: issueRows };

  const sheetId = buildSheetID_(sheetNumber);
  const workbookName = workbook_().getName();
  const dataRowCount = Math.max(lastRow - 1, 0);
  const headerValues = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];

  let rawValues = [];
  let displayValues = [];
  let formulas = [];
  let validations = [];

  if (dataRowCount > 0) {
    const range = sheet.getRange(2, 1, dataRowCount, lastColumn);
    rawValues = range.getValues();
    displayValues = range.getDisplayValues();
    formulas = range.getFormulas();
    validations = range.getDataValidations();
  }

  headerValues.forEach(function(header, columnIndex) {
    const columnNumber = columnIndex + 1;
    const columnId = buildColumnID_(sheetNumber, columnNumber);
    const normalizedHeader = normalizeHeader_(header);
    const rawColumn = rawValues.map(function(row) { return row[columnIndex]; });
    const displayColumn = displayValues.map(function(row) { return row[columnIndex]; });
    const formulaColumn = formulas.map(function(row) { return row[columnIndex]; });
    const validationColumn = validations.map(function(row) { return row[columnIndex]; });

    const stats = analyzeM5Column_(rawColumn, displayColumn, formulaColumn, validationColumn, normalizedHeader);
    const status = determineM5ColumnStatus_(header, stats);
    const likelyKey = isLikelyM5Key_(normalizedHeader, stats);
    const likelyRequired = isLikelyM5Required_(normalizedHeader);

    profileRows.push([
      workbookName, sheetId, sheet.getName(), columnId, columnNumber,
      columnLetter_(columnNumber), safe_(header), normalizedHeader,
      dataRowCount, stats.nonblank, stats.blank, stats.completeness,
      stats.uniqueCount, stats.duplicateCount, stats.formulaCount,
      stats.checkboxCount, stats.typeCounts.TEXT, stats.typeCounts.NUMBER,
      stats.typeCounts.DATE, stats.typeCounts.BOOLEAN, stats.typeCounts.EMAIL,
      stats.typeCounts.URL, likelyKey, likelyRequired, stats.suggestedType,
      status, timestamp_()
    ]);

    appendM5ColumnIssues_(
      issueRows, sheetId, sheet.getName(), columnId, columnNumber,
      header, normalizedHeader, dataRowCount, stats, likelyKey, likelyRequired
    );
  });

  appendM5SheetLevelIssues_(issueRows, sheet, sheetId, headerValues, dataRowCount);
  return { profileRows: profileRows, issueRows: issueRows };
}

function analyzeM5Column_(rawValues, displayValues, formulas, validations, normalizedHeader) {
  const total = rawValues.length;
  const typeCounts = { TEXT: 0, NUMBER: 0, DATE: 0, BOOLEAN: 0, EMAIL: 0, URL: 0, EMPTY: 0 };
  const frequency = {};
  const examples = { invalidEmail: [], invalidUrl: [], invalidPhone: [], invalidDate: [], duplicates: [] };
  let blank = 0;
  let nonblank = 0;
  let formulaCount = 0;
  let checkboxCount = 0;

  rawValues.forEach(function(value, index) {
    const displayValue = displayValues[index];
    const formula = formulas[index];
    const validation = validations[index];

    if (formula) formulaCount++;
    if (isM5CheckboxValidation_(validation)) checkboxCount++;

    if (isM5Blank_(value, displayValue)) {
      blank++;
      typeCounts.EMPTY++;
      return;
    }

    nonblank++;
    const detectedType = detectM5ValueType_(value, displayValue);
    typeCounts[detectedType]++;

    const key = normalizeM5DuplicateValue_(displayValue);
    if (key) frequency[key] = (frequency[key] || 0) + 1;

    if (isM5EmailHeader_(normalizedHeader) && !isValidM5Email_(String(displayValue))) {
      addM5Example_(examples.invalidEmail, displayValue);
    }
    if (isM5UrlHeader_(normalizedHeader) && !isValidM5Url_(String(displayValue))) {
      addM5Example_(examples.invalidUrl, displayValue);
    }
    if (isM5PhoneHeader_(normalizedHeader) && !isValidM5Phone_(String(displayValue))) {
      addM5Example_(examples.invalidPhone, displayValue);
    }
    if (isM5DateHeader_(normalizedHeader) && !isValidM5DateValue_(value, displayValue)) {
      addM5Example_(examples.invalidDate, displayValue);
    }
  });

  let uniqueCount = 0;
  let duplicateCount = 0;
  Object.keys(frequency).forEach(function(key) {
    uniqueCount++;
    if (frequency[key] > 1) {
      duplicateCount += frequency[key] - 1;
      addM5Example_(examples.duplicates, key);
    }
  });

  return {
    total: total,
    nonblank: nonblank,
    blank: blank,
    completeness: total ? Math.round((nonblank / total) * 10000) / 100 : 100,
    uniqueCount: uniqueCount,
    duplicateCount: duplicateCount,
    formulaCount: formulaCount,
    checkboxCount: checkboxCount,
    typeCounts: typeCounts,
    suggestedType: suggestM5ColumnType_(typeCounts, nonblank, normalizedHeader),
    examples: examples
  };
}

function appendM5ColumnIssues_(issueRows, sheetId, sheetName, columnId, columnNumber, header, normalizedHeader, dataRowCount, stats, likelyKey, likelyRequired) {
  if (!String(header).trim()) {
    pushM5Issue_(issueRows, "HIGH", sheetId, sheetName, columnId, columnNumber, header,
      "BLANK_HEADER", 1, "", "Add a unique header name before migration.");
  }

  if (likelyRequired && dataRowCount > 0 && stats.blank > 0) {
    pushM5Issue_(issueRows, stats.completeness < 80 ? "HIGH" : "MEDIUM",
      sheetId, sheetName, columnId, columnNumber, header,
      "BLANK_REQUIRED_VALUES", stats.blank, "",
      "Complete missing values or define an approved default.");
  }

  if (likelyKey && stats.duplicateCount > 0) {
    pushM5Issue_(issueRows, "CRITICAL", sheetId, sheetName, columnId, columnNumber, header,
      "DUPLICATE_KEY_VALUES", stats.duplicateCount,
      stats.examples.duplicates.join(" | "),
      "Resolve duplicate identifiers before migration.");
  }

  if (isM5EmailHeader_(normalizedHeader) && stats.examples.invalidEmail.length > 0) {
    pushM5Issue_(issueRows, "HIGH", sheetId, sheetName, columnId, columnNumber, header,
      "INVALID_EMAIL", stats.examples.invalidEmail.length,
      stats.examples.invalidEmail.join(" | "),
      "Correct or remove invalid email addresses.");
  }

  if (isM5UrlHeader_(normalizedHeader) && stats.examples.invalidUrl.length > 0) {
    pushM5Issue_(issueRows, "MEDIUM", sheetId, sheetName, columnId, columnNumber, header,
      "INVALID_URL", stats.examples.invalidUrl.length,
      stats.examples.invalidUrl.join(" | "),
      "Use complete http:// or https:// URLs.");
  }

  if (isM5PhoneHeader_(normalizedHeader) && stats.examples.invalidPhone.length > 0) {
    pushM5Issue_(issueRows, "MEDIUM", sheetId, sheetName, columnId, columnNumber, header,
      "INVALID_PHONE", stats.examples.invalidPhone.length,
      stats.examples.invalidPhone.join(" | "),
      "Normalize phone numbers to a valid 10-digit format.");
  }

  if (isM5DateHeader_(normalizedHeader) && stats.examples.invalidDate.length > 0) {
    pushM5Issue_(issueRows, "MEDIUM", sheetId, sheetName, columnId, columnNumber, header,
      "INVALID_DATE", stats.examples.invalidDate.length,
      stats.examples.invalidDate.join(" | "),
      "Convert text dates into valid spreadsheet dates.");
  }

  if (dataRowCount > 0 && stats.nonblank === 0) {
    pushM5Issue_(issueRows, "LOW", sheetId, sheetName, columnId, columnNumber, header,
      "EMPTY_COLUMN", dataRowCount, "", "Confirm whether this column is needed.");
  }

  const populatedTypes = [
    stats.typeCounts.TEXT, stats.typeCounts.NUMBER, stats.typeCounts.DATE,
    stats.typeCounts.BOOLEAN, stats.typeCounts.EMAIL, stats.typeCounts.URL
  ].filter(function(count) { return count > 0; }).length;

  if (populatedTypes > 1 && stats.nonblank >= 3) {
    pushM5Issue_(issueRows, "LOW", sheetId, sheetName, columnId, columnNumber, header,
      "MIXED_DATA_TYPES", stats.nonblank, "",
      "Review and normalize the column to one primary data type.");
  }
}

function appendM5SheetLevelIssues_(issueRows, sheet, sheetId, headerValues, dataRowCount) {
  const normalized = headerValues.map(function(header) { return normalizeHeader_(header); });
  const frequency = {};
  normalized.forEach(function(header) {
    if (!header) return;
    frequency[header] = (frequency[header] || 0) + 1;
  });

  Object.keys(frequency).forEach(function(header) {
    if (frequency[header] > 1) {
      pushM5Issue_(issueRows, "HIGH", sheetId, sheet.getName(), "", "", header,
        "DUPLICATE_HEADER", frequency[header], header,
        "Rename duplicate headers so every column has a unique name.");
    }
  });

  if (dataRowCount === 0) {
    pushM5Issue_(issueRows, "LOW", sheetId, sheet.getName(), "", "", "",
      "NO_DATA_ROWS", 0, "", "Confirm whether this sheet is intentionally empty.");
  }
}

function pushM5Issue_(issueRows, severity, sheetId, sheetName, columnId, columnNumber, header, issueType, affectedCount, examples, recommendation) {
  issueRows.push([
    "ISS-" + Utilities.getUuid().substring(0, 8).toUpperCase(),
    severity, sheetId, sheetName, columnId, columnNumber, safe_(header),
    issueType, affectedCount, safe_(examples), recommendation, timestamp_()
  ]);
}

function getM5InventoryOutputSheets_() {
  return [
    M5.INVENTORY_SHEET,
    M5.SCHEMA_SHEET,
    M5.SCRIPT_SHEET,
    M5.DIAGNOSTIC_SHEET,
    M5.REPORT_SHEET,
    M5_PROFILE_SHEET,
    M5_PROFILE_ISSUES_SHEET
  ];
}

function determineM5ColumnStatus_(header, stats) {
  if (!String(header).trim()) return "REVIEW";
  if (stats.nonblank === 0 && stats.total > 0) return "EMPTY";
  if (stats.completeness < 80) return "INCOMPLETE";
  if (stats.duplicateCount > 0) return "DUPLICATES";
  return "OK";
}

function isLikelyM5Key_(header, stats) {
  if (!header) return false;
  const compact = header.replace(/_/g, "");
  const keyNames = [
    "id", "leadid", "agentid", "contactid", "listingid", "propertyid",
    "appointmentid", "taskid", "assignmentid", "credentialnumber", "email"
  ];
  if (keyNames.indexOf(compact) !== -1) return true;
  return stats.nonblank >= 3 && stats.duplicateCount === 0 &&
    stats.uniqueCount === stats.nonblank && /(^|_)id$/.test(header);
}

function isLikelyM5Required_(header) {
  const compact = String(header || "").replace(/_/g, "");
  return [
    "id", "leadid", "agentid", "contactid", "firstname", "lastname",
    "name", "email", "phone", "status", "createdat", "updatedat"
  ].indexOf(compact) !== -1;
}

function detectM5ValueType_(rawValue, displayValue) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) return "DATE";
  if (typeof rawValue === "boolean") return "BOOLEAN";
  if (typeof rawValue === "number" && isFinite(rawValue)) return "NUMBER";
  const text = String(displayValue || "").trim();
  if (isValidM5Email_(text)) return "EMAIL";
  if (isValidM5Url_(text)) return "URL";
  return "TEXT";
}

function suggestM5ColumnType_(typeCounts, nonblank, header) {
  if (nonblank === 0) return inferM5TypeFromHeader_(header);
  const candidates = [
    ["TEXT", typeCounts.TEXT], ["NUMBER", typeCounts.NUMBER],
    ["DATE", typeCounts.DATE], ["BOOLEAN", typeCounts.BOOLEAN],
    ["EMAIL", typeCounts.EMAIL], ["URL", typeCounts.URL]
  ];
  candidates.sort(function(a, b) { return b[1] - a[1]; });
  const inferred = inferM5TypeFromHeader_(header);
  if (inferred !== "TEXT" && candidates[0][1] / nonblank < 0.8) return inferred;
  return candidates[0][0];
}

function inferM5TypeFromHeader_(header) {
  if (isM5EmailHeader_(header)) return "EMAIL";
  if (isM5UrlHeader_(header)) return "URL";
  if (isM5DateHeader_(header)) return "DATE";
  if (isM5PhoneHeader_(header)) return "PHONE";
  if (/(amount|price|cost|balance|score|count|quantity|weight|percent|rate)/.test(header)) return "NUMBER";
  if (/(active|enabled|approved|confirmed|paused|hidden|deleted)/.test(header)) return "BOOLEAN";
  return "TEXT";
}

function isM5Blank_(rawValue, displayValue) {
  if (rawValue === null || rawValue === undefined) return true;
  return String(displayValue === undefined ? rawValue : displayValue).trim() === "";
}

function normalizeM5DuplicateValue_(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isM5CheckboxValidation_(validation) {
  return validation && validation.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX;
}

function isM5EmailHeader_(header) {
  return /(^|_)(email|emailaddress|email_address)($|_)/.test(String(header || ""));
}

function isM5UrlHeader_(header) {
  return /(url|link|website|webapp|photo|image|toururl)/.test(String(header || ""));
}

function isM5PhoneHeader_(header) {
  return /(phone|mobile|cell|telephone)/.test(String(header || ""));
}

function isM5DateHeader_(header) {
  return /(date|created|updated|modified|timestamp|expiration|effective|issuance|appointment)/.test(String(header || ""));
}

function isValidM5Email_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || "").trim());
}

function isValidM5Url_(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value || "").trim());
}

function isValidM5Phone_(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.charAt(0) === "1");
}

function isValidM5DateValue_(rawValue, displayValue) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) return true;
  if (typeof rawValue === "number" && isFinite(rawValue)) return true;
  const text = String(displayValue || "").trim();
  if (!text) return true;
  return !isNaN(new Date(text).getTime());
}

function addM5Example_(list, value) {
  if (list.length >= 5) return;
  const text = String(value || "").trim();
  if (text && list.indexOf(text) === -1) list.push(text);
}

function formatM5ProfileSheet_(sheet) {
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 12, sheet.getLastRow() - 1, 1).setNumberFormat("0.00");
  }

  sheet.setFrozenRows(1);

  if (sheet.getLastRow() > 1 && !sheet.getFilter()) {
    sheet.getDataRange().createFilter();
  }

  autoResize_(sheet);
}

function formatM5IssuesSheet_(sheet) {
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() > 1 && !sheet.getFilter()) {
    sheet.getDataRange().createFilter();
  }

  autoResize_(sheet);
}

function M5_getDataProfileSummary() {
  const ss = workbook_();
  const profileSheet = ss.getSheetByName(M5_PROFILE_SHEET);
  const issuesSheet = ss.getSheetByName(M5_PROFILE_ISSUES_SHEET);
  return {
    lastRun: getDocProperty_("M5_LAST_DATA_PROFILE") || "",
    columnsProfiled: profileSheet ? Math.max(profileSheet.getLastRow() - 1, 0) : 0,
    issuesFound: issuesSheet ? Math.max(issuesSheet.getLastRow() - 1, 0) : 0
  };
}

function M5_testDataProfiler() {
  const result = M5_runDataProfiler();
  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(M5_getDataProfileSummary()));
  return result.success;
}
