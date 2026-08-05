/******************************************************************************
 * MelroseOS Enterprise
 * Auto-Classification & Approval Engine
 * File: AUD-06_AutoClassificationApproval.gs
 * Version: 3.0.0
 *
 * Purpose:
 *   Automatically approves ONLY high-confidence cleanup decisions from the
 *   dependency-aware v2 audit.
 *
 * SAFETY:
 *   - PROTECTED_ACTIVE => KEEP_LOCKED
 *   - ARCHIVE_SAFE => APPROVED_ARCHIVE
 *   - DELETE_SAFE => APPROVED_DELETE
 *   - MANUAL_REVIEW => left untouched unless high-confidence rules apply
 *   - Never executes cleanup itself
 *   - Never deletes or moves sheets
 *
 * Requires:
 *   AUD-03_DependencyAwareAuditor.gs
 *   AUD-05_CleanupExecutor.gs
 ******************************************************************************/

const AUD6 = {
  VERSION: "3.0.0",
  CORE_ID: "1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64",
  REVIEW_SHEET: "AUD2_CLEANUP_REVIEW",
  SUMMARY_SHEET: "AUD6_AUTO_APPROVAL_SUMMARY",

  APPROVALS: {
    KEEP: "KEEP_LOCKED",
    ARCHIVE: "APPROVED_ARCHIVE",
    DELETE: "APPROVED_DELETE",
    MANUAL: "PENDING_REVIEW"
  },

  ACTIVE_PREFIXES: [
    "AE_","LI_","NF_","AP_","CO_","OP_","AC_","LC_","AUD_","AUD2_","AUD5_","AUD6_"
  ],

  ACTIVE_EXACT_NAMES: [
    "AE_AGENTS",
    "AE_LEADS",
    "AE_ASSIGNMENTS",
    "AE_LEAD_LOCKS",
    "AE_AUDIT_LOG",
    "AE_CONFIG",
    "AE_AGENT_DISTRIBUTION_LOG",
    "AE_AGENT_ROSTER_SYNC_LOG",

    "LI_INTAKE",
    "LI_REJECTED",
    "LI_AUDIT_LOG",
    "LI_DUPLICATE_LOG",
    "LI_SOURCE_REGISTRY",

    "NF_QUEUE",
    "NF_TEMPLATES",
    "NF_AUDIT_LOG",

    "AP_APPOINTMENTS",
    "AP_ACTION_LOG",
    "AP_AUDIT_LOG",

    "LC_LEAD_LIFECYCLE",
    "LC_ACTIVITY_LOG",
    "LC_STATUS_HISTORY",

    "AC_SLA_CONFIG",
    "AC_LEAD_SLA",
    "AC_ALERT_LOG",
    "AC_AGENT_METRICS",

    "OP_RUN_LOG",
    "OP_STATUS",
    "OP_POST_LAUNCH_MONITOR",

    "CO_HEALTH_CHECK",
    "CO_SYSTEM_STATUS",
    "CO_AUDIT_LOG",

    "AUD_SYSTEM_INVENTORY",
    "AUD_CLEANUP_RECOMMENDATIONS",
    "AUD2_DEPENDENCY_INVENTORY",
    "AUD2_CLEANUP_REVIEW",
    "AUD5_CLEANUP_LOG",
    "AUD6_AUTO_APPROVAL_SUMMARY"
  ]
};

function AUD6_runAutoClassificationApproval() {
  const core = SpreadsheetApp.openById(AUD6.CORE_ID);
  const review = core.getSheetByName(AUD6.REVIEW_SHEET);

  if (!review) {
    throw new Error(
      "Missing review sheet: " + AUD6.REVIEW_SHEET
    );
  }

  const data = review.getDataRange().getValues();

  if (data.length < 2) {
    return {
      success: true,
      processed: 0,
      keepLocked: 0,
      approvedArchive: 0,
      approvedDelete: 0,
      manualReview: 0
    };
  }

  const headers = data[0].map(function(v) {
    return String(v || "").trim();
  });

  const col = {
    workbook: headers.indexOf("Workbook"),
    sheetName: headers.indexOf("SheetName"),
    classification: headers.indexOf("Classification"),
    recommendedAction: headers.indexOf("RecommendedAction"),
    confidence: headers.indexOf("Confidence"),
    evidence: headers.indexOf("Evidence"),
    approvalStatus: headers.indexOf("ApprovalStatus")
  };

  Object.keys(col).forEach(function(key) {
    if (col[key] < 0) {
      throw new Error(
        "Missing required column in " +
        AUD6.REVIEW_SHEET +
        ": " +
        key
      );
    }
  });

  const summary = {
    processed: 0,
    keepLocked: 0,
    approvedArchive: 0,
    approvedDelete: 0,
    manualReview: 0,
    changedRows: 0
  };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const workbook = String(
      row[col.workbook] || ""
    ).trim().toUpperCase();

    const sheetName = String(
      row[col.sheetName] || ""
    ).trim();

    const classification = String(
      row[col.classification] || ""
    ).trim().toUpperCase();

    const confidence = String(
      row[col.confidence] || ""
    ).trim().toUpperCase();

    const evidence = String(
      row[col.evidence] || ""
    ).trim();

    const currentApproval = String(
      row[col.approvalStatus] || ""
    ).trim().toUpperCase();

    if (!sheetName) {
      continue;
    }

    summary.processed++;

    const decision =
      AUD6_decide_(
        workbook,
        sheetName,
        classification,
        confidence,
        evidence
      );

    let approval = currentApproval;

    if (
      currentApproval === "" ||
      currentApproval === "PENDING_REVIEW"
    ) {
      approval = decision.approval;
    }

    if (
      approval !== currentApproval
    ) {
      review
        .getRange(
          i + 1,
          col.approvalStatus + 1
        )
        .setValue(
          approval
        );

      summary.changedRows++;
    }

    if (
      approval === AUD6.APPROVALS.KEEP
    ) {
      summary.keepLocked++;
    } else if (
      approval === AUD6.APPROVALS.ARCHIVE
    ) {
      summary.approvedArchive++;
    } else if (
      approval === AUD6.APPROVALS.DELETE
    ) {
      summary.approvedDelete++;
    } else {
      summary.manualReview++;
    }
  }

  AUD6_writeSummary_(
    summary
  );

  return {
    success: true,
    version: AUD6.VERSION,
    processed: summary.processed,
    changedRows: summary.changedRows,
    keepLocked: summary.keepLocked,
    approvedArchive: summary.approvedArchive,
    approvedDelete: summary.approvedDelete,
    manualReview: summary.manualReview,
    cleanupExecuted: false
  };
}

