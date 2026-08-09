/**
 * =====================================================================
 * MELROSEOS 5.0 — CRM FOUNDATION
 * Full Overwrite
 * Version 5.0.0
 *
 * INSTALL LOCATION
 * - Apps Script project attached to the MelroseOS CRM spreadsheet
 *
 * CRM WORKBOOK
 * - 1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8
 *
 * RUN IN ORDER
 * 1. setupM5CRMFoundation()
 * 2. seedM5CRMSettings()
 * 3. installM5CRMFoundationTriggers()
 * 4. testM5CRMFoundation()
 *
 * THIS FOUNDATION PROVIDES
 * - Permanent CRM record IDs
 * - Contacts
 * - Lead timeline
 * - Activities
 * - Tasks
 * - Appointments
 * - Lead assignments
 * - Pipeline
 * - Notes
 * - Communication log
 * - Tags
 * - Custom fields
 * - Settings
 * - Audit log
 * - Duplicate detection
 * - Contact search
 * - Health monitoring
 * =====================================================================
 */


var M5_CRM = Object.freeze({
  VERSION: '5.0.0',

  WORKBOOKS: Object.freeze({
    CORE: '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64',
    CRM: '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
    MARKETING: '1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo',
    WEBSITE: '1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc',
    ANALYTICS: '1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU',
    ARCHIVE: '1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk'
  }),

  SHEETS: Object.freeze({
    CONTACTS: 'M5_Contacts',
    TIMELINE: 'M5_LeadTimeline',
    ACTIVITIES: 'M5_Activities',
    TASKS: 'M5_Tasks',
    APPOINTMENTS: 'M5_Appointments',
    ASSIGNMENTS: 'M5_LeadAssignments',
    PIPELINE: 'M5_Pipeline',
    NOTES: 'M5_Notes',
    COMMUNICATIONS: 'M5_CommunicationLog',
    TAGS: 'M5_Tags',
    CUSTOM_FIELDS: 'M5_CustomFields',
    SETTINGS: 'M5_Settings',
    AUDIT: 'M5_CRMAuditLog',
    DUPLICATES: 'M5_DuplicateReview',
    HEALTH: 'M5_CRMHealth',
    SEARCH: 'M5_ContactSearch'
  }),

  CONTACT_TYPES: [
    'Buyer',
    'Seller',
    'Renter',
    'Landlord',
    'Investor',
    'Recruiting',
    'Agent',
    'Vendor',
    'Past Client',
    'Referral Partner',
    'Other'
  ],

  PIPELINE_STAGES: [
    'New',
    'Attempting Contact',
    'Contacted',
    'Qualified',
    'Consultation Scheduled',
    'Consultation Completed',
    'Active Search',
    'Showing Homes',
    'Listing Preparation',
    'Listed',
    'Offer Submitted',
    'Under Contract',
    'Closed',
    'Long-Term Nurture',
    'Lost',
    'Do Not Contact'
  ],

  TASK_STATUSES: [
    'Open',
    'In Progress',
    'Waiting',
    'Completed',
    'Cancelled'
  ],

  PRIORITIES: [
    'Low',
    'Normal',
    'High',
    'Urgent'
  ]
});


/* =====================================================================
   INSTALLATION
===================================================================== */

