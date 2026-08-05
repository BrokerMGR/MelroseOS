/******************************************************************************
 * MelroseOS Enterprise
 * Lead Intake Migration
 * File: LI-06_IntakeRouter.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Provides a single entry point for all lead sources. Applies source
 *   defaults, validates/deduplicates the lead, and optionally processes the
 *   intake queue through the Assignment Engine.
 *
 * Requires:
 *   LI-01 through LI-05
 *   AE-01 through AE-10
 ******************************************************************************/

function LI_routeIncomingLead(payload, options) {
  LI_initializeSourceRegistry();
  LI_initializeDedupeEngine();

  options = options || {};

  if (!payload) {
    throw new Error("Lead payload is required.");
  }

  const sourceName = String(
    payload.Source ||
    payload.source ||
    options.source ||
    "UNKNOWN"
  ).trim();

  const routedPayload = {};

  Object.keys(payload).forEach(function(key) {
    routedPayload[key] = payload[key];
  });

  routedPayload.Source = sourceName;

  const intakeResult = LI_receiveLeadWithDedupe(routedPayload);

  if (!intakeResult.success) {
    return {
      success: false,
      stage: "INTAKE",
      intake: intakeResult
    };
  }

  const autoProcess =
    options.autoProcess === true ||
    String(options.autoProcess || "").toUpperCase() === "TRUE";

  if (!autoProcess) {
    return {
      success: true,
      stage: "QUEUED",
      intake: intakeResult,
      assignment: null
    };
  }

  const assignment = LI_processSingleIntake_(
    intakeResult.intakeId
  );

  return {
    success: assignment.success,
    stage: "PROCESSED",
    intake: intakeResult,
    assignment: assignment
  };
}

function LI_processSingleIntake_(intakeId) {
  const rows = LI_sheetObjects_(LI.SHEETS.INTAKE);

  const intake = rows.find(function(row) {
    return String(row.IntakeID || "") === String(intakeId || "");
  });

  if (!intake) {
    throw new Error("Intake record not found: " + intakeId);
  }

  if (String(intake.Status || "").toUpperCase() !== "NEW") {
    return {
      success: false,
      intakeId: intakeId,
      leadId: intake.LeadID || "",
      reason: "Intake record is not in NEW status."
    };
  }

  return LI_processIntakeRecord_(intake);
}

function LI_routeBuyerLead(payload, autoProcess) {
  payload = payload || {};
  payload.LeadType = "BUYER";

  return LI_routeIncomingLead(
    payload,
    {autoProcess: autoProcess === true}
  );
}

function LI_routeSellerLead(payload, autoProcess) {
  payload = payload || {};
  payload.LeadType = "SELLER";

  return LI_routeIncomingLead(
    payload,
    {autoProcess: autoProcess === true}
  );
}

function LI_routeRenterLead(payload, autoProcess) {
  payload = payload || {};
  payload.LeadType = "RENTER";

  return LI_routeIncomingLead(
    payload,
    {autoProcess: autoProcess === true}
  );
}

function LI_routeRecruitingLead(payload, autoProcess) {
  payload = payload || {};
  payload.LeadType = "RECRUITING";

  return LI_routeIncomingLead(
    payload,
    {autoProcess: autoProcess === true}
  );
}

function LI_registerDefaultSources() {
  LI_initializeSourceRegistry();

  const defaults = [
    {
      SourceID: "SRC-BOOK-NOW",
      SourceName: "Book Now",
      SourceType: "WEB_FORM",
      Active: true,
      Priority: 10,
      Notes: "Primary Melrose Group Realty Book Now lead funnel."
    },
    {
      SourceID: "SRC-CITY-GUIDE",
      SourceName: "City Guide",
      SourceType: "WEB_FORM",
      Active: true,
      Priority: 20,
      Notes: "City and parish guide lead forms."
    },
    {
      SourceID: "SRC-WEBSITE",
      SourceName: "Website",
      SourceType: "WEB_FORM",
      Active: true,
      Priority: 30,
      Notes: "General website lead intake."
    },
    {
      SourceID: "SRC-SOCIAL",
      SourceName: "Social Media",
      SourceType: "SOCIAL",
      Active: true,
      Priority: 40,
      Notes: "Social media lead generation."
    },
    {
      SourceID: "SRC-MANUAL",
      SourceName: "Manual Entry",
      SourceType: "MANUAL",
      Active: true,
      Priority: 90,
      Notes: "Broker or staff manual lead entry."
    },
    {
      SourceID: "SRC-RECRUITING",
      SourceName: "Join the Team",
      SourceType: "RECRUITING",
      Active: true,
      DefaultLeadType: "RECRUITING",
      Priority: 10,
      Notes: "Recruiting leads route to broker only."
    }
  ];

  defaults.forEach(function(source) {
    LI_upsertSource(source);
  });

  return {
    success: true,
    registered: defaults.length,
    summary: LI_getSourceRegistrySummary()
  };
}

function LI_getRouterStatus() {
  return {
    intake: LI_getIntakeSummary(),
    queue: LI_getQueueStatus(),
    sources: LI_getSourceRegistrySummary(),
    duplicates: LI_getDuplicateSummary(),
    assignmentMode: AE_getMode()
  };
}

