/******************************************************************************
 * MelroseOS Enterprise
 * Manual Review Reduction Engine
 * File: AUD-07_ManualReviewReduction.gs
 * Version: 4.0.0
 *
 * PURPOSE
 *   Reduce PENDING_REVIEW rows using conservative workbook-role, schema,
 *   content, naming, archive, and dependency evidence.
 *
 * SAFETY
 *   - REPORT/APPROVAL ONLY. Does not move, delete, rename, or clear sheets.
 *   - ARCHIVE workbook => KEEP_IN_ARCHIVE.
 *   - Existing KEEP_LOCKED is preserved.
 *   - Dependency evidence => KEEP_LOCKED.
 *   - High-confidence production schemas => KEEP_LOCKED.
 *   - High-confidence obsolete/history patterns => APPROVED_ARCHIVE.
 *   - Empty/default/test sheets may => APPROVED_DELETE.
 *   - Uncertain rows remain PENDING_REVIEW.
 ******************************************************************************/

const AUD7 = {
  VERSION: "4.0.0",
  CORE_ID: "1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64",
  REVIEW_SHEET: "AUD2_CLEANUP_REVIEW",
  INVENTORY_SHEET: "AUD2_DEPENDENCY_INVENTORY",
  SUMMARY_SHEET: "AUD7_MANUAL_REVIEW_SUMMARY",
  DECISIONS_SHEET: "AUD7_DECISION_LOG",

  APPROVALS: {
    KEEP: "KEEP_LOCKED",
    KEEP_ARCHIVE: "KEEP_IN_ARCHIVE",
    ARCHIVE: "APPROVED_ARCHIVE",
    DELETE: "APPROVED_DELETE",
    MANUAL: "PENDING_REVIEW"
  },

  ROLE_PREFIXES: {
    CORE: [
      "MELROSEOS_","WORKFLOW","SYSTEM","SCHEDULED","ARCHITECTURE",
      "OP_","CO_","AUD","AC_"
    ],
    CRM: [
      "AE_","LI_","NF_","AP_","LC_","CRM_","LEAD","CONTACT",
      "AGENT","APPOINTMENT"
    ],
    MARKETING: [
      "MARKETING","ADVERTISING","EMAIL","SOCIAL","AI","CONTENT",
      "CAMPAIGN","NOTIFICATION"
    ],
    WEBSITE: [
      "WEBSITE","WEB","FEATURED","LISTING","AGENT","CITY","PAGE",
      "SEO","FORM"
    ],
    ANALYTICS: [
      "ANALYTICS","METRIC","REPORT","DASHBOARD","KPI","SNAPSHOT"
    ]
  },

  PRODUCTION_HEADER_GROUPS: [
    ["AGENTID","AGENTNAME"],
    ["LEADID"],
    ["RUNID","STATUS"],
    ["COMPONENT","MODE","STATUS"],
    ["WORKBOOK","SHEETNAME","CLASSIFICATION"],
    ["APPOINTMENTID"],
    ["CAMPAIGNID"],
    ["POSTID"],
    ["LISTINGID"],
    ["EMAIL"],
    ["UPDATEDAT"]
  ]
};

