/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine
 * File: AE-12_AgentLeadDistributionBridge.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   1. Adds/synchronizes each production agent's LeadsSheetId into AE_AGENTS.
 *   2. Pushes assigned leads into each agent's independent Google Sheet.
 *   3. Prevents duplicate LeadID writes.
 *
 * Source Roster:
 *   Spreadsheet ID: 1XeMYTkNhEnvT1IrzYmnUA0pNYh7UcsrVWjH4YlDMo2s
 *   Tab: Agents
 *
 * Source spreadsheet ID priority:
 *   AgentLeadsSheetId -> LeadsSheetId -> LeadSheetId
 *
 * Destination tab created inside each agent workbook:
 *   MelroseOS Leads
 *
 * Requires:
 *   AE-01 through AE-11
 ******************************************************************************/

const AE_AGENT_LEAD_DESTINATION_TAB = "MelroseOS Leads";
const AE_AGENT_DISTRIBUTION_LOG = "AE_AGENT_DISTRIBUTION_LOG";

function AE_initializeAgentLeadDistributionBridge() {
  AE_initializeAgentRosterSync();

  const ss = workbook_();

  AE_ensureAgentRegistryColumn_("LeadsSheetId");

  const logSheet = createSheetIfMissing_(
    ss,
    AE_AGENT_DISTRIBUTION_LOG
  );

  AE_setHeadersIfEmpty_(
    logSheet,
    [
      "DistributionID",
      "LeadID",
      "AgentID",
      "AgentName",
      "LeadsSheetId",
      "Action",
      "Status",
      "Details",
      "DistributedAt"
    ]
  );

  return true;
}

function AE_syncAgentLeadSheetIds() {
  AE_initializeAgentLeadDistributionBridge();

  const sourceSS = SpreadsheetApp.openById(
    AE_AGENT_ROSTER_SOURCE.SPREADSHEET_ID
  );

  const sourceSheet = sourceSS.getSheetByName(
    AE_AGENT_ROSTER_SOURCE.SHEET_NAME
  );

  if (!sourceSheet) {
    throw new Error("Source roster tab not found: Agents");
  }

  const sourceRows = AE_readRosterObjects_(sourceSheet);
  const agentSheet = workbook_().getSheetByName(AE.SHEETS.AGENTS);

  const headers = agentSheet
    .getRange(1, 1, 1, agentSheet.getLastColumn())
    .getDisplayValues()[0];

  const idCol = headers.indexOf("AgentID") + 1;
  const leadsSheetIdCol = headers.indexOf("LeadsSheetId") + 1;

  if (!idCol || !leadsSheetIdCol) {
    throw new Error(
      "AgentID or LeadsSheetId column is missing from AE_AGENTS."
    );
  }

  let updated = 0;
  let skipped = 0;

  sourceRows.forEach(function(sourceAgent) {
    const agentId = String(
      sourceAgent.AgentID || ""
    ).trim();

    if (!agentId) {
      skipped++;
      return;
    }

    const leadsSheetId = AE_pickAgentLeadsSheetId_(
      sourceAgent
    );

    const row = AE_findRowByValue_(
      AE.SHEETS.AGENTS,
      "AgentID",
      agentId
    );

    if (!row) {
      skipped++;
      return;
    }

    agentSheet
      .getRange(row, leadsSheetIdCol)
      .setValue(leadsSheetId);

    const updatedAtCol =
      headers.indexOf("UpdatedAt") + 1;

    if (updatedAtCol) {
      agentSheet
        .getRange(row, updatedAtCol)
        .setValue(timestamp_());
    }

    updated++;
  });

  setDocProperty_(
    "AE_AGENT_LEAD_SHEET_IDS_LAST_SYNC",
    new Date().toISOString()
  );

  return {
    success: true,
    updated: updated,
    skipped: skipped
  };
}

function AE_pickAgentLeadsSheetId_(sourceAgent) {
  return String(
    sourceAgent.AgentLeadsSheetId ||
    sourceAgent.LeadsSheetId ||
    sourceAgent.LeadSheetId ||
    ""
  ).trim();
}

