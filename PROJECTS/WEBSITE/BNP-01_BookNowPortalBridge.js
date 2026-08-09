/******************************************************************************
 * MelroseOS Book Now + Client Portal Experience
 * BNP-01_BookNowPortalBridge.gs
 * Version 1.0.0
 *
 * INSTALL IN WEBSITE APPS SCRIPT PROJECT.
 *
 * PURPOSE
 * - Ensure every Book Now lead has a portal/token/profile.
 * - Build personalized portal URLs.
 * - Queue branded Book Now portal emails.
 * - Provide lead-type-specific portal tool data.
 * - Keep agent linked lead sheets as primary human-edit source.
 ******************************************************************************/

const BNP = {
  VERSION: "1.0.0",
  WEBAPP_URL: "https://script.google.com/macros/s/AKfycbywBS1wpe1TI4C8a37nWK67SVp8nRrHpa2wjUhvNjNjCxLmU6l_z0aJrBJ5x9NRSGmvTQ/exec",
  BOOKING_URL: "https://melrosegrouprealty.com/book-now",
  WEBSITE_URL: "https://melrosegrouprealty.com",
  TIMEZONE: "America/Chicago",
  SEND_START_MINUTE: 9 * 60,
  SEND_END_MINUTE: 18 * 60 + 30
};

function BNP_initializeBookNowPortalExperience() {
  CIP_initializePlatform();
  BNP_ensureColumns_();
  BNP_seedToolAssumptions_();
  return BNP_getStatus();
}

function BNP_ensureColumns_() {
  const site = CIP_websiteWorkbook_();
  BNP_addMissingHeaders_(site.getSheetByName(CIP.SHEETS.REGISTRY), [
    "WelcomeEmailQueuedAt","WelcomeEmailSentAt","PortalLastOpenedAt"
  ]);
  BNP_addMissingHeaders_(site.getSheetByName(CIP.SHEETS.PROFILES), [
    "PortalURL","PrimaryTool","ToolDisclaimer","ProfileUpdatedAt"
  ]);
}

function BNP_addMissingHeaders_(sheet, names) {
  if (!sheet) return;
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1,1,1,lastCol).getDisplayValues()[0]
    .map(function(v){ return String(v || "").trim(); });
  names.forEach(function(name) {
    if (headers.indexOf(name) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(name);
      headers.push(name);
    }
  });
}

function BNP_seedToolAssumptions_() {
  const sheet = CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.MARKET_ASSUMPTIONS);
  if (!sheet) return;

  const rows = CIP_objects_(sheet);
  const existing = {};
  rows.forEach(function(r) {
    const key = String(r.Key || r.Setting || r.Name || "").trim();
    if (key) existing[key] = true;
  });

  const defaults = [
    ["MortgageInterestRate", 6.50, "Percent", "Editable planning assumption. Update as market conditions change."],
    ["BuyerDownPaymentPercent", 20, "Percent", "Default buyer planning assumption."],
    ["PropertyTaxAnnualPercent", 1.50, "Percent", "Ball-park annual property tax planning assumption; actual taxes vary."],
    ["HomeInsuranceAnnualPercent", 5.00, "Percent", "Ball-park insurance planning assumption; actual premiums vary materially by property and coverage."],
    ["LoanTermYears", 30, "Years", "Default amortization term."],
    ["SellerValueRangePercent", 7.50, "Percent", "Informational value range around preliminary estimate."],
    ["ToolDisclaimer", "Estimates are for informational and planning purposes only and are not lending, appraisal, insurance, tax, legal, or financial advice. Actual rates, taxes, insurance, loan terms, property values, and eligibility vary. Buyers should consult a local licensed mortgage professional for financing. Sellers should contact Melrose Group Realty for a property-specific comparative market analysis and pricing consultation.", "Text", "Required portal disclaimer."]
  ];

  defaults.forEach(function(row) {
    if (!existing[row[0]]) sheet.appendRow(row);
  });
}

function BNP_prepareLeadExperience(leadId) {
  CIP_initializePlatform();
  BNP_ensureColumns_();

  // Uses existing realtime/single-lead bridge to guarantee current portal profile.
  if (typeof CIP_RT_syncLeadNow_ === "function") {
    CIP_RT_syncLeadNow_(leadId, {source:"BOOK_NOW_PORTAL_PREP"});
  } else {
    CIP_syncLeadPortals();
  }

  const site = CIP_websiteWorkbook_();
  const registrySheet = site.getSheetByName(CIP.SHEETS.REGISTRY);
  const profileSheet = site.getSheetByName(CIP.SHEETS.PROFILES);

  const registry = CIP_objects_(registrySheet).find(function(r) {
    return String(r.LeadID || "") === String(leadId || "");
  });
  if (!registry) throw new Error("Portal registry not found for LeadID " + leadId);

  const profile = CIP_objects_(profileSheet).find(function(r) {
    return String(r.LeadID || "") === String(leadId || "");
  }) || {};

  const portalUrl = BNP.WEBAPP_URL + "?t=" + encodeURIComponent(registry.PortalToken);
  const leadType = String(registry.LeadType || profile.LeadType || "").toUpperCase();

  BNP_setByHeader_(profileSheet, profile._row, "PortalURL", portalUrl);
  BNP_setByHeader_(profileSheet, profile._row, "PrimaryTool", BNP_primaryTool_(leadType));
  BNP_setByHeader_(profileSheet, profile._row, "ToolDisclaimer", BNP_disclaimer_());
  BNP_setByHeader_(profileSheet, profile._row, "ProfileUpdatedAt", new Date());

  return {
    success:true,
    leadId:leadId,
    leadType:leadType,
    portalUrl:portalUrl,
    primaryTool:BNP_primaryTool_(leadType)
  };
}

