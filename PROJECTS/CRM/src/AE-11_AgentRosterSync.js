/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine
 * File: AE-11_AgentRosterSync.gs
 * Version: 1.0.0
 *
 * Source Spreadsheet ID:
 * 1XeMYTkNhEnvT1IrzYmnUA0pNYh7UcsrVWjH4YlDMo2s
 * Source Tab: Agents
 ******************************************************************************/

const AE_AGENT_ROSTER_SOURCE = {
  SPREADSHEET_ID: "1XeMYTkNhEnvT1IrzYmnUA0pNYh7UcsrVWjH4YlDMo2s",
  SHEET_NAME: "Agents"
};

const AE_AGENT_ROSTER_SYNC_LOG = "AE_AGENT_ROSTER_SYNC_LOG";

function AE_initializeAgentRosterSync() {
  AE_initializeConfig();

  const sheet = createSheetIfMissing_(
    workbook_(),
    AE_AGENT_ROSTER_SYNC_LOG
  );

  AE_setHeadersIfEmpty_(sheet, [
    "SyncID",
    "SourceAgentID",
    "AgentName",
    "Email",
    "Action",
    "Status",
    "Details",
    "SyncedAt"
  ]);

  return true;
}

function AE_syncProductionAgentRoster() {
  AE_initializeAgentRosterSync();

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

  if (!sourceRows.length) {
    throw new Error("Source roster contains no agent records.");
  }

  const results = [];

  sourceRows.forEach(function(sourceAgent) {
    try {
      const mapped = AE_mapRosterAgent_(sourceAgent);

      if (!mapped.AgentID) throw new Error("AgentID is missing.");
      if (!mapped.AgentName) throw new Error("AgentName is missing.");
      if (!mapped.Email) throw new Error("AgentEmail/NotifyEmail is missing.");

      const existed = !!AE_getAgent(mapped.AgentID);

      AE_upsertAgent(mapped);

      AE_logAgentRosterSync_(
        mapped,
        existed ? "UPDATED" : "CREATED",
        "SUCCESS",
        "Production roster synchronized."
      );

      results.push({
        success: true,
        agentId: mapped.AgentID,
        agentName: mapped.AgentName,
        action: existed ? "UPDATED" : "CREATED"
      });

    } catch (error) {
      AE_logAgentRosterSync_(
        {
          AgentID: sourceAgent.AgentID || "",
          AgentName: sourceAgent.AgentName || "",
          Email: sourceAgent.NotifyEmail || sourceAgent.AgentEmail || ""
        },
        "SKIPPED",
        "ERROR",
        error.message || String(error)
      );

      results.push({
        success: false,
        agentId: sourceAgent.AgentID || "",
        agentName: sourceAgent.AgentName || "",
        error: error.message || String(error)
      });
    }
  });

  setDocProperty_(
    "AE_AGENT_ROSTER_LAST_SYNC",
    new Date().toISOString()
  );

  setDocProperty_(
    "AE_AGENT_ROSTER_SYNC_COUNT",
    String(results.filter(function(r) {
      return r.success;
    }).length)
  );

  return {
    success: results.every(function(r) {
      return r.success;
    }),
    sourceRows: sourceRows.length,
    synchronized: results.filter(function(r) {
      return r.success;
    }).length,
    failed: results.filter(function(r) {
      return !r.success;
    }).length,
    results: results
  };
}

function AE_mapRosterAgent_(sourceAgent) {
  const email = AE_normalizeEmail_(
    sourceAgent.NotifyEmail ||
    sourceAgent.AgentEmail ||
    ""
  );

  const parishes = AE_buildParishCoverage_(sourceAgent);

  const active = AE_rosterTrue_(sourceAgent.Active);

  return {
    AgentID: String(sourceAgent.AgentID || "").trim(),
    AgentName: String(sourceAgent.AgentName || "").trim(),
    Email: email,
    Phone: "",
    Active: active,
    AcceptingLeads: active,
    Parishes: parishes.length
      ? parishes.join(",")
      : String(sourceAgent.DefaultParish || "").trim().toUpperCase(),
    LeadTypes: "BUYER,SELLER,RENTER",
    Priority: 100,
    DailyCap: AE_getNumberConfig_("DEFAULT_DAILY_CAP", 999)
  };
}

