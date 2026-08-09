/******************************************************************************
 * MelroseOS Enterprise
 * Lead Lifecycle Management
 * File: LC-01_Core.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Tracks each lead after assignment through follow-up, contact, consultation,
 *   active client, closed/lost, and nurture stages.
 *
 * Requires:
 *   AE-01 through AE-13
 *   LI-01 through LI-09
 *   NF-01 through NF-06
 *   AP-01 through AP-06
 ******************************************************************************/

const LC = {
  VERSION: "1.0.0",
  SHEETS: {
    LIFECYCLE: "LC_LEAD_LIFECYCLE",
    ACTIVITY: "LC_ACTIVITY_LOG",
    STATUS_HISTORY: "LC_STATUS_HISTORY"
  },
  STATUSES: [
    "NEW",
    "ASSIGNED",
    "CONTACT_ATTEMPTED",
    "CONTACTED",
    "CONSULTATION_SCHEDULED",
    "CONSULTATION_COMPLETED",
    "ACTIVE_CLIENT",
    "UNDER_CONTRACT",
    "CLOSED",
    "NURTURE",
    "LOST",
    "DO_NOT_CONTACT"
  ]
};

function LC_initializeCore() {
  const ss = workbook_();

  Object.keys(LC.SHEETS).forEach(function(key) {
    createSheetIfMissing_(ss, LC.SHEETS[key]);
  });

  LC_setHeadersIfEmpty_(
    ss.getSheetByName(LC.SHEETS.LIFECYCLE),
    [
      "LeadID",
      "AgentID",
      "AgentName",
      "LeadType",
      "CurrentStatus",
      "LastContactAt",
      "NextFollowUpAt",
      "ConsultationAt",
      "ClosedAt",
      "LostReason",
      "DoNotContact",
      "CreatedAt",
      "UpdatedAt"
    ]
  );

  LC_setHeadersIfEmpty_(
    ss.getSheetByName(LC.SHEETS.ACTIVITY),
    [
      "ActivityID",
      "LeadID",
      "AgentID",
      "ActivityType",
      "Channel",
      "Direction",
      "Details",
      "OccurredAt"
    ]
  );

  LC_setHeadersIfEmpty_(
    ss.getSheetByName(LC.SHEETS.STATUS_HISTORY),
    [
      "HistoryID",
      "LeadID",
      "PreviousStatus",
      "NewStatus",
      "ChangedBy",
      "Details",
      "ChangedAt"
    ]
  );

  return {
    success: true,
    version: LC.VERSION
  };
}

function LC_setHeadersIfEmpty_(sheet, headers) {
  if (!sheet) {
    throw new Error("Required Lead Lifecycle sheet is missing.");
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    autoResize_(sheet);
    return;
  }

  const width = Math.max(sheet.getLastColumn(), headers.length);
  const existing = sheet
    .getRange(1, 1, 1, width)
    .getDisplayValues()[0];

  const hasHeaders = existing.some(function(value) {
    return String(value || "").trim() !== "";
  });

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    autoResize_(sheet);
  }
}

function LC_createOrUpdateLifecycle(leadId) {
  LC_initializeCore();

  const lead = LC_findLead_(leadId);

  if (!lead) {
    throw new Error("Lead not found: " + leadId);
  }

  const agent = lead.AssignedAgentID
    ? AE_getAgent(lead.AssignedAgentID)
    : null;

  const sheet = workbook_().getSheetByName(
    LC.SHEETS.LIFECYCLE
  );

  const row = LC_findLifecycleRow_(leadId);

  const existing = row
    ? LC_getLifecycleByRow_(row)
    : {};

  const currentStatus =
    String(existing.CurrentStatus || "").trim() ||
    String(lead.Status || "").trim() ||
    "ASSIGNED";

  const payload = [
    lead.LeadID,
    lead.AssignedAgentID || "",
    agent ? agent.AgentName || "" : lead.AssignedAgentName || "",
    lead.LeadType || "",
    currentStatus,
    existing.LastContactAt || "",
    existing.NextFollowUpAt || "",
    existing.ConsultationAt || "",
    existing.ClosedAt || "",
    existing.LostReason || "",
    existing.DoNotContact || false,
    existing.CreatedAt || timestamp_(),
    timestamp_()
  ];

  if (row) {
    sheet.getRange(row, 1, 1, payload.length).setValues([payload]);
  } else {
    sheet.appendRow(payload);

    LC_logStatusChange_(
      lead.LeadID,
      "",
      currentStatus,
      "SYSTEM",
      "Lifecycle record created."
    );
  }

  return {
    success: true,
    leadId: lead.LeadID,
    status: currentStatus
  };
}

