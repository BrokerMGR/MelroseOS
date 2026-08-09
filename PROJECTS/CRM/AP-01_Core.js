/******************************************************************************
 * MelroseOS Enterprise
 * Appointment Confirmation & Reschedule Migration
 * File: AP-01_Core.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Core appointment registry for lead consultations, confirmations,
 *   reschedule requests, and appointment status tracking.
 *
 * Requires:
 *   INV-01_Core.gs
 *   AE-01 through AE-10
 *   LI-01 through LI-07
 *   NF-01 through NF-06
 ******************************************************************************/

const AP = {
  VERSION: "1.0.0",
  MODE_PROPERTY: "M5_APPOINTMENT_MODE",
  DEFAULT_MODE: "SHADOW",
  SHEETS: {
    APPOINTMENTS: "AP_APPOINTMENTS",
    ACTIONS: "AP_ACTION_LOG",
    AUDIT: "AP_AUDIT_LOG"
  }
};

function AP_initializeCore() {
  const ss = workbook_();

  Object.keys(AP.SHEETS).forEach(function(key) {
    createSheetIfMissing_(ss, AP.SHEETS[key]);
  });

  AP_setHeadersIfEmpty_(
    ss.getSheetByName(AP.SHEETS.APPOINTMENTS),
    [
      "AppointmentID",
      "LeadID",
      "AgentID",
      "LeadName",
      "LeadEmail",
      "AgentName",
      "AgentEmail",
      "StartTime",
      "EndTime",
      "Timezone",
      "Status",
      "LeadConfirmToken",
      "AgentConfirmToken",
      "LeadRescheduleToken",
      "AgentRescheduleToken",
      "CalendarEventID",
      "CreatedAt",
      "UpdatedAt"
    ]
  );

  AP_setHeadersIfEmpty_(
    ss.getSheetByName(AP.SHEETS.ACTIONS),
    [
      "ActionID",
      "AppointmentID",
      "ActorType",
      "ActionType",
      "Token",
      "PreviousStatus",
      "NewStatus",
      "Details",
      "CreatedAt"
    ]
  );

  AP_setHeadersIfEmpty_(
    ss.getSheetByName(AP.SHEETS.AUDIT),
    [
      "AuditID",
      "EventType",
      "AppointmentID",
      "LeadID",
      "AgentID",
      "Details",
      "Mode",
      "CreatedAt"
    ]
  );

  if (!getDocProperty_(AP.MODE_PROPERTY)) {
    setDocProperty_(AP.MODE_PROPERTY, AP.DEFAULT_MODE);
  }

  AP_log_(
    "CORE_INITIALIZED",
    "",
    "",
    "",
    "Appointment core initialized."
  );

  return {
    success: true,
    version: AP.VERSION,
    mode: AP_getMode()
  };
}

