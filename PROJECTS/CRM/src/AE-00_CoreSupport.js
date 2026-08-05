/******************************************************************************
 * MelroseOS Enterprise
 * File: AE-00_CoreSupport.js
 * Version: 1.0.0
 *
 * Canonical shared support layer for the Assignment Engine.
 ******************************************************************************/

const AE_CORE_SUPPORT_VERSION = "1.0.0";

function AE_initializeConfig() {
  AE_ensureRuntimeConstants_();

  const ss = AE_workbook_();

  AE_ensureSheet_(
    ss,
    AE.SHEETS.CONFIG,
    [
      "ConfigKey",
      "ConfigValue",
      "Description",
      "UpdatedAt"
    ]
  );

  AE_ensureSheet_(
    ss,
    AE.SHEETS.AGENTS,
    [
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
      "Phone",
      "Notes",
      "UpdatedAt"
    ]
  );

  AE_ensureSheet_(
    ss,
    AE.SHEETS.LEADS,
    [
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
      "AssignedAgentEmail",
      "AssignmentMethod",
      "UpdatedAt"
    ]
  );

  AE_ensureSheet_(
    ss,
    AE.SHEETS.ROUTING_STATE,
    [
      "RouteKey",
      "LeadType",
      "Parish",
      "LastAgentID",
      "LastAgentName",
      "LastAssignedAt",
      "UpdatedAt"
    ]
  );

  AE_ensureSheet_(
    ss,
    AE.SHEETS.LOG,
    [
      "Timestamp",
      "EventType",
      "ReferenceID",
      "Message",
      "DetailsJSON"
    ]
  );

  const defaults = {
    MODE: "SHADOW",
    ROUND_ROBIN_ENABLED: true,
    PRIORITY_ROUTING_ENABLED: true,
    PARISH_MATCH_REQUIRED: true,
    LEAD_TYPE_MATCH_REQUIRED: true,
    DAILY_CAP_ENABLED: false,
    DEFAULT_DAILY_CAP: 25,
    ALLOW_ALL_PARISH: true,
    ALLOW_ALL_LEAD_TYPES: true,
    RECRUITING_ROUTE: "BROKER_ONLY",
    BROKER_EMAIL: "melrosegroupbroker@gmail.com",
    BROKER_NAME: "Ulysses A. Barnes, Jr."
  };

  Object.keys(defaults).forEach(function(key) {
    AE_upsertConfigInternal_(
      key,
      defaults[key],
      "MelroseOS Assignment Engine default."
    );
  });

  AE_upsertAgentInternal_({
    AgentID: "BROKER-001",
    AgentName: "Ulysses A. Barnes, Jr.",
    Email: "melrosegroupbroker@gmail.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "ALL",
    LeadTypes: "ALL,RECRUITING",
    Priority: 1,
    DailyCap: 999,
    CurrentDailyCount: 0,
    Notes: "Broker authority and fallback agent."
  });

  return {
    success: true,
    release: "AE-00-CORE-SUPPORT",
    version: AE_CORE_SUPPORT_VERSION,
    mode: AE_getMode(),
    sheets: AE.SHEETS,
    completedAt: new Date().toISOString()
  };
}

function AE_ensureRuntimeConstants_() {
  if (typeof AE === "undefined") {
    throw new Error(
      "AE-01_AssignmentEngine.js must define the AE constant."
    );
  }

  if (!AE.SHEETS) {
    AE.SHEETS = {};
  }

  AE.SHEETS.CONFIG =
    AE.SHEETS.CONFIG || "AE_CONFIG";

  AE.SHEETS.AGENTS =
    AE.SHEETS.AGENTS ||
    AE.AGENTS_SHEET ||
    "AE_AGENTS";

  AE.SHEETS.LEADS =
    AE.SHEETS.LEADS ||
    AE.LEADS_SHEET ||
    "AE_LEADS";

  AE.SHEETS.ROUTING_STATE =
    AE.SHEETS.ROUTING_STATE ||
    AE.ROUTING_STATE_SHEET ||
    "AE_ROUTING_STATE";

  AE.SHEETS.LOG =
    AE.SHEETS.LOG || "AE_LOG";

  AE.AGENTS_SHEET = AE.SHEETS.AGENTS;
  AE.LEADS_SHEET = AE.SHEETS.LEADS;
  AE.ROUTING_STATE_SHEET =
    AE.SHEETS.ROUTING_STATE;

  return AE.SHEETS;
}