function LC_updateLeadStatus(
  leadId,
  newStatus,
  changedBy,
  details
) {
  LC_initializeCore();

  const normalized = String(newStatus || "")
    .trim()
    .toUpperCase();

  if (LC.STATUSES.indexOf(normalized) === -1) {
    throw new Error(
      "Unsupported lifecycle status: " + normalized
    );
  }

  LC_createOrUpdateLifecycle(leadId);

  const row = LC_findLifecycleRow_(leadId);
  const lifecycle = LC_getLifecycleByRow_(row);

  const previousStatus = String(
    lifecycle.CurrentStatus || ""
  ).toUpperCase();

  const sheet = workbook_().getSheetByName(
    LC.SHEETS.LIFECYCLE
  );

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  LC_setCell_(
    sheet,
    headers,
    row,
    "CurrentStatus",
    normalized
  );

  if (normalized === "CLOSED") {
    LC_setCell_(
      sheet,
      headers,
      row,
      "ClosedAt",
      timestamp_()
    );
  }

  if (normalized === "DO_NOT_CONTACT") {
    LC_setCell_(
      sheet,
      headers,
      row,
      "DoNotContact",
      true
    );

    if (
      typeof NF_cancelLeadFollowUps ===
      "function"
    ) {
      NF_cancelLeadFollowUps(leadId);
    }
  }

  LC_setCell_(
    sheet,
    headers,
    row,
    "UpdatedAt",
    timestamp_()
  );

  LC_logStatusChange_(
    leadId,
    previousStatus,
    normalized,
    changedBy || "SYSTEM",
    details || ""
  );

  return {
    success: true,
    leadId: leadId,
    previousStatus: previousStatus,
    newStatus: normalized
  };
}

function LC_logActivity(
  leadId,
  activityType,
  channel,
  direction,
  details,
  agentId
) {
  LC_initializeCore();

  const sheet = workbook_().getSheetByName(
    LC.SHEETS.ACTIVITY
  );

  sheet.appendRow([
    LC_uuid_("ACT"),
    String(leadId || ""),
    String(agentId || ""),
    String(activityType || "").toUpperCase(),
    String(channel || "").toUpperCase(),
    String(direction || "").toUpperCase(),
    String(details || ""),
    timestamp_()
  ]);

  if (
    [
      "EMAIL",
      "CALL",
      "TEXT",
      "REPLY"
    ].indexOf(
      String(activityType || "").toUpperCase()
    ) !== -1
  ) {
    LC_updateLastContact_(leadId);
  }

  return true;
}

function LC_updateLastContact_(leadId) {
  LC_createOrUpdateLifecycle(leadId);

  const row = LC_findLifecycleRow_(leadId);
  const sheet = workbook_().getSheetByName(
    LC.SHEETS.LIFECYCLE
  );

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  LC_setCell_(
    sheet,
    headers,
    row,
    "LastContactAt",
    timestamp_()
  );

  LC_setCell_(
    sheet,
    headers,
    row,
    "UpdatedAt",
    timestamp_()
  );
}

function LC_setNextFollowUp(
  leadId,
  nextFollowUpAt
) {
  LC_createOrUpdateLifecycle(leadId);

  const row = LC_findLifecycleRow_(leadId);
  const sheet = workbook_().getSheetByName(
    LC.SHEETS.LIFECYCLE
  );

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  LC_setCell_(
    sheet,
    headers,
    row,
    "NextFollowUpAt",
    nextFollowUpAt
  );

  LC_setCell_(
    sheet,
    headers,
    row,
    "UpdatedAt",
    timestamp_()
  );

  return true;
}

