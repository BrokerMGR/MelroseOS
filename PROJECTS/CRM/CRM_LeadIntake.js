/**
 * =====================================================================
 * MELROSEOS 5.0 — CRM LEAD INTAKE ENGINE
 * Full Overwrite
 * Version 5.0.0
 *
 * INSTALL LOCATION
 * - Apps Script project attached to the MelroseOS CRM spreadsheet
 *
 * DEPENDENCY
 * - MelroseOS 5.0 CRM Foundation
 *
 * RUN IN ORDER
 * 1. setupM5CRMLeadIntake()
 * 2. seedM5LeadSources()
 * 3. installM5LeadIntakeTriggers()
 * 4. testM5CRMLeadIntake()
 *
 * PRIMARY ENTRY POINT
 * - submitM5Lead(payload)
 *
 * PURPOSE
 * - Standardize all incoming leads
 * - Validate required data
 * - Normalize lead source values
 * - Prevent duplicate contacts
 * - Create or update CRM contact records
 * - Create intake records and timeline events
 * - Score and prioritize leads
 * - Create follow-up tasks
 * - Provide assignment and automation hooks
 * - Support manual, form, CSV, website, social and API intake
 * =====================================================================
 */


var M5_LEAD_INTAKE = Object.freeze({
  VERSION: '5.0.0',

  SHEETS: Object.freeze({
    INTAKE: 'M5_LeadIntake',
    SOURCES: 'M5_LeadSources',
    RULES: 'M5_LeadScoringRules',
    REJECTIONS: 'M5_LeadRejections',
    EVENTS: 'M5_LeadIntakeEvents'
  }),

  SOURCES: Object.freeze({
    BOOK_NOW: 'BOOK_NOW',
    CITY_GUIDE: 'CITY_GUIDE',
    WEBSITE: 'WEBSITE',
    FACEBOOK: 'FACEBOOK',
    INSTAGRAM: 'INSTAGRAM',
    LINKEDIN: 'LINKEDIN',
    GOOGLE: 'GOOGLE',
    REFERRAL: 'REFERRAL',
    OPEN_HOUSE: 'OPEN_HOUSE',
    QR_CODE: 'QR_CODE',
    MANUAL: 'MANUAL',
    CSV_IMPORT: 'CSV_IMPORT',
    RECRUITING: 'RECRUITING',
    API: 'API',
    OTHER: 'OTHER'
  }),

  STATUSES: Object.freeze({
    RECEIVED: 'RECEIVED',
    VALIDATED: 'VALIDATED',
    DUPLICATE: 'DUPLICATE',
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    REJECTED: 'REJECTED',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED'
  })
});


/* =====================================================================
   INSTALLATION
===================================================================== */

function setupM5CRMLeadIntake() {
  m5LeadIntakeRequireFoundation_();

  var ss = m5CrmWorkbook_();

  m5CrmEnsureSheet_(ss, M5_LEAD_INTAKE.SHEETS.INTAKE, [
    'IntakeID',
    'ContactID',
    'LeadID',
    'LeadSource',
    'LeadSourceDetail',
    'ExternalReference',
    'ContactType',
    'FirstName',
    'LastName',
    'Email',
    'Phone',
    'City',
    'State',
    'ZipCode',
    'Parish',
    'Message',
    'CampaignID',
    'LandingPageURL',
    'ReferrerURL',
    'UTMSource',
    'UTMMedium',
    'UTMCampaign',
    'UTMTerm',
    'UTMContent',
    'LeadScore',
    'Priority',
    'DuplicateStatus',
    'ProcessingStatus',
    'AssignedAgentID',
    'AssignedAgentName',
    'ReceivedAt',
    'ProcessedAt',
    'CreatedBy',
    'RawPayloadJSON',
    'ProcessingMessage'
  ]);

  m5CrmEnsureSheet_(ss, M5_LEAD_INTAKE.SHEETS.SOURCES, [
    'LeadSource',
    'DisplayName',
    'Category',
    'DefaultScore',
    'DefaultPriority',
    'IsActive',
    'Description',
    'UpdatedAt'
  ]);

  m5CrmEnsureSheet_(ss, M5_LEAD_INTAKE.SHEETS.RULES, [
    'RuleID',
    'RuleName',
    'FieldName',
    'Operator',
    'MatchValue',
    'ScoreAdjustment',
    'PriorityOverride',
    'IsActive',
    'Description',
    'UpdatedAt'
  ]);

  m5CrmEnsureSheet_(ss, M5_LEAD_INTAKE.SHEETS.REJECTIONS, [
    'RejectionID',
    'IntakeID',
    'ReasonCode',
    'ReasonMessage',
    'LeadSource',
    'Email',
    'Phone',
    'ReceivedAt',
    'RawPayloadJSON',
    'ReviewedAt',
    'ReviewedBy',
    'Resolution'
  ]);

  m5CrmEnsureSheet_(ss, M5_LEAD_INTAKE.SHEETS.EVENTS, [
    'EventID',
    'IntakeID',
    'ContactID',
    'EventType',
    'Status',
    'Message',
    'EventAt',
    'MetadataJSON'
  ]);

  m5LeadIntakeApplyValidations_();

  m5CrmWriteCoreRegistration_();

  return {
    success: true,
    version: M5_LEAD_INTAKE.VERSION,
    nextFunction: 'seedM5LeadSources'
  };
}


