/******************************************************************************
 * MelroseOS Enterprise
 * Lead Intake Migration
 * File: LI-03_DedupeEngine.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Detects duplicate incoming leads using normalized email and phone.
 *
 * Requires:
 *   LI-01_Core.gs
 *   LI-02_SourceRegistry.gs
 *   AE-01_Core.gs
 ******************************************************************************/

const LI_DUPLICATE_LOG_SHEET = "LI_DUPLICATE_LOG";

function LI_initializeDedupeEngine() {
  LI_initializeCore();

  const ss = workbook_();
  const sheet = createSheetIfMissing_(ss, LI_DUPLICATE_LOG_SHEET);

  LI_setHeadersIfEmpty_(sheet, [
    "DuplicateID",
    "IntakeID",
    "LeadID",
    "MatchedLeadID",
    "MatchType",
    "MatchValue",
    "Action",
    "DetectedAt"
  ]);

  return {
    success: true,
    duplicatesLogged: LI_sheetObjects_(LI_DUPLICATE_LOG_SHEET).length
  };
}

function LI_findDuplicateLead(lead) {
  if (!lead) {
    throw new Error("Lead record is required.");
  }

  const email = AE_normalizeEmail_(
    lead.Email || lead.email || ""
  );

  const phone = AE_normalizePhone_(
    lead.Phone || lead.phone || ""
  );

  const candidates = [];

  Array.prototype.push.apply(
    candidates,
    LI_sheetObjects_(LI.SHEETS.INTAKE)
  );

  if (
    typeof AE !== "undefined" &&
    AE.SHEETS &&
    AE.SHEETS.LEADS
  ) {
    Array.prototype.push.apply(
      candidates,
      AE_sheetObjects_(AE.SHEETS.LEADS)
    );
  }

  let emailMatch = null;
  let phoneMatch = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    const candidateLeadId = String(
      candidate.LeadID || ""
    ).trim();

    if (
      lead.LeadID &&
      candidateLeadId === String(lead.LeadID).trim()
    ) {
      continue;
    }

    const candidateEmail = AE_normalizeEmail_(
      candidate.Email || ""
    );

    const candidatePhone = AE_normalizePhone_(
      candidate.Phone || ""
    );

    if (
      email &&
      candidateEmail &&
      email === candidateEmail
    ) {
      emailMatch = {
        matchedLeadId: candidateLeadId,
        matchType: "EMAIL",
        matchValue: email,
        candidate: candidate
      };
      break;
    }

    if (
      phone &&
      candidatePhone &&
      phone === candidatePhone &&
      !phoneMatch
    ) {
      phoneMatch = {
        matchedLeadId: candidateLeadId,
        matchType: "PHONE",
        matchValue: phone,
        candidate: candidate
      };
    }
  }

  return emailMatch || phoneMatch;
}

function LI_checkAndLogDuplicate(lead) {
  LI_initializeDedupeEngine();

  const match = LI_findDuplicateLead(lead);

  if (!match) {
    return {
      duplicate: false
    };
  }

  LI_logDuplicate_(
    lead,
    match,
    "BLOCK"
  );

  return {
    duplicate: true,
    matchedLeadId: match.matchedLeadId,
    matchType: match.matchType,
    matchValue: match.matchValue,
    action: "BLOCK"
  };
}

function LI_logDuplicate_(lead, match, action) {
  const sheet = workbook_().getSheetByName(
    LI_DUPLICATE_LOG_SHEET
  );

  if (!sheet) {
    throw new Error("LI_DUPLICATE_LOG sheet is missing.");
  }

  sheet.appendRow([
    LI_uuid_("DUP"),
    String(lead.IntakeID || ""),
    String(lead.LeadID || ""),
    String(match.matchedLeadId || ""),
    String(match.matchType || ""),
    String(match.matchValue || ""),
    String(action || "BLOCK"),
    timestamp_()
  ]);

  LI_log_(
    "DUPLICATE_DETECTED",
    lead.IntakeID || "",
    "Duplicate matched by " +
      match.matchType +
      " to lead " +
      match.matchedLeadId +
      ".",
    lead.LeadID || ""
  );
}

