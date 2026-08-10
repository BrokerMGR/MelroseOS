/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine Migration
 * File: AE-05_EligibilityEngine.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Determines which agents are eligible to receive a lead before routing.
 *
 * Requires:
 *   AE-01_Core.gs
 *   AE-02_Config.gs
 *   AE-03_AgentRegistry.gs
 *   AE-04_LeadLock.gs
 ******************************************************************************/

function AE_evaluateEligibility(lead) {
  AE_assertNotPaused_();

  if (!lead) {
    throw new Error("Lead record is required.");
  }

  const normalizedLead = AE_normalizeLeadForEligibility_(lead);

  if (normalizedLead.leadType === "RECRUITING") {
    return AE_evaluateRecruitingEligibility_(normalizedLead);
  }

  const locked = AE_resolveLockedAgent(
    normalizedLead.email,
    normalizedLead.phone
  );

  if (locked) {
    return {
      success: true,
      lead: normalizedLead,
      routeType: "LEAD_LOCK",
      eligibleAgents: [locked.agent],
      lockedAgent: locked.agent,
      reason: "Existing lead lock found."
    };
  }

  const agents = AE_getAllAgents();
  const eligible = [];
  const rejected = [];

  agents.forEach(function(agent) {
    const evaluation = AE_evaluateAgentEligibility_(
      agent,
      normalizedLead
    );

    if (evaluation.eligible) {
      eligible.push(agent);
    } else {
      rejected.push({
        AgentID: agent.AgentID,
        AgentName: agent.AgentName,
        reasons: evaluation.reasons
      });
    }
  });

  eligible.sort(AE_eligibilitySort_);

  return {
    success: true,
    lead: normalizedLead,
    routeType: "STANDARD",
    eligibleAgents: eligible,
    rejectedAgents: rejected,
    reason: eligible.length
      ? eligible.length + " eligible agent(s) found."
      : "No eligible agents found."
  };
}

function AE_evaluateAgentEligibility_(agent, lead) {
  const reasons = [];

  if (!AE_isTrue_(agent.Active)) {
    reasons.push("Agent is inactive.");
  }

  if (!AE_isTrue_(agent.AcceptingLeads)) {
    reasons.push("Agent is not accepting leads.");
  }

  if (
    AE_getBooleanConfig_("PARISH_MATCH_REQUIRED", true) &&
    !AE_agentMatchesParish_(agent, lead.parish)
  ) {
    reasons.push("Parish not eligible.");
  }

  if (
    AE_getBooleanConfig_("LEAD_TYPE_MATCH_REQUIRED", true) &&
    !AE_agentMatchesLeadType_(agent, lead.leadType)
  ) {
    reasons.push("Lead type not eligible.");
  }

  if (
    AE_getBooleanConfig_("DAILY_CAP_ENABLED", false) &&
    AE_agentAtDailyCap_(agent)
  ) {
    reasons.push("Daily assignment cap reached.");
  }

  return {
    eligible: reasons.length === 0,
    reasons: reasons
  };
}

function AE_agentMatchesParish_(agent, parish) {
  const target = String(parish || "").trim().toUpperCase();

  if (!target) {
    return true;
  }

  const parishes = AE_normalizeList_(agent.Parishes);

  if (
    AE_getBooleanConfig_("ALLOW_ALL_PARISH", true) &&
    parishes.indexOf("ALL") !== -1
  ) {
    return true;
  }

  return parishes.indexOf(target) !== -1;
}

function AE_agentMatchesLeadType_(agent, leadType) {
  const target = String(leadType || "").trim().toUpperCase();

  if (!target) {
    return true;
  }

  const leadTypes = AE_normalizeList_(agent.LeadTypes);

  if (
    AE_getBooleanConfig_("ALLOW_ALL_LEAD_TYPES", true) &&
    leadTypes.indexOf("ALL") !== -1
  ) {
    return true;
  }

  return leadTypes.indexOf(target) !== -1;
}

function AE_agentAtDailyCap_(agent) {
  const defaultCap = AE_getNumberConfig_("DEFAULT_DAILY_CAP", 999);
  const cap = Number(agent.DailyCap || defaultCap);
  const count = Number(agent.CurrentDailyCount || 0);

  return count >= cap;
}