function seedM5LeadSources() {
  var sourceSheet = m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.SOURCES);

  var rows = [
    ['BOOK_NOW', 'Book Now', 'WEBSITE', 25, 'High', true, 'Primary consultation form.'],
    ['CITY_GUIDE', 'City Guide', 'WEBSITE', 20, 'High', true, 'Lead from parish or city guide page.'],
    ['WEBSITE', 'Website', 'WEBSITE', 15, 'Normal', true, 'General website inquiry.'],
    ['FACEBOOK', 'Facebook', 'SOCIAL', 15, 'Normal', true, 'Facebook organic or paid lead.'],
    ['INSTAGRAM', 'Instagram', 'SOCIAL', 15, 'Normal', true, 'Instagram organic or paid lead.'],
    ['LINKEDIN', 'LinkedIn', 'SOCIAL', 12, 'Normal', true, 'LinkedIn inquiry.'],
    ['GOOGLE', 'Google', 'SEARCH', 20, 'High', true, 'Google search or advertisement lead.'],
    ['REFERRAL', 'Referral', 'REFERRAL', 30, 'High', true, 'Personal or professional referral.'],
    ['OPEN_HOUSE', 'Open House', 'EVENT', 20, 'High', true, 'Open house registration.'],
    ['QR_CODE', 'QR Code', 'OFFLINE', 15, 'Normal', true, 'QR code conversion.'],
    ['MANUAL', 'Manual Entry', 'INTERNAL', 10, 'Normal', true, 'Entered manually by brokerage staff.'],
    ['CSV_IMPORT', 'CSV Import', 'IMPORT', 5, 'Low', true, 'Bulk imported lead.'],
    ['RECRUITING', 'Recruiting', 'RECRUITING', 20, 'High', true, 'Agent recruitment inquiry.'],
    ['API', 'API', 'INTEGRATION', 10, 'Normal', true, 'External API integration.'],
    ['OTHER', 'Other', 'OTHER', 5, 'Low', true, 'Unclassified lead source.']
  ].map(function (row) {
    return {
      LeadSource: row[0],
      DisplayName: row[1],
      Category: row[2],
      DefaultScore: row[3],
      DefaultPriority: row[4],
      IsActive: row[5],
      Description: row[6],
      UpdatedAt: new Date()
    };
  });

  m5CrmUpsert_(sourceSheet, 'LeadSource', rows);

  seedM5LeadScoringRules();

  return {
    success: true,
    sourcesSeeded: rows.length
  };
}


function seedM5LeadScoringRules() {
  var ruleSheet = m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.RULES);

  var rules = [
    ['RULE-EMAIL', 'Has Email', 'Email', 'NOT_EMPTY', '', 10, '', true, 'Lead supplied an email address.'],
    ['RULE-PHONE', 'Has Phone', 'Phone', 'NOT_EMPTY', '', 15, '', true, 'Lead supplied a phone number.'],
    ['RULE-MESSAGE', 'Has Message', 'Message', 'NOT_EMPTY', '', 5, '', true, 'Lead supplied a message or comments.'],
    ['RULE-PARISH', 'Has Parish', 'Parish', 'NOT_EMPTY', '', 5, '', true, 'Lead supplied a parish.'],
    ['RULE-ZIP', 'Has Zip Code', 'ZipCode', 'NOT_EMPTY', '', 5, '', true, 'Lead supplied a ZIP code.'],
    ['RULE-BUYER', 'Buyer Lead', 'ContactType', 'EQUALS', 'Buyer', 10, '', true, 'Buyer inquiry.'],
    ['RULE-SELLER', 'Seller Lead', 'ContactType', 'EQUALS', 'Seller', 15, 'High', true, 'Seller inquiry.'],
    ['RULE-INVESTOR', 'Investor Lead', 'ContactType', 'EQUALS', 'Investor', 15, 'High', true, 'Investor inquiry.'],
    ['RULE-REFERRAL', 'Referral Source', 'LeadSource', 'EQUALS', 'REFERRAL', 15, 'High', true, 'Referral leads receive added priority.'],
    ['RULE-BOOKNOW', 'Book Now Source', 'LeadSource', 'EQUALS', 'BOOK_NOW', 10, 'High', true, 'Consultation form submission.'],
    ['RULE-RECRUITING', 'Recruiting Source', 'LeadSource', 'EQUALS', 'RECRUITING', 10, 'High', true, 'Recruiting inquiry.']
  ].map(function (row) {
    return {
      RuleID: row[0],
      RuleName: row[1],
      FieldName: row[2],
      Operator: row[3],
      MatchValue: row[4],
      ScoreAdjustment: row[5],
      PriorityOverride: row[6],
      IsActive: row[7],
      Description: row[8],
      UpdatedAt: new Date()
    };
  });

  m5CrmUpsert_(ruleSheet, 'RuleID', rules);

  return {
    success: true,
    rulesSeeded: rules.length
  };
}


