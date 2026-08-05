/******************************************************************************
 * MelroseOS Enterprise
 * Manual Review Deep Analysis
 * File: AUD-08_ManualReviewDeepAnalysis.gs
 * Version: 5.0.0
 *
 * PURPOSE
 *   Analyze remaining PENDING_REVIEW sheets using deeper structural evidence:
 *   headers, formulas, validations, row/column usage, duplicate schema signals,
 *   active counterpart detection, workbook role, and placeholder/history patterns.
 *
 * SAFETY
 *   - ANALYSIS / APPROVAL ONLY.
 *   - Does not move, delete, rename, clear, or archive any sheet.
 *   - Does not modify Apps Script source files.
 *   - Uncertain sheets remain PENDING_REVIEW.
 ******************************************************************************/

const AUD8 = {
  VERSION: "5.0.0",

  WORKBOOKS: {
    CORE: "1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64",
    CRM: "1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8",
    MARKETING: "1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo",
    WEBSITE: "1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc",
    ANALYTICS: "1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU",
    ARCHIVE: "1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk"
  },

  CORE_ID: "1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64",

  REVIEW_SHEET: "AUD2_CLEANUP_REVIEW",
  INVENTORY_SHEET: "AUD2_DEPENDENCY_INVENTORY",
  ANALYSIS_SHEET: "AUD8_DEEP_ANALYSIS",
  SUMMARY_SHEET: "AUD8_DEEP_ANALYSIS_SUMMARY",

  APPROVALS: {
    KEEP: "KEEP_LOCKED",
    KEEP_ARCHIVE: "KEEP_IN_ARCHIVE",
    ARCHIVE: "APPROVED_ARCHIVE",
    DELETE: "APPROVED_DELETE",
    MANUAL: "PENDING_REVIEW"
  },

  ACTIVE_EXACT: [
    "AE_AGENTS","AE_LEADS","AE_ASSIGNMENTS","AE_LEAD_LOCKS","AE_CONFIG",
    "LI_INTAKE","LI_REJECTED","LI_SOURCE_REGISTRY",
    "NF_QUEUE","NF_TEMPLATES",
    "AP_APPOINTMENTS",
    "LC_LEAD_LIFECYCLE","LC_ACTIVITY_LOG","LC_STATUS_HISTORY",
    "AC_SLA_CONFIG","AC_LEAD_SLA","AC_ALERT_LOG","AC_AGENT_METRICS",
    "OP_RUN_LOG","OP_STATUS",
    "CO_HEALTH_CHECK","CO_SYSTEM_STATUS",
    "AUD2_DEPENDENCY_INVENTORY","AUD2_CLEANUP_REVIEW",
    "AUD5_CLEANUP_LOG","AUD5_CLEANUP_SUMMARY",
    "AUD6_AUTO_APPROVAL_SUMMARY",
    "AUD7_MANUAL_REVIEW_SUMMARY","AUD7_DECISION_LOG",
    "AUD8_DEEP_ANALYSIS","AUD8_DEEP_ANALYSIS_SUMMARY"
  ]
};