function LC_findLead_(leadId) {
  const leads = AE_sheetObjects_(
    AE.SHEETS.LEADS
  );

  const target = String(
    leadId || ""
  ).trim();

  for (let i = 0; i < leads.length; i++) {
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

function LC_findLifecycleRow_(leadId) {
  const sheet = workbook_().getSheetByName(
    LC.SHEETS.LIFECYCLE
  );

  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const col = headers.indexOf("LeadID") + 1;

  const values = sheet
    .getRange(2, col, sheet.getLastRow() - 1, 1)
    .getDisplayValues();

  const target = String(leadId || "").trim();

  for (let i = 0; i < values.length; i++) {
    if (
      String(values[i][0] || "").trim() === target
    ) {
      return i + 2;
    }
  }

  return null;
}

function LC_getLifecycleByRow_(row) {
  const sheet = workbook_().getSheetByName(
    LC.SHEETS.LIFECYCLE
  );

  if (!sheet || !row) {
    return {};
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const values = sheet
    .getRange(row, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const result = {};

  headers.forEach(function(header, index) {
    result[header] = values[index];
  });

  return result;
}

function LC_setCell_(
  sheet,
  headers,
  row,
  headerName,
  value
) {
  const col = headers.indexOf(
    headerName
  ) + 1;

  if (!col) {
    throw new Error(
      "Header '" +
      headerName +
      "' not found."
    );
  }

  sheet
    .getRange(row, col)
    .setValue(value);
}

function LC_logStatusChange_(
  leadId,
  previousStatus,
  newStatus,
  changedBy,
  details
) {
  const sheet = workbook_().getSheetByName(
    LC.SHEETS.STATUS_HISTORY
  );

  if (!sheet) {
    return;
  }

  sheet.appendRow([
    LC_uuid_("HIS"),
    leadId,
    previousStatus,
    newStatus,
    changedBy,
    details,
    timestamp_()
  ]);
}

function LC_uuid_(prefix) {
  return String(prefix || "LC") +
    "-" +
    Utilities
      .getUuid()
      .substring(0, 8)
      .toUpperCase();
}

function LC_getLifecycleSummary() {
  const rows = LC_sheetObjects_(
    LC.SHEETS.LIFECYCLE
  );

  const counts = {};

  LC.STATUSES.forEach(function(status) {
    counts[status] = rows.filter(function(row) {
      return String(
        row.CurrentStatus || ""
      ).toUpperCase() === status;
    }).length;
  });

  return {
    total: rows.length,
    statuses: counts
  };
}

function LC_sheetObjects_(sheetName) {
  const sheet = workbook_().getSheetByName(
    sheetName
  );

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet
    .getDataRange()
    .getValues();

  const headers = values
    .shift()
    .map(function(header) {
      return String(header || "").trim();
    });

  return values
    .filter(function(row) {
      return row.some(function(value) {
        return String(value || "").trim() !== "";
      });
    })
    .map(function(row, index) {
      const obj = {
        _row: index + 2
      };

      headers.forEach(function(header, i) {
        obj[header] = row[i];
      });

      return obj;
    });
}

function LC_testCore() {
  LC_initializeCore();

  const leads = AE_sheetObjects_(
    AE.SHEETS.LEADS
  ).filter(function(lead) {
    return String(
      lead.AssignedAgentID || ""
    ).trim() !== "";
  });

  if (!leads.length) {
    Logger.log(
      JSON.stringify({
        success: true,
        skipped: true,
        reason:
          "No assigned leads available for lifecycle self-test."
      })
    );

    return true;
  }

  const result =
    LC_createOrUpdateLifecycle(
      leads[0].LeadID
    );

  if (!result.success) {
    throw new Error(
      "Lead Lifecycle Core self-test failed."
    );
  }

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      LC_getLifecycleSummary()
    )
  );

  return true;
}