/* =====================================================================
   PRIMARY INTAKE
===================================================================== */

function submitM5Lead(payload) {
  payload = payload || {};

  var intakeId = 'INTAKE-' + Utilities.getUuid();
  var receivedAt = new Date();
  var normalized = m5NormalizeLeadPayload_(payload);

  m5LeadIntakeWriteEvent_({
    intakeId: intakeId,
    eventType: 'LEAD_RECEIVED',
    status: 'RECEIVED',
    message: 'Lead payload received.',
    metadata: normalized
  });

  var validation = validateM5LeadPayload(normalized);

  if (!validation.success) {
    return m5RejectLead_(
      intakeId,
      normalized,
      validation.code,
      validation.message
    );
  }

  var sourceRecord = m5GetLeadSourceRecord_(normalized.leadSource);

  if (!sourceRecord || !m5LeadIntakeBoolean_(sourceRecord.IsActive)) {
    return m5RejectLead_(
      intakeId,
      normalized,
      'INACTIVE_SOURCE',
      'Lead source is not active.'
    );
  }

  var scoring = scoreM5Lead(normalized);
  normalized.leadScore = scoring.score;
  normalized.priority = scoring.priority;

  var duplicate = findM5ContactDuplicate({
    email: normalized.email,
    phone: normalized.phone
  });

  var contactResult;

  try {
    if (duplicate.exactMatch) {
      contactResult = m5UpdateExistingContactFromLead_(
        duplicate.contact,
        normalized
      );
    } else {
      contactResult = createM5Contact({
        contactType: normalized.contactType,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        email: normalized.email,
        phone: normalized.phone,
        city: normalized.city,
        state: normalized.state,
        zipCode: normalized.zipCode,
        parish: normalized.parish,
        leadSource: normalized.leadSource,
        leadSourceDetail: normalized.leadSourceDetail,
        campaignId: normalized.campaignId,
        pipelineStage: 'New',
        leadStatus: 'Active',
        leadScore: normalized.leadScore,
        assignedAgentId: normalized.assignedAgentId,
        assignedAgentName: normalized.assignedAgentName,
        externalReference: normalized.externalReference,
        notesSummary: normalized.message
      });
    }

    var intakeStatus = duplicate.exactMatch ? 'UPDATED' : 'CREATED';

    m5WriteLeadIntakeRecord_({
      intakeId: intakeId,
      contactId: contactResult.contactId,
      leadId: contactResult.leadId ||
        (contactResult.contact && contactResult.contact.LeadID) ||
        duplicate.contact && duplicate.contact.LeadID || '',
      normalized: normalized,
      duplicateStatus: duplicate.exactMatch ? 'EXACT_MATCH' : 'NEW',
      processingStatus: intakeStatus,
      receivedAt: receivedAt,
      processedAt: new Date(),
      processingMessage: duplicate.exactMatch
        ? 'Existing CRM contact updated.'
        : 'New CRM contact created.',
      rawPayload: payload
    });

    createM5TimelineEvent({
      contactId: contactResult.contactId,
      leadId: contactResult.leadId ||
        (duplicate.contact && duplicate.contact.LeadID) || '',
      eventType: 'LEAD_INTAKE_COMPLETE',
      eventTitle: 'Lead Intake Completed',
      eventDescription:
        normalized.leadSource + ' lead processed successfully.',
      eventSource: normalized.leadSource,
      referenceId: intakeId,
      metadata: {
        intakeId: intakeId,
        score: normalized.leadScore,
        priority: normalized.priority,
        duplicate: duplicate.exactMatch,
        leadSourceDetail: normalized.leadSourceDetail
      }
    });

    var taskResult = m5CreateLeadFollowUpTask_(
      contactResult.contactId,
      normalized
    );

    var assignmentHook = m5RunLeadAssignmentHook_({
      intakeId: intakeId,
      contactId: contactResult.contactId,
      leadId: contactResult.leadId ||
        (duplicate.contact && duplicate.contact.LeadID) || '',
      payload: normalized
    });

    var automationHook = m5RunLeadAutomationHook_({
      intakeId: intakeId,
      contactId: contactResult.contactId,
      payload: normalized
    });

    m5LeadIntakeWriteEvent_({
      intakeId: intakeId,
      contactId: contactResult.contactId,
      eventType: 'LEAD_COMPLETE',
      status: 'COMPLETE',
      message: 'Lead intake completed successfully.',
      metadata: {
        taskId: taskResult.taskId || '',
        assignmentHook: assignmentHook,
        automationHook: automationHook
      }
    });

    return {
      success: true,
      intakeId: intakeId,
      contactId: contactResult.contactId,
      leadId: contactResult.leadId ||
        (duplicate.contact && duplicate.contact.LeadID) || '',
      duplicate: duplicate.exactMatch,
      leadScore: normalized.leadScore,
      priority: normalized.priority,
      taskId: taskResult.taskId || '',
      assignmentHook: assignmentHook,
      automationHook: automationHook
    };
  } catch (error) {
    m5WriteLeadIntakeRecord_({
      intakeId: intakeId,
      contactId: '',
      leadId: '',
      normalized: normalized,
      duplicateStatus: duplicate.exactMatch ? 'EXACT_MATCH' : 'UNKNOWN',
      processingStatus: 'FAILED',
      receivedAt: receivedAt,
      processedAt: new Date(),
      processingMessage: error.message || String(error),
      rawPayload: payload
    });

    m5LeadIntakeWriteEvent_({
      intakeId: intakeId,
      eventType: 'LEAD_FAILED',
      status: 'FAILED',
      message: error.message || String(error),
      metadata: {}
    });

    throw error;
  }
}