function LI_receiveLeadWithDedupe(payload) {
  LI_initializeDedupeEngine();

  if (!payload) {
    throw new Error("Lead payload is required.");
  }

  let normalized = LI_applySourceDefaults(payload);
  const validation = LI_validateLead_(normalized);

  normalized.IntakeID = LI_uuid_("INT");
  normalized.LeadID =
    normalized.LeadID || LI_uuid_("LEAD");
  normalized.ReceivedAt = timestamp_();

  if (!validation.valid) {
    const intakeSheet = workbook_().getSheetByName(
      LI.SHEETS.INTAKE
    );

    intakeSheet.appendRow([
      normalized.IntakeID,
      normalized.LeadID,
      normalized.ReceivedAt,
      normalized.FirstName,
      normalized.LastName,
      normalized.Email,
      normalized.Phone,
      normalized.LeadType,
      normalized.Parish,
      normalized.City,
      normalized.Source,
      normalized.SourceRecordID,
      "REJECTED",
      "INVALID",
      validation.message,
      "",
      "",
      timestamp_()
    ]);

    LI_rejectLead_(
      normalized,
      validation.message
    );

    return {
      success: false,
      duplicate: false,
      intakeId: normalized.IntakeID,
      leadId: normalized.LeadID,
      status: "REJECTED",
      reason: validation.message
    };
  }

  const duplicate = LI_findDuplicateLead(normalized);

  const intakeSheet = workbook_().getSheetByName(
    LI.SHEETS.INTAKE
  );

  const status = duplicate
    ? "DUPLICATE"
    : "NEW";

  const validationStatus = duplicate
    ? "DUPLICATE"
    : "VALID";

  const validationMessage = duplicate
    ? "Duplicate matched by " +
      duplicate.matchType +
      " to lead " +
      duplicate.matchedLeadId +
      "."
    : "";

  intakeSheet.appendRow([
    normalized.IntakeID,
    normalized.LeadID,
    normalized.ReceivedAt,
    normalized.FirstName,
    normalized.LastName,
    normalized.Email,
    normalized.Phone,
    normalized.LeadType,
    normalized.Parish,
    normalized.City,
    normalized.Source,
    normalized.SourceRecordID,
    status,
    validationStatus,
    validationMessage,
    "",
    "",
    timestamp_()
  ]);

  if (duplicate) {
    LI_logDuplicate_(
      normalized,
      duplicate,
      "BLOCK"
    );

    return {
      success: false,
      duplicate: true,
      intakeId: normalized.IntakeID,
      leadId: normalized.LeadID,
      matchedLeadId: duplicate.matchedLeadId,
      matchType: duplicate.matchType,
      status: "DUPLICATE"
    };
  }

  LI_log_(
    "LEAD_RECEIVED",
    normalized.IntakeID,
    "Lead accepted into intake queue after duplicate check.",
    normalized.LeadID
  );

  return {
    success: true,
    duplicate: false,
    intakeId: normalized.IntakeID,
    leadId: normalized.LeadID,
    status: "NEW"
  };
}

function LI_getDuplicateSummary() {
  const rows = LI_sheetObjects_(LI_DUPLICATE_LOG_SHEET);

  const emailMatches = rows.filter(function(row) {
    return String(row.MatchType || "").toUpperCase() === "EMAIL";
  }).length;

  const phoneMatches = rows.filter(function(row) {
    return String(row.MatchType || "").toUpperCase() === "PHONE";
  }).length;

  return {
    totalDuplicates: rows.length,
    emailMatches: emailMatches,
    phoneMatches: phoneMatches
  };
}

function LI_clearDuplicateLog() {
  const sheet = workbook_().getSheetByName(
    LI_DUPLICATE_LOG_SHEET
  );

  if (!sheet) return true;

  const headers = sheet.getLastColumn()
    ? sheet.getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      ).getValues()
    : [];

  clearSheet_(sheet);

  if (headers.length && headers[0].length) {
    sheet
      .getRange(
        1,
        1,
        1,
        headers[0].length
      )
      .setValues(headers);
  }

  return true;
}

function LI_testDedupeEngine() {
  LI_initializeDedupeEngine();

  const seed = LI_receiveLead({
    FirstName: "Duplicate",
    LastName: "Seed",
    Email: "li-dedupe-test@example.com",
    Phone: "(985) 555-0133",
    LeadType: "BUYER",
    Parish: "ST. TAMMANY",
    Source: "SELF_TEST"
  });

  const result = LI_receiveLeadWithDedupe({
    FirstName: "Duplicate",
    LastName: "Repeat",
    Email: "li-dedupe-test@example.com",
    Phone: "(985) 555-0133",
    LeadType: "BUYER",
    Parish: "ST. TAMMANY",
    Source: "SELF_TEST"
  });

  if (!result.duplicate) {
    throw new Error(
      "Lead Intake Dedupe Engine self-test failed."
    );
  }

  Logger.log(JSON.stringify(seed));
  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(LI_getDuplicateSummary()));

  return true;
}
