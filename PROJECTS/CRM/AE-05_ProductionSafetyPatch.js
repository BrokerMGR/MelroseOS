/******************************************************************************
 * AE-05_ProductionSafetyPatch.gs
 * MelroseOS CRM Assignment Production Safety
 * Version 1.1.0
 *
 * Add AFTER the existing AE files. This intentionally overrides the older
 * helper functions with production-safe versions.
 ******************************************************************************/

function AE_bool_(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined || value === "") return false;

  const v = String(value).trim().toUpperCase();
  return ["TRUE","YES","Y","1","ACTIVE","ENABLED","AVAILABLE"].indexOf(v) !== -1;
}

function AE_isAgentActive_(agent) {
  // Production rule: BOTH switches must explicitly be ON.
  if (!AE_bool_(agent.Active)) return false;
  if (!AE_bool_(agent.AcceptingLeads)) return false;

  const dailyCap = Number(agent.DailyCap || 0);
  const current = Number(agent.CurrentDailyCount || 0);

  if (dailyCap > 0 && current >= dailyCap) return false;

  return true;
}

function AE_getAgentWorkbookId_(agent) {
  return String(
    agent.LeadsSheetId ||
    agent.AgentLeadsSheetId ||
    agent.AgentLeadsWorkbookId ||
    agent.LeadWorkbookId ||
    agent.LeadsWorkbookId ||
    agent.LeadSheetId ||
    agent.WorkbookID ||
    agent.WorkbookId ||
    agent.SpreadsheetID ||
    agent.SpreadsheetId ||
    ""
  ).trim();
}

function AE_isTestAgent_(agent) {
  const id = String(agent.AgentID || "").trim().toUpperCase();
  const email = String(agent.Email || "").trim().toLowerCase();
  const name = String(agent.AgentName || "").trim().toLowerCase();

  return (
    id.indexOf("AGT-TEST") === 0 ||
    id.indexOf("AGT-LOCK-TEST") === 0 ||
    id.indexOf("AGT-ELIGIBILITY-TEST") === 0 ||
    id.indexOf("AGT-RR-") === 0 ||
    id.indexOf("AGT-ASSIGNMENT-TEST") === 0 ||
    id.indexOf("AGT-SHADOW-TEST") === 0 ||
    id.indexOf("AGT-LI-QUEUE-TEST") === 0 ||
    id.indexOf("AGT-NF-BUILDER-TEST") === 0 ||
    id.indexOf("AGT-NF-FOLLOWUP-TEST") === 0 ||
    email.indexOf("@example.com") !== -1 ||
    name.indexOf("test") !== -1
  );
}

function AE_isAgentEligible_(agent, leadType, parish) {
  // Hard safety exclusion even if a test row is accidentally re-enabled.
  if (AE_isTestAgent_(agent)) return false;

  return (
    AE_isAgentActive_(agent) &&
    AE_agentSupportsLeadType_(agent, leadType) &&
    AE_agentSupportsParish_(agent, parish)
  );
}

function AE_findBrokerAgent_(agents) {
  const brokerEmail = String(AE.BROKER_EMAIL || "").trim().toLowerCase();

  return agents.find(function(agent) {
    return String(agent.Email || "").trim().toLowerCase() === brokerEmail;
  }) || agents.find(function(agent) {
    return String(agent.AgentName || "").trim().toUpperCase() ===
           String(AE.BROKER_NAME || "").trim().toUpperCase();
  }) || null;
}

/**
 * Production audit. This replaces the older audit interpretation.
 */
function AE_productionSafetyAudit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const agentsSheet = ss.getSheetByName(AE.AGENTS_SHEET);

  if (!agentsSheet) {
    throw new Error("Missing sheet: " + AE.AGENTS_SHEET);
  }

  const rows = AE_objects_(agentsSheet);

  const result = {
    success: true,
    version: "1.1.0",
    productionAgents: 0,
    eligibleProductionAgents: 0,
    inactiveOrNotAccepting: 0,
    testAgents: 0,
    brokerFound: false,
    agents: []
  };

  rows.forEach(function(agent) {
    const isTest = AE_isTestAgent_(agent);

    if (isTest) {
      result.testAgents++;
      return;
    }

    result.productionAgents++;

    const active = AE_bool_(agent.Active);
    const accepting = AE_bool_(agent.AcceptingLeads);
    const eligible = AE_isAgentActive_(agent);

    if (eligible) result.eligibleProductionAgents++;
    else result.inactiveOrNotAccepting++;

    if (
      String(agent.Email || "").trim().toLowerCase() ===
      String(AE.BROKER_EMAIL || "").trim().toLowerCase()
    ) {
      result.brokerFound = true;
    }

    result.agents.push({
      AgentID: agent.AgentID || "",
      AgentName: agent.AgentName || "",
      Email: agent.Email || "",
      Active: agent.Active,
      AcceptingLeads: agent.AcceptingLeads,
      activeBoolean: active,
      acceptingBoolean: accepting,
      eligibleNow: eligible,
      Parishes: agent.Parishes || "",
      LeadTypes: agent.LeadTypes || "",
      DailyCap: agent.DailyCap || "",
      CurrentDailyCount: agent.CurrentDailyCount || "",
      LeadsSheetId: AE_getAgentWorkbookId_(agent)
    });
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Safe test-agent shutdown.
 */
function AE_disableAllTestAgents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AE.AGENTS_SHEET);

  if (!sheet) {
    throw new Error("Missing sheet: " + AE.AGENTS_SHEET);
  }

  let disabled = 0;

  AE_objects_(sheet).forEach(function(agent) {
    if (!AE_isTestAgent_(agent)) return;

    AE_updateRow_(sheet, agent.__rowNumber, {
      Active: false,
      AcceptingLeads: false,
      UpdatedAt: new Date()
    });

    disabled++;
  });

  const result = {
    success: true,
    version: "1.1.0",
    disabledTestAgents: disabled
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Confirms the exact production routing expectation from current AE_AGENTS.
 */
function AE_verifyProductionSafety() {
  const audit = AE_productionSafetyAudit();

  const unexpected = audit.agents.filter(function(agent) {
    const rawActive = AE_bool_(agent.Active);
    const rawAccepting = AE_bool_(agent.AcceptingLeads);
    return agent.eligibleNow !== (rawActive && rawAccepting);
  });

  const result = {
    success: unexpected.length === 0 && audit.brokerFound,
    version: "1.1.0",
    brokerFound: audit.brokerFound,
    productionAgents: audit.productionAgents,
    eligibleProductionAgents: audit.eligibleProductionAgents,
    inactiveOrNotAccepting: audit.inactiveOrNotAccepting,
    testAgentsExcluded: audit.testAgents,
    eligibilityMismatches: unexpected.length,
    mismatches: unexpected
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
