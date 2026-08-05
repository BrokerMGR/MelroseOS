/******************************************************************************
 * MelroseOS Enterprise
 * Safe Revalidation Cleanup Executor
 * File: AUD-05_CleanupExecutor.gs
 * Version: 2.1.0
 *
 * OVERWRITES v2 using the exact production filename.
 *
 * FIX:
 *   Allows a row originally classified MANUAL_REVIEW to be processed when a
 *   later approved analysis layer (AUD6/AUD7/AUD8) has explicitly changed
 *   ApprovalStatus to APPROVED_ARCHIVE or APPROVED_DELETE.
 *
 * SAFETY:
 *   - Current dependency evidence still overrides approvals and blocks cleanup.
 *   - PROTECTED_ACTIVE remains blocked.
 *   - Missing source sheets are skipped.
 *   - Every live action archives and verifies before source removal.
 ******************************************************************************/

const AUD5 = {
  VERSION: "2.1.0",
  CORE_ID: "1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64",
  ARCHIVE_ID: "1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk",
  REVIEW_SHEET: "AUD2_CLEANUP_REVIEW",
  INVENTORY_SHEET: "AUD2_DEPENDENCY_INVENTORY",
  LOG_SHEET: "AUD5_CLEANUP_LOG",
  SUMMARY_SHEET: "AUD5_CLEANUP_SUMMARY",
  APPROVE_ARCHIVE: "APPROVED_ARCHIVE",
  APPROVE_DELETE: "APPROVED_DELETE"
};

function AUD5_initializeCleanupExecutor() {
  const core = SpreadsheetApp.openById(AUD5.CORE_ID);

  let log = core.getSheetByName(AUD5.LOG_SHEET);
  if (!log) log = core.insertSheet(AUD5.LOG_SHEET);

  const logHeaders = [
    "RunID","Workbook","SheetName","Classification","ApprovalStatus",
    "Mode","Action","Status","Details","ArchiveSheetName","ProcessedAt"
  ];

  if (log.getLastRow() === 0) {
    log.getRange(1,1,1,logHeaders.length).setValues([logHeaders]);
    log.setFrozenRows(1);
  } else if (log.getLastColumn() < logHeaders.length) {
    log.getRange(1,1,1,logHeaders.length).setValues([logHeaders]);
  }

  let summary = core.getSheetByName(AUD5.SUMMARY_SHEET);
  if (!summary) summary = core.insertSheet(AUD5.SUMMARY_SHEET);

  return true;
}

function AUD5_previewApprovedCleanup() {
  const result = AUD5_processCleanup_(true);
  Logger.log(JSON.stringify(AUD5_compactResult_(result)));
  return result;
}

function AUD5_executeApprovedCleanup() {
  const result = AUD5_processCleanup_(false);
  Logger.log(JSON.stringify(AUD5_compactResult_(result)));
  return result;
}

function AUD5_processCleanup_(dryRun) {
  AUD5_initializeCleanupExecutor();

  const core = SpreadsheetApp.openById(AUD5.CORE_ID);
  const review = core.getSheetByName(AUD5.REVIEW_SHEET);

  if (!review) {
    throw new Error("Missing review sheet: " + AUD5.REVIEW_SHEET);
  }

  const rows = AUD5_objects_(review);

  const approved = rows.filter(function(row) {
    const approval = String(row.ApprovalStatus || "").trim().toUpperCase();
    return approval === AUD5.APPROVE_ARCHIVE ||
           approval === AUD5.APPROVE_DELETE;
  });

  const runId = "CLN-" + Utilities.getUuid().substring(0,8).toUpperCase();
  const mode = dryRun ? "DRY_RUN" : "LIVE";

  const result = {
    success: true,
    version: AUD5.VERSION,
    runId: runId,
    dryRun: dryRun,
    approvedRows: approved.length,
    processed: 0,
    ready: 0,
    archived: 0,
    deleted: 0,
    skippedAlreadyMissing: 0,
    skippedProtected: 0,
    skippedManualReview: 0,
    skippedInvalidApproval: 0,
    failed: 0,
    results: []
  };

  approved.forEach(function(row) {
    const item = AUD5_processRowSafe_(row, dryRun, runId, mode);
    result.results.push(item);
    result.processed++;

    switch (item.status) {
      case "READY": result.ready++; break;
      case "ARCHIVED": result.archived++; break;
      case "DELETED": result.deleted++; break;
      case "SKIPPED_ALREADY_MISSING": result.skippedAlreadyMissing++; break;
      case "SKIPPED_PROTECTED": result.skippedProtected++; break;
      case "SKIPPED_MANUAL_REVIEW": result.skippedManualReview++; break;
      case "SKIPPED_INVALID_APPROVAL": result.skippedInvalidApproval++; break;
      case "FAILED":
        result.failed++;
        result.success = false;
        break;
    }
  });

  AUD5_writeSummary_(result);
  return result;
}