function AE_workbook_() {
  if (typeof workbook_ === "function") {
    return workbook_();
  }

  return SpreadsheetApp.getActiveSpreadsheet();
}

function AE_ensureSheet_(ss, sheetName, requiredHeaders) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  AE_setHeadersIfEmpty_(
    sheet,
    requiredHeaders
  );

  return sheet;
}

function AE_setHeadersIfEmpty_(sheet, requiredHeaders) {
  if (!sheet) {
    throw new Error("Sheet is required.");
  }

  const headers = Array.isArray(requiredHeaders)
    ? requiredHeaders
    : [];

  if (!headers.length) {
    return [];
  }

  if (
    sheet.getLastRow() === 0 ||
    sheet.getLastColumn() === 0
  ) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    sheet.setFrozenRows(1);
    return headers;
  }

  let currentHeaders = sheet
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

  const missing = headers.filter(function(header) {
    return currentHeaders.indexOf(header) === -1;
  });

  if (missing.length) {
    sheet
      .getRange(
        1,
        currentHeaders.length + 1,
        1,
        missing.length
      )
      .setValues([missing]);

    currentHeaders =
      currentHeaders.concat(missing);
  }

  sheet.setFrozenRows(1);
  return currentHeaders;
}

function AE_sheetObjects_(sheetOrName) {
  const ss = AE_workbook_();

  const sheet =
    typeof sheetOrName === "string"
      ? ss.getSheetByName(sheetOrName)
      : sheetOrName;

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const headers = sheet
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

  const values = sheet
    .getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      headers.length
    )
    .getValues();

  return values.map(function(row, index) {
    const result = {
      _row: index + 2,
      __rowNumber: index + 2
    };

    headers.forEach(function(header, column) {
      result[header] = row[column];
    });

    return result;
  });
}

function AE_findRowByValue_(
  sheetOrName,
  headerName,
  value
) {
  const rows = AE_sheetObjects_(sheetOrName);
  const target = String(value || "").trim();

  for (let i = 0; i < rows.length; i++) {
    if (
      String(
        rows[i][headerName] || ""
      ).trim() === target
    ) {
      return rows[i]._row;
    }
  }

  return 0;
}

function AE_getConfigValue(key, defaultValue) {
  AE_initializeConfig();

  const configKey = String(key || "")
    .trim()
    .toUpperCase();

  const rows = AE_sheetObjects_(
    AE.SHEETS.CONFIG
  );

  const record = rows.find(function(row) {
    return String(
      row.ConfigKey || ""
    ).trim().toUpperCase() === configKey;
  });

  if (!record) {
    return defaultValue;
  }

  const value = record.ConfigValue;

  return value === undefined ||
    value === null ||
    String(value).trim() === ""
    ? defaultValue
    : value;
}

function AE_getBooleanConfig_(
  key,
  defaultValue
) {
  return AE_isTrue_(
    AE_getConfigValue(
      key,
      defaultValue
    )
  );
}

function AE_getNumberConfig_(
  key,
  defaultValue
) {
  const value = Number(
    AE_getConfigValue(
      key,
      defaultValue
    )
  );

  return Number.isFinite(value)
    ? value
    : Number(defaultValue || 0);
}

