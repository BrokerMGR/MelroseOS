
/******************************************************************************
 * MelroseOS CRM Production Hardening
 * CRM-04_ProductionHardening.gs
 * Version 1.0.0
 *
 * PURPOSE
 * - Auto-run reconciliation after normal intake processing
 * - Prevent test agents from receiving live leads
 * - Provide production-routing audit for AE_AGENTS
 ******************************************************************************/

const PH = {
  VERSION: "1.0.0",

  TEST_AGENT_PREFIXES: [
    "AGT-TEST",
    "AGT-LOCK-TEST",
    "AGT-ELIGIBILITY-TEST",
    "AGT-RR-",
    "AGT-ASSIGNMENT-TEST",
    "AGT-SHADOW-TEST",
    "AGT-LI-QUEUE-TEST",
    "AGT-NF-BUILDER-TEST",
    "AGT-NF-FOLLOWUP-TEST"
  ],

  REQUIRED_AGENT_FIELDS: [
    "AgentID",
    "AgentName",
    "Email",
    "Active",
    "AcceptingLeads",
    "Parishes",
    "LeadTypes",
    "Priority",
    "DailyCap",
    "CurrentDailyCount",
    "LastAssignedAt",
    "LeadsSheetId"
  ]
};


/* ============================================================================
 * MASTER CRM CYCLE
 * ==========================================================================*/