function AUD6_decide_(
  workbook,
  sheetName,
  classification,
  confidence,
  evidence
) {
  const upper =
    String(
      sheetName || ""
    ).toUpperCase();

  const protectedPrefix =
    AUD6.ACTIVE_PREFIXES.some(
      function(prefix) {
        return upper.indexOf(
          prefix
        ) === 0;
      }
    );

  const protectedExact =
    AUD6.ACTIVE_EXACT_NAMES.indexOf(
      upper
    ) !== -1;

  const dependencyEvidence =
    /(literal sheet-name reference|getSheetByName reference|constant\/config value reference|cross-workbook sheet reference|Trigger dependency|Protected MelroseOS module prefix)/i
      .test(
        evidence || ""
      );

  if (
    classification === "PROTECTED_ACTIVE" ||
    protectedPrefix ||
    protectedExact ||
    dependencyEvidence
  ) {
    return {
      approval:
        AUD6.APPROVALS.KEEP,
      reason:
        "Protected by active dependency or production-module rule."
    };
  }

  if (
    classification === "ARCHIVE_SAFE"
  ) {
    return {
      approval:
        AUD6.APPROVALS.ARCHIVE,
      reason:
        "Dependency-aware auditor marked ARCHIVE_SAFE."
    };
  }

  if (
    classification === "DELETE_SAFE"
  ) {
    return {
      approval:
        AUD6.APPROVALS.DELETE,
      reason:
        "Dependency-aware auditor marked DELETE_SAFE."
    };
  }

  if (
    classification === "MANUAL_REVIEW"
  ) {
    /*
     * High-confidence manual-review auto-resolution rules.
     *
     * We only auto-resolve obvious migration/history remnants.
     */
    if (
      /(_PREMIGRATION_|PREMIGRATION|_OLD_|^OLD_|LEGACY|DEPRECATED|OBSOLETE)/
        .test(
          upper
        )
    ) {
      return {
        approval:
          AUD6.APPROVALS.ARCHIVE,
        reason:
          "Manual-review row matched high-confidence legacy/archive naming rule."
      };
    }

    if (
      workbook !== "ARCHIVE" &&
      /^SHEET1$/
        .test(
          upper
        )
    ) {
      return {
        approval:
          AUD6.APPROVALS.DELETE,
        reason:
          "Default empty Sheet1 candidate."
      };
    }

    return {
      approval:
        AUD6.APPROVALS.MANUAL,
      reason:
        "Insufficient confidence for automatic approval."
    };
  }

  return {
    approval:
      AUD6.APPROVALS.MANUAL,
    reason:
      "No automatic rule matched."
  };
}

function AUD6_writeSummary_(
  summary
) {
  const core =
    SpreadsheetApp.openById(
      AUD6.CORE_ID
    );

  let sheet =
    core.getSheetByName(
      AUD6.SUMMARY_SHEET
    );

  if (!sheet) {
    sheet =
      core.insertSheet(
        AUD6.SUMMARY_SHEET
      );
  }

  sheet.clearContents();

  sheet
    .getRange(
      1,
      1,
      1,
      2
    )
    .setValues([[
      "Metric",
      "Value"
    ]]);

  const rows = [
    ["Version", AUD6.VERSION],
    ["Processed", summary.processed],
    ["ChangedRows", summary.changedRows],
    ["KeepLocked", summary.keepLocked],
    ["ApprovedArchive", summary.approvedArchive],
    ["ApprovedDelete", summary.approvedDelete],
    ["ManualReview", summary.manualReview],
    ["CleanupExecuted", false],
    ["UpdatedAt", new Date()]
  ];

  sheet
    .getRange(
      2,
      1,
      rows.length,
      2
    )
    .setValues(
      rows
    );

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(
    1,
    2
  );
}

function AUD6_getAutoApprovalSummary() {
  const core =
    SpreadsheetApp.openById(
      AUD6.CORE_ID
    );

  const sheet =
    core.getSheetByName(
      AUD6.REVIEW_SHEET
    );

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return {
      success: true,
      total: 0
    };
  }

  const values =
    sheet.getDataRange()
      .getValues();

  const headers =
    values.shift();

  const approvalCol =
    headers.indexOf(
      "ApprovalStatus"
    );

  const counts = {};

  values.forEach(function(row) {
    const approval =
      String(
        row[approvalCol] ||
        "BLANK"
      )
        .trim()
        .toUpperCase();

    counts[approval] =
      (counts[approval] || 0) +
      1;
  });

  return {
    success: true,
    total: values.length,
    approvals: counts
  };
}

function AUD6_testAutoClassificationApproval() {
  const result =
    AUD6_runAutoClassificationApproval();

  Logger.log(
    JSON.stringify(
      result
    )
  );

  Logger.log(
    JSON.stringify(
      AUD6_getAutoApprovalSummary()
    )
  );

  return true;
}