/* =====================================================================
   VALIDATION AND NORMALIZATION
===================================================================== */

function validateM5LeadPayload(payload) {
  payload = payload || {};

  if (
    !payload.firstName &&
    !payload.lastName &&
    !payload.email &&
    !payload.phone
  ) {
    return {
      success: false,
      code: 'MISSING_IDENTITY',
      message: 'Lead requires a name, email address, or phone number.'
    };
  }

  if (
    payload.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
  ) {
    return {
      success: false,
      code: 'INVALID_EMAIL',
      message: 'Lead email address is invalid.'
    };
  }

  if (
    payload.phone &&
    m5CrmNormalizePhone_(payload.phone).length < 10
  ) {
    return {
      success: false,
      code: 'INVALID_PHONE',
      message: 'Lead phone number is invalid.'
    };
  }

  if (!m5GetLeadSourceRecord_(payload.leadSource)) {
    return {
      success: false,
      code: 'UNKNOWN_SOURCE',
      message: 'Lead source is not registered: ' +
        payload.leadSource
    };
  }

  return {
    success: true,
    code: 'VALID',
    message: 'Lead payload is valid.'
  };
}


function m5NormalizeLeadPayload_(payload) {
  var leadSource = m5NormalizeLeadSource_(
    payload.leadSource || payload.source || 'OTHER'
  );

  return {
    leadSource: leadSource,
    leadSourceDetail: m5CrmText_(
      payload.leadSourceDetail ||
      payload.sourceDetail ||
      payload.formName ||
      ''
    ),
    externalReference: m5CrmText_(
      payload.externalReference ||
      payload.externalId ||
      payload.referenceId ||
      ''
    ),
    contactType: m5NormalizeContactType_(
      payload.contactType ||
      payload.leadType ||
      payload.type ||
      'Other'
    ),
    firstName: m5CrmText_(
      payload.firstName ||
      payload.firstname ||
      payload.first ||
      ''
    ),
    lastName: m5CrmText_(
      payload.lastName ||
      payload.lastname ||
      payload.last ||
      ''
    ),
    email: m5CrmNormalizeEmail_(
      payload.email ||
      payload.emailAddress ||
      ''
    ),
    phone: m5CrmText_(
      payload.phone ||
      payload.phoneNumber ||
      payload.mobile ||
      ''
    ),
    city: m5CrmText_(payload.city),
    state: m5CrmText_(payload.state) || 'LA',
    zipCode: m5CrmText_(
      payload.zipCode ||
      payload.zip ||
      payload.postalCode ||
      ''
    ),
    parish: m5CrmText_(
      payload.parish ||
      payload.parishNeeded ||
      payload.serviceArea ||
      ''
    ),
    message: m5CrmText_(
      payload.message ||
      payload.comments ||
      payload.notes ||
      payload.inquiry ||
      ''
    ),
    campaignId: m5CrmText_(
      payload.campaignId ||
      payload.campaign ||
      ''
    ),
    landingPageUrl: m5CrmText_(
      payload.landingPageUrl ||
      payload.pageUrl ||
      payload.url ||
      ''
    ),
    referrerUrl: m5CrmText_(
      payload.referrerUrl ||
      payload.referrer ||
      ''
    ),
    utmSource: m5CrmText_(payload.utmSource),
    utmMedium: m5CrmText_(payload.utmMedium),
    utmCampaign: m5CrmText_(payload.utmCampaign),
    utmTerm: m5CrmText_(payload.utmTerm),
    utmContent: m5CrmText_(payload.utmContent),
    assignedAgentId: m5CrmText_(payload.assignedAgentId),
    assignedAgentName: m5CrmText_(payload.assignedAgentName),
    leadScore: 0,
    priority: 'Normal'
  };
}


