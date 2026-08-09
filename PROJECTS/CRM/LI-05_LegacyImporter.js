/******************************************************************************
 * MelroseOS Enterprise
 * Lead Intake Migration
 * File: LI-05_LegacyImporter.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Imports legacy lead rows into the normalized Lead Intake pipeline.
 *
 * Requires:
 *   LI-01 through LI-04
 ******************************************************************************/

const LI_LEGACY_IMPORT_LOG_SHEET = "LI_LEGACY_IMPORT_LOG";

function LI_initializeLegacyImporter() {
  LI_initializeDedupeEngine();

  const sheet = createSheetIfMissing_(
    workbook_(),
    LI_LEGACY_IMPORT_LOG_SHEET
  );

  LI_setHeadersIfEmpty_(sheet, [
    "ImportID",
    "SourceSheet",
    "SourceRow",
    "LeadID",
    "IntakeID",
    "Status",
    "Details",
    "ImportedAt"
  ]);

  return true;
}

function LI_importLegacySheet(sourceSheetName, limit) {
  LI_initializeLegacyImporter();

  const ss = workbook_();
  const source = ss.getSheetByName(sourceSheetName);

  if (!source) {
    throw new Error("Legacy source sheet not found: " + sourceSheetName);
  }

  if (source.getLastRow() < 2) {
    return {
      success: true,
      imported: 0,
      duplicates: 0,
      rejected: 0,
      failed: 0
    };
  }

  const max = Math.max(1, Number(limit || 500));
  const values = source.getDataRange().getValues();
  const headers = values.shift().map(function(h) {
    return String(h || "").trim();
  });

  const results = [];

  values.slice(0, max).forEach(function(row, index) {
    const sourceRow = index + 2;
    const record = {};

    headers.forEach(function(header, i) {
      record[header] = row[i];
    });

    try {
      const payload = LI_mapLegacyRecord_(record, sourceSheetName);
      const result = LI_receiveLeadWithDedupe(payload);

      LI_logLegacyImport_(
        sourceSheetName,
        sourceRow,
        result.leadId || "",
        result.intakeId || "",
        result.status || (result.success ? "IMPORTED" : "FAILED"),
        result.reason || result.matchType || ""
      );

      results.push(result);
    } catch (error) {
      LI_logLegacyImport_(
        sourceSheetName,
        sourceRow,
        "",
        "",
        "ERROR",
        error.message || String(error)
      );

      results.push({
        success: false,
        status: "ERROR",
        error: error.message || String(error)
      });
    }
  });

  return {
    success: true,
    imported: results.filter(function(r) {
      return r.success;
    }).length,
    duplicates: results.filter(function(r) {
      return r.duplicate === true;
    }).length,
    rejected: results.filter(function(r) {
      return r.status === "REJECTED";
    }).length,
    failed: results.filter(function(r) {
      return r.status === "ERROR";
    }).length,
    totalProcessed: results.length
  };
}

function LI_mapLegacyRecord_(record, sourceSheetName) {
  return {
    LeadID: LI_firstLegacyValue_(record, [
      "LeadID", "Lead ID", "ID"
    ]),
    FirstName: LI_firstLegacyValue_(record, [
      "FirstName", "First Name", "First"
    ]),
    LastName: LI_firstLegacyValue_(record, [
      "LastName", "Last Name", "Last"
    ]),
    Email: LI_firstLegacyValue_(record, [
      "Email", "Email Address", "Lead Email"
    ]),
    Phone: LI_firstLegacyValue_(record, [
      "Phone", "Phone Number", "Mobile", "Cell"
    ]),
    LeadType: LI_firstLegacyValue_(record, [
      "LeadType", "Lead Type", "Type", "Category"
    ]),
    Parish: LI_firstLegacyValue_(record, [
      "Parish", "Parish Needed", "Service Parish"
    ]),
    City: LI_firstLegacyValue_(record, [
      "City", "Lead City"
    ]),
    Source: LI_firstLegacyValue_(record, [
      "Source", "Lead Source", "Origin"
    ]) || sourceSheetName,
    SourceRecordID: LI_firstLegacyValue_(record, [
      "SourceRecordID", "Source Record ID", "RecordID"
    ])
  };
}

function LI_firstLegacyValue_(record, aliases) {
  const keys = Object.keys(record);

  for (let i = 0; i < aliases.length; i++) {
    const alias = aliases[i].toLowerCase();

    for (let j = 0; j < keys.length; j++) {
      if (String(keys[j]).trim().toLowerCase() === alias) {
        const value = record[keys[j]];

        if (
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
        ) {
          return value;
        }
      }
    }
  }

  return "";
}

function LI_logLegacyImport_(
  sourceSheet,
  sourceRow,
  leadId,
  intakeId,
  status,
  details
) {
  const sheet = workbook_().getSheetByName(
    LI_LEGACY_IMPORT_LOG_SHEET
  );

  sheet.appendRow([
    LI_uuid_("IMP"),
    sourceSheet,
    sourceRow,
    leadId,
    intakeId,
    status,
    details,
    timestamp_()
  ]);
}

function LI_getLegacyImportSummary() {
  const rows = LI_sheetObjects_(LI_LEGACY_IMPORT_LOG_SHEET);

  return {
    total: rows.length,
    imported: rows.filter(function(r) {
      return String(r.Status || "").toUpperCase() === "NEW";
    }).length,
    duplicates: rows.filter(function(r) {
      return String(r.Status || "").toUpperCase() === "DUPLICATE";
    }).length,
    rejected: rows.filter(function(r) {
      return String(r.Status || "").toUpperCase() === "REJECTED";
    }).length,
    errors: rows.filter(function(r) {
      return String(r.Status || "").toUpperCase() === "ERROR";
    }).length
  };
}

function LI_testLegacyImporter() {
  LI_initializeLegacyImporter();

  const ss = workbook_();
  const testSheetName = "LI_LEGACY_TEST";
  let sheet = ss.getSheetByName(testSheetName);

  if (!sheet) {
    sheet = ss.insertSheet(testSheetName);
  }

  clearSheet_(sheet);

  sheet.getRange(1, 1, 1, 8).setValues([[
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Lead Type",
    "Parish",
    "City",
    "Lead Source"
  ]]);

  const unique = Utilities.getUuid().substring(0, 8);

  sheet.getRange(2, 1, 1, 8).setValues([[
    "Legacy",
    "Test",
    "legacy-" + unique + "@example.com",
    "",
    "Buyer",
    "St. Tammany",
    "Mandeville",
    "Legacy Self Test"
  ]]);

  const result = LI_importLegacySheet(testSheetName, 10);

  if (!result.success || result.imported < 1) {
    throw new Error("Legacy Importer self-test failed.");
  }

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(LI_getLegacyImportSummary()));

  return true;
}
