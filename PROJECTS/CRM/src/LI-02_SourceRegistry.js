/******************************************************************************
 * MelroseOS Enterprise
 * Lead Intake Migration
 * File: LI-02_SourceRegistry.gs
 * Version: 1.0.0
 *
 * Requires:
 *   LI-01_Core.gs
 ******************************************************************************/

const LI_SOURCE_SHEET = "LI_SOURCE_REGISTRY";

function LI_checkSourceRegistryGuard_(){
  if(typeof MOS5D32_checkLeadIntakeGate_ === "function"){
    return MOS5D32_checkLeadIntakeGate_();
  }

  return {
    success:true,
    gate:"SOURCE_REGISTRY",
    status:"OPEN",
    checkedAt:timestamp_()
  };
}

function LI_initializeSourceRegistry() {
  LI_initializeCore();
  LI_checkSourceRegistryGuard_();

  const ss = workbook_();
  const sheet = createSheetIfMissing_(ss, LI_SOURCE_SHEET);

  LI_setHeadersIfEmpty_(sheet, [
    "SourceID",
    "SourceName",
    "SourceType",
    "Active",
    "DefaultLeadType",
    "DefaultParish",
    "Priority",
    "Notes",
    "UpdatedAt"
  ]);

  return {
    success: true,
    sources: LI_getSources().length
  };
}

function LI_upsertSource(source) {
  LI_initializeSourceRegistry();
  LI_checkSourceRegistryGuard_();

  if (!source) throw new Error("Source record is required.");

  const sheet = workbook_().getSheetByName(LI_SOURCE_SHEET);
  const sourceName = String(
    source.SourceName || source.sourceName || source.name || ""
  ).trim();

  if (!sourceName) throw new Error("SourceName is required.");

  const suppliedId = String(
    source.SourceID || source.sourceId || ""
  ).trim();

  let row = suppliedId
    ? LI_findSourceRow_("SourceID", suppliedId)
    : null;

  if (!row) row = LI_findSourceRow_("SourceName", sourceName);

  const existing = row ? LI_getSourceByRow_(row) : {};
  const sourceId = suppliedId || existing.SourceID || LI_uuid_("SRC");

  const payload = [
    sourceId,
    sourceName,
    String(
      source.SourceType ||
      source.sourceType ||
      existing.SourceType ||
      "MANUAL"
    ).trim().toUpperCase(),
    LI_booleanValue_(
      LI_pick_(source.Active, source.active, existing.Active, true)
    ),
    LI_normalizeLeadType_(
      LI_pick_(
        source.DefaultLeadType,
        source.defaultLeadType,
        existing.DefaultLeadType,
        ""
      )
    ),
    String(
      LI_pick_(
        source.DefaultParish,
        source.defaultParish,
        existing.DefaultParish,
        ""
      )
    ).trim().toUpperCase(),
    Number(
      LI_pick_(
        source.Priority,
        source.priority,
        existing.Priority,
        100
      )
    ),
    String(
      LI_pick_(source.Notes, source.notes, existing.Notes, "")
    ).trim(),
    timestamp_()
  ];

  if (row) {
    sheet.getRange(row, 1, 1, payload.length).setValues([payload]);
  } else {
    sheet.appendRow(payload);
  }

  LI_log_(
    "SOURCE_UPSERTED",
    "",
    "Lead source updated: " + sourceName + ".",
    ""
  );

  return sourceId;
}

function LI_getSources() {
  return LI_sheetObjects_(LI_SOURCE_SHEET);
}

function LI_getSource(sourceIdOrName) {
  const target = String(sourceIdOrName || "").trim();
  if (!target) return null;

  const sources = LI_getSources();

  for (let i = 0; i < sources.length; i++) {
    if (
      String(sources[i].SourceID || "").trim() === target ||
      String(sources[i].SourceName || "").trim().toLowerCase() ===
        target.toLowerCase()
    ) {
      return sources[i];
    }
  }

  return null;
}

function LI_getActiveSources() {
  return LI_getSources()
    .filter(function(source) {
      return LI_isTrue_(source.Active);
    })
    .sort(function(a, b) {
      const pa = Number(a.Priority || 100);
      const pb = Number(b.Priority || 100);

      if (pa !== pb) return pa - pb;

      return String(a.SourceName || "")
        .localeCompare(String(b.SourceName || ""));
    });
}