function m5NormalizeLeadSource_(source) {
  var value = m5CrmText_(source)
    .toUpperCase()
    .replace(/[\s\-]+/g, '_');

  var aliases = {
    BOOKNOW: 'BOOK_NOW',
    BOOK_NOW_FORM: 'BOOK_NOW',
    CITYGUIDE: 'CITY_GUIDE',
    CITY_PAGE: 'CITY_GUIDE',
    FB: 'FACEBOOK',
    FACEBOOK_AD: 'FACEBOOK',
    IG: 'INSTAGRAM',
    INSTAGRAM_AD: 'INSTAGRAM',
    GOOGLE_ADS: 'GOOGLE',
    GOOGLE_SEARCH: 'GOOGLE',
    OPENHOUSE: 'OPEN_HOUSE',
    QR: 'QR_CODE',
    MANUAL_ENTRY: 'MANUAL',
    IMPORT: 'CSV_IMPORT',
    AGENT_RECRUITING: 'RECRUITING'
  };

  if (aliases[value]) {
    value = aliases[value];
  }

  return M5_LEAD_INTAKE.SOURCES[value]
    ? M5_LEAD_INTAKE.SOURCES[value]
    : 'OTHER';
}


function m5NormalizeContactType_(type) {
  var value = m5CrmText_(type).toLowerCase();

  var map = {
    buyer: 'Buyer',
    buyers: 'Buyer',
    seller: 'Seller',
    sellers: 'Seller',
    renter: 'Renter',
    renters: 'Renter',
    tenant: 'Renter',
    landlord: 'Landlord',
    investor: 'Investor',
    recruiting: 'Recruiting',
    recruit: 'Recruiting',
    agent: 'Agent',
    vendor: 'Vendor',
    referral: 'Referral Partner',
    past_client: 'Past Client',
    pastclient: 'Past Client'
  };

  return map[value] || 'Other';
}


/* =====================================================================
   LEAD SCORING
===================================================================== */

function scoreM5Lead(payload) {
  payload = payload || {};

  var source = m5GetLeadSourceRecord_(payload.leadSource);
  var score = Number(source && source.DefaultScore || 0);
  var priority = source && source.DefaultPriority || 'Normal';

  var rules = m5CrmReadObjects_(
    m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.RULES)
  ).filter(function (rule) {
    return m5LeadIntakeBoolean_(rule.IsActive);
  });

  rules.forEach(function (rule) {
    var value = m5LeadPayloadField_(payload, rule.FieldName);
    var matched = m5LeadRuleMatches_(
      value,
      rule.Operator,
      rule.MatchValue
    );

    if (!matched) {
      return;
    }

    score += Number(rule.ScoreAdjustment || 0);

    if (rule.PriorityOverride) {
      priority = rule.PriorityOverride;
    }
  });

  score = Math.max(0, Math.min(100, score));

  if (score >= 75) {
    priority = 'Urgent';
  } else if (score >= 50 && priority !== 'Urgent') {
    priority = 'High';
  } else if (score < 20 && priority === 'Normal') {
    priority = 'Low';
  }

  return {
    success: true,
    score: score,
    priority: priority
  };
}


function m5LeadPayloadField_(payload, fieldName) {
  var map = {
    LeadSource: 'leadSource',
    LeadSourceDetail: 'leadSourceDetail',
    ContactType: 'contactType',
    FirstName: 'firstName',
    LastName: 'lastName',
    Email: 'email',
    Phone: 'phone',
    City: 'city',
    State: 'state',
    ZipCode: 'zipCode',
    Parish: 'parish',
    Message: 'message',
    CampaignID: 'campaignId'
  };

  var key = map[fieldName] || fieldName;

  return payload[key];
}