function AUD7_runManualReviewReduction() {
  const core = SpreadsheetApp.openById(AUD7.CORE_ID);
  const review = core.getSheetByName(AUD7.REVIEW_SHEET);
  const inventory = core.getSheetByName(AUD7.INVENTORY_SHEET);

  if (!review || !inventory) {
    throw new Error("AUD2 review or inventory sheet is missing.");
  }

  const reviewData = review.getDataRange().getValues();
  if (reviewData.length < 2) {
    return {success:true, version:AUD7.VERSION, processed:0};
  }

  const headers = reviewData[0].map(function(v){ return String(v || "").trim(); });
  const idx = AUD7_index_(headers, [
    "Workbook","SheetName","Classification","Confidence",
    "Evidence","ApprovalStatus"
  ]);

  const inventoryMap = AUD7_inventoryMap_(inventory);
  const decisionRows = [];

  const summary = {
    processed: 0,
    changedRows: 0,
    keepLocked: 0,
    keepInArchive: 0,
    approvedArchive: 0,
    approvedDelete: 0,
    manualReview: 0
  };

  for (let r = 1; r < reviewData.length; r++) {
    const row = reviewData[r];
    const workbook = String(row[idx.Workbook] || "").trim().toUpperCase();
    const sheetName = String(row[idx.SheetName] || "").trim();
    const classification = String(row[idx.Classification] || "").trim().toUpperCase();
    const evidence = String(row[idx.Evidence] || "").trim();
    const current = String(row[idx.ApprovalStatus] || "").trim().toUpperCase();

    if (!workbook || !sheetName) continue;
    summary.processed++;

    const inv = inventoryMap[workbook + "||" + sheetName] || {};
    const decision = AUD7_decide_(workbook, sheetName, classification, evidence, current, inv);

    if (decision.approval !== current) {
      review.getRange(r + 1, idx.ApprovalStatus + 1).setValue(decision.approval);
      summary.changedRows++;
    }

    if (decision.approval === AUD7.APPROVALS.KEEP) summary.keepLocked++;
    else if (decision.approval === AUD7.APPROVALS.KEEP_ARCHIVE) summary.keepInArchive++;
    else if (decision.approval === AUD7.APPROVALS.ARCHIVE) summary.approvedArchive++;
    else if (decision.approval === AUD7.APPROVALS.DELETE) summary.approvedDelete++;
    else summary.manualReview++;

    decisionRows.push([
      workbook, sheetName, current, decision.approval,
      decision.confidence, decision.reason, new Date()
    ]);
  }

  AUD7_writeDecisionLog_(core, decisionRows);
  AUD7_writeSummary_(core, summary);

  return {
    success: true,
    version: AUD7.VERSION,
    processed: summary.processed,
    changedRows: summary.changedRows,
    keepLocked: summary.keepLocked,
    keepInArchive: summary.keepInArchive,
    approvedArchive: summary.approvedArchive,
    approvedDelete: summary.approvedDelete,
    manualReview: summary.manualReview,
    cleanupExecuted: false
  };
}

function AUD7_decide_(workbook, sheetName, classification, evidence, current, inv) {
  const upper = sheetName.toUpperCase();

  if (workbook === "ARCHIVE") {
    return AUD7_result_("KEEP_IN_ARCHIVE","HIGH",
      "Sheet is already in the ARCHIVE workbook; exclude from future cleanup.");
  }

  if (current === "KEEP_LOCKED" || classification === "PROTECTED_ACTIVE") {
    return AUD7_result_("KEEP_LOCKED","HIGH",
      "Existing protection or dependency-aware classification preserved.");
  }

  if (AUD7_hasDependency_(evidence, inv)) {
    return AUD7_result_("KEEP_LOCKED","HIGH",
      "Current dependency evidence protects this sheet.");
  }

  const rows = Number(inv.Rows || 0);
  const cols = Number(inv.Columns || 0);
  const hasData = AUD7_bool_(inv.HasData);

  if (AUD7_isKnownAuditInfrastructure_(upper)) {
    return AUD7_result_("KEEP_LOCKED","HIGH",
      "Current MelroseOS audit/operations infrastructure.");
  }

  if (AUD7_matchesWorkbookRole_(workbook, upper) &&
      AUD7_hasProductionSchemaSignal_(inv)) {
    return AUD7_result_("KEEP_LOCKED","MEDIUM_HIGH",
      "Sheet name matches workbook role and contains production-like schema/data.");
  }

  if (AUD7_isHistoricalName_(upper)) {
    return AUD7_result_("APPROVED_ARCHIVE","HIGH",
      "Historical, migration, legacy, old, deprecated, or obsolete naming pattern.");
  }

  if (AUD7_isDefaultOrTemp_(upper) && !hasData && rows <= 1 && cols <= 1) {
    return AUD7_result_("APPROVED_DELETE","HIGH",
      "Empty default/temp/test sheet with no dependency evidence.");
  }

  if (classification === "ARCHIVE_SAFE") {
    return AUD7_result_("APPROVED_ARCHIVE","HIGH",
      "Dependency-aware audit classified sheet ARCHIVE_SAFE.");
  }

  if (classification === "DELETE_SAFE") {
    return AUD7_result_("APPROVED_DELETE","HIGH",
      "Dependency-aware audit classified sheet DELETE_SAFE.");
  }

  if (hasData && AUD7_matchesWorkbookRole_(workbook, upper)) {
    return AUD7_result_("KEEP_LOCKED","MEDIUM",
      "Contains data and naming aligns with workbook operational role.");
  }

  return AUD7_result_("PENDING_REVIEW","LOW",
    "Insufficient evidence for safe automatic disposition.");
}