function LI_applySourceDefaults(lead) {
  const normalized = LI_normalizeLead_(lead || {});
  const sourceName = normalized.Source;

  if (!sourceName) return normalized;

  const source = LI_getSource(sourceName);

  if (!source || !LI_isTrue_(source.Active)) return normalized;

  if (!normalized.LeadType && source.DefaultLeadType) {
    normalized.LeadType = LI_normalizeLeadType_(source.DefaultLeadType);
  }

  if (!normalized.Parish && source.DefaultParish) {
    normalized.Parish = String(source.DefaultParish).trim().toUpperCase();
  }

  return normalized;
}

function LI_setSourceActive(sourceId, active) {
  LI_checkSourceRegistryGuard_();

  const row = LI_findSourceRow_("SourceID", sourceId);

  if (!row) throw new Error("Source not found: " + sourceId);

  const sheet = workbook_().getSheetByName(LI_SOURCE_SHEET);
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const activeCol = headers.indexOf("Active") + 1;
  const updatedCol = headers.indexOf("UpdatedAt") + 1;

  if (!activeCol) throw new Error("Active header not found.");

  sheet.getRange(row, activeCol).setValue(!!active);

  if (updatedCol) {
    sheet.getRange(row, updatedCol).setValue(timestamp_());
  }

  return true;
}

function LI_findSourceRow_(headerName, value) {
  const sheet = workbook_().getSheetByName(LI_SOURCE_SHEET);

  if (!sheet || sheet.getLastRow() < 2) return null;

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const column = headers.indexOf(headerName) + 1;

  if (!column) {
    throw new Error(
      "Header '" + headerName + "' not found in " + LI_SOURCE_SHEET + "."
    );
  }

  const values = sheet
    .getRange(2, column, sheet.getLastRow() - 1, 1)
    .getDisplayValues();

  const target = String(value || "").trim().toLowerCase();

  for (let i = 0; i < values.length; i++) {
    if (
      String(values[i][0] || "").trim().toLowerCase() === target
    ) {
      return i + 2;
    }
  }

  return null;
}

function LI_getSourceByRow_(row) {
  const sheet = workbook_().getSheetByName(LI_SOURCE_SHEET);

  if (!sheet || row < 2 || row > sheet.getLastRow()) return {};

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const values = sheet
    .getRange(row, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const result = {_row: row};

  headers.forEach(function(header, index) {
    result[String(header || "").trim()] = values[index];
  });

  return result;
}

function LI_booleanValue_(value) {
  if (typeof value === "boolean") return value;
  return String(value).toUpperCase() !== "FALSE";
}

function LI_isTrue_(value) {
  return value === true || String(value).toUpperCase() === "TRUE";
}

function LI_pick_() {
  for (let i = 0; i < arguments.length; i++) {
    const value = arguments[i];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function LI_getSourceRegistrySummary() {
  const sources = LI_getSources();

  return {
    totalSources: sources.length,
    activeSources: sources.filter(function(source) {
      return LI_isTrue_(source.Active);
    }).length,
    inactiveSources: sources.filter(function(source) {
      return !LI_isTrue_(source.Active);
    }).length
  };
}

function LI_testSourceRegistry() {
  LI_initializeSourceRegistry();

  const sourceId = LI_upsertSource({
    SourceID: "SRC-SELF-TEST",
    SourceName: "Lead Intake Self Test",
    SourceType: "TEST",
    Active: true,
    DefaultLeadType: "BUYER",
    DefaultParish: "ST. TAMMANY",
    Priority: 999,
    Notes: "Temporary self-test source."
  });

  const source = LI_getSource(sourceId);

  if (!source || source.SourceID !== "SRC-SELF-TEST") {
    throw new Error("Lead Intake Source Registry self-test failed.");
  }

  const testLead = LI_applySourceDefaults({
    FirstName: "Source",
    LastName: "Test",
    Email: "source-registry-test@example.com",
    Source: "Lead Intake Self Test"
  });

  if (
    testLead.LeadType !== "BUYER" ||
    testLead.Parish !== "ST. TAMMANY"
  ) {
    throw new Error("Lead source defaults were not applied correctly.");
  }

  Logger.log(JSON.stringify(LI_getSourceRegistrySummary()));
  return true;
}
