/******************************************************************************
 * MelroseOS Enterprise
 * Appointment Confirmation & Reschedule Migration
 * File: AP-05_NotificationBridge.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Bridges appointment actions into the NF notification queue.
 *   No email is sent directly here; NF mode controls actual delivery.
 *
 * Requires:
 *   AP-01 through AP-04
 *   NF-01 through NF-06
 ******************************************************************************/

function AP_initializeNotificationBridge() {
  AP_initializeCore();
  NF_initializeTemplateEngine();
  AP_registerAppointmentTemplates();

  return {
    success: true,
    appointmentMode: AP_getMode(),
    notificationMode: NF_getMode()
  };
}

function AP_registerAppointmentTemplates() {
  const templates = [
    {
      TemplateID: "TPL-APPOINTMENT-PENDING",
      TemplateName: "Appointment Pending Confirmation",
      NotificationType: "APPOINTMENT_PENDING",
      Subject: "Please confirm your Melrose Group Realty appointment",
      BodyHTML:
        "<p>Hi {{RecipientName}},</p>" +
        "<p>Your consultation is scheduled for {{AppointmentStart}}.</p>" +
        "<p>Please use your confirmation or reschedule option to update your appointment.</p>" +
        "<p>Melrose Group Realty</p>",
      Active: true
    },
    {
      TemplateID: "TPL-APPOINTMENT-CONFIRMED",
      TemplateName: "Appointment Confirmed",
      NotificationType: "APPOINTMENT_CONFIRMED",
      Subject: "Your Melrose Group Realty appointment is confirmed",
      BodyHTML:
        "<p>Hi {{RecipientName}},</p>" +
        "<p>Your consultation for {{AppointmentStart}} has been confirmed.</p>" +
        "<p>Melrose Group Realty</p>",
      Active: true
    },
    {
      TemplateID: "TPL-APPOINTMENT-RESCHEDULE",
      TemplateName: "Appointment Reschedule Requested",
      NotificationType: "APPOINTMENT_RESCHEDULE_REQUESTED",
      Subject: "Appointment reschedule requested",
      BodyHTML:
        "<p>Hi {{RecipientName}},</p>" +
        "<p>A request was made to reschedule the consultation currently set for {{AppointmentStart}}.</p>" +
        "<p>Melrose Group Realty</p>",
      Active: true
    }
  ];

  templates.forEach(function(template) {
    NF_upsertTemplate(template);
  });

  return templates.length;
}

function AP_queueAppointmentPendingNotifications(appointmentId) {
  return AP_queueAppointmentNotifications_(
    appointmentId,
    "TPL-APPOINTMENT-PENDING",
    "APPOINTMENT_PENDING"
  );
}

function AP_queueAppointmentConfirmedNotifications(appointmentId) {
  return AP_queueAppointmentNotifications_(
    appointmentId,
    "TPL-APPOINTMENT-CONFIRMED",
    "APPOINTMENT_CONFIRMED"
  );
}

function AP_queueRescheduleNotifications(appointmentId) {
  return AP_queueAppointmentNotifications_(
    appointmentId,
    "TPL-APPOINTMENT-RESCHEDULE",
    "APPOINTMENT_RESCHEDULE_REQUESTED"
  );
}