function AE_upsertConfigInternal_(
  key,
  value,
  description
) {
  const sheet = AE_workbook_()
    .getSheetByName(AE.SHEETS.CONFIG);

  const configKey = String(key || "")
    .trim()
    .toUpperCase();

  const row = AE_findRowByValue_(
    sheet,
    "ConfigKey",
    configKey
  );

  const payload = {
    ConfigKey: configKey,
    ConfigValue: value,
    Description:
      String(description || "").trim(),
    UpdatedAt: new Date()
  };

  if (row) {
    AE_updateObjectRow_(
      sheet,
      row,
      payload
    );
  } else {
    AE_appendObjectRow_(
      sheet,
      payload
    );
  }

  return payload;
}

function AE_getMode() {
  const mode = String(
    AE_getConfigValue(
      "MODE",
      "SHADOW"
    )
  ).trim().toUpperCase();

  if (
    ["LIVE", "SHADOW", "PAUSED"]
      .indexOf(mode) === -1
  ) {
    return "SHADOW";
  }

  return mode;
}

function AE_setShadowMode() {
  AE_initializeConfig();

  AE_upsertConfigInternal_(
    "MODE",
    "SHADOW",
    "Assignment decisions are evaluated without live state commits."
  );

  return {
    success: true,
    mode: "SHADOW"
  };
}

function AE_setLiveMode() {
  AE_initializeConfig();

  AE_upsertConfigInternal_(
    "MODE",
    "LIVE",
    "Live Assignment Engine mode."
  );

  return {
    success: true,
    mode: "LIVE"
  };
}

function AE_setPausedMode() {
  AE_initializeConfig();

  AE_upsertConfigInternal_(
    "MODE",
    "PAUSED",
    "Assignment Engine paused."
  );

  return {
    success: true,
    mode: "PAUSED"
  };
}

function AE_isLiveMode_() {
  return AE_getMode() === "LIVE";
}

function AE_isShadowMode_() {
  return AE_getMode() === "SHADOW";
}

function AE_assertNotPaused_() {
  const mode = AE_getMode();

  if (mode === "PAUSED") {
    throw new Error(
      "Assignment Engine is paused."
    );
  }

  return {
    success: true,
    mode: mode
  };
}

function AE_getAllAgents() {
  AE_initializeConfig();

  return AE_sheetObjects_(
    AE.SHEETS.AGENTS
  );
}

function AE_getAgent(agentIdOrEmail) {
  AE_initializeConfig();

  const target = String(
    agentIdOrEmail || ""
  ).trim().toLowerCase();

  if (!target) {
    return null;
  }

  const agents = AE_getAllAgents();

  return agents.find(function(agent) {
    return (
      String(
        agent.AgentID || ""
      ).trim().toLowerCase() === target ||
      String(
        agent.Email || ""
      ).trim().toLowerCase() === target
    );
  }) || null;
}

function AE_upsertAgent(agent) {
  AE_initializeConfig();
  return AE_upsertAgentInternal_(agent);
}