function setupM5CRMFoundation() {
  var ss = m5CrmWorkbook_();

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.CONTACTS, [
    'ContactID',
    'LeadID',
    'ContactType',
    'FirstName',
    'LastName',
    'FullName',
    'Email',
    'EmailNormalized',
    'Phone',
    'PhoneNormalized',
    'SecondaryEmail',
    'SecondaryPhone',
    'Company',
    'Address1',
    'Address2',
    'City',
    'State',
    'ZipCode',
    'Parish',
    'LeadSource',
    'LeadSourceDetail',
    'CampaignID',
    'AssignedAgentID',
    'AssignedAgentName',
    'PipelineStage',
    'LeadStatus',
    'LeadScore',
    'PreferredContactMethod',
    'PreferredContactTime',
    'Language',
    'Tags',
    'DoNotContact',
    'Unsubscribed',
    'LastContactAt',
    'NextFollowUpAt',
    'CreatedAt',
    'CreatedBy',
    'UpdatedAt',
    'UpdatedBy',
    'ArchivedAt',
    'ExternalReference',
    'NotesSummary'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.TIMELINE, [
    'TimelineID',
    'ContactID',
    'LeadID',
    'EventType',
    'EventTitle',
    'EventDescription',
    'EventSource',
    'ReferenceID',
    'EventAt',
    'CreatedAt',
    'CreatedBy',
    'MetadataJSON'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.ACTIVITIES, [
    'ActivityID',
    'ContactID',
    'ActivityType',
    'Subject',
    'Description',
    'Direction',
    'Status',
    'Outcome',
    'OwnerID',
    'OwnerName',
    'DueAt',
    'CompletedAt',
    'ReferenceID',
    'CreatedAt',
    'CreatedBy',
    'UpdatedAt'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.TASKS, [
    'TaskID',
    'ContactID',
    'Title',
    'Description',
    'TaskType',
    'Priority',
    'Status',
    'AssignedToID',
    'AssignedToName',
    'DueAt',
    'ReminderAt',
    'CompletedAt',
    'CompletedBy',
    'RelatedRecordType',
    'RelatedRecordID',
    'CreatedAt',
    'CreatedBy',
    'UpdatedAt',
    'UpdatedBy'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.APPOINTMENTS, [
    'AppointmentID',
    'ContactID',
    'AppointmentType',
    'Title',
    'StartAt',
    'EndAt',
    'TimeZone',
    'Status',
    'Location',
    'MeetingURL',
    'CalendarEventID',
    'AssignedAgentID',
    'AssignedAgentName',
    'ConfirmedAt',
    'CancelledAt',
    'RescheduleRequestedAt',
    'Notes',
    'CreatedAt',
    'CreatedBy',
    'UpdatedAt'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.ASSIGNMENTS, [
    'AssignmentID',
    'ContactID',
    'LeadID',
    'AgentID',
    'AgentName',
    'AssignmentMethod',
    'AssignmentReason',
    'Territory',
    'Parish',
    'ZipCode',
    'Status',
    'AssignedAt',
    'AssignedBy',
    'ReleasedAt',
    'ReleasedBy',
    'PreviousAssignmentID',
    'Notes'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.PIPELINE, [
    'PipelineID',
    'ContactID',
    'PipelineType',
    'CurrentStage',
    'PreviousStage',
    'StageEnteredAt',
    'StageChangedAt',
    'StageChangedBy',
    'Probability',
    'EstimatedValue',
    'ExpectedCloseDate',
    'LostReason',
    'ClosedAt',
    'Status',
    'CreatedAt',
    'UpdatedAt'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.NOTES, [
    'NoteID',
    'ContactID',
    'NoteType',
    'Title',
    'NoteText',
    'IsPinned',
    'IsPrivate',
    'CreatedAt',
    'CreatedBy',
    'UpdatedAt',
    'UpdatedBy'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.COMMUNICATIONS, [
    'CommunicationID',
    'ContactID',
    'Channel',
    'Direction',
    'Subject',
    'MessageSummary',
    'FromAddress',
    'ToAddress',
    'Status',
    'SentAt',
    'DeliveredAt',
    'OpenedAt',
    'ClickedAt',
    'RepliedAt',
    'ExternalMessageID',
    'CampaignID',
    'TemplateID',
    'CreatedAt',
    'MetadataJSON'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.TAGS, [
    'TagAssignmentID',
    'ContactID',
    'Tag',
    'Category',
    'Status',
    'AssignedAt',
    'AssignedBy',
    'RemovedAt',
    'RemovedBy'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.CUSTOM_FIELDS, [
    'CustomFieldValueID',
    'ContactID',
    'FieldKey',
    'FieldLabel',
    'FieldType',
    'FieldValue',
    'UpdatedAt',
    'UpdatedBy'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.SETTINGS, [
    'SettingKey',
    'SettingValue',
    'ValueType',
    'Category',
    'Description',
    'IsActive',
    'UpdatedAt',
    'UpdatedBy'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.AUDIT, [
    'AuditID',
    'RecordType',
    'RecordID',
    'Action',
    'FieldName',
    'OldValue',
    'NewValue',
    'ChangedAt',
    'ChangedBy',
    'SourceFunction',
    'MetadataJSON'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.DUPLICATES, [
    'DuplicateReviewID',
    'PrimaryContactID',
    'PossibleDuplicateContactID',
    'MatchType',
    'MatchScore',
    'MatchDetails',
    'Status',
    'ReviewedAt',
    'ReviewedBy',
    'Resolution',
    'CreatedAt'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.HEALTH, [
    'CheckID',
    'CheckName',
    'Status',
    'Message',
    'RecordsChecked',
    'IssuesFound',
    'CheckedAt'
  ]);

  m5CrmEnsureSheet_(ss, M5_CRM.SHEETS.SEARCH, [
    'SearchField',
    'SearchValue'
  ]);

  m5CrmFormatAllSheets_();
  m5CrmApplyValidations_();
  m5CrmWriteCoreRegistration_();

  return {
    success: true,
    version: M5_CRM.VERSION,
    sheetsCreated: Object.keys(M5_CRM.SHEETS).length,
    nextFunction: 'seedM5CRMSettings'
  };
}


function seedM5CRMSettings() {
  var sheet = m5CrmSheet_(M5_CRM.SHEETS.SETTINGS);

  var settings = [
    ['CRM_VERSION', M5_CRM.VERSION, 'TEXT', 'SYSTEM', 'Installed CRM version.', true],
    ['DEFAULT_TIMEZONE', 'America/Chicago', 'TEXT', 'SYSTEM', 'Primary brokerage time zone.', true],
    ['DEFAULT_STATE', 'LA', 'TEXT', 'CONTACTS', 'Default state for new contacts.', true],
    ['DEFAULT_PIPELINE_STAGE', 'New', 'TEXT', 'PIPELINE', 'Initial pipeline stage.', true],
    ['DUPLICATE_EMAIL_MATCH', 'true', 'BOOLEAN', 'DUPLICATES', 'Check normalized email for duplicates.', true],
    ['DUPLICATE_PHONE_MATCH', 'true', 'BOOLEAN', 'DUPLICATES', 'Check normalized phone for duplicates.', true],
    ['AUTO_CREATE_PIPELINE', 'true', 'BOOLEAN', 'PIPELINE', 'Create pipeline record for new contacts.', true],
    ['AUTO_CREATE_TIMELINE', 'true', 'BOOLEAN', 'TIMELINE', 'Create timeline event for new contacts.', true],
    ['CONTACT_ID_PREFIX', 'CONTACT', 'TEXT', 'IDS', 'Permanent contact identifier prefix.', true],
    ['LEAD_ID_PREFIX', 'LEAD', 'TEXT', 'IDS', 'Permanent lead identifier prefix.', true],
    ['TASK_ID_PREFIX', 'TASK', 'TEXT', 'IDS', 'Permanent task identifier prefix.', true],
    ['APPOINTMENT_ID_PREFIX', 'APPT', 'TEXT', 'IDS', 'Permanent appointment identifier prefix.', true],
    ['ACTIVITY_ID_PREFIX', 'ACTIVITY', 'TEXT', 'IDS', 'Permanent activity identifier prefix.', true],
    ['NOTE_ID_PREFIX', 'NOTE', 'TEXT', 'IDS', 'Permanent note identifier prefix.', true],
    ['PIPELINE_ID_PREFIX', 'PIPELINE', 'TEXT', 'IDS', 'Permanent pipeline identifier prefix.', true]
  ].map(function (row) {
    return {
      SettingKey: row[0],
      SettingValue: row[1],
      ValueType: row[2],
      Category: row[3],
      Description: row[4],
      IsActive: row[5],
      UpdatedAt: new Date(),
      UpdatedBy: m5CrmCurrentUser_()
    };
  });

  m5CrmUpsert_(sheet, 'SettingKey', settings);

  return {
    success: true,
    settingsSeeded: settings.length
  };
}


/* =====================================================================
   CONTACT CREATION AND UPDATE
===================================================================== */

function createM5Contact(input) {
  input = input || {};

  var firstName = m5CrmText_(input.firstName);
  var lastName = m5CrmText_(input.lastName);
  var email = m5CrmText_(input.email);
  var phone = m5CrmText_(input.phone);

  if (!firstName && !lastName && !email && !phone) {
    throw new Error(
      'A contact requires a name, email address, or phone number.'
    );
  }

  var emailNormalized = m5CrmNormalizeEmail_(email);
  var phoneNormalized = m5CrmNormalizePhone_(phone);

  var duplicate = findM5ContactDuplicate({
    email: emailNormalized,
    phone: phoneNormalized
  });

  if (duplicate.exactMatch) {
    return {
      success: true,
      duplicate: true,
      contactId: duplicate.contact.ContactID,
      contact: duplicate.contact,
      message: 'Existing contact returned instead of creating a duplicate.'
    };
  }

  var contactId = m5CrmNextId_('CONTACT');
  var leadId = m5CrmNextId_('LEAD');
  var now = new Date();
  var user = m5CrmCurrentUser_();

  var contact = {
    ContactID: contactId,
    LeadID: leadId,
    ContactType: input.contactType || 'Other',
    FirstName: firstName,
    LastName: lastName,
    FullName: [firstName, lastName].filter(Boolean).join(' '),
    Email: email,
    EmailNormalized: emailNormalized,
    Phone: phone,
    PhoneNormalized: phoneNormalized,
    SecondaryEmail: m5CrmText_(input.secondaryEmail),
    SecondaryPhone: m5CrmText_(input.secondaryPhone),
    Company: m5CrmText_(input.company),
    Address1: m5CrmText_(input.address1),
    Address2: m5CrmText_(input.address2),
    City: m5CrmText_(input.city),
    State: m5CrmText_(input.state) || 'LA',
    ZipCode: m5CrmText_(input.zipCode),
    Parish: m5CrmText_(input.parish),
    LeadSource: m5CrmText_(input.leadSource) || 'Manual Entry',
    LeadSourceDetail: m5CrmText_(input.leadSourceDetail),
    CampaignID: m5CrmText_(input.campaignId),
    AssignedAgentID: m5CrmText_(input.assignedAgentId),
    AssignedAgentName: m5CrmText_(input.assignedAgentName),
    PipelineStage: m5CrmText_(input.pipelineStage) || 'New',
    LeadStatus: m5CrmText_(input.leadStatus) || 'Active',
    LeadScore: Number(input.leadScore || 0),
    PreferredContactMethod: m5CrmText_(input.preferredContactMethod),
    PreferredContactTime: m5CrmText_(input.preferredContactTime),
    Language: m5CrmText_(input.language) || 'English',
    Tags: m5CrmText_(input.tags),
    DoNotContact: Boolean(input.doNotContact),
    Unsubscribed: Boolean(input.unsubscribed),
    LastContactAt: input.lastContactAt || '',
    NextFollowUpAt: input.nextFollowUpAt || '',
    CreatedAt: now,
    CreatedBy: user,
    UpdatedAt: now,
    UpdatedBy: user,
    ArchivedAt: '',
    ExternalReference: m5CrmText_(input.externalReference),
    NotesSummary: m5CrmText_(input.notesSummary)
  };

  m5CrmAppendObject_(m5CrmSheet_(M5_CRM.SHEETS.CONTACTS), contact);

  createM5TimelineEvent({
    contactId: contactId,
    leadId: leadId,
    eventType: 'CONTACT_CREATED',
    eventTitle: 'Contact Created',
    eventDescription: 'New CRM contact created.',
    eventSource: contact.LeadSource,
    referenceId: contactId,
    metadata: {
      contactType: contact.ContactType,
      leadSource: contact.LeadSource
    }
  });

  createM5PipelineRecord({
    contactId: contactId,
    pipelineType: contact.ContactType,
    currentStage: contact.PipelineStage
  });

  if (contact.AssignedAgentID || contact.AssignedAgentName) {
    createM5LeadAssignment({
      contactId: contactId,
      leadId: leadId,
      agentId: contact.AssignedAgentID,
      agentName: contact.AssignedAgentName,
      assignmentMethod: input.assignmentMethod || 'Manual',
      assignmentReason: input.assignmentReason || 'Created with assigned agent',
      parish: contact.Parish,
      zipCode: contact.ZipCode
    });
  }

  m5CrmAudit_(
    'CONTACT',
    contactId,
    'CREATE',
    '',
    '',
    JSON.stringify(contact),
    'createM5Contact'
  );

  if (duplicate.possibleMatches.length) {
    m5CrmRecordPossibleDuplicates_(
      contactId,
      duplicate.possibleMatches
    );
  }

  return {
    success: true,
    duplicate: false,
    contactId: contactId,
    leadId: leadId,
    contact: contact
  };
}


function updateM5Contact(contactId, updates) {
  updates = updates || {};

  var sheet = m5CrmSheet_(M5_CRM.SHEETS.CONTACTS);
  var record = m5CrmFindRow_(sheet, 'ContactID', contactId);

  if (!record) {
    throw new Error('Contact not found: ' + contactId);
  }

  var allowed = [
    'ContactType',
    'FirstName',
    'LastName',
    'Email',
    'Phone',
    'SecondaryEmail',
    'SecondaryPhone',
    'Company',
    'Address1',
    'Address2',
    'City',
    'State',
    'ZipCode',
    'Parish',
    'LeadSource',
    'LeadSourceDetail',
    'CampaignID',
    'AssignedAgentID',
    'AssignedAgentName',
    'PipelineStage',
    'LeadStatus',
    'LeadScore',
    'PreferredContactMethod',
    'PreferredContactTime',
    'Language',
    'Tags',
    'DoNotContact',
    'Unsubscribed',
    'LastContactAt',
    'NextFollowUpAt',
    'ArchivedAt',
    'ExternalReference',
    'NotesSummary'
  ];

  var changes = {};
  var auditRows = [];

  allowed.forEach(function (field) {
    var inputKey = field.charAt(0).toLowerCase() + field.slice(1);

    if (!Object.prototype.hasOwnProperty.call(updates, inputKey) &&
        !Object.prototype.hasOwnProperty.call(updates, field)) {
      return;
    }

    var newValue = Object.prototype.hasOwnProperty.call(updates, inputKey)
      ? updates[inputKey]
      : updates[field];

    if (String(record[field] || '') === String(newValue || '')) {
      return;
    }

    changes[field] = newValue;

    auditRows.push({
      field: field,
      oldValue: record[field],
      newValue: newValue
    });
  });

  if (Object.prototype.hasOwnProperty.call(changes, 'Email')) {
    changes.EmailNormalized =
      m5CrmNormalizeEmail_(changes.Email);
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'Phone')) {
    changes.PhoneNormalized =
      m5CrmNormalizePhone_(changes.Phone);
  }

  if (
    Object.prototype.hasOwnProperty.call(changes, 'FirstName') ||
    Object.prototype.hasOwnProperty.call(changes, 'LastName')
  ) {
    changes.FullName = [
      Object.prototype.hasOwnProperty.call(changes, 'FirstName')
        ? changes.FirstName
        : record.FirstName,
      Object.prototype.hasOwnProperty.call(changes, 'LastName')
        ? changes.LastName
        : record.LastName
    ].filter(Boolean).join(' ');
  }

  changes.UpdatedAt = new Date();
  changes.UpdatedBy = m5CrmCurrentUser_();

  m5CrmUpdateRow_(sheet, record._rowNumber, changes);

  auditRows.forEach(function (change) {
    m5CrmAudit_(
      'CONTACT',
      contactId,
      'UPDATE',
      change.field,
      change.oldValue,
      change.newValue,
      'updateM5Contact'
    );
  });

  createM5TimelineEvent({
    contactId: contactId,
    leadId: record.LeadID,
    eventType: 'CONTACT_UPDATED',
    eventTitle: 'Contact Updated',
    eventDescription: auditRows.length + ' field(s) updated.',
    eventSource: 'CRM',
    referenceId: contactId,
    metadata: auditRows
  });

  return {
    success: true,
    contactId: contactId,
    fieldsUpdated: auditRows.length
  };
}


/* =====================================================================
   DUPLICATE DETECTION
===================================================================== */

function findM5ContactDuplicate(input) {
  input = input || {};

  var email = m5CrmNormalizeEmail_(input.email);
  var phone = m5CrmNormalizePhone_(input.phone);
  var contacts = m5CrmReadObjects_(
    m5CrmSheet_(M5_CRM.SHEETS.CONTACTS)
  );

  var exact = null;
  var possible = [];

  contacts.forEach(function (contact) {
    var emailMatch = email &&
      email === String(contact.EmailNormalized || '');
    var phoneMatch = phone &&
      phone === String(contact.PhoneNormalized || '');

    if (emailMatch || phoneMatch) {
      var score = emailMatch && phoneMatch ? 100 : 95;

      if (!exact) {
        exact = contact;
      }

      possible.push({
        contact: contact,
        score: score,
        matchType: emailMatch && phoneMatch
          ? 'EMAIL_AND_PHONE'
          : emailMatch
            ? 'EMAIL'
            : 'PHONE'
      });
    }
  });

  return {
    success: true,
    exactMatch: Boolean(exact),
    contact: exact,
    possibleMatches: possible
  };
}


function scanM5ContactDuplicates() {
  var contacts = m5CrmReadObjects_(
    m5CrmSheet_(M5_CRM.SHEETS.CONTACTS)
  );

  var emailMap = {};
  var phoneMap = {};
  var pairs = {};

  contacts.forEach(function (contact) {
    var email = String(contact.EmailNormalized || '');
    var phone = String(contact.PhoneNormalized || '');

    if (email) {
      emailMap[email] = emailMap[email] || [];
      emailMap[email].push(contact);
    }

    if (phone) {
      phoneMap[phone] = phoneMap[phone] || [];
      phoneMap[phone].push(contact);
    }
  });

  function addPairs(group, matchType, score) {
    Object.keys(group).forEach(function (key) {
      var list = group[key];

      if (list.length < 2) {
        return;
      }

      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var ids = [
            list[i].ContactID,
            list[j].ContactID
          ].sort();

          var pairKey = ids.join('::');

          if (!pairs[pairKey] || pairs[pairKey].score < score) {
            pairs[pairKey] = {
              first: ids[0],
              second: ids[1],
              matchType: matchType,
              score: score,
              details: key
            };
          }
        }
      }
    });
  }

  addPairs(emailMap, 'EMAIL', 95);
  addPairs(phoneMap, 'PHONE', 95);

  var reviewSheet = m5CrmSheet_(M5_CRM.SHEETS.DUPLICATES);
  var rows = Object.keys(pairs).map(function (key) {
    var pair = pairs[key];

    return {
      DuplicateReviewID: 'DUP-' + Utilities.getUuid(),
      PrimaryContactID: pair.first,
      PossibleDuplicateContactID: pair.second,
      MatchType: pair.matchType,
      MatchScore: pair.score,
      MatchDetails: pair.details,
      Status: 'Pending Review',
      ReviewedAt: '',
      ReviewedBy: '',
      Resolution: '',
      CreatedAt: new Date()
    };
  });

  if (rows.length) {
    rows.forEach(function (row) {
      m5CrmAppendObject_(reviewSheet, row);
    });
  }

  return {
    success: true,
    contactsChecked: contacts.length,
    duplicatePairsFound: rows.length
  };
}


function m5CrmRecordPossibleDuplicates_(contactId, possibleMatches) {
  var sheet = m5CrmSheet_(M5_CRM.SHEETS.DUPLICATES);

  possibleMatches.forEach(function (match) {
    if (match.contact.ContactID === contactId) {
      return;
    }

    m5CrmAppendObject_(sheet, {
      DuplicateReviewID: 'DUP-' + Utilities.getUuid(),
      PrimaryContactID: contactId,
      PossibleDuplicateContactID: match.contact.ContactID,
      MatchType: match.matchType,
      MatchScore: match.score,
      MatchDetails: '',
      Status: 'Pending Review',
      ReviewedAt: '',
      ReviewedBy: '',
      Resolution: '',
      CreatedAt: new Date()
    });
  });
}


/* =====================================================================
   CRM RECORD BUILDERS
===================================================================== */

function createM5TimelineEvent(input) {
  input = input || {};

  var row = {
    TimelineID: m5CrmNextId_('TIMELINE'),
    ContactID: input.contactId || '',
    LeadID: input.leadId || '',
    EventType: input.eventType || 'GENERAL',
    EventTitle: input.eventTitle || '',
    EventDescription: input.eventDescription || '',
    EventSource: input.eventSource || 'CRM',
    ReferenceID: input.referenceId || '',
    EventAt: input.eventAt || new Date(),
    CreatedAt: new Date(),
    CreatedBy: m5CrmCurrentUser_(),
    MetadataJSON: m5CrmSafeJson_(input.metadata || {})
  };

  m5CrmAppendObject_(
    m5CrmSheet_(M5_CRM.SHEETS.TIMELINE),
    row
  );

  return {
    success: true,
    timelineId: row.TimelineID
  };
}


function createM5PipelineRecord(input) {
  input = input || {};

  var row = {
    PipelineID: m5CrmNextId_('PIPELINE'),
    ContactID: input.contactId || '',
    PipelineType: input.pipelineType || 'Other',
    CurrentStage: input.currentStage || 'New',
    PreviousStage: '',
    StageEnteredAt: new Date(),
    StageChangedAt: new Date(),
    StageChangedBy: m5CrmCurrentUser_(),
    Probability: Number(input.probability || 0),
    EstimatedValue: Number(input.estimatedValue || 0),
    ExpectedCloseDate: input.expectedCloseDate || '',
    LostReason: '',
    ClosedAt: '',
    Status: 'Active',
    CreatedAt: new Date(),
    UpdatedAt: new Date()
  };

  m5CrmAppendObject_(
    m5CrmSheet_(M5_CRM.SHEETS.PIPELINE),
    row
  );

  return {
    success: true,
    pipelineId: row.PipelineID
  };
}


function moveM5ContactPipelineStage(contactId, newStage, details) {
  details = details || {};

  var pipelineSheet = m5CrmSheet_(M5_CRM.SHEETS.PIPELINE);
  var pipeline = m5CrmReadObjects_(pipelineSheet, true)
    .filter(function (row) {
      return String(row.ContactID || '') === String(contactId || '') &&
        String(row.Status || '').toLowerCase() === 'active';
    })[0];

  if (!pipeline) {
    throw new Error('Active pipeline not found for ' + contactId);
  }

  var previousStage = pipeline.CurrentStage;

  m5CrmUpdateRow_(pipelineSheet, pipeline._rowNumber, {
    PreviousStage: previousStage,
    CurrentStage: newStage,
    StageEnteredAt: new Date(),
    StageChangedAt: new Date(),
    StageChangedBy: m5CrmCurrentUser_(),
    Probability: Object.prototype.hasOwnProperty.call(
      details,
      'probability'
    ) ? details.probability : pipeline.Probability,
    EstimatedValue: Object.prototype.hasOwnProperty.call(
      details,
      'estimatedValue'
    ) ? details.estimatedValue : pipeline.EstimatedValue,
    ExpectedCloseDate: details.expectedCloseDate ||
      pipeline.ExpectedCloseDate,
    LostReason: details.lostReason || pipeline.LostReason,
    ClosedAt: newStage === 'Closed'
      ? new Date()
      : pipeline.ClosedAt,
    UpdatedAt: new Date()
  });

  updateM5Contact(contactId, {
    pipelineStage: newStage
  });

  createM5TimelineEvent({
    contactId: contactId,
    eventType: 'PIPELINE_STAGE_CHANGED',
    eventTitle: 'Pipeline Stage Changed',
    eventDescription: previousStage + ' → ' + newStage,
    eventSource: 'CRM',
    referenceId: pipeline.PipelineID,
    metadata: details
  });

  return {
    success: true,
    contactId: contactId,
    previousStage: previousStage,
    currentStage: newStage
  };
}


function createM5Task(input) {
  input = input || {};

  var row = {
    TaskID: m5CrmNextId_('TASK'),
    ContactID: input.contactId || '',
    Title: input.title || 'Follow Up',
    Description: input.description || '',
    TaskType: input.taskType || 'Follow Up',
    Priority: input.priority || 'Normal',
    Status: input.status || 'Open',
    AssignedToID: input.assignedToId || '',
    AssignedToName: input.assignedToName || '',
    DueAt: input.dueAt || '',
    ReminderAt: input.reminderAt || '',
    CompletedAt: '',
    CompletedBy: '',
    RelatedRecordType: input.relatedRecordType || '',
    RelatedRecordID: input.relatedRecordId || '',
    CreatedAt: new Date(),
    CreatedBy: m5CrmCurrentUser_(),
    UpdatedAt: new Date(),
    UpdatedBy: m5CrmCurrentUser_()
  };

  m5CrmAppendObject_(
    m5CrmSheet_(M5_CRM.SHEETS.TASKS),
    row
  );

  createM5TimelineEvent({
    contactId: row.ContactID,
    eventType: 'TASK_CREATED',
    eventTitle: row.Title,
    eventDescription: row.Description,
    eventSource: 'CRM',
    referenceId: row.TaskID
  });

  return {
    success: true,
    taskId: row.TaskID
  };
}


function createM5Appointment(input) {
  input = input || {};

  var row = {
    AppointmentID: m5CrmNextId_('APPT'),
    ContactID: input.contactId || '',
    AppointmentType: input.appointmentType || 'Consultation',
    Title: input.title || 'Consultation',
    StartAt: input.startAt || '',
    EndAt: input.endAt || '',
    TimeZone: input.timeZone || 'America/Chicago',
    Status: input.status || 'Pending',
    Location: input.location || '',
    MeetingURL: input.meetingUrl || '',
    CalendarEventID: input.calendarEventId || '',
    AssignedAgentID: input.assignedAgentId || '',
    AssignedAgentName: input.assignedAgentName || '',
    ConfirmedAt: '',
    CancelledAt: '',
    RescheduleRequestedAt: '',
    Notes: input.notes || '',
    CreatedAt: new Date(),
    CreatedBy: m5CrmCurrentUser_(),
    UpdatedAt: new Date()
  };

  m5CrmAppendObject_(
    m5CrmSheet_(M5_CRM.SHEETS.APPOINTMENTS),
    row
  );

  createM5TimelineEvent({
    contactId: row.ContactID,
    eventType: 'APPOINTMENT_CREATED',
    eventTitle: row.Title,
    eventDescription: row.AppointmentType,
    eventSource: 'CRM',
    referenceId: row.AppointmentID,
    eventAt: row.StartAt || new Date()
  });

  return {
    success: true,
    appointmentId: row.AppointmentID
  };
}


function createM5LeadAssignment(input) {
  input = input || {};

  var row = {
    AssignmentID: m5CrmNextId_('ASSIGNMENT'),
    ContactID: input.contactId || '',
    LeadID: input.leadId || '',
    AgentID: input.agentId || '',
    AgentName: input.agentName || '',
    AssignmentMethod: input.assignmentMethod || 'Manual',
    AssignmentReason: input.assignmentReason || '',
    Territory: input.territory || '',
    Parish: input.parish || '',
    ZipCode: input.zipCode || '',
    Status: 'Active',
    AssignedAt: new Date(),
    AssignedBy: m5CrmCurrentUser_(),
    ReleasedAt: '',
    ReleasedBy: '',
    PreviousAssignmentID: input.previousAssignmentId || '',
    Notes: input.notes || ''
  };

  m5CrmAppendObject_(
    m5CrmSheet_(M5_CRM.SHEETS.ASSIGNMENTS),
    row
  );

  createM5TimelineEvent({
    contactId: row.ContactID,
    leadId: row.LeadID,
    eventType: 'LEAD_ASSIGNED',
    eventTitle: 'Lead Assigned',
    eventDescription: 'Assigned to ' + row.AgentName,
    eventSource: 'CRM',
    referenceId: row.AssignmentID
  });

  return {
    success: true,
    assignmentId: row.AssignmentID
  };
}


/* =====================================================================
   SEARCH
===================================================================== */

function searchM5Contacts(query) {
  query = m5CrmText_(query).toLowerCase();

  if (!query) {
    return [];
  }

  return m5CrmReadObjects_(
    m5CrmSheet_(M5_CRM.SHEETS.CONTACTS)
  ).filter(function (contact) {
    var haystack = [
      contact.ContactID,
      contact.LeadID,
      contact.FullName,
      contact.Email,
      contact.Phone,
      contact.Company,
      contact.City,
      contact.ZipCode,
      contact.Parish,
      contact.AssignedAgentName,
      contact.Tags,
      contact.ExternalReference
    ].join(' ').toLowerCase();

    return haystack.indexOf(query) >= 0;
  }).slice(0, 100);
}


function runM5ContactSearchFromSheet() {
  var searchSheet = m5CrmSheet_(M5_CRM.SHEETS.SEARCH);
  var query = searchSheet.getRange('B2').getDisplayValue();
  var results = searchM5Contacts(query);

  searchSheet.getRange(
    4,
    1,
    Math.max(searchSheet.getMaxRows() - 3, 1),
    Math.max(searchSheet.getMaxColumns(), 1)
  ).clearContent();

  var headers = [
    'ContactID',
    'FullName',
    'ContactType',
    'Email',
    'Phone',
    'City',
    'Parish',
    'PipelineStage',
    'AssignedAgentName',
    'LeadSource'
  ];

  searchSheet.getRange(4, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold');

  if (results.length) {
    var values = results.map(function (row) {
      return headers.map(function (header) {
        return row[header] || '';
      });
    });

    searchSheet.getRange(5, 1, values.length, headers.length)
      .setValues(values);
  }

  return {
    success: true,
    query: query,
    results: results.length
  };
}


/* =====================================================================
   HEALTH
===================================================================== */

function runM5CRMHealthCheck() {
  var checks = [];
  var ss = m5CrmWorkbook_();

  Object.keys(M5_CRM.SHEETS).forEach(function (key) {
    var name = M5_CRM.SHEETS[key];
    var sheet = ss.getSheetByName(name);

    checks.push({
      CheckID: 'SHEET-' + key,
      CheckName: 'Sheet available: ' + name,
      Status: sheet ? 'PASS' : 'FAIL',
      Message: sheet ? 'Sheet is available.' : 'Sheet is missing.',
      RecordsChecked: sheet
        ? Math.max(sheet.getLastRow() - 1, 0)
        : 0,
      IssuesFound: sheet ? 0 : 1,
      CheckedAt: new Date()
    });
  });

  var contacts = m5CrmReadObjects_(
    m5CrmSheet_(M5_CRM.SHEETS.CONTACTS)
  );

  var missingIds = contacts.filter(function (row) {
    return !row.ContactID || !row.LeadID;
  });

  checks.push({
    CheckID: 'CONTACT-IDS',
    CheckName: 'Contact IDs',
    Status: missingIds.length ? 'FAIL' : 'PASS',
    Message: missingIds.length
      ? missingIds.length + ' contact(s) are missing permanent IDs.'
      : 'All contacts have permanent IDs.',
    RecordsChecked: contacts.length,
    IssuesFound: missingIds.length,
    CheckedAt: new Date()
  });

  var duplicateResult = scanM5ContactDuplicates();

  checks.push({
    CheckID: 'DUPLICATES',
    CheckName: 'Duplicate scan',
    Status: duplicateResult.duplicatePairsFound
      ? 'WARNING'
      : 'PASS',
    Message: duplicateResult.duplicatePairsFound
      ? duplicateResult.duplicatePairsFound +
        ' possible duplicate pair(s) found.'
      : 'No duplicate pairs found.',
    RecordsChecked: duplicateResult.contactsChecked,
    IssuesFound: duplicateResult.duplicatePairsFound,
    CheckedAt: new Date()
  });

  m5CrmReplaceAll_(
    m5CrmSheet_(M5_CRM.SHEETS.HEALTH),
    checks,
    [
      'CheckID',
      'CheckName',
      'Status',
      'Message',
      'RecordsChecked',
      'IssuesFound',
      'CheckedAt'
    ]
  );

  m5CrmWriteCoreHealth_(checks);

  var failures = checks.filter(function (row) {
    return row.Status === 'FAIL';
  });

  return {
    success: failures.length === 0,
    checks: checks.length,
    failed: failures.length,
    warnings: checks.filter(function (row) {
      return row.Status === 'WARNING';
    }).length
  };
}


function installM5CRMFoundationTriggers() {
  m5CrmDeleteTriggers_('runM5CRMHealthCheck');

  ScriptApp.newTrigger('runM5CRMHealthCheck')
    .timeBased()
    .everyHours(6)
    .create();

  return {
    success: true,
    triggerInstalled: true,
    frequency: 'Every 6 hours'
  };
}


/* =====================================================================
   MENU
===================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MelroseOS CRM')
    .addItem('Run CRM Health Check', 'runM5CRMHealthCheck')
    .addItem('Scan for Duplicates', 'scanM5ContactDuplicates')
    .addSeparator()
    .addItem('Open Contact Search', 'openM5ContactSearch')
    .addItem('Run Contact Search', 'runM5ContactSearchFromSheet')
    .addToUi();
}


function openM5ContactSearch() {
  var ss = m5CrmWorkbook_();
  var sheet = ss.getSheetByName(M5_CRM.SHEETS.SEARCH);

  ss.setActiveSheet(sheet);
  sheet.getRange('A2').setValue('Search');
  sheet.getRange('B2').activate();

  return {
    success: true
  };
}


/* =====================================================================
   CORE REGISTRATION
===================================================================== */

function m5CrmWriteCoreRegistration_() {
  try {
    var core = SpreadsheetApp.openById(M5_CRM.WORKBOOKS.CORE);
    var registry = core.getSheetByName('M5_ComponentRegistry');

    if (!registry) {
      return {
        success: false,
        skipped: true,
        message: 'Core component registry is unavailable.'
      };
    }

    var record = {
      ComponentID: 'M5-CRM',
      ComponentName: 'CRM Operating System',
      Module: 'CRM',
      ComponentType: 'MODULE',
      Version: M5_CRM.VERSION,
      WorkbookKey: 'CRM',
      Status: 'ACTIVE',
      Dependencies: 'M5-FRAMEWORK,M5-MODULE-INSTALLER',
      InstalledAt: new Date(),
      UpdatedAt: new Date(),
      Notes: 'CRM Foundation installed in dedicated CRM project.'
    };

    m5CrmUpsert_(registry, 'ComponentID', [record]);

    var catalog = core.getSheetByName('M5_ModuleCatalog');

    if (catalog) {
      var module = m5CrmFindRow_(catalog, 'ModuleID', 'M5-CRM');

      if (module) {
        m5CrmUpdateRow_(catalog, module._rowNumber, {
          Status: 'ACTIVE',
          InstalledVersion: M5_CRM.VERSION,
          InstalledAt: module.InstalledAt || new Date(),
          UpdatedAt: new Date()
        });
      }
    }

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
}


function m5CrmWriteCoreHealth_(checks) {
  try {
    var core = SpreadsheetApp.openById(M5_CRM.WORKBOOKS.CORE);
    var health = core.getSheetByName('M5_Health');

    if (!health) {
      return;
    }

    var failed = checks.filter(function (row) {
      return row.Status === 'FAIL';
    }).length;

    var warning = checks.filter(function (row) {
      return row.Status === 'WARNING';
    }).length;

    m5CrmUpsert_(health, 'ComponentID', [{
      ComponentID: 'M5-CRM',
      ComponentName: 'CRM Operating System',
      Module: 'CRM',
      WorkbookKey: 'CRM',
      Status: failed ? 'FAIL' : warning ? 'WARNING' : 'PASS',
      Message: failed
        ? failed + ' failed CRM health check(s).'
        : warning
          ? warning + ' CRM warning(s).'
          : 'CRM health checks passed.',
      CheckedAt: new Date(),
      DetailsJSON: m5CrmSafeJson_({
        checks: checks.length,
        failed: failed,
        warnings: warning
      })
    }]);
  } catch (ignored) {
    // CRM remains functional even when Core registration is unavailable.
  }
}


/* =====================================================================
   UTILITIES
===================================================================== */

function m5CrmWorkbook_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();

  if (active && active.getId() === M5_CRM.WORKBOOKS.CRM) {
    return active;
  }

  return SpreadsheetApp.openById(M5_CRM.WORKBOOKS.CRM);
}


function m5CrmSheet_(sheetName) {
  var sheet = m5CrmWorkbook_().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing CRM sheet: ' + sheetName);
  }

  return sheet;
}


function m5CrmEnsureSheet_(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  var existing = sheet.getLastColumn()
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn())
        .getDisplayValues()[0]
    : [];

  var missing = headers.filter(function (header) {
    return existing.indexOf(header) < 0;
  });

  if (sheet.getLastRow() === 0 || existing.every(function (value) {
    return !value;
  })) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (missing.length) {
    sheet.getRange(
      1,
      existing.length + 1,
      1,
      missing.length
    ).setValues([missing]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setFontWeight('bold');

  return sheet;
}


function m5CrmReadObjects_(sheet, includeRows) {
  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  var headers = values[0].map(String);

  return values.slice(1)
    .map(function (row, index) {
      var object = {};

      headers.forEach(function (header, columnIndex) {
        object[header] = row[columnIndex];
      });

      if (includeRows) {
        object._rowNumber = index + 2;
      }

      return object;
    })
    .filter(function (object) {
      return headers.some(function (header) {
        return object[header] !== '';
      });
    });
}


function m5CrmAppendObject_(sheet, object) {
  var headers = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getDisplayValues()[0];

  var row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(object, header)
      ? object[header]
      : '';
  });

  sheet.appendRow(row);
}


function m5CrmUpdateRow_(sheet, rowNumber, updates) {
  var headers = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getDisplayValues()[0];

  var range = sheet.getRange(
    rowNumber,
    1,
    1,
    headers.length
  );

  var values = range.getValues()[0];

  headers.forEach(function (header, index) {
    if (Object.prototype.hasOwnProperty.call(updates, header)) {
      values[index] = updates[header];
    }
  });

  range.setValues([values]);
}


function m5CrmFindRow_(sheet, keyColumn, keyValue) {
  return m5CrmReadObjects_(sheet, true).find(function (row) {
    return String(row[keyColumn] || '') === String(keyValue || '');
  }) || null;
}


function m5CrmUpsert_(sheet, keyColumn, objects) {
  objects.forEach(function (object) {
    var existing = m5CrmFindRow_(
      sheet,
      keyColumn,
      object[keyColumn]
    );

    if (existing) {
      m5CrmUpdateRow_(sheet, existing._rowNumber, object);
    } else {
      m5CrmAppendObject_(sheet, object);
    }
  });
}


function m5CrmReplaceAll_(sheet, objects, headers) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold');

  if (!objects.length) {
    return;
  }

  var values = objects.map(function (object) {
    return headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(object, header)
        ? object[header]
        : '';
    });
  });

  sheet.getRange(2, 1, values.length, headers.length)
    .setValues(values);
}


function m5CrmNextId_(prefix) {
  var properties = PropertiesService.getScriptProperties();
  var key = 'M5_CRM_ID_' + prefix;
  var lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    var current = Number(properties.getProperty(key) || 0) + 1;
    properties.setProperty(key, String(current));

    return prefix + '-' + Utilities.formatString('%08d', current);
  } finally {
    lock.releaseLock();
  }
}


function m5CrmNormalizeEmail_(email) {
  return m5CrmText_(email).toLowerCase();
}


function m5CrmNormalizePhone_(phone) {
  var digits = m5CrmText_(phone).replace(/\D/g, '');

  if (digits.length === 11 && digits.charAt(0) === '1') {
    digits = digits.slice(1);
  }

  return digits;
}


function m5CrmText_(value) {
  return String(value == null ? '' : value).trim();
}


function m5CrmCurrentUser_() {
  try {
    return Session.getActiveUser().getEmail() || 'SYSTEM';
  } catch (error) {
    return 'SYSTEM';
  }
}


function m5CrmSafeJson_(value) {
  try {
    return JSON.stringify(value == null ? {} : value);
  } catch (error) {
    return JSON.stringify({
      serializationError: error.message || String(error)
    });
  }
}


function m5CrmAudit_(
  recordType,
  recordId,
  action,
  fieldName,
  oldValue,
  newValue,
  sourceFunction
) {
  m5CrmAppendObject_(
    m5CrmSheet_(M5_CRM.SHEETS.AUDIT),
    {
      AuditID: 'AUDIT-' + Utilities.getUuid(),
      RecordType: recordType,
      RecordID: recordId,
      Action: action,
      FieldName: fieldName || '',
      OldValue: typeof oldValue === 'object'
        ? m5CrmSafeJson_(oldValue)
        : oldValue,
      NewValue: typeof newValue === 'object'
        ? m5CrmSafeJson_(newValue)
        : newValue,
      ChangedAt: new Date(),
      ChangedBy: m5CrmCurrentUser_(),
      SourceFunction: sourceFunction || '',
      MetadataJSON: ''
    }
  );
}


function m5CrmDeleteTriggers_(handlerFunction) {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handlerFunction) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}


function m5CrmApplyValidations_() {
  var contacts = m5CrmSheet_(M5_CRM.SHEETS.CONTACTS);
  var tasks = m5CrmSheet_(M5_CRM.SHEETS.TASKS);
  var pipeline = m5CrmSheet_(M5_CRM.SHEETS.PIPELINE);

  m5CrmSetValidationByHeader_(
    contacts,
    'ContactType',
    M5_CRM.CONTACT_TYPES
  );

  m5CrmSetValidationByHeader_(
    contacts,
    'PipelineStage',
    M5_CRM.PIPELINE_STAGES
  );

  m5CrmSetValidationByHeader_(
    tasks,
    'Status',
    M5_CRM.TASK_STATUSES
  );

  m5CrmSetValidationByHeader_(
    tasks,
    'Priority',
    M5_CRM.PRIORITIES
  );

  m5CrmSetValidationByHeader_(
    pipeline,
    'CurrentStage',
    M5_CRM.PIPELINE_STAGES
  );
}


function m5CrmSetValidationByHeader_(sheet, header, values) {
  var headers = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getDisplayValues()[0];

  var column = headers.indexOf(header) + 1;

  if (!column) {
    return;
  }

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(2, column, sheet.getMaxRows() - 1, 1)
    .setDataValidation(rule);
}


function m5CrmFormatAllSheets_() {
  var ss = m5CrmWorkbook_();

  ss.getSheets().forEach(function (sheet) {
    if (sheet.getName().indexOf('M5_') !== 0) {
      return;
    }

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setFontWeight('bold');

    sheet.autoResizeColumns(
      1,
      Math.min(sheet.getLastColumn(), 20)
    );
  });

  var search = ss.getSheetByName(M5_CRM.SHEETS.SEARCH);

  if (search) {
    search.getRange('A2').setValue('Search');
    search.getRange('B2').setValue('');
  }
}


/* =====================================================================
   TEST
===================================================================== */

function testM5CRMFoundation() {
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

  run('CRM workbook accessible', function () {
    return m5CrmWorkbook_().getName();
  });

  run('All CRM sheets available', function () {
    var ss = m5CrmWorkbook_();
    var missing = Object.keys(M5_CRM.SHEETS)
      .map(function (key) {
        return M5_CRM.SHEETS[key];
      })
      .filter(function (name) {
        return !ss.getSheetByName(name);
      });

    if (missing.length) {
      throw new Error('Missing sheets: ' + missing.join(', '));
    }

    return Object.keys(M5_CRM.SHEETS).length;
  });

  run('ID generator working', function () {
    return m5CrmNextId_('TEST');
  });

  run('Duplicate scanner working', function () {
    return scanM5ContactDuplicates();
  });

  run('CRM health check working', function () {
    return runM5CRMHealthCheck();
  });

  run('Core registration attempted', function () {
    return m5CrmWriteCoreRegistration_();
  });

  var failures = tests.filter(function (test) {
    return test.status === 'FAIL';
  });

  return {
    success: failures.length === 0,
    version: M5_CRM.VERSION,
    passed: tests.length - failures.length,
    failed: failures.length,
    tests: tests,
    nextModule: failures.length === 0
      ? 'M5 CRM Lead Intake Engine'
      : ''
  };
}