function AUD7_hasDependency_(evidence, inv) {
  const pattern =
    /(literal sheet-name reference|getSheetByName reference|constant\/config value reference|cross-workbook sheet reference|Trigger dependency|Protected MelroseOS module prefix)/i;

  if (pattern.test(evidence || "")) return true;

  return AUD7_bool_(inv.LiteralReference) ||
         AUD7_bool_(inv.GetSheetReference) ||
         AUD7_bool_(inv.ConstantReference) ||
         AUD7_bool_(inv.CrossWorkbookReference) ||
         AUD7_bool_(inv.TriggerRelated) ||
         AUD7_bool_(inv.ProtectedPrefix);
}

function AUD7_matchesWorkbookRole_(workbook, upper) {
  const prefixes = AUD7.ROLE_PREFIXES[workbook] || [];
  return prefixes.some(function(prefix) {
    return upper.indexOf(prefix) === 0 || upper.indexOf(prefix) !== -1;
  });
}

function AUD7_hasProductionSchemaSignal_(inv) {
  const rows = Number(inv.Rows || 0);
  const cols = Number(inv.Columns || 0);
  return rows > 1 || cols > 2;
}

function AUD7_isHistoricalName_(upper) {
  return /(_PREMIGRATION_|PREMIGRATION|_OLD_|^OLD_|LEGACY|DEPRECATED|OBSOLETE|BACKUP|ARCHIVED|HISTORY_COPY)/.test(upper);
}

function AUD7_isDefaultOrTemp_(upper) {
  return upper === "SHEET1" ||
    /(^|[_\-\s])(TEST|DEMO|SAMPLE|SANDBOX|TMP|TEMP)([_\-\s]|$)/.test(upper);
}

function AUD7_isKnownAuditInfrastructure_(upper) {
  return /^(AUD2_|AUD5_|AUD6_|AUD7_|OP_|CO_|AC_)/.test(upper);
}

function AUD7_inventoryMap_(sheet) {
  const objects = AUD7_objects_(sheet);
  const map = {};
  objects.forEach(function(o) {
    const key =
      String(o.Workbook || "").trim().toUpperCase() +
      "||" +
      String(o.SheetName || "").trim();
    map[key] = o;
  });
  return map;
}

function AUD7_index_(headers, required) {
  const result = {};
  required.forEach(function(name) {
    const i = headers.indexOf(name);
    if (i < 0) throw new Error("Missing required column: " + name);
    result[name] = i;
  });
  return result;
}

function AUD7_objects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(function(v){ return String(v || "").trim(); });
  return values.filter(function(row) {
    return row.some(function(v){ return String(v || "").trim() !== ""; });
  }).map(function(row) {
    const o = {};
    headers.forEach(function(h,i){ o[h] = row[i]; });
    return o;
  });
}

function AUD7_bool_(value) {
  return value === true || String(value || "").trim().toUpperCase() === "TRUE";
}

function AUD7_result_(approval, confidence, reason) {
  return {approval:approval, confidence:confidence, reason:reason};
}

function AUD7_writeDecisionLog_(core, rows) {
  let sheet = core.getSheetByName(AUD7.DECISIONS_SHEET);
  if (!sheet) sheet = core.insertSheet(AUD7.DECISIONS_SHEET);
  sheet.clearContents();

  const headers = [
    "Workbook","SheetName","PreviousApproval","NewApproval",
    "DecisionConfidence","DecisionReason","EvaluatedAt"
  ];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);

  if (rows.length) {
    sheet.getRange(2,1,rows.length,headers.length).setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1,headers.length);
}

function AUD7_writeSummary_(core, s) {
  let sheet = core.getSheetByName(AUD7.SUMMARY_SHEET);
  if (!sheet) sheet = core.insertSheet(AUD7.SUMMARY_SHEET);
  sheet.clearContents();

  const rows = [
    ["Metric","Value"],
    ["Version",AUD7.VERSION],
    ["Processed",s.processed],
    ["ChangedRows",s.changedRows],
    ["KeepLocked",s.keepLocked],
    ["KeepInArchive",s.keepInArchive],
    ["ApprovedArchive",s.approvedArchive],
    ["ApprovedDelete",s.approvedDelete],
    ["ManualReview",s.manualReview],
    ["CleanupExecuted",false],
    ["UpdatedAt",new Date()]
  ];

  sheet.getRange(1,1,rows.length,2).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1,2);
}

function AUD7_testManualReviewReduction() {
  const result = AUD7_runManualReviewReduction();
  Logger.log(JSON.stringify(result));

  if (!result.success) {
    throw new Error("Manual Review Reduction v4 failed.");
  }

  return true;
}