function AE_ensureAgentRegistryColumn_(headerName) {
  const sheet = workbook_().getSheetByName(
    AE.SHEETS.AGENTS
  );

  if (!sheet) {
    throw new Error("AE_AGENTS sheet is missing.");
  }

  const lastColumn = Math.max(
    1,
    sheet.getLastColumn()
  );

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0];

  if (
    headers.indexOf(headerName) !== -1
  ) {
    return headers.indexOf(headerName) + 1;
  }

  const newColumn = lastColumn + 1;

  sheet
    .getRange(1, newColumn)
    .setValue(headerName);

  return newColumn;
}

function AE_distributeAssignedLead(leadId) {
  AE_initializeAgentLeadDistributionBridge();

  const lead = AE_findAssignedLeadForDistribution_(
    leadId
  );

  if (!lead) {
    throw new Error(
      "Assigned lead not found: " + leadId
    );
  }

  const agentId = String(
    lead.AssignedAgentID || ""
  ).trim();

  if (!agentId) {
    throw new Error(
      "Lead has no AssignedAgentID: " + leadId
    );
  }

  const agent = AE_getAgent(agentId);

  if (!agent) {
    throw new Error(
      "Assigned agent not found: " + agentId
    );
  }

  if (!AE_isTrue_(agent.Active)) {
    throw new Error(
      "Assigned agent is inactive: " + agentId
    );
  }

  const leadsSheetId = String(
    agent.LeadsSheetId || ""
  ).trim();

  if (!leadsSheetId) {
    AE_logDistribution_(
      lead,
      agent,
      "",
      "SKIPPED",
      "ERROR",
      "Agent has no LeadsSheetId configured."
    );

    throw new Error(
      "Agent has no LeadsSheetId configured: " +
      agent.AgentName
    );
  }

  const destinationSS =
    SpreadsheetApp.openById(
      leadsSheetId
    );

  let destinationSheet =
    destinationSS.getSheetByName(
      AE_AGENT_LEAD_DESTINATION_TAB
    );

  if (!destinationSheet) {
    destinationSheet =
      destinationSS.insertSheet(
        AE_AGENT_LEAD_DESTINATION_TAB
      );
  }

  AE_setupAgentLeadDestinationHeaders_(
    destinationSheet
  );

  const existingRow =
    AE_findLeadInDestination_(
      destinationSheet,
      lead.LeadID
    );

  if (existingRow) {
    AE_logDistribution_(
      lead,
      agent,
      leadsSheetId,
      "NO_CHANGE",
      "SUCCESS",
      "Lead already exists in agent destination sheet."
    );

    return {
      success: true,
      duplicate: true,
      leadId: lead.LeadID,
      agentId: agent.AgentID,
      agentName: agent.AgentName,
      leadsSheetId: leadsSheetId,
      action: "NO_CHANGE"
    };
  }

  destinationSheet.appendRow([
    lead.LeadID || "",
    lead.CreatedAt || "",
    lead.FirstName || "",
    lead.LastName || "",
    lead.Email || "",
    lead.Phone || "",
    lead.LeadType || "",
    lead.Parish || "",
    lead.Source || "",
    lead.Status || "",
    agent.AgentID || "",
    agent.AgentName || "",
    lead.AssignedAt || "",
    lead.AssignmentReason || "",
    timestamp_()
  ]);

  AE_logDistribution_(
    lead,
    agent,
    leadsSheetId,
    "CREATED",
    "SUCCESS",
    "Assigned lead pushed to agent workbook."
  );

  return {
    success: true,
    duplicate: false,
    leadId: lead.LeadID,
    agentId: agent.AgentID,
    agentName: agent.AgentName,
    leadsSheetId: leadsSheetId,
    action: "CREATED"
  };
}

function AE_distributePendingAssignedLeads(limit) {
  AE_initializeAgentLeadDistributionBridge();

  const max = Math.max(
    1,
    Number(limit || 50)
  );

  const leads = AE_sheetObjects_(
    AE.SHEETS.LEADS
  )
    .filter(function(lead) {
      return (
        String(
          lead.AssignedAgentID || ""
        ).trim() !== ""
      );
    })
    .slice(0, max);

  const results = [];

  leads.forEach(function(lead) {
    try {
      results.push(
        AE_distributeAssignedLead(
          lead.LeadID
        )
      );
    } catch (error) {
      results.push({
        success: false,
        leadId: lead.LeadID || "",
        error:
          error.message ||
          String(error)
      });
    }
  });

  return {
    success:
      results.every(function(result) {
        return result.success;
      }),
    processed: results.length,
    successful:
      results.filter(function(result) {
        return result.success;
      }).length,
    failed:
      results.filter(function(result) {
        return !result.success;
      }).length,
    results: results
  };
}