function AE_buildParishCoverage_(sourceAgent) {
  if (AE_rosterTrue_(sourceAgent["Covers: ALL"])) {
    return ["ALL"];
  }

  const map = [
    ["Covers: St. Tammany", "ST. TAMMANY"],
    ["Covers: Orleans", "ORLEANS"],
    ["Covers: Jefferson", "JEFFERSON"],
    ["Covers: St. Bernard", "ST. BERNARD"],
    ["Covers: Plaquemines", "PLAQUEMINES"],
    ["Covers: St. Charles", "ST. CHARLES"],
    ["Covers: St. John the Baptist", "ST. JOHN THE BAPTIST"],
    ["Covers: Tangipahoa", "TANGIPAHOA"],
    ["Covers: Livingston", "LIVINGSTON"],
    ["Covers: Ascension", "ASCENSION"],
    ["Covers: East Baton Rouge", "EAST BATON ROUGE"],
    ["Covers: West Baton Rouge", "WEST BATON ROUGE"],
    ["Covers: Lafourche", "LAFOURCHE"],
    ["Covers: Terrebonne", "TERREBONNE"],
    ["Covers: St. James", "ST. JAMES"],
    ["Covers: St. Mary", "ST. MARY"]
  ];

  const parishes = [];

  map.forEach(function(item) {
    if (AE_rosterTrue_(sourceAgent[item[0]])) {
      parishes.push(item[1]);
    }
  });

  if (!parishes.length && sourceAgent.DefaultParish) {
    parishes.push(
      String(sourceAgent.DefaultParish).trim().toUpperCase()
    );
  }

  return parishes;
}

function AE_rosterTrue_(value) {
  if (value === true) return true;

  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  return ["TRUE", "YES", "Y", "1", "ACTIVE"].indexOf(normalized) !== -1;
}

function AE_readRosterObjects_(sheet) {
  const values = sheet.getDataRange().getValues();

  const headers = values.shift().map(function(header) {
    return String(header || "").trim();
  });

  return values
    .filter(function(row) {
      return row.some(function(value) {
        return String(value || "").trim() !== "";
      });
    })
    .map(function(row) {
      const obj = {};

      headers.forEach(function(header, index) {
        obj[header] = row[index];
      });

      return obj;
    });
}

function AE_deactivateAllTestAgents() {
  const agents = AE_getAllAgents();
  let deactivated = 0;

  agents.forEach(function(agent) {
    const id = String(agent.AgentID || "").toUpperCase();

    if (
      id.indexOf("TEST") !== -1 ||
      id.indexOf("AGT-RR-") === 0
    ) {
      AE_setAgentActive(agent.AgentID, false);
      AE_setAgentAcceptingLeads(agent.AgentID, false);
      deactivated++;
    }
  });

  return {
    success: true,
    deactivated: deactivated
  };
}

function AE_logAgentRosterSync_(agent, action, status, details) {
  const sheet = workbook_().getSheetByName(
    AE_AGENT_ROSTER_SYNC_LOG
  );

  if (!sheet) return;

  sheet.appendRow([
    "SYNC-" + Utilities.getUuid().substring(0, 8).toUpperCase(),
    agent.AgentID || "",
    agent.AgentName || "",
    agent.Email || "",
    action,
    status,
    details,
    timestamp_()
  ]);
}

function AE_getAgentRosterSyncStatus() {
  const agents = AE_getAllAgents();

  return {
    lastSync:
      getDocProperty_("AE_AGENT_ROSTER_LAST_SYNC") || "",
    lastSyncCount:
      Number(getDocProperty_("AE_AGENT_ROSTER_SYNC_COUNT") || 0),
    totalAgents: agents.length,
    activeAgents: agents.filter(function(agent) {
      return AE_isTrue_(agent.Active) &&
        AE_isTrue_(agent.AcceptingLeads);
    }).length
  };
}

function AE_testAgentRosterSync() {
  AE_initializeAgentRosterSync();

  const sourceSS = SpreadsheetApp.openById(
    AE_AGENT_ROSTER_SOURCE.SPREADSHEET_ID
  );

  const sourceSheet = sourceSS.getSheetByName(
    AE_AGENT_ROSTER_SOURCE.SHEET_NAME
  );

  if (!sourceSheet) {
    throw new Error("Production Agent Roster source tab was not found.");
  }

  const rows = AE_readRosterObjects_(sourceSheet);

  if (!rows.length) {
    throw new Error("Production Agent Roster contains no records.");
  }

  Logger.log(JSON.stringify({
    success: true,
    sourceRows: rows.length,
    sourceSpreadsheet: AE_AGENT_ROSTER_SOURCE.SPREADSHEET_ID,
    sourceSheet: AE_AGENT_ROSTER_SOURCE.SHEET_NAME
  }));

  return true;
}