function AUD8_runDeepAnalysis() {
  const core = SpreadsheetApp.openById(AUD8.CORE_ID);
  const review = core.getSheetByName(AUD8.REVIEW_SHEET);

  if (!review) {
    throw new Error("Missing review sheet: " + AUD8.REVIEW_SHEET);
  }

  const reviewRows = AUD8_objects_(review);

  const pending = reviewRows.filter(function(row) {
    return String(row.ApprovalStatus || "")
      .trim()
      .toUpperCase() === AUD8.APPROVALS.MANUAL;
  });

  const analysisSheet = AUD8_reset_(core, AUD8.ANALYSIS_SHEET, [
    "Workbook","SheetName","Rows","Columns","NonBlankCells","FormulaCells",
    "ValidationCells","HeaderSignature","HasProductionHeaders",
    "HasMeaningfulData","DuplicateSchemaCount","ActiveCounterpart",
    "WorkbookRoleMatch","PlaceholderOnly","Decision","Confidence",
    "Reason","AnalyzedAt"
  ]);

  const analysisRows = [];
  const decisions = [];

  const schemaIndex = AUD8_buildSchemaIndex_();

  pending.forEach(function(row) {
    const workbook = String(row.Workbook || "").trim().toUpperCase();
    const sheetName = String(row.SheetName || "").trim();

    if (!AUD8.WORKBOOKS[workbook] || !sheetName) {
      return;
    }

    const ss = SpreadsheetApp.openById(AUD8.WORKBOOKS[workbook]);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      decisions.push({
        workbook: workbook,
        sheetName: sheetName,
        approval: AUD8.APPROVALS.MANUAL,
        confidence: "LOW",
        reason: "Source sheet is missing; no destructive decision made."
      });
      return;
    }

    const profile = AUD8_profileSheet_(sheet);
    const signature = AUD8_headerSignature_(profile.headers);
    const duplicateSchemaCount = signature
      ? Number(schemaIndex[signature] || 0)
      : 0;

    const activeCounterpart = AUD8_findActiveCounterpart_(
      workbook,
      sheetName,
      signature,
      profile,
      schemaIndex
    );

    const roleMatch = AUD8_roleMatch_(workbook, sheetName, profile.headers);
    const productionHeaders = AUD8_hasProductionHeaders_(profile.headers);
    const placeholderOnly = AUD8_isPlaceholderOnly_(profile);
    const decision = AUD8_decide_(
      workbook,
      sheetName,
      profile,
      productionHeaders,
      duplicateSchemaCount,
      activeCounterpart,
      roleMatch,
      placeholderOnly
    );

    decisions.push({
      workbook: workbook,
      sheetName: sheetName,
      approval: decision.approval,
      confidence: decision.confidence,
      reason: decision.reason
    });

    analysisRows.push([
      workbook,
      sheetName,
      profile.rows,
      profile.cols,
      profile.nonBlankCells,
      profile.formulaCells,
      profile.validationCells,
      signature,
      productionHeaders,
      profile.hasMeaningfulData,
      duplicateSchemaCount,
      activeCounterpart || "",
      roleMatch,
      placeholderOnly,
      decision.approval,
      decision.confidence,
      decision.reason,
      new Date()
    ]);
  });

  if (analysisRows.length) {
    analysisSheet
      .getRange(2,1,analysisRows.length,analysisRows[0].length)
      .setValues(analysisRows);
  }

  analysisSheet.setFrozenRows(1);
  analysisSheet.autoResizeColumns(1, analysisSheet.getLastColumn());

  const changed = AUD8_applyDecisions_(review, decisions);
  const summary = AUD8_summarize_(decisions, changed);
  AUD8_writeSummary_(core, summary);

  return summary;
}

function AUD8_profileSheet_(sheet) {
  const rows = sheet.getLastRow();
  const cols = sheet.getLastColumn();

  if (rows === 0 || cols === 0) {
    return {
      rows:0, cols:0, nonBlankCells:0, formulaCells:0,
      validationCells:0, headers:[], hasMeaningfulData:false
    };
  }

  const range = sheet.getRange(1,1,rows,cols);
  const values = range.getDisplayValues();
  const formulas = range.getFormulas();
  const validations = range.getDataValidations();

  let nonBlank = 0;
  let formulaCells = 0;
  let validationCells = 0;

  values.forEach(function(row, r) {
    row.forEach(function(value, c) {
      if (String(value || "").trim() !== "") nonBlank++;
      if (String(formulas[r][c] || "").trim() !== "") formulaCells++;
      if (validations[r][c]) validationCells++;
    });
  });

  const headers = values.length
    ? values[0].map(function(v){ return String(v || "").trim(); })
    : [];

  const hasMeaningfulData =
    rows > 1 &&
    nonBlank > headers.filter(Boolean).length;

  return {
    rows: rows,
    cols: cols,
    nonBlankCells: nonBlank,
    formulaCells: formulaCells,
    validationCells: validationCells,
    headers: headers,
    hasMeaningfulData: hasMeaningfulData
  };
}