function m5LeadRuleMatches_(value, operator, matchValue) {
  var left = m5CrmText_(value);
  var right = m5CrmText_(matchValue);
  var op = m5CrmText_(operator).toUpperCase();

  if (op === 'NOT_EMPTY') {
    return Boolean(left);
  }

  if (op === 'EMPTY') {
    return !left;
  }

  if (op === 'EQUALS') {
    return left.toLowerCase() === right.toLowerCase();
  }

  if (op === 'NOT_EQUALS') {
    return left.toLowerCase() !== right.toLowerCase();
  }

  if (op === 'CONTAINS') {
    return left.toLowerCase().indexOf(right.toLowerCase()) >= 0;
  }

  if (op === 'STARTS_WITH') {
    return left.toLowerCase().indexOf(right.toLowerCase()) === 0;
  }

  if (op === 'GREATER_THAN') {
    return Number(left || 0) > Number(right || 0);
  }

  if (op === 'LESS_THAN') {
    return Number(left || 0) < Number(right || 0);
  }

  return false;
}


/* =====================================================================
   CONTACT UPDATE
===================================================================== */

function m5UpdateExistingContactFromLead_(contact, payload) {
  var updates = {};

  if (!contact.FirstName && payload.firstName) {
    updates.firstName = payload.firstName;
  }

  if (!contact.LastName && payload.lastName) {
    updates.lastName = payload.lastName;
  }

  if (!contact.Email && payload.email) {
    updates.email = payload.email;
  }

  if (!contact.Phone && payload.phone) {
    updates.phone = payload.phone;
  }

  if (!contact.City && payload.city) {
    updates.city = payload.city;
  }

  if (!contact.ZipCode && payload.zipCode) {
    updates.zipCode = payload.zipCode;
  }

  if (!contact.Parish && payload.parish) {
    updates.parish = payload.parish;
  }

  updates.leadSource = payload.leadSource;
  updates.leadSourceDetail = payload.leadSourceDetail;
  updates.leadScore = Math.max(
    Number(contact.LeadScore || 0),
    Number(payload.leadScore || 0)
  );
  updates.lastContactAt = new Date();

  if (payload.message) {
    updates.notesSummary = payload.message;
  }

  updateM5Contact(contact.ContactID, updates);

  return {
    success: true,
    duplicate: true,
    contactId: contact.ContactID,
    leadId: contact.LeadID,
    contact: contact
  };
}


/* =====================================================================
   TASKS AND HOOKS
===================================================================== */

function m5CreateLeadFollowUpTask_(contactId, payload) {
  var dueAt = new Date();
  var minutes = payload.priority === 'Urgent'
    ? 5
    : payload.priority === 'High'
      ? 15
      : payload.priority === 'Normal'
        ? 60
        : 240;

  dueAt.setMinutes(dueAt.getMinutes() + minutes);

  return createM5Task({
    contactId: contactId,
    title: 'Respond to new ' + payload.contactType + ' lead',
    description:
      'Lead source: ' + payload.leadSource +
      (payload.message ? '\n\nLead message: ' + payload.message : ''),
    taskType: 'New Lead Follow Up',
    priority: payload.priority,
    status: 'Open',
    assignedToId: payload.assignedAgentId,
    assignedToName: payload.assignedAgentName,
    dueAt: dueAt,
    relatedRecordType: 'LEAD_INTAKE'
  });
}


function m5RunLeadAssignmentHook_(context) {
  if (typeof assignM5Lead === 'function') {
    try {
      return assignM5Lead(context);
    } catch (error) {
      return {
        success: false,
        available: true,
        error: error.message || String(error)
      };
    }
  }

  return {
    success: true,
    available: false,
    message: 'Assignment Engine not installed yet.'
  };
}


function m5RunLeadAutomationHook_(context) {
  if (typeof startM5LeadAutomation === 'function') {
    try {
      return startM5LeadAutomation(context);
    } catch (error) {
      return {
        success: false,
        available: true,
        error: error.message || String(error)
      };
    }
  }

  return {
    success: true,
    available: false,
    message: 'Automation Engine not installed yet.'
  };
}


/* =====================================================================
   INTAKE RECORDS
===================================================================== */

function m5WriteLeadIntakeRecord_(options) {
  var payload = options.normalized || {};

  m5CrmAppendObject_(
    m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.INTAKE),
    {
      IntakeID: options.intakeId,
      ContactID: options.contactId || '',
      LeadID: options.leadId || '',
      LeadSource: payload.leadSource || '',
      LeadSourceDetail: payload.leadSourceDetail || '',
      ExternalReference: payload.externalReference || '',
      ContactType: payload.contactType || '',
      FirstName: payload.firstName || '',
      LastName: payload.lastName || '',
      Email: payload.email || '',
      Phone: payload.phone || '',
      City: payload.city || '',
      State: payload.state || '',
      ZipCode: payload.zipCode || '',
      Parish: payload.parish || '',
      Message: payload.message || '',
      CampaignID: payload.campaignId || '',
      LandingPageURL: payload.landingPageUrl || '',
      ReferrerURL: payload.referrerUrl || '',
      UTMSource: payload.utmSource || '',
      UTMMedium: payload.utmMedium || '',
      UTMCampaign: payload.utmCampaign || '',
      UTMTerm: payload.utmTerm || '',
      UTMContent: payload.utmContent || '',
      LeadScore: payload.leadScore || 0,
      Priority: payload.priority || 'Normal',
      DuplicateStatus: options.duplicateStatus || '',
      ProcessingStatus: options.processingStatus || '',
      AssignedAgentID: payload.assignedAgentId || '',
      AssignedAgentName: payload.assignedAgentName || '',
      ReceivedAt: options.receivedAt || new Date(),
      ProcessedAt: options.processedAt || '',
      CreatedBy: m5CrmCurrentUser_(),
      RawPayloadJSON: m5CrmSafeJson_(options.rawPayload || {}),
      ProcessingMessage: options.processingMessage || ''
    }
  );
}


