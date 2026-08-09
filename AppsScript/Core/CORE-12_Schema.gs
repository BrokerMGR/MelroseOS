/**
 * MelroseOS Enterprise Core
 * File: CORE-12_Schema.gs
 * Release: MOS5-CORE-12
 * Version: 1.0.0
 * Purpose: Canonical schema definitions and schema enforcement.
 */

const MGR_SCHEMA = Object.freeze({
  CRM_LEADS: Object.freeze([
    'LeadID','CreatedAt','UpdatedAt','Status','LeadType','Source',
    'FirstName','LastName','Email','Phone','City','Parish',
    'AssignedAgentID','AssignedAgentName','AssignedAgentEmail',
    'RouteMethod','Priority','LastActivityAt','NextActionAt',
    'DoNotContact','Unsubscribed','LockKey','CampaignStatus',
    'ConsultationStatus','Notes','CreatedBy','UpdatedBy',
    'ClosedAt','ArchiveReason','MetadataJSON','Version'
  ]),

  CRM_AGENTS: Object.freeze([
    'AgentID','FirstName','LastName','FullName','Email','Phone',
    'Status','Affiliation','AcceptingLeads','LeadTypes','Parishes',
    'Priority','DailyLeadCap','CurrentDailyCount','LastAssignedAt',
    'DashboardAccess','CreatedAt','UpdatedAt','MetadataJSON'
  ]),

  CRM_LEAD_LOCKS: Object.freeze([
    'LockKey','LeadID','Email','Phone','OwnerAgentID',
    'CreatedAt','UpdatedAt','Active'
  ]),

  AUDIT_LOG: Object.freeze([
    'AuditID','Timestamp','Actor','Action','EntityType','EntityID',
    'CorrelationID','Source','DetailsJSON'
  ])
});

function MGR_getSchema(name) {
  MGR_require(name, 'Schema name');
  const key = MGR_normalizeKey(name);

  if (!Object.prototype.hasOwnProperty.call(MGR_SCHEMA, key)) {
    throw new Error('Unknown MelroseOS schema: ' + name);
  }

  return MGR_SCHEMA[key].slice();
}

function MGR_validateHeaders(actualHeaders, expectedHeaders) {
  const actual = actualHeaders || [];
  const expected = expectedHeaders || [];
  const missing = expected.filter(function(header) {
    return actual.indexOf(header) === -1;
  });

  const unexpected = actual.filter(function(header) {
    return header && expected.indexOf(header) === -1;
  });

  return {
    success: missing.length === 0,
    missing: missing,
    unexpected: unexpected,
    actualCount: actual.length,
    expectedCount: expected.length
  };
}

function MGR_validateSheetSchema(sheet, schemaName) {
  return MGR_validateHeaders(
    MGR_getHeaders(sheet),
    MGR_getSchema(schemaName)
  );
}

function MGR_ensureSheetSchema(workbookKeyOrId, sheetName, schemaName) {
  const expected = MGR_getSchema(schemaName);
  const sheet = MGR_ensureSheet(workbookKeyOrId, sheetName, expected);
  const actual = MGR_getHeaders(sheet);
  const result = MGR_validateHeaders(actual, expected);

  if (result.missing.length) {
    let nextColumn = Math.max(1, sheet.getLastColumn() + 1);

    result.missing.forEach(function(header) {
      sheet.getRange(1, nextColumn).setValue(header);
      nextColumn += 1;
    });
  }

  return {
    sheetName: sheetName,
    schemaName: schemaName,
    validation: MGR_validateSheetSchema(sheet, schemaName)
  };
}

function MGR_schemaDiagnostics() {
  const names = Object.keys(MGR_SCHEMA);
  const duplicates = [];

  names.forEach(function(name) {
    const headers = MGR_SCHEMA[name];
    const seen = {};

    headers.forEach(function(header) {
      if (seen[header]) duplicates.push(name + ':' + header);
      seen[header] = true;
    });
  });

  return {
    success: duplicates.length === 0,
    schemas: names,
    duplicateHeaders: duplicates,
    timestamp: MGR_nowIso()
  };
}