function AE_evaluateRecruitingEligibility_(lead) {
  const route = String(
    AE_getConfigValue("RECRUITING_ROUTE", "BROKER_ONLY")
  ).toUpperCase();

  if (route !== "BROKER_ONLY") {
    return {
      success: false,
      lead: lead,
      routeType: "RECRUITING",
      eligibleAgents: [],
      rejectedAgents: [],
      reason: "Unsupported recruiting route configuration: " + route
    };
  }

  const broker = AE_findBrokerAgent_();

  return {
    success: !!broker,
    lead: lead,
    routeType: "BROKER_ONLY",
    eligibleAgents: broker ? [broker] : [],
    rejectedAgents: [],
    reason: broker
      ? "Recruiting lead routed to broker only."
      : "No broker agent is configured in AE_AGENTS."
  };
}

function AE_findBrokerAgent_() {
  const agents = AE_getAllAgents();

  const brokerEmail = AE_normalizeEmail_(
    AE_getConfigValue("BROKER_EMAIL", "")
  );

  if (brokerEmail) {
    for (let i = 0; i < agents.length; i++) {
      if (
        AE_normalizeEmail_(agents[i].Email) === brokerEmail &&
        AE_isTrue_(agents[i].Active)
      ) {
        return agents[i];
      }
    }
  }

  for (let j = 0; j < agents.length; j++) {
    const leadTypes = AE_normalizeList_(agents[j].LeadTypes);

    if (
      AE_isTrue_(agents[j].Active) &&
      leadTypes.indexOf("RECRUITING") !== -1
    ) {
      return agents[j];
    }
  }

  return null;
}

function AE_normalizeLeadForEligibility_(lead) {
  return {
    leadId: String(
      lead.LeadID ||
      lead.leadId ||
      ""
    ).trim(),

    firstName: String(
      lead.FirstName ||
      lead.firstName ||
      ""
    ).trim(),

    lastName: String(
      lead.LastName ||
      lead.lastName ||
      ""
    ).trim(),

    email: AE_normalizeEmail_(
      lead.Email ||
      lead.email
    ),

    phone: AE_normalizePhone_(
      lead.Phone ||
      lead.phone
    ),

    leadType: String(
      lead.LeadType ||
      lead.leadType ||
      ""
    ).trim().toUpperCase(),

    parish: String(
      lead.Parish ||
      lead.parish ||
      ""
    ).trim().toUpperCase(),

    source: String(
      lead.Source ||
      lead.source ||
      ""
    ).trim()
  };
}

function AE_eligibilitySort_(a, b) {
  if (AE_getBooleanConfig_("PRIORITY_ROUTING_ENABLED", true)) {
    const priorityA = Number(a.Priority || 100);
    const priorityB = Number(b.Priority || 100);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
  }

  const lastA = AE_dateNumber_(a.LastAssignedAt);
  const lastB = AE_dateNumber_(b.LastAssignedAt);

  if (lastA !== lastB) {
    return lastA - lastB;
  }

  const countA = Number(a.CurrentDailyCount || 0);
  const countB = Number(b.CurrentDailyCount || 0);

  if (countA !== countB) {
    return countA - countB;
  }

  return String(a.AgentName || "")
    .localeCompare(String(b.AgentName || ""));
}

function AE_getEligibilitySummary(lead) {
  const result = AE_evaluateEligibility(lead);

  return {
    success: result.success,
    routeType: result.routeType,
    eligibleCount: result.eligibleAgents.length,
    eligibleAgentIDs: result.eligibleAgents.map(function(agent) {
      return agent.AgentID;
    }),
    reason: result.reason
  };
}

function AE_testEligibilityEngine() {
  AE_initializeConfig();

  AE_upsertAgent({
    AgentID: "AGT-ELIGIBILITY-TEST",
    AgentName: "Eligibility Test Agent",
    Email: "eligibility-test@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "ST. TAMMANY",
    LeadTypes: "BUYER,SELLER,RENTER",
    Priority: 999,
    DailyCap: 999
  });

  const result = AE_evaluateEligibility({
    LeadID: "LEAD-ELIGIBILITY-TEST",
    FirstName: "Test",
    LastName: "Lead",
    Email: "new-eligibility-lead@example.com",
    Phone: "(985) 555-0199",
    LeadType: "BUYER",
    Parish: "ST. TAMMANY",
    Source: "SELF_TEST"
  });

  const found = result.eligibleAgents.some(function(agent) {
    return agent.AgentID === "AGT-ELIGIBILITY-TEST";
  });

  if (!found) {
    throw new Error("Eligibility Engine self-test failed.");
  }

  Logger.log(JSON.stringify(AE_getEligibilitySummary({
    LeadID: "LEAD-ELIGIBILITY-TEST-2",
    Email: "eligibility-summary@example.com",
    LeadType: "BUYER",
    Parish: "ST. TAMMANY"
  })));

  return true;
}
