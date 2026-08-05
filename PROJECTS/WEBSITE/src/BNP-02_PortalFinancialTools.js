/******************************************************************************
 * MelroseOS Portal Financial + Seller Planning Tools
 * BNP-02_PortalFinancialTools.gs
 * Version 1.0.0
 ******************************************************************************/

function BNP_getPortalToolConfig(portalToken) {
  const site = CIP_websiteWorkbook_();
  const registry = CIP_objects_(site.getSheetByName(CIP.SHEETS.REGISTRY))
    .find(function(r){ return String(r.PortalToken || "") === String(portalToken || ""); });
  if (!registry) throw new Error("Invalid portal token.");

  const profile = CIP_objects_(site.getSheetByName(CIP.SHEETS.PROFILES))
    .find(function(r){ return String(r.LeadID || "") === String(registry.LeadID || ""); }) || {};

  const type = String(registry.LeadType || profile.LeadType || "").toUpperCase();

  return {
    success:true,
    leadId:registry.LeadID,
    leadType:type,
    tool:BNP_primaryTool_(type),
    assumptions:BNP_marketAssumptions_(),
    disclaimer:BNP_disclaimer_(),
    profile:profile
  };
}

/**
 * Buyer affordability/payment planning calculator.
 * All outputs are estimates only.
 */
function BNP_calculateBuyerAffordability(input) {
  input = input || {};
  const a = BNP_marketAssumptions_();

  const price = BNP_num_(input.purchasePrice);
  const downPct = BNP_numDefault_(input.downPaymentPercent, a.BuyerDownPaymentPercent);
  const rate = BNP_numDefault_(input.interestRate, a.MortgageInterestRate);
  const years = BNP_numDefault_(input.loanTermYears, a.LoanTermYears);
  const taxPct = BNP_numDefault_(input.propertyTaxAnnualPercent, a.PropertyTaxAnnualPercent);
  const insurancePct = BNP_numDefault_(input.homeInsuranceAnnualPercent, a.HomeInsuranceAnnualPercent);
  const hoa = BNP_num_(input.monthlyHoa);
  const other = BNP_num_(input.monthlyOther);

  const down = price * downPct / 100;
  const principal = Math.max(price - down, 0);
  const n = Math.max(years * 12, 1);
  const r = rate / 100 / 12;

  const pi = r > 0
    ? principal * (r * Math.pow(1+r,n)) / (Math.pow(1+r,n)-1)
    : principal / n;

  const taxes = price * taxPct / 100 / 12;
  const insurance = price * insurancePct / 100 / 12;
  const total = pi + taxes + insurance + hoa + other;

  return {
    success:true,
    purchasePrice:BNP_money_(price),
    downPayment:BNP_money_(down),
    estimatedLoanAmount:BNP_money_(principal),
    estimatedPrincipalAndInterest:BNP_money_(pi),
    estimatedMonthlyTaxes:BNP_money_(taxes),
    estimatedMonthlyInsurance:BNP_money_(insurance),
    monthlyHoa:BNP_money_(hoa),
    monthlyOther:BNP_money_(other),
    estimatedTotalMonthlyPayment:BNP_money_(total),
    assumptions:{
      downPaymentPercent:downPct,
      interestRate:rate,
      loanTermYears:years,
      propertyTaxAnnualPercent:taxPct,
      homeInsuranceAnnualPercent:insurancePct
    },
    disclaimer:BNP_disclaimer_()
  };
}

/**
 * Seller preliminary planning estimate.
 * This intentionally does NOT claim to be an appraisal or automated valuation.
 * The client supplies an expected/preliminary value or the system may pass a
 * separately sourced preliminary market value later.
 */
function BNP_calculateSellerValueRange(input) {
  input = input || {};
  const a = BNP_marketAssumptions_();

  const estimate = BNP_num_(input.preliminaryEstimate);
  const rangePct = BNP_numDefault_(input.rangePercent, a.SellerValueRangePercent);

  return {
    success:true,
    preliminaryEstimate:BNP_money_(estimate),
    estimatedLow:BNP_money_(estimate * (1 - rangePct/100)),
    estimatedHigh:BNP_money_(estimate * (1 + rangePct/100)),
    rangePercent:rangePct,
    valuationType:"PRELIMINARY_INFORMATIONAL_RANGE",
    nextStep:"Request a property-specific comparative market analysis from Melrose Group Realty.",
    disclaimer:BNP_disclaimer_()
  };
}

function BNP_marketAssumptions_() {
  const sheet = CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.MARKET_ASSUMPTIONS);
  const rows = CIP_objects_(sheet);
  const out = {
    MortgageInterestRate:6.50,
    BuyerDownPaymentPercent:20,
    PropertyTaxAnnualPercent:1.50,
    HomeInsuranceAnnualPercent:5.00,
    LoanTermYears:30,
    SellerValueRangePercent:7.50
  };

  rows.forEach(function(r) {
    const key = String(r.Key || r.Setting || r.Name || "").trim();
    const value = r.Value !== undefined ? r.Value :
      (r.AssumptionValue !== undefined ? r.AssumptionValue : r.DefaultValue);
    if (key && out[key] !== undefined && value !== "") out[key] = BNP_numDefault_(value, out[key]);
  });
  return out;
}

function BNP_num_(v) {
  const n = Number(String(v === undefined || v === null ? "" : v).replace(/[$,%\s,]/g,""));
  return isFinite(n) ? n : 0;
}

function BNP_numDefault_(v, d) {
  if (v === "" || v === undefined || v === null) return Number(d);
  const n = BNP_num_(v);
  return isFinite(n) ? n : Number(d);
}

function BNP_money_(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}