function AE_upsertAgentInternal_(agent) {
  const input = agent || {};

  const agentId = String(
    input.AgentID || input.agentId || ""
  ).trim();

  const email = String(
    input.Email || input.email || ""
  ).trim().toLowerCase();

  if (!agentId && !email) {
    throw new Error(
      "AgentID or Email is required."
    );
  }

  const sheet = AE_workbook_()
    .getSheetByName(AE.SHEETS.AGENTS);

  const rows = AE_sheetObjects_(sheet);

  const existing = rows.find(function(row) {
    return (
      agentId &&
      String(
        row.AgentID || ""
      ).trim() === agentId
    ) || (
      email &&
      String(
        row.Email || ""
      ).trim().toLowerCase() === email
    );
  });

  const payload = {
    AgentID:
      agentId ||
      String(
        existing &&
        existing.AgentID ||
        AE_uuid_("AGENT")
      ),
    AgentName: String(
      input.AgentName ||
      input.agentName ||
      input.Name ||
      input.name ||
      existing &&
      existing.AgentName ||
      ""
    ).trim(),
    Email:
      email ||
      String(
        existing &&
        existing.Email ||
        ""
      ).trim().toLowerCase(),
    Active:
      input.Active !== undefined
        ? AE_isTrue_(input.Active)
        : existing
          ? AE_isTrue_(existing.Active)
          : true,
    AcceptingLeads:
      input.AcceptingLeads !== undefined
        ? AE_isTrue_(
            input.AcceptingLeads
          )
        : existing
          ? AE_isTrue_(
              existing.AcceptingLeads
            )
          : true,
    Parishes: String(
      input.Parishes !== undefined
        ? input.Parishes
        : existing &&
          existing.Parishes ||
          "ALL"
    ).trim(),
    LeadTypes: String(
      input.LeadTypes !== undefined
        ? input.LeadTypes
        : existing &&
          existing.LeadTypes ||
          "ALL"
    ).trim(),
    Priority: Number(
      input.Priority !== undefined
        ? input.Priority
        : existing &&
          existing.Priority ||
          100
    ),
    DailyCap: Number(
      input.DailyCap !== undefined
        ? input.DailyCap
        : existing &&
          existing.DailyCap ||
          AE_getNumberConfig_(
            "DEFAULT_DAILY_CAP",
            25
          )
    ),
    CurrentDailyCount: Number(
      input.CurrentDailyCount !== undefined
        ? input.CurrentDailyCount
        : existing &&
          existing.CurrentDailyCount ||
          0
    ),
    LastAssignedAt:
      input.LastAssignedAt !== undefined
        ? input.LastAssignedAt
        : existing &&
          existing.LastAssignedAt ||
          "",
    Phone: String(
      input.Phone !== undefined
        ? input.Phone
        : existing &&
          existing.Phone ||
          ""
    ).trim(),
    Notes: String(
      input.Notes !== undefined
        ? input.Notes
        : existing &&
          existing.Notes ||
          ""
    ).trim(),
    UpdatedAt: new Date()
  };

  if (existing) {
    AE_updateObjectRow_(
      sheet,
      existing._row,
      payload
    );
  } else {
    AE_appendObjectRow_(
      sheet,
      payload
    );
  }

  return payload;
}

function AE_setAgentActive(
  agentIdOrEmail,
  active
) {
  const agent = AE_getAgent(
    agentIdOrEmail
  );

  if (!agent) {
    throw new Error(
      "Agent not found: " +
      agentIdOrEmail
    );
  }

  return AE_upsertAgent({
    AgentID: agent.AgentID,
    Active: AE_isTrue_(active)
  });
}

function AE_setAgentAcceptingLeads(
  agentIdOrEmail,
  acceptingLeads
) {
  const agent = AE_getAgent(
    agentIdOrEmail
  );

  if (!agent) {
    throw new Error(
      "Agent not found: " +
      agentIdOrEmail
    );
  }

  return AE_upsertAgent({
    AgentID: agent.AgentID,
    AcceptingLeads:
      AE_isTrue_(acceptingLeads)
  });
}

function AE_markAgentAssigned(agentId) {
  const agent = AE_getAgent(agentId);

  if (!agent) {
    throw new Error(
      "Agent not found: " + agentId
    );
  }

  return AE_upsertAgent({
    AgentID: agent.AgentID,
    CurrentDailyCount:
      Number(
        agent.CurrentDailyCount || 0
      ) + 1,
    LastAssignedAt: new Date()
  });
}

function AE_normalizeList_(value) {
  if (Array.isArray(value)) {
    return value
      .map(function(item) {
        return String(item || "")
          .trim()
          .toUpperCase()
          .replace(
            /\s+PARISH$/i,
            ""
          );
      })
      .filter(Boolean);
  }

  return String(value || "")
    .split(/[,;|/\n]+/)
    .map(function(item) {
      return String(item || "")
        .trim()
        .toUpperCase()
        .replace(
          /\s+PARISH$/i,
          ""
        );
    })
    .filter(Boolean);
}