function AUD8_buildSchemaIndex_() {
  const index = {};

  Object.keys(AUD8.WORKBOOKS).forEach(function(workbook) {
    const ss = SpreadsheetApp.openById(AUD8.WORKBOOKS[workbook]);

    ss.getSheets().forEach(function(sheet) {
      const cols = sheet.getLastColumn();
      if (cols < 1) return;

      const headers = sheet
        .getRange(1,1,1,cols)
        .getDisplayValues()[0]
        .map(function(v){ return String(v || "").trim(); });

      const sig = AUD8_headerSignature_(headers);

      if (sig) {
        index[sig] = (index[sig] || 0) + 1;
      }
    });
  });

  return index;
}

function AUD8_headerSignature_(headers) {
  const normalized = (headers || [])
    .filter(function(h){ return String(h || "").trim() !== ""; })
    .map(function(h) {
      return String(h || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_");
    });

  return normalized.length
    ? normalized.join("|")
    : "";
}

function AUD8_hasProductionHeaders_(headers) {
  const set = {};
  (headers || []).forEach(function(h) {
    set[String(h || "").trim().toUpperCase()] = true;
  });

  const important = [
    "LEADID","AGENTID","STATUS","EMAIL","PHONE","CREATEDAT","UPDATEDAT",
    "ASSIGNEDAGENTID","APPOINTMENTID","CAMPAIGNID","POSTID","LISTINGID",
    "RUNID","COMPONENT","SHEETNAME","WORKBOOK"
  ];

  let score = 0;

  important.forEach(function(h) {
    if (set[h]) score++;
  });

  return score >= 2;
}

function AUD8_findActiveCounterpart_(
  workbook,
  sheetName,
  signature,
  profile,
  schemaIndex
) {
  const upper = String(sheetName || "").toUpperCase();

  if (
    /(_PREMIGRATION_|PREMIGRATION|_OLD_|^OLD_|LEGACY|DEPRECATED|OBSOLETE|BACKUP)/
      .test(upper)
  ) {
    const stripped = upper
      .replace(/_PREMIGRATION_.*/,"")
      .replace(/PREMIGRATION.*/,"")
      .replace(/_OLD_.*/,"")
      .replace(/^OLD_/,"")
      .replace(/LEGACY/g,"")
      .replace(/DEPRECATED/g,"")
      .replace(/OBSOLETE/g,"")
      .replace(/BACKUP/g,"")
      .replace(/_+/g,"_")
      .replace(/^_|_$/g,"");

    const ss = SpreadsheetApp.openById(AUD8.WORKBOOKS[workbook]);
    const counterpart = ss.getSheets().find(function(s) {
      return s.getName().toUpperCase() === stripped;
    });

    if (counterpart) {
      return counterpart.getName();
    }
  }

  if (
    signature &&
    Number(schemaIndex[signature] || 0) > 1 &&
    profile.hasMeaningfulData
  ) {
    return "SCHEMA_DUPLICATE_EXISTS";
  }

  return "";
}

function AUD8_roleMatch_(workbook, sheetName, headers) {
  const name = String(sheetName || "").toUpperCase();
  const headerText = (headers || []).join(" ").toUpperCase();

  const patterns = {
    CORE: /(SYSTEM|WORKFLOW|MELROSEOS|SCHEDULED|TASK|REGISTRY|HEALTH|CONFIG)/,
    CRM: /(LEAD|AGENT|CONTACT|ASSIGN|APPOINT|PIPELINE|ACTIVITY|FOLLOW|NOTIFICATION)/,
    MARKETING: /(MARKETING|ADVERTISING|CAMPAIGN|EMAIL|SOCIAL|CONTENT|AI|CREATIVE|PUBLISH)/,
    WEBSITE: /(WEBSITE|WEB|LISTING|PAGE|SEO|API|SYNC|AGENT)/,
    ANALYTICS: /(ANALYTICS|METRIC|REPORT|DASHBOARD|KPI|SNAPSHOT|DOCUMENT)/,
    ARCHIVE: /.*/
  };

  const pattern = patterns[workbook] || /$a/;

  return pattern.test(name) || pattern.test(headerText);
}

function AUD8_isPlaceholderOnly_(profile) {
  if (profile.rows === 0 || profile.cols === 0) return true;

  const headerCount = (profile.headers || []).filter(function(h) {
    return String(h || "").trim() !== "";
  }).length;

  return (
    profile.rows <= 1 &&
    profile.nonBlankCells <= Math.max(1, headerCount) &&
    profile.formulaCells === 0
  );
}

function AUD8_decide_(
  workbook,
  sheetName,
  profile,
  productionHeaders,
  duplicateSchemaCount,
  activeCounterpart,
  roleMatch,
  placeholderOnly
) {
  const upper = String(sheetName || "").toUpperCase();

  if (workbook === "ARCHIVE") {
    return AUD8_result_(
      AUD8.APPROVALS.KEEP_ARCHIVE,
      "HIGH",
      "Already stored in ARCHIVE workbook."
    );
  }

  if (AUD8.ACTIVE_EXACT.indexOf(upper) !== -1) {
    return AUD8_result_(
      AUD8.APPROVALS.KEEP,
      "HIGH",
      "Known active production sheet."
    );
  }

  if (
    /(_PREMIGRATION_|PREMIGRATION|_OLD_|^OLD_|LEGACY|DEPRECATED|OBSOLETE)/
      .test(upper)
  ) {
    return AUD8_result_(
      AUD8.APPROVALS.ARCHIVE,
      "HIGH",
      activeCounterpart
        ? "Historical sheet has an active counterpart: " + activeCounterpart
        : "Historical/legacy naming pattern."
    );
  }

  if (
    /(^|[_\-\s])(TEST|DEMO|SAMPLE|SANDBOX|TMP|TEMP)([_\-\s]|$)/
      .test(upper) &&
    placeholderOnly
  ) {
    return AUD8_result_(
      AUD8.APPROVALS.DELETE,
      "HIGH",
      "Empty test/demo/temp placeholder with no meaningful data."
    );
  }

  if (
    upper === "SHEET1" &&
    placeholderOnly
  ) {
    return AUD8_result_(
      AUD8.APPROVALS.DELETE,
      "HIGH",
      "Empty default Sheet1."
    );
  }

  if (
    productionHeaders &&
    profile.hasMeaningfulData &&
    roleMatch
  ) {
    return AUD8_result_(
      AUD8.APPROVALS.KEEP,
      "HIGH",
      "Production headers, meaningful data, and workbook-role alignment."
    );
  }

  if (
    profile.formulaCells > 0 ||
    profile.validationCells > 0
  ) {
    return AUD8_result_(
      AUD8.APPROVALS.KEEP,
      "MEDIUM_HIGH",
      "Contains formulas or data validations; preserve unless manually reviewed."
    );
  }

  if (
    duplicateSchemaCount > 1 &&
    activeCounterpart &&
    !productionHeaders
  ) {
    return AUD8_result_(
      AUD8.APPROVALS.ARCHIVE,
      "MEDIUM",
      "Schema duplicate exists and no strong production-header signal was found."
    );
  }

  if (
    placeholderOnly &&
    !productionHeaders
  ) {
    return AUD8_result_(
      AUD8.APPROVALS.ARCHIVE,
      "MEDIUM",
      "Placeholder-only sheet with no strong production schema; archive rather than delete."
    );
  }

  if (
    profile.hasMeaningfulData &&
    roleMatch
  ) {
    return AUD8_result_(
      AUD8.APPROVALS.KEEP,
      "MEDIUM",
      "Contains meaningful data aligned with workbook role."
    );
  }

  return AUD8_result_(
    AUD8.APPROVALS.MANUAL,
    "LOW",
    "Still insufficient evidence for a safe automatic decision."
  );
}

function AUD8_applyDecisions_(reviewSheet, decisions) {
  const data = reviewSheet.getDataRange().getValues();
  const headers = data[0].map(function(v){ return String(v || "").trim(); });

  const workbookCol = headers.indexOf("Workbook");
  const sheetCol = headers.indexOf("SheetName");
  const approvalCol = headers.indexOf("ApprovalStatus");

  if (
    workbookCol < 0 ||
    sheetCol < 0 ||
    approvalCol < 0
  ) {
    throw new Error("AUD2_CLEANUP_REVIEW is missing required columns.");
  }

  const decisionMap = {};

  decisions.forEach(function(d) {
    decisionMap[
      d.workbook + "||" + d.sheetName
    ] = d;
  });

  let changed = 0;

  for (let r = 1; r < data.length; r++) {
    const key =
      String(data[r][workbookCol] || "").trim().toUpperCase() +
      "||" +
      String(data[r][sheetCol] || "").trim();

    const decision = decisionMap[key];

    if (!decision) continue;

    const current = String(
      data[r][approvalCol] || ""
    ).trim().toUpperCase();

    if (
      current === AUD8.APPROVALS.MANUAL &&
      decision.approval !== current
    ) {
      reviewSheet
        .getRange(r + 1, approvalCol + 1)
        .setValue(decision.approval);

      changed++;
    }
  }

  return changed;
}

function AUD8_summarize_(decisions, changed) {
  const summary = {
    success: true,
    version: AUD8.VERSION,
    processed: decisions.length,
    changedRows: changed,
    keepLocked: 0,
    keepInArchive: 0,
    approvedArchive: 0,
    approvedDelete: 0,
    stillManualReview: 0,
    cleanupExecuted: false
  };

  decisions.forEach(function(d) {
    if (d.approval === AUD8.APPROVALS.KEEP) summary.keepLocked++;
    else if (d.approval === AUD8.APPROVALS.KEEP_ARCHIVE) summary.keepInArchive++;
    else if (d.approval === AUD8.APPROVALS.ARCHIVE) summary.approvedArchive++;
    else if (d.approval === AUD8.APPROVALS.DELETE) summary.approvedDelete++;
    else summary.stillManualReview++;
  });

  return summary;
}

function AUD8_writeSummary_(core, summary) {
  let sheet = core.getSheetByName(AUD8.SUMMARY_SHEET);

  if (!sheet) {
    sheet = core.insertSheet(AUD8.SUMMARY_SHEET);
  }

  sheet.clearContents();

  const rows = [
    ["Metric","Value"],
    ["Version",summary.version],
    ["Processed",summary.processed],
    ["ChangedRows",summary.changedRows],
    ["KeepLocked",summary.keepLocked],
    ["KeepInArchive",summary.keepInArchive],
    ["ApprovedArchive",summary.approvedArchive],
    ["ApprovedDelete",summary.approvedDelete],
    ["StillManualReview",summary.stillManualReview],
    ["CleanupExecuted",false],
    ["UpdatedAt",new Date()]
  ];

  sheet.getRange(1,1,rows.length,2).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1,2);
}

function AUD8_reset_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  sheet.clearContents();
  sheet.getRange(1,1,1,headers.length).setValues([headers]);

  return sheet;
}

function AUD8_objects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(function(v) {
    return String(v || "").trim();
  });

  return values
    .filter(function(row) {
      return row.some(function(v) {
        return String(v || "").trim() !== "";
      });
    })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) {
        obj[h] = row[i];
      });
      return obj;
    });
}

function AUD8_result_(approval, confidence, reason) {
  return {
    approval: approval,
    confidence: confidence,
    reason: reason
  };
}

function AUD8_testManualReviewDeepAnalysis() {
  const result = AUD8_runDeepAnalysis();

  Logger.log(JSON.stringify(result));

  if (!result.success) {
    throw new Error("Manual Review Deep Analysis v5 failed.");
  }

  return true;
}