function AUD5_processRowSafe_(row, dryRun, runId, mode) {
  const workbook = String(row.Workbook || "").trim().toUpperCase();
  const sheetName = String(row.SheetName || "").trim();
  const classification = String(row.Classification || "").trim().toUpperCase();
  const approval = String(row.ApprovalStatus || "").trim().toUpperCase();

  const base = {
    success: true,
    workbook: workbook,
    sheetName: sheetName,
    classification: classification,
    approvalStatus: approval,
    action: "",
    status: "",
    details: "",
    archiveSheetName: ""
  };

  try {
    if (!workbook || !sheetName) {
      return AUD5_finishItem_(
        base, runId, row, mode, "NONE",
        "SKIPPED_INVALID_APPROVAL",
        "Workbook or SheetName is blank.", ""
      );
    }

    const protection = AUD5_revalidateProtection_(row);

    if (protection.protected) {
      return AUD5_finishItem_(
        base, runId, row, mode, "KEEP_LOCKED",
        "SKIPPED_PROTECTED",
        protection.reason, ""
      );
    }

    /*
     * v2.1 FIX:
     * MANUAL_REVIEW classification no longer blocks a row when a later
     * analysis layer has explicitly approved it for archive/delete.
     */
    const hasExplicitApproval =
      approval === AUD5.APPROVE_ARCHIVE ||
      approval === AUD5.APPROVE_DELETE;

    if (
      classification === "MANUAL_REVIEW" &&
      !hasExplicitApproval
    ) {
      return AUD5_finishItem_(
        base, runId, row, mode, "NONE",
        "SKIPPED_MANUAL_REVIEW",
        "MANUAL_REVIEW row has no explicit later approval.", ""
      );
    }

    if (!hasExplicitApproval) {
      return AUD5_finishItem_(
        base, runId, row, mode, "NONE",
        "SKIPPED_INVALID_APPROVAL",
        "Row is not explicitly approved for archive or delete.", ""
      );
    }

    const sourceId = AUD2.WORKBOOKS[workbook];

    if (!sourceId) {
      throw new Error("Unknown workbook: " + workbook);
    }

    if (workbook === "ARCHIVE") {
      return AUD5_finishItem_(
        base, runId, row, mode, "KEEP_IN_ARCHIVE",
        "SKIPPED_PROTECTED",
        "Archive workbook sheets are never removed by cleanup executor.", ""
      );
    }

    const sourceSS = SpreadsheetApp.openById(sourceId);
    const sourceSheet = sourceSS.getSheetByName(sheetName);

    if (!sourceSheet) {
      return AUD5_finishItem_(
        base, runId, row, mode, "NONE",
        "SKIPPED_ALREADY_MISSING",
        "Source sheet no longer exists. No action required.", ""
      );
    }

    const action =
      approval === AUD5.APPROVE_DELETE
        ? "BACKUP_THEN_DELETE"
        : "ARCHIVE_THEN_REMOVE";

    if (dryRun) {
      return AUD5_finishItem_(
        base, runId, row, mode, action,
        "READY",
        "Revalidation passed. Explicit later approval accepted. No changes performed.", ""
      );
    }

    const archiveSS = SpreadsheetApp.openById(AUD5.ARCHIVE_ID);
    const archiveName = AUD5_uniqueArchiveName_(
      archiveSS, workbook, sheetName
    );

    const sourceSnapshot = AUD5_sheetSnapshot_(sourceSheet);

    const copied = sourceSheet.copyTo(archiveSS);
    copied.setName(archiveName);

    SpreadsheetApp.flush();

    const verify = archiveSS.getSheetByName(archiveName);

    if (!verify) {
      throw new Error(
        "Archive copy verification failed. Source was not deleted."
      );
    }

    const verification = AUD5_verifyArchiveCopy_(
      sourceSnapshot, verify
    );

    if (!verification.success) {
      throw new Error(
        "Archive verification failed: " +
        verification.reason +
        ". Source was not deleted."
      );
    }

    sourceSS.deleteSheet(sourceSheet);
    SpreadsheetApp.flush();

    const status =
      approval === AUD5.APPROVE_DELETE
        ? "DELETED"
        : "ARCHIVED";

    return AUD5_finishItem_(
      base, runId, row, mode, action, status,
      "Archive copy verified as " + archiveName +
      "; source sheet removed.",
      archiveName
    );

  } catch (error) {
    base.success = false;

    return AUD5_finishItem_(
      base, runId, row, mode, "ERROR", "FAILED",
      error.message || String(error), ""
    );
  }
}

