/******************************************************************************
 * MelroseOS Enterprise
 * System Auditor + Workbook Cleanup
 * File: AUD-01_SystemAuditor.gs
 * Version: 1.0.0
 *
 * NOTE: REPORT ONLY. This file does not delete, move, rename, or archive tabs.
 ******************************************************************************/

const AUD = {
  VERSION: "1.0.0",
  WORKBOOKS: {
    CORE: "1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64",
    CRM: "1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8",
    MARKETING: "1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo",
    WEBSITE: "1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc",
    ANALYTICS: "1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU",
    ARCHIVE: "1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk"
  },
  INVENTORY_SHEET: "AUD_SYSTEM_INVENTORY",
  RECOMMENDATIONS_SHEET: "AUD_CLEANUP_RECOMMENDATIONS"
};

function AUD_runSystemAudit() {
  const core = SpreadsheetApp.openById(AUD.WORKBOOKS.CORE);

  const inventory = AUD_resetSheet_(core, AUD.INVENTORY_SHEET, [
    "Workbook","SpreadsheetID","SheetName","Rows","Columns","CellsUsed",
    "HasData","CodeReferenced","ReferenceProjects","DuplicateGroup",
    "Classification","RecommendedAction","Reason","AuditedAt"
  ]);

  const recommendations = AUD_resetSheet_(core, AUD.RECOMMENDATIONS_SHEET, [
    "Workbook","SheetName","Classification","RecommendedAction",
    "CodeReferenced","Reason","ReviewStatus","ReviewedAt"
  ]);

  const raw = [];
  const groups = {};

  Object.keys(AUD.WORKBOOKS).forEach(function(workbookName) {
    const spreadsheetId = AUD.WORKBOOKS[workbookName];
    const ss = SpreadsheetApp.openById(spreadsheetId);

    ss.getSheets().forEach(function(sheet) {
      const name = sheet.getName();
      const normalized = AUD_normalizeName_(name);

      if (!groups[normalized]) groups[normalized] = [];
      groups[normalized].push(workbookName + "::" + name);

      raw.push({
        workbook: workbookName,
        spreadsheetId: spreadsheetId,
        sheetName: name,
        rows: sheet.getLastRow(),
        columns: sheet.getLastColumn(),
        cellsUsed: Math.max(0, sheet.getLastRow()) * Math.max(0, sheet.getLastColumn()),
        hasData: sheet.getLastRow() > 1 || sheet.getLastColumn() > 1,
        referenceProjects: AUD_referenceProjects_(name)
      });
    });
  });

  const inventoryRows = [];
  const recommendationRows = [];

  raw.forEach(function(item) {
    const duplicateGroup = (groups[AUD_normalizeName_(item.sheetName)] || []).length > 1
      ? (groups[AUD_normalizeName_(item.sheetName)] || []).join(" | ")
      : "";

    const referenced = item.referenceProjects.length > 0;
    const classification = AUD_classify_(item, referenced, duplicateGroup);
    const action = AUD_action_(item, referenced, classification);
    const reason = AUD_reason_(item, referenced, duplicateGroup, classification);

    inventoryRows.push([
      item.workbook,item.spreadsheetId,item.sheetName,item.rows,item.columns,
      item.cellsUsed,item.hasData,referenced,item.referenceProjects.join(", "),
      duplicateGroup,classification,action,reason,new Date()
    ]);

    if (classification !== "ACTIVE" || action !== "KEEP") {
      recommendationRows.push([
        item.workbook,item.sheetName,classification,action,referenced,
        reason,"PENDING_REVIEW",""
      ]);
    }
  });

  if (inventoryRows.length) {
    inventory.getRange(2,1,inventoryRows.length,inventoryRows[0].length).setValues(inventoryRows);
  }

  if (recommendationRows.length) {
    recommendations.getRange(2,1,recommendationRows.length,recommendationRows[0].length).setValues(recommendationRows);
  }

  inventory.setFrozenRows(1);
  recommendations.setFrozenRows(1);
  inventory.autoResizeColumns(1, inventory.getLastColumn());
  recommendations.autoResizeColumns(1, recommendations.getLastColumn());

  return AUD_getAuditSummary();
}

function AUD_resetSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  return sheet;
}

function AUD_referenceProjects_(sheetName) {
  const registry = typeof AUD_CODE_REFERENCES !== "undefined"
    ? AUD_CODE_REFERENCES
    : {};

  const target = String(sheetName || "").trim();
  const projects = [];

  Object.keys(registry).forEach(function(project) {
    const names = registry[project] || [];
    if (names.some(function(name) {
      return String(name || "").trim() === target;
    })) {
      projects.push(project);
    }
  });

  return projects;
}

function AUD_classify_(item, referenced, duplicateGroup) {
  const name = String(item.sheetName || "").toUpperCase();

  if (name === AUD.INVENTORY_SHEET || name === AUD.RECOMMENDATIONS_SHEET) return "ACTIVE";
  if (referenced) return "ACTIVE";

  if (/(^|[_\-\s])(TEST|DEMO|SAMPLE|SANDBOX|TMP|TEMP)([_\-\s]|$)/.test(name)) {
    return "TEST";
  }

  if (/(LEGACY|DEPRECATED|OBSOLETE|OLD|MIGRATION)/.test(name)) {
    return "LEGACY";
  }

  if (duplicateGroup && item.workbook !== "ARCHIVE") {
    return "DUPLICATE";
  }

  return "ARCHIVE_CANDIDATE";
}

function AUD_action_(item, referenced, classification) {
  if (referenced) return "KEEP";
  if (classification === "TEST") return "REVIEW_FOR_DELETE";
  if (item.workbook === "ARCHIVE") return "KEEP_IN_ARCHIVE";
  return "REVIEW_FOR_ARCHIVE";
}

function AUD_reason_(item, referenced, duplicateGroup, classification) {
  const reasons = [];
  reasons.push(referenced
    ? "Referenced by current local Apps Script source."
    : "No literal sheet-name reference found in current local Apps Script source.");
  if (!item.hasData) reasons.push("Sheet appears empty.");
  if (duplicateGroup) reasons.push("Same normalized tab name appears in multiple workbooks.");
  reasons.push("Classified as " + classification + ".");
  return reasons.join(" ");
}

function AUD_normalizeName_(name) {
  return String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function AUD_getAuditSummary() {
  const ss = SpreadsheetApp.openById(AUD.WORKBOOKS.CORE);
  const sheet = ss.getSheetByName(AUD.INVENTORY_SHEET);

  if (!sheet || sheet.getLastRow() < 2) {
    return {success:true,totalSheets:0,classifications:{},deletionPerformed:false};
  }

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const classCol = headers.indexOf("Classification");
  const counts = {};

  data.forEach(function(row) {
    const value = String(row[classCol] || "UNKNOWN");
    counts[value] = (counts[value] || 0) + 1;
  });

  return {
    success:true,
    totalSheets:data.length,
    classifications:counts,
    deletionPerformed:false
  };
}

function AUD_testSystemAuditor() {
  const result = AUD_runSystemAudit();
  Logger.log(JSON.stringify(result));
  if (!result.success) throw new Error("System Auditor failed.");
  return true;
}