function AP_queueAppointmentNotifications_(
  appointmentId,
  templateId,
  notificationType
) {
  AP_initializeNotificationBridge();

  const appointment = AP_getAppointment(appointmentId);

  if (!appointment) {
    throw new Error("Appointment not found: " + appointmentId);
  }

  const recipients = [
    {
      type: "LEAD",
      email: appointment.LeadEmail,
      name: appointment.LeadName
    },
    {
      type: "AGENT",
      email: appointment.AgentEmail,
      name: appointment.AgentName
    }
  ];

  const results = [];

  recipients.forEach(function(recipient) {
    if (!recipient.email) return;

    const data = AP_buildAppointmentMergeData_(
      appointment,
      recipient
    );

    const rendered = NF_renderTemplate(
      templateId,
      data
    );

    results.push(
      NF_queueNotification({
        LeadID: appointment.LeadID,
        AgentID: appointment.AgentID,
        NotificationType: notificationType,
        RecipientType: recipient.type,
        RecipientEmail: recipient.email,
        RecipientName: recipient.name,
        TemplateID: templateId,
        Subject: rendered.subject,
        ScheduledAt: timestamp_()
      })
    );
  });

  AP_log_(
    "APPOINTMENT_NOTIFICATIONS_QUEUED",
    appointment.AppointmentID,
    appointment.LeadID,
    appointment.AgentID,
    results.length + " notification(s) queued for " + notificationType + "."
  );

  return {
    success: true,
    appointmentId: appointment.AppointmentID,
    queued: results.length,
    notifications: results
  };
}

function AP_buildAppointmentMergeData_(appointment, recipient) {
  return {
    AppointmentID: appointment.AppointmentID || "",
    LeadID: appointment.LeadID || "",
    AgentID: appointment.AgentID || "",
    LeadName: appointment.LeadName || "",
    LeadEmail: appointment.LeadEmail || "",
    AgentName: appointment.AgentName || "",
    AgentEmail: appointment.AgentEmail || "",
    RecipientName: recipient.name || "",
    AppointmentStart: AP_formatAppointmentDate_(
      appointment.StartTime,
      appointment.Timezone
    ),
    AppointmentEnd: AP_formatAppointmentDate_(
      appointment.EndTime,
      appointment.Timezone
    ),
    Status: appointment.Status || ""
  };
}

function AP_formatAppointmentDate_(value, timezone) {
  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return String(value || "");
  }

  return Utilities.formatDate(
    date,
    timezone || "America/Chicago",
    "EEEE, MMMM d, yyyy 'at' h:mm a"
  );
}

function AP_confirmAndNotify(token) {
  const result = AP_confirmByToken(token);

  if (result.success && !result.alreadyConfirmed) {
    result.notifications =
      AP_queueAppointmentConfirmedNotifications(
        result.appointmentId
      );
  }

  return result;
}

function AP_requestRescheduleAndNotify(token) {
  const result = AP_requestRescheduleByToken(token);

  if (result.success) {
    result.notifications =
      AP_queueRescheduleNotifications(
        result.appointmentId
      );
  }

  return result;
}

function AP_createAppointmentAndNotify(payload) {
  const result = AP_createAppointment(payload);

  if (result.success) {
    result.notifications =
      AP_queueAppointmentPendingNotifications(
        result.appointmentId
      );
  }

  return result;
}

function AP_testNotificationBridge() {
  AP_initializeNotificationBridge();
  AP_setShadowMode();
  NF_setShadowMode();

  const unique = Utilities.getUuid().substring(0, 8);

  const created = AP_createAppointmentAndNotify({
    LeadID: "LEAD-AP-BRIDGE-" + unique,
    AgentID: "AGT-AP-BRIDGE-" + unique,
    LeadName: "Bridge Test Lead",
    LeadEmail: "ap-bridge-lead-" + unique + "@example.com",
    AgentName: "Bridge Test Agent",
    AgentEmail: "ap-bridge-agent-" + unique + "@example.com",
    StartTime: new Date(
      new Date().getTime() + 24 * 60 * 60 * 1000
    ),
    EndTime: new Date(
      new Date().getTime() +
      24 * 60 * 60 * 1000 +
      30 * 60 * 1000
    ),
    Timezone: "America/Chicago"
  });

  if (
    !created.success ||
    !created.notifications ||
    created.notifications.queued !== 2
  ) {
    throw new Error(
      "Appointment Notification Bridge self-test failed."
    );
  }

  Logger.log(JSON.stringify(created));

  return true;
}