function LI_testIntakeRouter() {
  LI_registerDefaultSources();
  AE_initializeConfig();
  AE_setShadowMode();

  AE_upsertAgent({
    AgentID: "AGT-LI-ROUTER-TEST",
    AgentName: "Lead Intake Router Test Agent",
    Email: "li-router-agent@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "ROUTER TEST PARISH",
    LeadTypes: "BUYER",
    Priority: 1,
    DailyCap: 999
  });

  const unique = Utilities.getUuid().substring(0, 8);

  const result = LI_routeBuyerLead(
    {
      FirstName: "Router",
      LastName: "Test",
      Email: "li-router-" + unique + "@example.com",
      Parish: "ROUTER TEST PARISH",
      Source: "Website"
    },
    true
  );

  if (!result.success) {
    throw new Error("Lead Intake Router self-test failed.");
  }

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(LI_getRouterStatus()));

  return true;
}

// BEGIN MOS5-M1C-CANONICAL-LEAD-INTAKE v1.0.0
const MOS5_M1C_INTAKE_VERSION = "1.0.0";

/**
 * Canonical entry point for every MelroseOS lead source.
 *
 * Pass 1 remains queue-only:
 * - Core safety controls must permit intake.
 * - Payload is normalized into the LI contract.
 * - Source defaults and dedupe run before queue creation.
 * - Assignment, communications, and triggers are not activated here.
 *
 * @param {Object} payload
 * @param {Object=} options
 * @return {Object}
 */
function MOS5_submitCanonicalLead(payload, options) {
  const startedAt = new Date();
  const settings = options || {};

  MOS5M1B_checkLeadIntakeGate_();

  const canonical = MOS5M1C_buildCanonicalPayload_(
    payload,
    settings
  );

  const result = LI_routeIncomingLead(
    canonical,
    {
      source: canonical.Source,
      autoProcess: false
    }
  );

  const response = {
    success: Boolean(result && result.success),
    release: "MOS5-M1C-CANONICAL-LEAD-INTAKE",
    version: MOS5_M1C_INTAKE_VERSION,
    stage: result && result.stage
      ? result.stage
      : "INTAKE_FAILED",
    intake: result && result.intake
      ? result.intake
      : null,
    assignment: null,
    autoProcess: false,
    routingActivated: false,
    communicationsActivated: false,
    triggersActivated: false,
    productionChanged: false,
    receivedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString()
  };

  MOS5M1C_logCanonicalIntake_(response, canonical);
  return response;
}

/**
 * Creates the single normalized LI payload used by all intake sources.
 *
 * @param {Object} payload
 * @param {Object=} options
 * @return {Object}
 */
function MOS5M1C_buildCanonicalPayload_(payload, options) {
  const input = payload || {};
  const settings = options || {};

  const firstName = MOS5M1C_titleCase_(
    input.FirstName ||
    input.firstName ||
    input.firstname ||
    ""
  );

  const lastName = MOS5M1C_titleCase_(
    input.LastName ||
    input.lastName ||
    input.lastname ||
    ""
  );

  const email = String(
    input.Email ||
    input.email ||
    ""
  ).trim().toLowerCase();

  const phone = MOS5M1C_normalizePhone_(
    input.Phone ||
    input.phone ||
    input.mobile ||
    ""
  );

  const leadType = String(
    input.LeadType ||
    input.leadType ||
    input.type ||
    settings.leadType ||
    ""
  ).trim().toUpperCase();

  const parish = String(
    input.Parish ||
    input.parish ||
    ""
  ).trim().toUpperCase().replace(/\s+PARISH$/, "");

  const source = String(
    input.Source ||
    input.source ||
    input.LeadSource ||
    input.leadSource ||
    settings.source ||
    "Website"
  ).trim();

  const consentValue =
    input.ConsentToContact !== undefined
      ? input.ConsentToContact
      : (
        input.consentToContact !== undefined
          ? input.consentToContact
          : input.consent
      );

  const canonical = {
    FirstName: firstName,
    LastName: lastName,
    Email: email,
    Phone: phone,
    LeadType: leadType,
    Parish: parish,
    City: String(input.City || input.city || "").trim(),
    State: String(input.State || input.state || "LA")
      .trim()
      .toUpperCase(),
    ZipCode: String(
      input.ZipCode ||
      input.zipCode ||
      input.zip ||
      ""
    ).trim(),
    Source: source,
    SourceDetail: String(
      input.SourceDetail ||
      input.sourceDetail ||
      input.leadSourceDetail ||
      ""
    ).trim(),
    CampaignID: String(
      input.CampaignID ||
      input.campaignId ||
      ""
    ).trim(),
    ExternalReference: String(
      input.ExternalReference ||
      input.externalReference ||
      ""
    ).trim(),
    Message: String(
      input.Message ||
      input.message ||
      input.notes ||
      ""
    ).trim(),
    PreferredContactMethod: String(
      input.PreferredContactMethod ||
      input.preferredContactMethod ||
      ""
    ).trim().toUpperCase(),
    ConsentToContact: MOS5M1C_toBoolean_(consentValue),
    ConsentSource: String(
      input.ConsentSource ||
      input.consentSource ||
      source
    ).trim(),
    ConsentCapturedAt: String(
      input.ConsentCapturedAt ||
      input.consentCapturedAt ||
      new Date().toISOString()
    ),
    ConsentVersion: String(
      input.ConsentVersion ||
      input.consentVersion ||
      "1.0"
    ).trim(),
    RawPayloadJSON: JSON.stringify(input)
  };

  MOS5M1C_validateCanonicalPayload_(canonical);
  return canonical;
}