function AP_setHeadersIfEmpty_(sheet, headers) {
  if (!sheet) {
    throw new Error("Required Appointment sheet is missing.");
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

function AP_getMode() {
  return String(
    getDocProperty_(AP.MODE_PROPERTY) ||
    AP.DEFAULT_MODE
  ).toUpperCase();
}

function AP_setMode(mode) {
  const normalized = String(mode || "")
    .trim()
    .toUpperCase();

  if (
    ["SHADOW", "LIVE", "PAUSED"]
      .indexOf(normalized) === -1
  ) {
    throw new Error(
      "Appointment mode must be SHADOW, LIVE, or PAUSED."
    );
  }

  setDocProperty_(
    AP.MODE_PROPERTY,
    normalized
  );

  return normalized;
}

function AP_setShadowMode() {
  return AP_setMode("SHADOW");
}

function AP_setLiveMode() {
  return AP_setMode("LIVE");
}

function AP_pause() {
  return AP_setMode("PAUSED");
}

function AP_createAppointment(payload) {
  AP_initializeCore();

  if (!payload) {
    throw new Error("Appointment payload is required.");
  }

  const appointmentId =
    String(payload.AppointmentID || "").trim() ||
    AP_uuid_("APT");

  const leadId =
    String(payload.LeadID || payload.leadId || "").trim();

  const agentId =
    String(payload.AgentID || payload.agentId || "").trim();

  if (!leadId) {
    throw new Error("LeadID is required.");
  }

  const startTime =
    payload.StartTime ||
    payload.startTime ||
    "";

  const endTime =
    payload.EndTime ||
    payload.endTime ||
    "";

  if (!startTime || !endTime) {
    throw new Error(
      "StartTime and EndTime are required."
    );
  }

  const sheet = workbook_().getSheetByName(
    AP.SHEETS.APPOINTMENTS
  );

  const tokens = AP_generateTokens_();

  sheet.appendRow([
    appointmentId,
    leadId,
    agentId,
    String(payload.LeadName || payload.leadName || ""),
    AE_normalizeEmail_(
      payload.LeadEmail || payload.leadEmail || ""
    ),
    String(payload.AgentName || payload.agentName || ""),
    AE_normalizeEmail_(
      payload.AgentEmail || payload.agentEmail || ""
    ),
    startTime,
    endTime,
    String(
      payload.Timezone ||
      payload.timezone ||
      "America/Chicago"
    ),
    "PENDING",
    tokens.leadConfirm,
    tokens.agentConfirm,
    tokens.leadReschedule,
    tokens.agentReschedule,
    "",
    timestamp_(),
    timestamp_()
  ]);

  AP_log_(
    "APPOINTMENT_CREATED",
    appointmentId,
    leadId,
    agentId,
    "Appointment created in PENDING status."
  );

  return {
    success: true,
    appointmentId: appointmentId,
    status: "PENDING",
    tokens: tokens,
    mode: AP_getMode()
  };
}

function AP_generateTokens_() {
  return {
    leadConfirm: AP_uuid_("LC"),
    agentConfirm: AP_uuid_("AC"),
    leadReschedule: AP_uuid_("LR"),
    agentReschedule: AP_uuid_("AR")
  };
}

function AP_getAppointment(appointmentId) {
  const target = String(
    appointmentId || ""
  ).trim();

  if (!target) return null;

  const appointments = AP_sheetObjects_(
    AP.SHEETS.APPOINTMENTS
  );

  for (let i = 0; i < appointments.length; i++) {
    if (
      String(
        appointments[i].AppointmentID || ""
      ).trim() === target
    ) {
      return appointments[i];
    }
  }

  return null;
}

function AP_findAppointmentByToken(token) {
  const target = String(token || "").trim();

  if (!target) return null;

  const tokenFields = [
    "LeadConfirmToken",
    "AgentConfirmToken",
    "LeadRescheduleToken",
    "AgentRescheduleToken"
  ];

  const appointments = AP_sheetObjects_(
    AP.SHEETS.APPOINTMENTS
  );

  for (let i = 0; i < appointments.length; i++) {
    for (let j = 0; j < tokenFields.length; j++) {
      if (
        String(
          appointments[i][tokenFields[j]] || ""
        ).trim() === target
      ) {
        return {
          appointment: appointments[i],
          tokenType: tokenFields[j]
        };
      }
    }
  }

  return null;
}

function AP_log_(
  eventType,
  appointmentId,
  leadId,
  agentId,
  details
) {
  const sheet = workbook_().getSheetByName(
    AP.SHEETS.AUDIT
  );

  if (!sheet) return;

  sheet.appendRow([
    AP_uuid_("AUD"),
    String(eventType || ""),
    String(appointmentId || ""),
    String(leadId || ""),
    String(agentId || ""),
    String(details || ""),
    AP_getMode(),
    timestamp_()
  ]);
}

function AP_uuid_(prefix) {
  return String(prefix || "AP") + "-" +
    Utilities
      .getUuid()
      .substring(0, 8)
      .toUpperCase();
}

function AP_sheetObjects_(sheetName) {
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

function AP_getCoreStatus() {
  const appointments = AP_sheetObjects_(
    AP.SHEETS.APPOINTMENTS
  );

  return {
    version: AP.VERSION,
    mode: AP_getMode(),
    totalAppointments: appointments.length,
    pending: appointments.filter(function(item) {
      return String(
        item.Status || ""
      ).toUpperCase() === "PENDING";
    }).length,
    confirmed: appointments.filter(function(item) {
      return String(
        item.Status || ""
      ).toUpperCase() === "CONFIRMED";
    }).length,
    rescheduleRequested: appointments.filter(function(item) {
      return String(
        item.Status || ""
      ).toUpperCase() === "RESCHEDULE_REQUESTED";
    }).length
  };
}

function AP_testCore() {
  AP_initializeCore();
  AP_setShadowMode();

  const result = AP_createAppointment({
    LeadID: "LEAD-AP-TEST",
    AgentID: "AGT-AP-TEST",
    LeadName: "Appointment Test Lead",
    LeadEmail: "ap-test-lead@example.com",
    AgentName: "Appointment Test Agent",
    AgentEmail: "ap-test-agent@example.com",
    StartTime: new Date(
      new Date().getTime() +
      24 * 60 * 60 * 1000
    ),
    EndTime: new Date(
      new Date().getTime() +
      24 * 60 * 60 * 1000 +
      30 * 60 * 1000
    ),
    Timezone: "America/Chicago"
  });

  if (
    !result.success ||
    result.status !== "PENDING" ||
    !result.tokens.leadConfirm ||
    !result.tokens.agentConfirm
  ) {
    throw new Error(
      "Appointment Core self-test failed."
    );
  }

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      AP_getCoreStatus()
    )
  );

  return true;
}
