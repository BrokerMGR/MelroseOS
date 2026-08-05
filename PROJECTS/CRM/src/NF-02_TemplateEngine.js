/******************************************************************************
 * MelroseOS Enterprise
 * Lead Notification & Follow-Up Migration
 * File: NF-02_TemplateEngine.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Creates, stores, retrieves, and renders notification email templates.
 *
 * Requires:
 *   NF-01_Core.gs
 ******************************************************************************/

function NF_initializeTemplateEngine() {
  NF_initializeCore();
  NF_registerDefaultTemplates();

  return {
    success: true,
    templates: NF_getTemplates().length
  };
}

function NF_upsertTemplate(template) {
  NF_initializeCore();

  if (!template) {
    throw new Error("Template payload is required.");
  }

  const templateId = String(
    template.TemplateID ||
    template.templateId ||
    ""
  ).trim();

  if (!templateId) {
    throw new Error("TemplateID is required.");
  }

  const sheet = workbook_().getSheetByName(NF.SHEETS.TEMPLATES);
  const row = NF_findTemplateRow_(templateId);

  const payload = [
    templateId,
    String(template.TemplateName || template.templateName || "").trim(),
    String(
      template.NotificationType ||
      template.notificationType ||
      "GENERAL"
    ).trim().toUpperCase(),
    String(template.Subject || template.subject || "").trim(),
    String(template.BodyHTML || template.bodyHtml || ""),
    NF_booleanValue_(
      template.Active !== undefined
        ? template.Active
        : template.active !== undefined
          ? template.active
          : true
    ),
    timestamp_()
  ];

  if (row) {
    sheet.getRange(row, 1, 1, payload.length).setValues([payload]);
  } else {
    sheet.appendRow(payload);
  }

  NF_log_(
    "TEMPLATE_UPSERTED",
    "",
    "",
    "",
    "Template updated: " + templateId + "."
  );

  return templateId;
}

function NF_getTemplates() {
  return NF_sheetObjects_(NF.SHEETS.TEMPLATES);
}

function NF_getTemplate(templateId) {
  const target = String(templateId || "").trim();

  if (!target) return null;

  const templates = NF_getTemplates();

  for (let i = 0; i < templates.length; i++) {
    if (String(templates[i].TemplateID || "").trim() === target) {
      return templates[i];
    }
  }

  return null;
}

function NF_renderTemplate(templateId, data) {
  const template = NF_getTemplate(templateId);

  if (!template) {
    throw new Error("Notification template not found: " + templateId);
  }

  if (!NF_isTrue_(template.Active)) {
    throw new Error("Notification template is inactive: " + templateId);
  }

  data = data || {};

  return {
    templateId: template.TemplateID,
    notificationType: template.NotificationType,
    subject: NF_mergeFields_(template.Subject, data),
    bodyHtml: NF_mergeFields_(template.BodyHTML, data)
  };
}

function NF_mergeFields_(content, data) {
  let output = String(content || "");

  Object.keys(data || {}).forEach(function(key) {
    const value = data[key] === null || data[key] === undefined
      ? ""
      : String(data[key]);

    const pattern = new RegExp(
      "\\{\\{\\s*" + NF_escapeRegex_(key) + "\\s*\\}\\}",
      "gi"
    );

    output = output.replace(pattern, value);
  });

  return output;
}

function NF_escapeRegex_(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function NF_registerDefaultTemplates() {
  const templates = [
    {
      TemplateID: "TPL-LEAD-CONFIRMATION",
      TemplateName: "Lead Confirmation",
      NotificationType: "LEAD_CONFIRMATION",
      Subject: "Thank you, {{FirstName}} — we received your request",
      BodyHTML:
        '<p>Hi {{FirstName}},</p>' +
        '<p>Thank you for contacting Melrose Group Realty. ' +
        'We received your {{LeadType}} request and a member of our team will be in touch.</p>' +
        '<p>We look forward to helping you with your real estate goals.</p>' +
        '<p>Melrose Group Realty</p>',
      Active: true
    },
    {
      TemplateID: "TPL-AGENT-NEW-LEAD",
      TemplateName: "Agent New Lead Alert",
      NotificationType: "AGENT_NEW_LEAD",
      Subject: "New {{LeadType}} lead: {{FirstName}} {{LastName}}",
      BodyHTML:
        '<p>You have a new {{LeadType}} lead.</p>' +
        '<p><strong>Name:</strong> {{FirstName}} {{LastName}}<br>' +
        '<strong>Email:</strong> {{Email}}<br>' +
        '<strong>Phone:</strong> {{Phone}}<br>' +
        '<strong>Parish:</strong> {{Parish}}<br>' +
        '<strong>Source:</strong> {{Source}}</p>' +
        '<p>Please follow up promptly.</p>',
      Active: true
    },
    {
      TemplateID: "TPL-LEAD-AGENT-INTRO",
      TemplateName: "Assigned Agent Introduction",
      NotificationType: "LEAD_AGENT_INTRO",
      Subject: "{{FirstName}}, meet your Melrose Group Realty agent",
      BodyHTML:
        '<p>Hi {{FirstName}},</p>' +
        '<p>Your real estate request has been assigned to {{AgentName}}.</p>' +
        '<p>{{AgentName}} will be your point of contact as we help with your {{LeadType}} needs.</p>' +
        '<p>Melrose Group Realty</p>',
      Active: true
    },
    {
      TemplateID: "TPL-RECRUITING-CONFIRMATION",
      TemplateName: "Recruiting Confirmation",
      NotificationType: "RECRUITING_CONFIRMATION",
      Subject: "Thank you for connecting with Melrose Group Realty",
      BodyHTML:
        '<p>Hi {{FirstName}},</p>' +
        '<p>Thank you for your interest in a confidential conversation with Melrose Group Realty.</p>' +
        '<p>Your request has been routed directly to the broker for follow-up.</p>' +
        '<p>Melrose Group Realty</p>',
      Active: true
    }
  ];

  templates.forEach(function(template) {
    NF_upsertTemplate(template);
  });

  return templates.length;
}

function NF_findTemplateRow_(templateId) {
  const sheet = workbook_().getSheetByName(NF.SHEETS.TEMPLATES);

  if (!sheet || sheet.getLastRow() < 2) return null;

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const col = headers.indexOf("TemplateID") + 1;

  if (!col) {
    throw new Error("TemplateID header not found.");
  }

  const values = sheet
    .getRange(2, col, sheet.getLastRow() - 1, 1)
    .getDisplayValues();

  const target = String(templateId || "").trim();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === target) {
      return i + 2;
    }
  }

  return null;
}

function NF_booleanValue_(value) {
  if (typeof value === "boolean") return value;
  return String(value).toUpperCase() !== "FALSE";
}

function NF_isTrue_(value) {
  return value === true || String(value).toUpperCase() === "TRUE";
}

function NF_testTemplateEngine() {
  NF_initializeTemplateEngine();

  const rendered = NF_renderTemplate(
    "TPL-LEAD-CONFIRMATION",
    {
      FirstName: "Template",
      LeadType: "Buyer"
    }
  );

  if (
    rendered.subject.indexOf("Template") === -1 ||
    rendered.bodyHtml.indexOf("Buyer") === -1
  ) {
    throw new Error("Notification Template Engine self-test failed.");
  }

  Logger.log(JSON.stringify(rendered));

  return true;
}