/**
 * Validates the public contract before the LI engine writes anything.
 *
 * @param {Object} lead
 * @return {boolean}
 */
function MOS5M1C_validateCanonicalPayload_(lead) {
  const errors = [];

  if (!lead.FirstName) {
    errors.push("FirstName is required.");
  }

  if (!lead.LastName) {
    errors.push("LastName is required.");
  }

  if (!lead.Email && !lead.Phone) {
    errors.push("Email or Phone is required.");
  }

  if (
    lead.Email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.Email)
  ) {
    errors.push("Email format is invalid.");
  }

  if (
    lead.Phone &&
    !/^\d{10}$/.test(lead.Phone)
  ) {
    errors.push("Phone must contain 10 digits.");
  }

  if (
    ["BUYER", "SELLER", "RENTER", "RECRUITING"]
      .indexOf(lead.LeadType) === -1
  ) {
    errors.push("LeadType is unsupported.");
  }

  if (
    lead.LeadType !== "RECRUITING" &&
    !lead.Parish
  ) {
    errors.push(
      "Parish is required for buyer, seller, and renter leads."
    );
  }

  if (lead.ConsentToContact !== true) {
    errors.push("ConsentToContact must be true.");
  }

  if (errors.length) {
    throw new Error(
      "Canonical lead validation failed: " +
      errors.join(" ")
    );
  }

  return true;
}

function MOS5M1C_normalizePhone_(value) {
  let digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 11 && digits.charAt(0) === "1") {
    digits = digits.substring(1);
  }

  return digits;
}

function MOS5M1C_titleCase_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, function(character) {
      return character.toUpperCase();
    });
}

function MOS5M1C_toBoolean_(value) {
  if (value === true) {
    return true;
  }

  return [
    "TRUE",
    "YES",
    "Y",
    "1",
    "ON",
    "CHECKED"
  ].indexOf(
    String(value || "").trim().toUpperCase()
  ) !== -1;
}

/**
 * Records an execution log without creating a second CRM lead record.
 *
 * @param {Object} result
 * @param {Object} lead
 */
function MOS5M1C_logCanonicalIntake_(result, lead) {
  const safeLead = {
    LeadType: lead.LeadType,
    Parish: lead.Parish,
    Source: lead.Source,
    HasEmail: Boolean(lead.Email),
    HasPhone: Boolean(lead.Phone),
    ConsentToContact: lead.ConsentToContact
  };

  console.log(JSON.stringify({
    module: "MOS5_M1C_CANONICAL_INTAKE",
    result: result,
    lead: safeLead
  }));
}

/**
 * Read-only M1C diagnostics.
 *
 * @return {Object}
 */
function MOS5M1C_runCanonicalIntakeDiagnostics() {
  const tests = [];

  function add(code, passed, details) {
    tests.push({
      code: code,
      status: passed ? "PASS" : "FAIL",
      details: details
    });
  }

  const buyer = MOS5M1C_buildCanonicalPayload_({
    firstName: "jane",
    lastName: "doe",
    email: " JANE@EXAMPLE.COM ",
    phone: "(985) 555-1212",
    leadType: "buyer",
    parish: "St. Tammany Parish",
    source: "Website",
    consentToContact: true
  });

  add(
    "NORMALIZED_NAME",
    buyer.FirstName === "Jane" &&
      buyer.LastName === "Doe",
    "Names normalize to title case."
  );

  add(
    "NORMALIZED_CONTACT",
    buyer.Email === "jane@example.com" &&
      buyer.Phone === "9855551212",
    "Email and phone normalize correctly."
  );

  add(
    "NORMALIZED_ROUTING",
    buyer.LeadType === "BUYER" &&
      buyer.Parish === "ST. TAMMANY",
    "Lead type and parish normalize correctly."
  );

  add(
    "CONSENT_REQUIRED",
    buyer.ConsentToContact === true,
    "Consent is captured as a boolean."
  );

  const failed = tests.filter(function(test) {
    return test.status === "FAIL";
  }).length;

  const result = {
    release: "MOS5-M1C-CANONICAL-LEAD-INTAKE",
    version: MOS5_M1C_INTAKE_VERSION,
    overallStatus: failed ? "FAIL" : "PASS",
    passed: tests.length - failed,
    failed: failed,
    tests: tests,
    queueOnly: true,
    productionChanged: false,
    routingActivated: false,
    communicationsActivated: false,
    completedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
// END MOS5-M1C-CANONICAL-LEAD-INTAKE v1.0.0
