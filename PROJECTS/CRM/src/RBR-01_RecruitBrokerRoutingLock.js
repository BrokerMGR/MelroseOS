/******************************************************************************
 * MelroseOS Recruit Broker Routing Lock
 * RBR-01_RecruitBrokerRoutingLock.gs
 * Version 1.0.0
 *
 * INSTALL: CRM Apps Script project
 *
 * PURPOSE
 * - Force all RECRUIT / RECRUITING leads to the broker.
 * - Bypass normal round robin for recruiting leads.
 * - Repair existing recruit leads with missing/generic assignment.
 * - Preserve current production lead flow for Buyer/Seller/Renter.
 ******************************************************************************/

const RBR = {
  VERSION: "1.0.0",
  BROKER_EMAIL: "melrosegroupbroker@gmail.com",
  BROKER_NAME: "Ulysses A. Barnes, Jr.",
  RECRUIT_TYPES: ["RECRUIT","RECRUITING","NEW RECRUIT","AGENT RECRUIT"],
  LEADS_SHEET: "AE_LEADS",
  AGENTS_SHEET: "AE_AGENTS",
  REASON: "RECRUIT_BROKER_OVERRIDE"
};

function RBR_installRecruitBrokerRoutingLock() {
  const broker = RBR_getBrokerAgent_();

  if (!broker) {
    throw new Error(
      "Broker agent record not found in AE_AGENTS for " +
      RBR.BROKER_EMAIL
    );
  }

  return {
    success: true,
    version: RBR.VERSION,
    brokerAgentID: broker.AgentID || "",
    brokerName: RBR_getAgentName_(broker),
    brokerEmail: RBR_getAgentEmail_(broker),
    recruitTypes: RBR.RECRUIT_TYPES,
    assignmentReason: RBR.REASON
  };
}

/**
 * MAIN GUARD
 * Call this before normal assignment logic.
 *
 * Returns:
 *   {handled:true,...} for recruit leads
 *   {handled:false} for all other lead types
 */
function RBR_applyRecruitRoutingOverride(lead) {
  lead = lead || {};

  if (!RBR_isRecruitType_(lead.LeadType || lead.Type || lead.Category)) {
    return {
      success: true,
      handled: false
    };
  }

  const broker = RBR_getBrokerAgent_();

  if (!broker) {
    throw new Error(
      "Recruit routing override failed: broker agent not found."
    );
  }

  return {
    success: true,
    handled: true,
    assignedAgentID: broker.AgentID || "",
    assignedAgentName: RBR_getAgentName_(broker),
    assignedAgentEmail: RBR_getAgentEmail_(broker),
    assignmentReason: RBR.REASON
  };
}

/**
 * Repair one existing lead by LeadID.
 */
function RBR_repairRecruitLeadById(leadId) {
  const ss = workbook_();
  const sheet = ss.getSheetByName(RBR.LEADS_SHEET);

  if (!sheet) {
    throw new Error("Missing " + RBR.LEADS_SHEET);
  }

  const lead = RBR_findLeadById_(sheet, leadId);

  if (!lead) {
    throw new Error("Lead not found: " + leadId);
  }

  if (!RBR_isRecruitType_(lead.LeadType)) {
    return {
      success: true,
      repaired: false,
      reason: "NOT_RECRUIT_LEAD"
    };
  }

  return RBR_writeBrokerAssignment_(sheet, lead);
}

/**
 * Repair all existing recruit leads where assignment is missing, generic,
 * or not assigned to the broker.
 */
