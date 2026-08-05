/******************************************************************************
 * MelroseOS CRM Universal Intake Installer + Tests
 * CRM-02_InstallerAndTests.gs
 * Version 2.0.1
 ******************************************************************************/

function UIX_systemCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const functions = {
    UIX_runUniversalIntakeProcessor:
      typeof UIX_runUniversalIntakeProcessor === "function",
    UIX_processIntakeRow_:
      typeof UIX_processIntakeRow_ === "function",
    UIX_createOrUpdateLead_:
      typeof UIX_createOrUpdateLead_ === "function",
    UIX_verifyLeadState_:
      typeof UIX_verifyLeadState_ === "function",
    UIX_headers_:
      typeof UIX_headers_ === "function",
    UIX_objects_:
      typeof UIX_objects_ === "function",
    UIX_updateRow_:
      typeof UIX_updateRow_ === "function"
  };

  const result = {
    success:
      typeof UIX !== "undefined" &&
      Object.keys(functions).every(function(name) {
        return functions[name] === true;
      }),
    version:
      typeof UIX !== "undefined"
        ? UIX.VERSION
        : "UIX_NOT_LOADED",
    activeSpreadsheet: ss.getName(),
    intakeSheetExists: !!ss.getSheetByName("LI_INTAKE"),
    sourceEventsSheetExists: !!ss.getSheetByName("UI_SOURCE_EVENTS"),
    leadsSheetExists: !!ss.getSheetByName("AE_LEADS"),
    agentsSheetExists: !!ss.getSheetByName("AE_AGENTS"),
    functions: functions
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function UIX_installRequiredColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  UIX_ensureColumns_(
    ss.getSheetByName("LI_INTAKE"),
    [
      "IntakeID","LeadID","SourceEventID","SourceMessageID","SourceType",
      "Source","SourceCampaign","LeadType","Type","Category","FullName",
      "FirstName","LastName","Email","Phone","Parish","ParishNeeded",
      "CityOrArea","Timeline","PriceRangeOrRentBudget","Bedrooms",
      "Bathrooms","FinancingStatus","PropertyToSellAddress","NotesFromLead",
      "ClassificationConfidence","IdentityConfidence","CommunicationMode",
      "HistoricalBackfill","Status","IntakeStatus","QueueStatus",
      "ProcessingStatus","AcknowledgementStatus","CreatedAt","ReceivedAt",
      "ProcessedAt","Error","UpdatedAt","RawJson"
    ]
  );

  UIX_ensureColumns_(
    ss.getSheetByName("UI_SOURCE_EVENTS"),
    [
      "SourceEventID","SourceType","SourceMessageID","ThreadID","ReceivedAt",
      "QueuedAt","ProcessedAt","Status","ParseStatus","Classification",
      "Confidence","LeadID","Email","Phone","FullName","OriginalSender",
      "EnvelopeSender","Subject","AssignmentStatus","AgentSheetStatus",
      "PortalStatus","CommunicationStatus","Error","RawJson","UpdatedAt"
    ]
  );

  Logger.log("Universal intake columns verified.");
}

function UIX_installUniversalIntakeTrigger() {
  const handler = "UIX_runUniversalIntakeProcessor";

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyMinutes(30)
    .create();

  Logger.log("Installed 30-minute trigger for " + handler);
}

function UIX_ensureColumns_(sheet, requiredHeaders) {
  if (!sheet) {
    throw new Error("Required sheet is missing.");
  }

  const existing = UIX_headers_(sheet);
  let nextColumn = existing.length + 1;

  requiredHeaders.forEach(function(header) {
    if (existing.indexOf(header) === -1) {
      sheet.getRange(1, nextColumn).setValue(header);
      nextColumn++;
    }
  });

  sheet.setFrozenRows(1);
}
function UIX_createManualTestLead() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("LI_INTAKE");

  if (!sheet) {
    throw new Error("LI_INTAKE sheet not found.");
  }

  const headers = UIX_headers_(sheet);

  const payload = {
    IntakeID: UIX_uuid_("TESTINTAKE"),
    LeadID: UIX_uuid_("TESTLEAD"),
    SourceEventID: UIX_uuid_("TESTSRC"),
    SourceMessageID: "MANUAL_TEST_NO_GMAIL",
    SourceType: "MANUAL_TEST",
    Source: "MANUAL_TEST",
    SourceCampaign: "CRM_PIPELINE_TEST",

    LeadType: "SELLER",
    Type: "SELLER",
    Category: "SELLER",

    FullName: "CRM Test Seller",
    FirstName: "CRM",
    LastName: "Test Seller",
    Email: "crmtestseller@example.com",
    Phone: "5045550199",

    Parish: "Jefferson",
    ParishNeeded: "Jefferson",
    CityOrArea: "Metairie",
    Timeline: "30-60 days",
    PriceRangeOrRentBudget: "",
    Bedrooms: "",
    Bathrooms: "",
    FinancingStatus: "",
    PropertyToSellAddress: "123 Test Street, Metairie, LA",

    NotesFromLead:
      "Manual MelroseOS CRM pipeline test. Do not contact.",

    ClassificationConfidence: 0.99,
    IdentityConfidence: 0.99,
    CommunicationMode: "TEST_ONLY",
    HistoricalBackfill: false,

    Status: "NEW",
    IntakeStatus: "QUEUED",
    QueueStatus: "QUEUED",
    ProcessingStatus: "QUEUED",
    AcknowledgementStatus: "PENDING",

    CreatedAt: new Date(),
    ReceivedAt: new Date(),
    UpdatedAt: new Date(),
    Error: "",

    RawJson: JSON.stringify({
      test: true,
      purpose: "CRM_PIPELINE_ONLY",
      doNotContact: true
    })
  };

  sheet.appendRow(
    headers.map(function(header) {
      return payload[header] !== undefined
        ? payload[header]
        : "";
    })
  );

  Logger.log(
    JSON.stringify(
      {
        success: true,
        message: "Manual CRM test lead created.",
        leadId: payload.LeadID,
        sourceEventId: payload.SourceEventID
      },
      null,
      2
    )
  );
}