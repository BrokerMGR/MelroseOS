/******************************************************************************
 * MelroseOS Enterprise
 * Lead Lifecycle Management
 * File: LC-03_AppointmentLifecycleBridge.gs
 * Version: 1.0.0
 ******************************************************************************/

function LC_syncAppointmentLifecycle(limit) {
  LC_initializeCore();

  const max = Math.max(1, Number(limit || 100));

  if (typeof AP_sheetObjects_ !== "function") {
    return {
      success: true,
      processed: 0,
      skipped: true,
      reason: "Appointment module unavailable."
    };
  }

  const appointments = AP_sheetObjects_(
    AP.SHEETS.APPOINTMENTS
  ).slice(0, max);

  const results = [];

  appointments.forEach(function(appt) {
    try {
      if (!appt.LeadID) return;

      const status = String(appt.Status || "").toUpperCase();

      if (status === "PENDING" || status === "CONFIRMED") {
        LC_createOrUpdateLifecycle(appt.LeadID);

        const row = LC_findLifecycleRow_(appt.LeadID);
        const sheet = workbook_().getSheetByName(LC.SHEETS.LIFECYCLE);
        const headers = sheet
          .getRange(1, 1, 1, sheet.getLastColumn())
          .getDisplayValues()[0];

        LC_setCell_(
          sheet,
          headers,
          row,
          "ConsultationAt",
          appt.StartTime || ""
        );

        LC_updateLeadStatus(
          appt.LeadID,
          "CONSULTATION_SCHEDULED",
          "APPOINTMENT_SYNC",
          "Appointment exists with status " + status + "."
        );
      }

      if (status === "COMPLETED") {
        LC_updateLeadStatus(
          appt.LeadID,
          "CONSULTATION_COMPLETED",
          "APPOINTMENT_SYNC",
          "Appointment marked completed."
        );
      }

      results.push({
        success: true,
        leadId: appt.LeadID,
        appointmentStatus: status
      });

    } catch (error) {
      results.push({
        success: false,
        leadId: appt.LeadID || "",
        error: error.message || String(error)
      });
    }
  });

  return {
    success: results.every(function(r) { return r.success; }),
    processed: results.length,
    results: results
  };
}

function LC_testAppointmentLifecycleBridge() {
  LC_initializeCore();

  Logger.log(JSON.stringify({
    success: true,
    appointmentModuleAvailable:
      typeof AP_sheetObjects_ === "function"
  }));

  return true;
}