function BNP_primaryTool_(leadType) {
  switch (String(leadType || "").toUpperCase()) {
    case "BUYER": return "AFFORDABILITY_CALCULATOR";
    case "SELLER": return "HOME_VALUE_ESTIMATOR";
    case "RENTER": return "RENT_VS_BUY_CALCULATOR";
    case "RECRUIT":
    case "RECRUITING": return "AGENT_CAREER_CENTER";
    default: return "CLIENT_RESOURCE_CENTER";
  }
}

function BNP_disclaimer_() {
  return "Estimates are for informational and planning purposes only and are not lending, appraisal, insurance, tax, legal, or financial advice. Actual rates, taxes, insurance, loan terms, property values, and eligibility vary. Buyers should consult a local licensed mortgage professional for financing. Sellers should contact Melrose Group Realty for a property-specific comparative market analysis and pricing consultation.";
}

/**
 * Queue a portal welcome email through PORTAL_COMM_QUEUE.
 * This does NOT bypass your communication scheduler; it respects the existing
 * queue architecture and 9:00 AM-6:30 PM Central delivery window.
 */
function BNP_queuePortalWelcomeEmail(leadId) {
  const prepared = BNP_prepareLeadExperience(leadId);
  const crm = CIP_crmWorkbook_();
  const lead = CIP_objects_(crm.getSheetByName("AE_LEADS")).find(function(r) {
    return String(r.LeadID || "") === String(leadId || "");
  });
  if (!lead) throw new Error("AE_LEADS record not found.");

  const site = CIP_websiteWorkbook_();
  const profiles = CIP_objects_(site.getSheetByName(CIP.SHEETS.PROFILES));
  const profile = profiles.find(function(r) {
    return String(r.LeadID || "") === String(leadId || "");
  }) || {};

  const firstName = lead.FirstName || BNP_firstName_(profile.FullName || "") || "there";
  const email = lead.Email || profile.Email || "";
  if (!email) throw new Error("Lead has no email address.");

  const subject = BNP_subject_(prepared.leadType, firstName);
  const html = BNP_buildWelcomeEmailHtml_(lead, profile, prepared);

  const queue = site.getSheetByName(CIP.SHEETS.COMM_QUEUE);
  if (!queue) throw new Error("Missing " + CIP.SHEETS.COMM_QUEUE);

  const headers = queue.getRange(1,1,1,queue.getLastColumn()).getDisplayValues()[0];
  const payload = {
    QueueID:CIP_uuid_("COMM"),
    LeadID:leadId,
    Email:email,
    ToEmail:email,
    RecipientEmail:email,
    Subject:subject,
    HtmlBody:html,
    Body:html,
    MessageType:"BOOK_NOW_PORTAL_WELCOME",
    Status:"QUEUED",
    ScheduledAt:BNP_nextAllowedSendTime_(),
    CreatedAt:new Date(),
    UpdatedAt:new Date()
  };

  const row = headers.map(function(h){ return payload[h] !== undefined ? payload[h] : ""; });
  queue.appendRow(row);

  const registrySheet = site.getSheetByName(CIP.SHEETS.REGISTRY);
  const registry = CIP_objects_(registrySheet).find(function(r) {
    return String(r.LeadID || "") === String(leadId || "");
  });
  if (registry) BNP_setByHeader_(registrySheet, registry._row, "WelcomeEmailQueuedAt", new Date());

  return {
    success:true,
    leadId:leadId,
    email:email,
    status:"QUEUED",
    scheduledAt:payload.ScheduledAt,
    portalUrl:prepared.portalUrl
  };
}

function BNP_subject_(type, firstName) {
  switch (type) {
    case "BUYER": return firstName + ", your personalized home buying dashboard is ready";
    case "SELLER": return firstName + ", your personalized home selling dashboard is ready";
    case "RENTER": return firstName + ", your personalized rental dashboard is ready";
    case "RECRUIT":
    case "RECRUITING": return firstName + ", your Melrose Group Realty career dashboard is ready";
    default: return firstName + ", your personalized Melrose Group Realty dashboard is ready";
  }
}

