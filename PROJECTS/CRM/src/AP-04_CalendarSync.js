/******************************************************************************
 * MelroseOS Enterprise
 * Appointment Confirmation & Reschedule Migration
 * File: AP-04_CalendarSync.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Synchronizes MelroseOS appointment records with Google Calendar.
 *   SHADOW mode simulates calendar actions without creating events.
 *
 * Requires:
 *   AP-01 through AP-03
 ******************************************************************************/

function AP_syncAppointmentToCalendar(appointmentId) {
  AP_initializeCore();

  const appointment = AP_getAppointment(appointmentId);

  if (!appointment) {
    throw new Error("Appointment not found: " + appointmentId);
  }

  const mode = AP_getMode();

  if (mode === "PAUSED") {
    throw new Error("Appointment Engine is PAUSED.");
  }

  if (mode === "SHADOW") {
    AP_log_(
      "CALENDAR_SHADOW_SYNC",
      appointment.AppointmentID,
      appointment.LeadID,
      appointment.AgentID,
      "Calendar synchronization simulated in SHADOW mode."
    );

    return {
      success: true,
      appointmentId: appointment.AppointmentID,
      mode: "SHADOW",
      calendarEventId: appointment.CalendarEventID || "",
      simulated: true
    };
  }

  return AP_syncAppointmentLive_(appointment);
}

function AP_syncAppointmentLive_(appointment) {
  const start = new Date(appointment.StartTime);
  const end = new Date(appointment.EndTime);

  if (
    isNaN(start.getTime()) ||
    isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    throw new Error("Appointment start or end time is invalid.");
  }

  const calendar = CalendarApp.getDefaultCalendar();

  const title = AP_buildCalendarTitle_(appointment);
  const description = AP_buildCalendarDescription_(appointment);

  let event = null;
  let eventId = String(
    appointment.CalendarEventID || ""
  ).trim();

  if (eventId) {
    try {
      event = calendar.getEventById(eventId);
    } catch (error) {
      event = null;
    }
  }

  if (event) {
    event.setTitle(title);
    event.setTime(start, end);
    event.setDescription(description);
  } else {
    event = calendar.createEvent(
      title,
      start,
      end,
      {
        description: description
      }
    );

    eventId = event.getId();

    AP_updateCalendarEventId_(
      appointment._row,
      eventId
    );
  }

  AP_log_(
    "CALENDAR_SYNCED",
    appointment.AppointmentID,
    appointment.LeadID,
    appointment.AgentID,
    "Appointment synchronized to Google Calendar."
  );

  return {
    success: true,
    appointmentId: appointment.AppointmentID,
    mode: "LIVE",
    calendarEventId: eventId,
    simulated: false
  };
}

function AP_buildCalendarTitle_(appointment) {
  const leadName = String(
    appointment.LeadName || "Lead"
  ).trim();

  return "Melrose Group Realty Consultation - " + leadName;
}

function AP_buildCalendarDescription_(appointment) {
  return [
    "MelroseOS Appointment",
    "",
    "Appointment ID: " + (appointment.AppointmentID || ""),
    "Lead ID: " + (appointment.LeadID || ""),
    "Lead: " + (appointment.LeadName || ""),
    "Lead Email: " + (appointment.LeadEmail || ""),
    "Agent: " + (appointment.AgentName || ""),
    "Agent Email: " + (appointment.AgentEmail || ""),
    "Status: " + (appointment.Status || "")
  ].join("\n");
}

function AP_updateCalendarEventId_(row, eventId) {
  const sheet = workbook_().getSheetByName(
    AP.SHEETS.APPOINTMENTS
  );

  if (!sheet || !row) {
    throw new Error("Appointment row could not be updated.");
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  AP_setAppointmentCell_(
    sheet,
    headers,
    row,
    "CalendarEventID",
    eventId
  );

  AP_setAppointmentCell_(
    sheet,
    headers,
    row,
    "UpdatedAt",
    timestamp_()
  );
}

function AP_syncPendingAppointments(limit) {
  const max = Math.max(1, Number(limit || 25));

  const appointments = AP_sheetObjects_(
    AP.SHEETS.APPOINTMENTS
  )
    .filter(function(item) {
      const status = String(
        item.Status || ""
      ).toUpperCase();

      return (
        status === "PENDING" ||
        status === "CONFIRMED"
      );
    })
    .slice(0, max);

  const results = [];

  appointments.forEach(function(appointment) {
    try {
      results.push(
        AP_syncAppointmentToCalendar(
          appointment.AppointmentID
        )
      );
    } catch (error) {
      AP_log_(
        "CALENDAR_SYNC_ERROR",
        appointment.AppointmentID,
        appointment.LeadID,
        appointment.AgentID,
        error.message || String(error)
      );

      results.push({
        success: false,
        appointmentId: appointment.AppointmentID,
        error: error.message || String(error)
      });
    }
  });

  return {
    success: true,
    mode: AP_getMode(),
    processed: results.length,
    successful: results.filter(function(result) {
      return result.success;
    }).length,
    failed: results.filter(function(result) {
      return !result.success;
    }).length,
    results: results
  };
}

function AP_deleteCalendarEvent(appointmentId) {
  const appointment = AP_getAppointment(appointmentId);

  if (!appointment) {
    throw new Error("Appointment not found: " + appointmentId);
  }

  if (AP_getMode() === "SHADOW") {
    return {
      success: true,
      mode: "SHADOW",
      simulated: true
    };
  }

  const eventId = String(
    appointment.CalendarEventID || ""
  ).trim();

  if (!eventId) {
    return {
      success: true,
      mode: "LIVE",
      deleted: false,
      reason: "No calendar event is linked."
    };
  }

  const calendar = CalendarApp.getDefaultCalendar();
  const event = calendar.getEventById(eventId);

  if (event) {
    event.deleteEvent();
  }

  AP_updateCalendarEventId_(
    appointment._row,
    ""
  );

  AP_log_(
    "CALENDAR_EVENT_DELETED",
    appointment.AppointmentID,
    appointment.LeadID,
    appointment.AgentID,
    "Linked calendar event deleted."
  );

  return {
    success: true,
    mode: "LIVE",
    deleted: !!event
  };
}

function AP_testCalendarSync() {
  AP_initializeCore();
  AP_setShadowMode();

  const created = AP_createAppointment({
    LeadID: "LEAD-AP-CALENDAR-TEST",
    AgentID: "AGT-AP-CALENDAR-TEST",
    LeadName: "Calendar Test Lead",
    LeadEmail: "ap-calendar-lead@example.com",
    AgentName: "Calendar Test Agent",
    AgentEmail: "ap-calendar-agent@example.com",
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

  const result = AP_syncAppointmentToCalendar(
    created.appointmentId
  );

  if (
    !result.success ||
    result.mode !== "SHADOW" ||
    result.simulated !== true
  ) {
    throw new Error(
      "Appointment Calendar Sync self-test failed."
    );
  }

  Logger.log(JSON.stringify(result));

  return true;
}
