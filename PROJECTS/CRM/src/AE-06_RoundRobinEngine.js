/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine Migration
 * File: AE-06_RoundRobinEngine.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Selects the next eligible agent using lead lock, broker-only recruiting,
 *   priority routing, and round-robin rules.
 *
 * Requires:
 *   AE-01_Core.gs
 *   AE-02_Config.gs
 *   AE-03_AgentRegistry.gs
 *   AE-04_LeadLock.gs
 *   AE-05_EligibilityEngine.gs
 ******************************************************************************/

function AE_selectAgentForLead(lead) {
  AE_assertNotPaused_();

  const evaluation = AE_evaluateEligibility(lead);

  if (!evaluation.success || !evaluation.eligibleAgents.length) {
    return {
      success: false,
      agent: null,
      routeType: evaluation.routeType || "NONE",
      method: "NO_ASSIGNMENT",
      reason: evaluation.reason || "No eligible agents found."
    };
  }

  if (evaluation.routeType === "LEAD_LOCK") {
    return {
      success: true,
      agent: evaluation.eligibleAgents[0],
      routeType: "LEAD_LOCK",
      method: "LEAD_LOCK",
      reason: "Repeat lead retained by existing lead lock."
    };
  }

  if (evaluation.routeType === "BROKER_ONLY") {
    return {
      success: true,
      agent: evaluation.eligibleAgents[0],
      routeType: "BROKER_ONLY",
      method: "BROKER_ONLY",
      reason: "Recruiting lead routed directly to broker."
    };
  }

  const eligible = evaluation.eligibleAgents.slice();

  if (!AE_getBooleanConfig_("ROUND_ROBIN_ENABLED", true)) {
    return {
      success: true,
      agent: eligible[0],
      routeType: "STANDARD",
      method: "PRIORITY_FIRST",
      reason: "Round robin disabled; first eligible agent selected."
    };
  }

  const selected = AE_selectRoundRobinAgent_(eligible);

  return {
    success: !!selected,
    agent: selected,
    routeType: "STANDARD",
    method: "ROUND_ROBIN",
    reason: selected
      ? "Selected by priority-aware round robin."
      : "No eligible agent could be selected."
  };
}

function AE_selectRoundRobinAgent_(eligibleAgents) {
  if (!eligibleAgents || !eligibleAgents.length) {
    return null;
  }

  let candidates = eligibleAgents.slice();

  if (AE_getBooleanConfig_("PRIORITY_ROUTING_ENABLED", true)) {
    const bestPriority = Math.min.apply(
      null,
      candidates.map(function(agent) {
        return Number(agent.Priority || 100);
      })
    );

    candidates = candidates.filter(function(agent) {
      return Number(agent.Priority || 100) === bestPriority;
    });
  }

  candidates.sort(function(a, b) {
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

    return String(a.AgentID || "")
      .localeCompare(String(b.AgentID || ""));
  });

  return candidates[0] || null;
}

function AE_previewAssignment(lead) {
  const selection = AE_selectAgentForLead(lead);

  return {
    success: selection.success,
    mode: AE_getMode(),
    agentId: selection.agent ? selection.agent.AgentID : "",
    agentName: selection.agent ? selection.agent.AgentName : "",
    routeType: selection.routeType,
    method: selection.method,
    reason: selection.reason
  };
}

function AE_commitSelectionState_(lead, selection) {
  if (!selection || !selection.success || !selection.agent) {
    return false;
  }

  if (!AE_isLiveMode_()) {
    return false;
  }

  AE_markAgentAssigned(selection.agent.AgentID);

  AE_createOrUpdateLeadLock(
    {
      LeadID: lead.LeadID || lead.leadId || "",
      Email: lead.Email || lead.email || "",
      Phone: lead.Phone || lead.phone || ""
    },
    selection.agent
  );

  return true;
}

function AE_testRoundRobinEngine() {
  AE_initializeConfig();

  AE_upsertAgent({
    AgentID: "AGT-RR-001",
    AgentName: "Round Robin Test One",
    Email: "rr-test-one@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "TEST PARISH",
    LeadTypes: "BUYER",
    Priority: 500,
    DailyCap: 999,
    CurrentDailyCount: 0
  });

  AE_upsertAgent({
    AgentID: "AGT-RR-002",
    AgentName: "Round Robin Test Two",
    Email: "rr-test-two@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "TEST PARISH",
    LeadTypes: "BUYER",
    Priority: 500,
    DailyCap: 999,
    CurrentDailyCount: 0
  });

  const result = AE_previewAssignment({
    LeadID: "LEAD-RR-TEST",
    Email: "round-robin-lead@example.com",
    Phone: "(985) 555-0177",
    LeadType: "BUYER",
    Parish: "TEST PARISH",
    Source: "SELF_TEST"
  });

  if (!result.success || !result.agentId) {
    throw new Error("Round Robin Engine self-test failed.");
  }

  Logger.log(JSON.stringify(result));

  return true;
}