function AUD5_revalidateProtection_(row) {
  const classification = String(
    row.Classification || ""
  ).trim().toUpperCase();

  const evidence = String(
    row.Evidence || ""
  ).trim();

  if (classification === "PROTECTED_ACTIVE") {
    return {
      protected: true,
      reason: "Current review classification is PROTECTED_ACTIVE."
    };
  }

  const dependencyPattern =
    /(literal sheet-name reference|getSheetByName reference|constant\/config value reference|cross-workbook sheet reference|Trigger dependency|Protected MelroseOS module prefix)/i;

  if (dependencyPattern.test(evidence)) {
    return {
      protected: true,
      reason: "Dependency evidence is present in the current review row."
    };
  }

  const core = SpreadsheetApp.openById(AUD5.CORE_ID);
  const inventory = core.getSheetByName(AUD5.INVENTORY_SHEET);

  if (inventory && inventory.getLastRow() > 1) {
    const items = AUD5_objects_(inventory);

    const current = items.find(function(item) {
      return String(item.Workbook || "").trim().toUpperCase() ===
               String(row.Workbook || "").trim().toUpperCase() &&
             String(item.SheetName || "").trim() ===
               String(row.SheetName || "").trim();
    });

    if (current) {
      const currentClass = String(
        current.Classification || ""
      ).trim().toUpperCase();

      const currentEvidence = String(
        current.Evidence || ""
      ).trim();

      if (
        currentClass === "PROTECTED_ACTIVE" ||
        dependencyPattern.test(currentEvidence)
      ) {
        return {
          protected: true,
          reason:
            "Latest dependency inventory now marks this sheet as protected."
        };
      }
    }
  }

  return {
    protected: false,
    reason: ""
  };
}

function AUD5_sheetSnapshot_(sheet) {
  const rows = sheet.getLastRow();
  const cols = sheet.getLastColumn();

  let values = [];

  if (rows > 0 && cols > 0) {
    values = sheet.getRange(1,1,rows,cols).getValues();
  }

  return {
    rows: rows,
    cols: cols,
    digest: AUD5_digestValues_(values)
  };
}

function AUD5_verifyArchiveCopy_(snapshot, archiveSheet) {
  const rows = archiveSheet.getLastRow();
  const cols = archiveSheet.getLastColumn();

  if (rows !== snapshot.rows || cols !== snapshot.cols) {
    return {
      success: false,
      reason:
        "dimension mismatch; source=" +
        snapshot.rows + "x" + snapshot.cols +
        ", archive=" + rows + "x" + cols
    };
  }

  let values = [];

  if (rows > 0 && cols > 0) {
    values = archiveSheet.getRange(1,1,rows,cols).getValues();
  }

  const digest = AUD5_digestValues_(values);

  if (digest !== snapshot.digest) {
    return {
      success: false,
      reason: "cell-value digest mismatch"
    };
  }

  return {
    success: true,
    reason: "verified"
  };
}