function BNP_buildWelcomeEmailHtml_(lead, profile, prepared) {
  const type = prepared.leadType;
  const name = lead.FirstName || BNP_firstName_(profile.FullName || "") || "there";
  const summary = BNP_summaryHtml_(type, lead, profile);
  const toolText = BNP_toolText_(type);

  return '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033;">' +
    '<div style="padding:28px;border:1px solid #e5e7eb;border-radius:14px;">' +
    '<h2 style="margin-top:0;">Welcome, ' + BNP_escape_(name) + '.</h2>' +
    '<p>Thank you for connecting with Melrose Group Realty. We created a personalized dashboard based on the information you submitted so you can keep your real estate journey organized in one place.</p>' +
    summary +
    '<p><strong>Your dashboard includes:</strong> ' + BNP_escape_(toolText) + ', your submitted criteria, assigned real estate professional, preferred professional resources, and next-step tools.</p>' +
    '<p style="text-align:center;margin:28px 0;">' +
    '<a href="' + prepared.portalUrl + '" style="display:inline-block;background:#172033;color:#fff;text-decoration:none;padding:14px 24px;border-radius:7px;font-weight:bold;">View My Personalized Dashboard</a>' +
    '</p>' +
    '<p style="text-align:center;">' +
    '<a href="' + BNP.BOOKING_URL + '" style="display:inline-block;border:1px solid #172033;color:#172033;text-decoration:none;padding:12px 20px;border-radius:7px;font-weight:bold;">Schedule a Consultation</a>' +
    '</p>' +
    '<p style="font-size:12px;color:#6b7280;margin-top:28px;">' + BNP_escape_(BNP_disclaimer_()) + '</p>' +
    '<p style="font-size:12px;color:#6b7280;">Licensed in Louisiana • (985) 250-0071 • Mandeville, LA</p>' +
    '</div></div>';
}

function BNP_summaryHtml_(type, lead, p) {
  const fields = [];
  function add(label, value) {
    if (value !== "" && value !== null && value !== undefined) {
      fields.push('<tr><td style="padding:6px 10px;font-weight:bold;">' + BNP_escape_(label) +
        '</td><td style="padding:6px 10px;">' + BNP_escape_(String(value)) + '</td></tr>');
    }
  }
  add("Real Estate Need", type);
  add("Parish / Area", p.ParishNeeded || p.Parish || lead.Parish);
  add("City / Area", p.CityOrArea);
  add("Timeline", p.Timeline);
  if (type === "BUYER" || type === "RENTER") {
    add("Budget / Price Range", p.PriceRangeOrRentBudget);
    add("Bedrooms", p.Bedrooms);
    add("Bathrooms", p.Bathrooms);
  }
  if (type === "BUYER") add("Financing Status", p.FinancingStatus);
  if (type === "SELLER") add("Property", p.PropertyToSellAddress);
  return fields.length
    ? '<table style="width:100%;border-collapse:collapse;background:#f8fafc;margin:20px 0;">' + fields.join("") + '</table>'
    : "";
}

function BNP_toolText_(type) {
  switch (type) {
    case "BUYER": return "an interactive affordability and estimated monthly payment calculator";
    case "SELLER": return "a preliminary home value planning estimator and valuation request center";
    case "RENTER": return "a rent-versus-buy cost comparison tool";
    case "RECRUIT":
    case "RECRUITING": return "career resources and Agent Academy access";
    default: return "personalized real estate resources";
  }
}

function BNP_nextAllowedSendTime_() {
  const now = new Date();
  const local = Utilities.formatDate(now, BNP.TIMEZONE, "yyyy-MM-dd HH:mm");
  const parts = local.split(/[- :]/).map(Number);
  const mins = parts[3] * 60 + parts[4];

  if (mins >= BNP.SEND_START_MINUTE && mins <= BNP.SEND_END_MINUTE) return now;

  const base = new Date(now);
  if (mins < BNP.SEND_START_MINUTE) {
    const delta = BNP.SEND_START_MINUTE - mins;
    return new Date(base.getTime() + delta * 60000);
  }

  const delta = (24 * 60 - mins) + BNP.SEND_START_MINUTE;
  return new Date(base.getTime() + delta * 60000);
}

function BNP_firstName_(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "";
}

function BNP_setByHeader_(sheet, row, header, value) {
  if (!sheet || !row) return;
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  const col = headers.indexOf(header) + 1;
  if (col > 0) sheet.getRange(row,col).setValue(value);
}

function BNP_escape_(v) {
  return String(v || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function BNP_getStatus() {
  const result = {
    success:true,
    version:BNP.VERSION,
    webAppUrl:BNP.WEBAPP_URL,
    communicationWindow:"9:00 AM-6:30 PM America/Chicago",
    buyerTool:"AFFORDABILITY_CALCULATOR",
    sellerTool:"HOME_VALUE_ESTIMATOR",
    renterTool:"RENT_VS_BUY_CALCULATOR",
    recruitTool:"AGENT_CAREER_CENTER",
    portalQueue:CIP.SHEETS.COMM_QUEUE
  };
  Logger.log(JSON.stringify(result,null,2));
  return result;
}