function m5RejectLead_(intakeId, payload, reasonCode, reasonMessage) {
  m5WriteLeadIntakeRecord_({
    intakeId: intakeId,
    contactId: '',
    leadId: '',
    normalized: payload,
    duplicateStatus: '',
    processingStatus: 'REJECTED',
    receivedAt: new Date(),
    processedAt: new Date(),
    processingMessage: reasonMessage,
    rawPayload: payload
  });

  m5CrmAppendObject_(
    m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.REJECTIONS),
    {
      RejectionID: 'REJECT-' + Utilities.getUuid(),
      IntakeID: intakeId,
      ReasonCode: reasonCode,
      ReasonMessage: reasonMessage,
      LeadSource: payload.leadSource || '',
      Email: payload.email || '',
      Phone: payload.phone || '',
      ReceivedAt: new Date(),
      RawPayloadJSON: m5CrmSafeJson_(payload),
      ReviewedAt: '',
      ReviewedBy: '',
      Resolution: ''
    }
  );

  m5LeadIntakeWriteEvent_({
    intakeId: intakeId,
    eventType: 'LEAD_REJECTED',
    status: 'REJECTED',
    message: reasonMessage,
    metadata: {
      reasonCode: reasonCode
    }
  });

  return {
    success: false,
    rejected: true,
    intakeId: intakeId,
    code: reasonCode,
    message: reasonMessage
  };
}


function m5LeadIntakeWriteEvent_(options) {
  m5CrmAppendObject_(
    m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.EVENTS),
    {
      EventID: 'INTAKE-EVENT-' + Utilities.getUuid(),
      IntakeID: options.intakeId || '',
      ContactID: options.contactId || '',
      EventType: options.eventType || '',
      Status: options.status || '',
      Message: options.message || '',
      EventAt: new Date(),
      MetadataJSON: m5CrmSafeJson_(options.metadata || {})
    }
  );
}


/* =====================================================================
   MANUAL / BATCH ENTRY
===================================================================== */

function submitM5LeadBatch(payloads) {
  payloads = Array.isArray(payloads) ? payloads : [];

  var results = payloads.map(function (payload) {
    try {
      return submitM5Lead(payload);
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  });

  return {
    success: results.every(function (result) {
      return result.success;
    }),
    submitted: payloads.length,
    succeeded: results.filter(function (result) {
      return result.success;
    }).length,
    failed: results.filter(function (result) {
      return !result.success;
    }).length,
    results: results
  };
}


function submitM5ManualTestLead() {
  return submitM5Lead({
    leadSource: 'MANUAL',
    leadSourceDetail: 'CRM Intake Test',
    contactType: 'Buyer',
    firstName: 'Test',
    lastName: 'Lead',
    email: 'test+' + new Date().getTime() + '@example.com',
    phone: '(985) 555-0100',
    city: 'Mandeville',
    state: 'LA',
    zipCode: '70471',
    parish: 'St. Tammany',
    message: 'Automated CRM intake test lead.'
  });
}


/* =====================================================================
   SOURCE LOOKUP
===================================================================== */

function m5GetLeadSourceRecord_(leadSource) {
  return m5CrmReadObjects_(
    m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.SOURCES)
  ).find(function (row) {
    return String(row.LeadSource || '').toUpperCase() ===
      String(leadSource || '').toUpperCase();
  }) || null;
}


/* =====================================================================
   TRIGGERS AND HEALTH
===================================================================== */

function installM5LeadIntakeTriggers() {
  m5CrmDeleteTriggers_('runM5LeadIntakeHealthCheck');

  ScriptApp.newTrigger('runM5LeadIntakeHealthCheck')
    .timeBased()
    .everyHours(6)
    .create();

  return {
    success: true,
    triggerInstalled: true,
    frequency: 'Every 6 hours'
  };
}