function AUD5_digestValues_(values) {
  const normalized = values.map(function(row) {
    return row.map(function(value) {
      if (value instanceof Date) {
        return {
          __type: "Date",
          value: value.toISOString()
        };
      }
      return value;
    });
  });

  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(normalized),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function(b) {
    const value = b < 0 ? b + 256 : b;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function AUD5_finishItem_(
  base, runId, row, mode, action, status, details, archiveName
) {
  base.action = action;
  base.status = status;
  base.details = details;
  base.archiveSheetName = archiveName || "";

  if (status === "FAILED") {
    base.success = false;
  }

  AUD5_log_(
    runId, row, mode, action, status, details, archiveName || ""
  );

  return base;
}

function AUD5_uniqueArchiveName_(archiveSS, workbook, sheetName) {
  const stamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || "America/Chicago",
    "yyyyMMdd_HHmmss"
  );

  const base = (
    workbook + "__" + sheetName + "__" + stamp
  )
    .replace(/[\[\]\*\?\/\\:]/g, "_")
    .substring(0, 90);

  let candidate = base;
  let counter = 1;

  while (archiveSS.getSheetByName(candidate)) {
    counter++;
    candidate = base.substring(0, 85) + "_" + counter;
  }

  return candidate;
}

function AUD5_objects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(function(value) {
    return String(value || "").trim();
  });

  return values
    .filter(function(row) {
      return row.some(function(value) {
        return String(value || "").trim() !== "";
      });
    })
    .map(function(row, index) {
      const obj = {_row: index + 2};

      headers.forEach(function(header, i) {
        obj[header] = row[i];
      });

      return obj;
    });
}

function AUD5_log_(
  runId, row, mode, action, status, details, archiveName
) {
  const core = SpreadsheetApp.openById(AUD5.CORE_ID);
  const log = core.getSheetByName(AUD5.LOG_SHEET);

  log.appendRow([
    runId,
    row.Workbook || "",
    row.SheetName || "",
    row.Classification || "",
    row.ApprovalStatus || "",
    mode,
    action,
    status,
    details,
    archiveName || "",
    new Date()
  ]);
}

function AUD5_writeSummary_(result) {
  const core = SpreadsheetApp.openById(AUD5.CORE_ID);
  let sheet = core.getSheetByName(AUD5.SUMMARY_SHEET);

  if (!sheet) {
    sheet = core.insertSheet(AUD5.SUMMARY_SHEET);
  }

  sheet.clearContents();

  const rows = [
    ["Metric","Value"],
    ["Version",result.version],
    ["RunID",result.runId],
    ["Mode",result.dryRun ? "DRY_RUN" : "LIVE"],
    ["Success",result.success],
    ["ApprovedRows",result.approvedRows],
    ["Processed",result.processed],
    ["Ready",result.ready],
    ["Archived",result.archived],
    ["Deleted",result.deleted],
    ["SkippedAlreadyMissing",result.skippedAlreadyMissing],
    ["SkippedProtected",result.skippedProtected],
    ["SkippedManualReview",result.skippedManualReview],
    ["SkippedInvalidApproval",result.skippedInvalidApproval],
    ["Failed",result.failed],
    ["UpdatedAt",new Date()]
  ];

  sheet.getRange(1,1,rows.length,2).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1,2);
}

function AUD5_compactResult_(result) {
  return {
    success: result.success,
    version: result.version,
    runId: result.runId,
    dryRun: result.dryRun,
    approvedRows: result.approvedRows,
    processed: result.processed,
    ready: result.ready,
    archived: result.archived,
    deleted: result.deleted,
    skippedAlreadyMissing: result.skippedAlreadyMissing,
    skippedProtected: result.skippedProtected,
    skippedManualReview: result.skippedManualReview,
    skippedInvalidApproval: result.skippedInvalidApproval,
    failed: result.failed
  };
}

function AUD5_testCleanupExecutor() {
  const result = AUD5_previewApprovedCleanup();

  if (!result.success) {
    throw new Error(
      "Cleanup Executor v2.1 dry-run reported failures. Review " +
      AUD5.LOG_SHEET + "."
    );
  }

  return true;
}
