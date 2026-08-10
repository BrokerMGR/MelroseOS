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