function RBR_repairAllRecruitAssignments() {
  const ss = workbook_();
  const sheet = ss.getSheetByName(RBR.LEADS_SHEET);

  if (!sheet) {
    throw new Error("Missing " + RBR.LEADS_SHEET);
  }

  const rows = RBR_objects_(sheet);

  let scanned = 0;
  let repaired = 0;
  let alreadyCorrect = 0;

  rows.forEach(function(lead) {
    if (!RBR_isRecruitType_(lead.LeadType)) {
      return;
    }

    scanned++;

    if (RBR_isCorrectBrokerAssignment_(lead)) {
      alreadyCorrect++;
      return;
    }

    const result = RBR_writeBrokerAssignment_(sheet, lead);

    if (result.repaired) {
      repaired++;
    }
  });

  const result = {
    success: true,
    version: RBR.VERSION,
    recruitLeadsScanned: scanned,
    repaired: repaired,
    alreadyCorrect: alreadyCorrect
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Safety watcher for newly inserted/mirrored AE_LEADS rows.
 * Can be called by intake/assignment flow after a lead is written.
 */
function RBR_enforceRecruitAssignmentForLeadId(leadId) {
  return RBR_repairRecruitLeadById(leadId);
}

function RBR_writeBrokerAssignment_(sheet, lead) {
  const broker = RBR_getBrokerAgent_();

  if (!broker) {
    throw new Error("Broker agent record not found.");
  }

  const headers = RBR_headers_(sheet);

  RBR_set_(sheet, lead._row, headers, "AssignedAgentID", broker.AgentID || "");
  RBR_set_(
    sheet,
    lead._row,
    headers,
    "AssignedAgentName",
    RBR_getAgentName_(broker)
  );

  if (headers.indexOf("AssignedAgentEmail") !== -1) {
    RBR_set_(
      sheet,
      lead._row,
      headers,
      "AssignedAgentEmail",
      RBR_getAgentEmail_(broker)
    );
  }

  if (headers.indexOf("AssignmentReason") !== -1) {
    RBR_set_(
      sheet,
      lead._row,
      headers,
      "AssignmentReason",
      RBR.REASON
    );
  }

  if (headers.indexOf("AssignedAt") !== -1) {
    RBR_set_(
      sheet,
      lead._row,
      headers,
      "AssignedAt",
      new Date()
    );
  }

  if (headers.indexOf("UpdatedAt") !== -1) {
    RBR_set_(
      sheet,
      lead._row,
      headers,
      "UpdatedAt",
      new Date()
    );
  }

  return {
    success: true,
    repaired: true,
    leadId: lead.LeadID || "",
    assignedAgentID: broker.AgentID || "",
    assignedAgentName: RBR_getAgentName_(broker),
    assignedAgentEmail: RBR_getAgentEmail_(broker),
    assignmentReason: RBR.REASON
  };
}

function RBR_isCorrectBrokerAssignment_(lead) {
  const broker = RBR_getBrokerAgent_();

  if (!broker) {
    return false;
  }

  const idMatch =
    String(lead.AssignedAgentID || "") ===
    String(broker.AgentID || "");

  const emailMatch =
    String(
      lead.AssignedAgentEmail || ""
    ).toLowerCase() ===
    RBR_getAgentEmail_(broker).toLowerCase();

  return idMatch || emailMatch;
}

function RBR_getBrokerAgent_() {
  const sheet = workbook_().getSheetByName(RBR.AGENTS_SHEET);

  if (!sheet) {
    return null;
  }

  const agents = RBR_objects_(sheet);

  return agents.find(function(agent) {
    const email = RBR_getAgentEmail_(agent).toLowerCase();

    return email === RBR.BROKER_EMAIL.toLowerCase();
  }) || null;
}

function RBR_getAgentEmail_(agent) {
  return String(
    agent.AgentEmail ||
    agent.Email ||
    agent.WorkEmail ||
    ""
  ).trim();
}

function RBR_getAgentName_(agent) {
  return String(
    agent.AgentName ||
    agent.FullName ||
    agent.Name ||
    RBR.BROKER_NAME
  ).trim();
}

function RBR_isRecruitType_(value) {
  const type = String(value || "")
    .trim()
    .toUpperCase();

  return RBR.RECRUIT_TYPES.indexOf(type) !== -1;
}

function RBR_findLeadById_(sheet, leadId) {
  return RBR_objects_(sheet).find(function(row) {
    return String(row.LeadID || "") === String(leadId || "");
  }) || null;
}

function RBR_headers_(sheet) {
  return sheet
    .getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    )
    .getDisplayValues()[0]
    .map(function(value) {
      return String(value || "").trim();
    });
}

function RBR_set_(sheet, row, headers, header, value) {
  const col = headers.indexOf(header) + 1;

  if (col > 0) {
    sheet
      .getRange(row, col)
      .setValue(value);
  }
}

function RBR_objects_(sheet) {
  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return [];
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values.shift()
      .map(function(value) {
        return String(
          value || ""
        ).trim();
      });

  return values
    .filter(function(row) {
      return row.some(function(value) {
        return String(
          value || ""
        ).trim() !== "";
      });
    })
    .map(function(row, index) {
      const obj = {
        _row: index + 2
      };

      headers.forEach(
        function(header, i) {
          obj[header] =
            row[i];
        }
      );

      return obj;
    });
}

function RBR_getRecruitRoutingStatus() {
  const broker =
    RBR_getBrokerAgent_();

  const result = {
    success: true,
    version: RBR.VERSION,
    brokerFound:
      !!broker,
    brokerAgentID:
      broker
        ? broker.AgentID || ""
        : "",
    brokerName:
      broker
        ? RBR_getAgentName_(broker)
        : "",
    brokerEmail:
      broker
        ? RBR_getAgentEmail_(broker)
        : "",
    assignmentReason:
      RBR.REASON,
    recruitTypes:
      RBR.RECRUIT_TYPES
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
