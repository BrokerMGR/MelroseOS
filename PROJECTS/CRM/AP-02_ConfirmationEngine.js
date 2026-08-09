/******************************************************************************
 * MelroseOS Enterprise
 * Appointment Confirmation & Reschedule Migration
 * File: AP-02_ConfirmationEngine.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Processes lead and agent confirmation tokens and changes an appointment
 *   to CONFIRMED once either valid confirmation action is received.
 *
 * Requires:
 *   AP-01_Core.gs
 ******************************************************************************/

function AP_confirmByToken(token) {
  AP_initializeCore();

  if (AP_getMode() === "PAUSED") {
    throw new Error("Appointment Engine is PAUSED.");
  }

  const match = AP_findAppointmentByToken(token);

  if (!match) {
    return {
      success: false,
      status: "INVALID_TOKEN",
      reason: "Confirmation token was not found."
    };
  }

  if (
    match.tokenType !== "LeadConfirmToken" &&
    match.tokenType !== "AgentConfirmToken"
  ) {
    return {
      success: false,
      status: "INVALID_ACTION",
      reason: "Token is not a confirmation token."
    };
  }

  const appointment = match.appointment;
  const currentStatus = String(
    appointment.Status || ""
  ).toUpperCase();

  if (currentStatus === "CONFIRMED") {
    return {
      success: true,
      appointmentId: appointment.AppointmentID,
      status: "CONFIRMED",
      alreadyConfirmed: true
    };
  }

  if (
    ["CANCELLED", "COMPLETED"].indexOf(currentStatus) !== -1
  ) {
    return {
      success: false,
      appointmentId: appointment.AppointmentID,
      status: currentStatus,
      reason: "Appointment can no longer be confirmed."
    };
  }

  const actorType =
    match.tokenType === "LeadConfirmToken"
      ? "LEAD"
      : "AGENT";

  AP_updateAppointmentStatus_(
    appointment._row,
    "CONFIRMED"
  );

  AP_recordAction_(
    appointment,
    actorType,
    "CONFIRM",
    token,
    currentStatus,
    "CONFIRMED",
    actorType + " confirmed the appointment."
  );

  AP_log_(
    "APPOINTMENT_CONFIRMED",
    appointment.AppointmentID,
    appointment.LeadID,
    appointment.AgentID,
    actorType + " confirmed the appointment."
  );

  return {
    success: true,
    appointmentId: appointment.AppointmentID,
    status: "CONFIRMED",
    confirmedBy: actorType,
    mode: AP_getMode()
  };
}

function AP_confirmAppointment(appointmentId, actorType) {
  const appointment = AP_getAppointment(appointmentId);

  if (!appointment) {
    throw new Error(
      "Appointment not found: " + appointmentId
    );
  }

  const actor = String(
    actorType || "LEAD"
  ).toUpperCase();

  const token = actor === "AGENT"
    ? appointment.AgentConfirmToken
    : appointment.LeadConfirmToken;

  return AP_confirmByToken(token);
}

function AP_updateAppointmentStatus_(row, status) {
  const sheet = workbook_().getSheetByName(
    AP.SHEETS.APPOINTMENTS
  );

  if (!sheet || !row) {
    throw new Error(
      "Appointment row could not be updated."
    );
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const statusCol =
    headers.indexOf("Status") + 1;

  const updatedCol =
    headers.indexOf("UpdatedAt") + 1;

  if (!statusCol) {
    throw new Error(
      "Status header not found in AP_APPOINTMENTS."
    );
  }

  sheet
    .getRange(row, statusCol)
    .setValue(status);

  if (updatedCol) {
    sheet
      .getRange(row, updatedCol)
      .setValue(timestamp_());
  }

  return true;
}

function AP_recordAction_(
  appointment,
  actorType,
  actionType,
  token,
  previousStatus,
  newStatus,
  details
) {
  const sheet = workbook_().getSheetByName(
    AP.SHEETS.ACTIONS
  );

  if (!sheet) {
    throw new Error(
      "AP_ACTION_LOG sheet is missing."
    );
  }

  sheet.appendRow([
    AP_uuid_("ACT"),
    appointment.AppointmentID,
    actorType,
    actionType,
    token,
    previousStatus,
    newStatus,
    details,
    timestamp_()
  ]);

  return true;
}

function AP_getConfirmationStatus(appointmentId) {
  const appointment =
    AP_getAppointment(appointmentId);

  if (!appointment) {
    return null;
  }

  const actions = AP_sheetObjects_(
    AP.SHEETS.ACTIONS
  ).filter(function(action) {
    return String(
      action.AppointmentID || ""
    ) === String(appointmentId || "") &&
    String(
      action.ActionType || ""
    ).toUpperCase() === "CONFIRM";
  });

  return {
    appointmentId: appointmentId,
    status: appointment.Status,
    confirmationCount: actions.length,
    lastConfirmedBy: actions.length
      ? actions[actions.length - 1].ActorType
      : ""
  };
}

function AP_testConfirmationEngine() {
  AP_initializeCore();
  AP_setShadowMode();

  const created = AP_createAppointment({
    LeadID: "LEAD-AP-CONFIRM-TEST",
    AgentID: "AGT-AP-CONFIRM-TEST",
    LeadName: "Confirmation Test Lead",
    LeadEmail: "ap-confirm-lead@example.com",
    AgentName: "Confirmation Test Agent",
    AgentEmail: "ap-confirm-agent@example.com",
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

  const result = AP_confirmByToken(
    created.tokens.leadConfirm
  );

  if (
    !result.success ||
    result.status !== "CONFIRMED" ||
    result.confirmedBy !== "LEAD"
  ) {
    throw new Error(
      "Appointment Confirmation Engine self-test failed."
    );
  }

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(
    AP_getConfirmationStatus(
      created.appointmentId
    )
  ));

  return true;
}
