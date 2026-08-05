/******************************************************************************
 * MelroseOS Enterprise
 * Appointment Confirmation & Reschedule Migration
 * File: AP-03_RescheduleEngine.gs
 * Version: 1.0.0
 *
 * Requires:
 *   AP-01_Core.gs
 *   AP-02_ConfirmationEngine.gs
 ******************************************************************************/

function AP_requestRescheduleByToken(token) {
  AP_initializeCore();

  if (AP_getMode() === "PAUSED") {
    throw new Error("Appointment Engine is PAUSED.");
  }

  const match = AP_findAppointmentByToken(token);

  if (!match) {
    return {
      success: false,
      status: "INVALID_TOKEN",
      reason: "Reschedule token was not found."
    };
  }

  if (
    match.tokenType !== "LeadRescheduleToken" &&
    match.tokenType !== "AgentRescheduleToken"
  ) {
    return {
      success: false,
      status: "INVALID_ACTION",
      reason: "Token is not a reschedule token."
    };
  }

  const appointment = match.appointment;
  const currentStatus = String(
    appointment.Status || ""
  ).toUpperCase();

  if (["CANCELLED", "COMPLETED"].indexOf(currentStatus) !== -1) {
    return {
      success: false,
      appointmentId: appointment.AppointmentID,
      status: currentStatus,
      reason: "Appointment can no longer be rescheduled."
    };
  }

  const actorType =
    match.tokenType === "LeadRescheduleToken"
      ? "LEAD"
      : "AGENT";

  AP_updateAppointmentStatus_(
    appointment._row,
    "RESCHEDULE_REQUESTED"
  );

  AP_recordAction_(
    appointment,
    actorType,
    "RESCHEDULE_REQUEST",
    token,
    currentStatus,
    "RESCHEDULE_REQUESTED",
    actorType + " requested a new appointment time."
  );

  AP_log_(
    "RESCHEDULE_REQUESTED",
    appointment.AppointmentID,
    appointment.LeadID,
    appointment.AgentID,
    actorType + " requested a new appointment time."
  );

  return {
    success: true,
    appointmentId: appointment.AppointmentID,
    status: "RESCHEDULE_REQUESTED",
    requestedBy: actorType,
    mode: AP_getMode()
  };
}

function AP_applyReschedule(
  appointmentId,
  newStartTime,
  newEndTime,
  actorType
) {
  AP_initializeCore();

  const appointment = AP_getAppointment(
    appointmentId
  );

  if (!appointment) {
    throw new Error(
      "Appointment not found: " + appointmentId
    );
  }

  if (!newStartTime || !newEndTime) {
    throw new Error(
      "New start and end times are required."
    );
  }

  const start = new Date(newStartTime);
  const end = new Date(newEndTime);

  if (
    isNaN(start.getTime()) ||
    isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    throw new Error(
      "Reschedule times are invalid."
    );
  }

  const previousStatus = String(
    appointment.Status || ""
  ).toUpperCase();

  const sheet = workbook_().getSheetByName(
    AP.SHEETS.APPOINTMENTS
  );

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  AP_setAppointmentCell_(
    sheet,
    headers,
    appointment._row,
    "StartTime",
    start
  );

  AP_setAppointmentCell_(
    sheet,
    headers,
    appointment._row,
    "EndTime",
    end
  );

  AP_setAppointmentCell_(
    sheet,
    headers,
    appointment._row,
    "Status",
    "PENDING"
  );

  AP_setAppointmentCell_(
    sheet,
    headers,
    appointment._row,
    "UpdatedAt",
    timestamp_()
  );

  const actor = String(
    actorType || "BROKER"
  ).toUpperCase();

  AP_recordAction_(
    appointment,
    actor,
    "RESCHEDULE_APPLIED",
    "",
    previousStatus,
    "PENDING",
    "Appointment moved to a new time and returned to PENDING confirmation."
  );

  AP_log_(
    "APPOINTMENT_RESCHEDULED",
    appointment.AppointmentID,
    appointment.LeadID,
    appointment.AgentID,
    "Appointment rescheduled by " + actor + "."
  );

  return {
    success: true,
    appointmentId: appointment.AppointmentID,
    status: "PENDING",
    startTime: start,
    endTime: end,
    updatedBy: actor
  };
}

function AP_setAppointmentCell_(
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
      "' not found in AP_APPOINTMENTS."
    );
  }

  sheet
    .getRange(row, col)
    .setValue(value);
}

function AP_getRescheduleRequests(limit) {
  const max = Math.max(
    1,
    Number(limit || 100)
  );

  return AP_sheetObjects_(
    AP.SHEETS.APPOINTMENTS
  )
    .filter(function(item) {
      return String(
        item.Status || ""
      ).toUpperCase() ===
        "RESCHEDULE_REQUESTED";
    })
    .slice(0, max);
}

function AP_testRescheduleEngine() {
  AP_initializeCore();
  AP_setShadowMode();

  const created =
    AP_createAppointment({
      LeadID:
        "LEAD-AP-RESCHEDULE-TEST",
      AgentID:
        "AGT-AP-RESCHEDULE-TEST",
      LeadName:
        "Reschedule Test Lead",
      LeadEmail:
        "ap-reschedule-lead@example.com",
      AgentName:
        "Reschedule Test Agent",
      AgentEmail:
        "ap-reschedule-agent@example.com",
      StartTime: new Date(
        new Date().getTime() +
        24 * 60 * 60 * 1000
      ),
      EndTime: new Date(
        new Date().getTime() +
        24 * 60 * 60 * 1000 +
        30 * 60 * 1000
      ),
      Timezone:
        "America/Chicago"
    });

  const request =
    AP_requestRescheduleByToken(
      created.tokens.leadReschedule
    );

  if (
    !request.success ||
    request.status !==
      "RESCHEDULE_REQUESTED"
  ) {
    throw new Error(
      "Reschedule request self-test failed."
    );
  }

  const newStart = new Date(
    new Date().getTime() +
    48 * 60 * 60 * 1000
  );

  const newEnd = new Date(
    newStart.getTime() +
    30 * 60 * 1000
  );

  const applied =
    AP_applyReschedule(
      created.appointmentId,
      newStart,
      newEnd,
      "BROKER"
    );

  if (
    !applied.success ||
    applied.status !== "PENDING"
  ) {
    throw new Error(
      "Reschedule application self-test failed."
    );
  }

  Logger.log(
    JSON.stringify(request)
  );

  Logger.log(
    JSON.stringify(applied)
  );

  return true;
}