function PH_runCRMProductionCycle() {
  const result = {
    success: true,
    version: PH.VERSION,
    intake: null,
    assignment: null,
    distribution: null,
    reconciliation: null,
    errors: []
  };

  try {
    result.intake = UIX_runUniversalIntakeProcessor();
  } catch (error) {
    result.errors.push("UIX intake: " + String(error && error.stack ? error.stack : error));
  }

  try {
    result.assignment = AE_runAssignmentEngine();
  } catch (error) {
    result.errors.push("Assignment: " + String(error && error.stack ? error.stack : error));
  }

  try {
    result.distribution = AE_processDistributionQueue();
  } catch (error) {
    result.errors.push("Distribution: " + String(error && error.stack ? error.stack : error));
  }

  try {
    result.reconciliation = UIX_reconcileProcessingRows();
  } catch (error) {
    result.errors.push("Reconciliation: " + String(error && error.stack ? error.stack : error));
  }

  result.success = result.errors.length === 0;

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


/* ============================================================================
 * TRIGGER INSTALLER
 * ==========================================================================*/

function PH_installCRMProductionTrigger() {
  const handler = "PH_runCRMProductionCycle";

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    const name = trigger.getHandlerFunction();

    if (
      name === handler ||
      name === "UIX_runUniversalIntakeProcessor"
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyMinutes(30)
    .create();

  Logger.log(
    "Installed 30-minute CRM production cycle trigger: " + handler
  );
}


/* ============================================================================
 * TEST AGENT SAFETY
 * ==========================================================================*/

function PH_previewTestAgents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AE.AGENTS_SHEET);

  if (!sheet) {
    throw new Error("Missing sheet: " + AE.AGENTS_SHEET);
  }

  const rows = AE_objects_(sheet);

  const matches = rows
    .filter(PH_isTestAgent_)
    .map(function(agent) {
      return {
        rowNumber: agent.__rowNumber,
        AgentID: agent.AgentID || "",
        AgentName: agent.AgentName || "",
        Email: agent.Email || "",
        Active: agent.Active || "",
        AcceptingLeads: agent.AcceptingLeads || "",
        Parishes: agent.Parishes || "",
        LeadTypes: agent.LeadTypes || ""
      };
    });

  const result = {
    success: true,
    count: matches.length,
    agents: matches
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function PH_disableTestAgents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AE.AGENTS_SHEET);

  if (!sheet) {
    throw new Error("Missing sheet: " + AE.AGENTS_SHEET);
  }

  const rows = AE_objects_(sheet);
  let disabled = 0;

  rows.forEach(function(agent) {
    if (!PH_isTestAgent_(agent)) {
      return;
    }

    AE_updateRow_(sheet, agent.__rowNumber, {
      Active: false,
      AcceptingLeads: false,
      UpdatedAt: new Date()
    });

    disabled++;
  });

  const result = {
    success: true,
    disabled: disabled
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function PH_isTestAgent_(agent) {
  const id = String(agent.AgentID || "").trim().toUpperCase();
  const email = String(agent.Email || "").trim().toLowerCase();
  const name = String(agent.AgentName || "").trim().toLowerCase();

  if (
    email.indexOf("@example.com") !== -1 ||
    name.indexOf("test") !== -1
  ) {
    return true;
  }

  return PH.TEST_AGENT_PREFIXES.some(function(prefix) {
    return id.indexOf(prefix) === 0;
  });
}


/* ============================================================================
 * PRODUCTION ROUTING AUDIT
 * ==========================================================================*/

function PH_auditProductionAgentRouting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AE.AGENTS_SHEET);

  if (!sheet) {
    throw new Error("Missing sheet: " + AE.AGENTS_SHEET);
  }

  const rows = AE_objects_(sheet);

  const productionAgents = rows
    .filter(function(agent) {
      return !PH_isTestAgent_(agent);
    })
    .map(function(agent) {
      const issues = [];

      if (!String(agent.AgentID || "").trim()) {
        issues.push("Missing AgentID");
      }

      if (!String(agent.AgentName || "").trim()) {
        issues.push("Missing AgentName");
      }

      if (!String(agent.Email || "").trim()) {
        issues.push("Missing Email");
      }

      if (!String(agent.Parishes || "").trim()) {
        issues.push("Missing Parishes");
      }

      if (!String(agent.LeadTypes || "").trim()) {
        issues.push("Missing LeadTypes");
      }

      if (!String(agent.LeadsSheetId || "").trim()) {
        issues.push("Missing LeadsSheetId");
      }

      const accepting = String(
        agent.AcceptingLeads === undefined
          ? ""
          : agent.AcceptingLeads
      ).trim();

      if (!accepting) {
        issues.push("AcceptingLeads not set");
      }

      return {
        AgentID: agent.AgentID || "",
        AgentName: agent.AgentName || "",
        Email: agent.Email || "",
        Active: agent.Active,
        AcceptingLeads: agent.AcceptingLeads,
        Parishes: agent.Parishes || "",
        LeadTypes: agent.LeadTypes || "",
        Priority: agent.Priority || "",
        DailyCap: agent.DailyCap || "",
        CurrentDailyCount: agent.CurrentDailyCount || "",
        LeadsSheetId: agent.LeadsSheetId || "",
        eligibleNow: AE_isAgentActive_(agent),
        issues: issues
      };
    });

  const result = {
    success: true,
    productionAgentCount: productionAgents.length,
    agentsWithIssues: productionAgents.filter(function(agent) {
      return agent.issues.length > 0;
    }).length,
    agents: productionAgents
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


/* ============================================================================
 * OPTIONAL DAILY COUNTER RESET
 * ==========================================================================*/

function PH_resetDailyLeadCounts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AE.AGENTS_SHEET);

  if (!sheet) {
    throw new Error("Missing sheet: " + AE.AGENTS_SHEET);
  }

  const rows = AE_objects_(sheet);
  let reset = 0;

  rows.forEach(function(agent) {
    if (PH_isTestAgent_(agent)) {
      return;
    }

    AE_updateRow_(sheet, agent.__rowNumber, {
      CurrentDailyCount: 0,
      UpdatedAt: new Date()
    });

    reset++;
  });

  const result = {
    success: true,
    reset: reset
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function PH_installDailyCounterResetTrigger() {
  const handler = "PH_resetDailyLeadCounts";

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .atHour(0)
    .everyDays(1)
    .create();

  Logger.log("Installed daily lead-count reset trigger.");
}