function AE_isTrue_(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  return [
    "TRUE",
    "YES",
    "Y",
    "1",
    "ON",
    "ACTIVE",
    "ENABLED",
    "AVAILABLE"
  ].indexOf(
    String(value || "")
      .trim()
      .toUpperCase()
  ) !== -1;
}

function AE_uuid_(prefix) {
  const cleanPrefix = String(
    prefix || "AE"
  ).trim().toUpperCase();

  return (
    cleanPrefix +
    "-" +
    Utilities.getUuid()
      .replace(/-/g, "")
      .substring(0, 16)
      .toUpperCase()
  );
}

function AE_dateNumber_(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return 0;
  }

  const date = new Date(value);
  const result = date.getTime();

  return Number.isFinite(result)
    ? result
    : 0;
}

function AE_appendObjectRow_(
  sheet,
  payload
) {
  const headers = sheet
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

  sheet.appendRow(
    headers.map(function(header) {
      return payload[header] !== undefined
        ? payload[header]
        : "";
    })
  );

  return sheet.getLastRow();
}

function AE_updateObjectRow_(
  sheet,
  rowNumber,
  payload
) {
  const headers = sheet
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

  const current = sheet
    .getRange(
      rowNumber,
      1,
      1,
      headers.length
    )
    .getValues()[0];

  const updated = headers.map(
    function(header, index) {
      return payload[header] !== undefined
        ? payload[header]
        : current[index];
    }
  );

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      headers.length
    )
    .setValues([updated]);

  return rowNumber;
}

function AE_log_(
  eventType,
  referenceId,
  message,
  details
) {
  AE_initializeConfig();

  const sheet = AE_workbook_()
    .getSheetByName(AE.SHEETS.LOG);

  sheet.appendRow([
    new Date(),
    String(eventType || "").trim(),
    String(referenceId || "").trim(),
    String(message || "").trim(),
    typeof details === "string"
      ? details
      : JSON.stringify(details || {})
  ]);

  return true;
}

function AE_runCoreSupportDiagnostics() {
  const tests = [];

  function add(
    code,
    passed,
    details
  ) {
    tests.push({
      code: code,
      status: passed
        ? "PASS"
        : "FAIL",
      details: details
    });
  }

  const initialization =
    AE_initializeConfig();

  add(
    "INITIALIZATION",
    initialization.success === true,
    "Assignment Engine initialized."
  );

  add(
    "CONFIG_SHEET",
    Boolean(
      AE_workbook_().getSheetByName(
        AE.SHEETS.CONFIG
      )
    ),
    "AE_CONFIG exists."
  );

  add(
    "AGENTS_SHEET",
    Boolean(
      AE_workbook_().getSheetByName(
        AE.SHEETS.AGENTS
      )
    ),
    "AE_AGENTS exists."
  );

  add(
    "LEADS_SHEET",
    Boolean(
      AE_workbook_().getSheetByName(
        AE.SHEETS.LEADS
      )
    ),
    "AE_LEADS exists."
  );

  const broker = AE_getAgent(
    "melrosegroupbroker@gmail.com"
  );

  add(
    "BROKER_AGENT",
    Boolean(
      broker &&
      AE_isTrue_(broker.Active)
    ),
    "Broker fallback agent exists."
  );

  add(
    "VALID_MODE",
    ["LIVE", "SHADOW", "PAUSED"]
      .indexOf(AE_getMode()) !== -1,
    "Assignment Engine mode is valid."
  );

  const failed = tests.filter(
    function(test) {
      return test.status === "FAIL";
    }
  ).length;

  const result = {
    release: "AE-00-CORE-SUPPORT",
    version: AE_CORE_SUPPORT_VERSION,
    overallStatus: failed
      ? "FAIL"
      : "PASS",
    passed:
      tests.length - failed,
    failed: failed,
    mode: AE_getMode(),
    tests: tests,
    completedAt:
      new Date().toISOString()
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