function AE_setupAgentLeadDestinationHeaders_(
  sheet
) {
  const headers = [
    "LeadID",
    "CreatedAt",
    "FirstName",
    "LastName",
    "Email",
    "Phone",
    "LeadType",
    "Parish",
    "Source",
    "Status",
    "AssignedAgentID",
    "AssignedAgentName",
    "AssignedAt",
    "AssignmentReason",
    "SyncedAt"
  ];

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([headers]);

    sheet.setFrozenRows(1);
    autoResize_(sheet);
    return;
  }

  const current = sheet
    .getRange(
      1,
      1,
      1,
      Math.max(
        sheet.getLastColumn(),
        headers.length
      )
    )
    .getDisplayValues()[0];

  const hasAnyHeader =
    current.some(function(value) {
      return String(
        value || ""
      ).trim() !== "";
    });

  if (!hasAnyHeader) {
    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([headers]);

    sheet.setFrozenRows(1);
    autoResize_(sheet);
  }
}

function AE_findLeadInDestination_(
  sheet,
  leadId
) {
  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return null;
  }

  const headers = sheet
    .getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    )
    .getDisplayValues()[0];

  const leadIdCol =
    headers.indexOf("LeadID") + 1;

  if (!leadIdCol) {
    return null;
  }

  const values = sheet
    .getRange(
      2,
      leadIdCol,
      sheet.getLastRow() - 1,
      1
    )
    .getDisplayValues();

  const target =
    String(
      leadId || ""
    ).trim();

  for (
    let i = 0;
    i < values.length;
    i++
  ) {
    if (
      String(
        values[i][0] || ""
      ).trim() === target
    ) {
      return i + 2;
    }
  }

  return null;
}

function AE_findAssignedLeadForDistribution_(
  leadId
) {
  const leads =
    AE_sheetObjects_(
      AE.SHEETS.LEADS
    );

  const target =
    String(
      leadId || ""
    ).trim();

  for (
    let i = 0;
    i < leads.length;
    i++
  ) {
    if (
      String(
        leads[i].LeadID || ""
      ).trim() === target
    ) {
      return leads[i];
    }
  }

  return null;
}

function AE_logDistribution_(
  lead,
  agent,
  leadsSheetId,
  action,
  status,
  details
) {
  const sheet =
    workbook_().getSheetByName(
      AE_AGENT_DISTRIBUTION_LOG
    );

  if (!sheet) {
    return;
  }

  sheet.appendRow([
    "DIST-" +
      Utilities
        .getUuid()
        .substring(0, 8)
        .toUpperCase(),

    lead.LeadID || "",

    agent.AgentID || "",

    agent.AgentName || "",

    leadsSheetId || "",

    action || "",

    status || "",

    details || "",

    timestamp_()
  ]);
}

function AE_getAgentLeadDistributionStatus() {
  const agents =
    AE_getAllAgents();

  return {
    lastLeadSheetIdSync:
      getDocProperty_(
        "AE_AGENT_LEAD_SHEET_IDS_LAST_SYNC"
      ) || "",

    activeAgents:
      agents.filter(function(agent) {
        return (
          AE_isTrue_(agent.Active) &&
          AE_isTrue_(
            agent.AcceptingLeads
          )
        );
      }).length,

    activeAgentsWithLeadSheets:
      agents.filter(function(agent) {
        return (
          AE_isTrue_(agent.Active) &&
          AE_isTrue_(
            agent.AcceptingLeads
          ) &&
          String(
            agent.LeadsSheetId || ""
          ).trim() !== ""
        );
      }).length
  };
}

function AE_testAgentLeadDistributionBridge() {
  AE_initializeAgentLeadDistributionBridge();

  const sync =
    AE_syncAgentLeadSheetIds();

  const status =
    AE_getAgentLeadDistributionStatus();

  Logger.log(
    JSON.stringify(sync)
  );

  Logger.log(
    JSON.stringify(status)
  );

  if (
    status.activeAgents > 0 &&
    status.activeAgentsWithLeadSheets === 0
  ) {
    throw new Error(
      "No active production agents have a LeadsSheetId configured."
    );
  }

  return true;
}