function runM5LeadIntakeHealthCheck() {
  var ss = m5CrmWorkbook_();
  var checks = [];

  Object.keys(M5_LEAD_INTAKE.SHEETS).forEach(function (key) {
    var name = M5_LEAD_INTAKE.SHEETS[key];
    var sheet = ss.getSheetByName(name);

    checks.push({
      name: name,
      status: sheet ? 'PASS' : 'FAIL',
      message: sheet ? 'Sheet available.' : 'Sheet missing.'
    });
  });

  var sources = m5CrmReadObjects_(
    m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.SOURCES)
  );

  checks.push({
    name: 'Lead Sources',
    status: sources.length ? 'PASS' : 'FAIL',
    message: sources.length + ' lead source(s) registered.'
  });

  var rules = m5CrmReadObjects_(
    m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.RULES)
  );

  checks.push({
    name: 'Scoring Rules',
    status: rules.length ? 'PASS' : 'WARNING',
    message: rules.length + ' scoring rule(s) registered.'
  });

  var failures = checks.filter(function (check) {
    return check.status === 'FAIL';
  });

  return {
    success: failures.length === 0,
    checks: checks.length,
    failed: failures.length,
    warnings: checks.filter(function (check) {
      return check.status === 'WARNING';
    }).length,
    results: checks
  };
}


/* =====================================================================
   VALIDATION FORMATTING
===================================================================== */

function m5LeadIntakeApplyValidations_() {
  var intake = m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.INTAKE);

  m5CrmSetValidationByHeader_(
    intake,
    'LeadSource',
    Object.keys(M5_LEAD_INTAKE.SOURCES)
  );

  m5CrmSetValidationByHeader_(
    intake,
    'ContactType',
    M5_CRM.CONTACT_TYPES
  );

  m5CrmSetValidationByHeader_(
    intake,
    'Priority',
    M5_CRM.PRIORITIES
  );
}


function m5LeadIntakeBoolean_(value) {
  if (value === true || value === false) {
    return value;
  }

  return ['TRUE', 'YES', '1', 'ACTIVE'].indexOf(
    String(value || '').toUpperCase()
  ) >= 0;
}


function m5LeadIntakeRequireFoundation_() {
  if (
    typeof M5_CRM === 'undefined' ||
    typeof m5CrmWorkbook_ !== 'function' ||
    typeof createM5Contact !== 'function' ||
    typeof createM5TimelineEvent !== 'function'
  ) {
    throw new Error(
      'Install the MelroseOS 5.0 CRM Foundation first.'
    );
  }
}


/* =====================================================================
   TEST
===================================================================== */

function testM5CRMLeadIntake() {
  var tests = [];

  function run(name, callback) {
    try {
      tests.push({
        test: name,
        status: 'PASS',
        result: callback()
      });
    } catch (error) {
      tests.push({
        test: name,
        status: 'FAIL',
        error: error.message || String(error)
      });
    }
  }

  run('CRM Foundation available', function () {
    m5LeadIntakeRequireFoundation_();
    return M5_CRM.VERSION;
  });

  run('Lead intake sheets available', function () {
    var ss = m5CrmWorkbook_();
    var missing = Object.keys(M5_LEAD_INTAKE.SHEETS)
      .map(function (key) {
        return M5_LEAD_INTAKE.SHEETS[key];
      })
      .filter(function (name) {
        return !ss.getSheetByName(name);
      });

    if (missing.length) {
      throw new Error('Missing sheets: ' + missing.join(', '));
    }

    return Object.keys(M5_LEAD_INTAKE.SHEETS).length;
  });

  run('Lead sources available', function () {
    var sources = m5CrmReadObjects_(
      m5CrmSheet_(M5_LEAD_INTAKE.SHEETS.SOURCES)
    );

    if (!sources.length) {
      throw new Error('No lead sources are registered.');
    }

    return sources.length;
  });

  run('Lead validation working', function () {
    return validateM5LeadPayload(
      m5NormalizeLeadPayload_({
        leadSource: 'MANUAL',
        firstName: 'Validation',
        email: 'validation@example.com'
      })
    );
  });

  run('Lead scoring working', function () {
    return scoreM5Lead(
      m5NormalizeLeadPayload_({
        leadSource: 'BOOK_NOW',
        contactType: 'Seller',
        firstName: 'Score',
        email: 'score@example.com',
        phone: '(985) 555-0101',
        parish: 'St. Tammany',
        message: 'Interested in selling.'
      })
    );
  });

  run('Lead intake health check working', function () {
    return runM5LeadIntakeHealthCheck();
  });

  var failures = tests.filter(function (test) {
    return test.status === 'FAIL';
  });

  return {
    success: failures.length === 0,
    version: M5_LEAD_INTAKE.VERSION,
    passed: tests.length - failures.length,
    failed: failures.length,
    tests: tests,
    nextModule: failures.length === 0
      ? 'M5 CRM Assignment Engine'
      : ''
  };
}
