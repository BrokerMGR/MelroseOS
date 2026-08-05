/******************************************************************************
 * MelroseOS System Permissions Manager
 * CRM-06_SystemPermissionsManager.gs
 * FULL OVERWRITE v1.0.2
 *
 * Fixes:
 * - Restores MGR_PERMS constant/configuration
 * - OWNER satisfies EDITOR and VIEWER requirements
 * - Sync does not try to add an owner as editor/viewer
 * - Additive-only permission behavior; never auto-revokes
 ******************************************************************************/

const MGR_PERMS = {
  VERSION: "1.1.0",
  REGISTRY_SHEET: "SYS_RESOURCE_PERMISSIONS",

  ACCOUNTS: {
    BROKER: "melrosegroupbroker@gmail.com",
    STAFF: "melrosegroupstaff@gmail.com",
    MGR_LEADS: "melrosegroupleads@gmail.com",
    AGENT_LEAD_CENTRAL: "agentleadcentral@gmail.com",
    REALTY: "melrosegrouprealty@gmail.com"
  },

  RESOURCES: {
    CORE: "1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64",
    CRM: "1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8",
    MARKETING: "1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo",
    WEBSITE: "1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc",
    ANALYTICS: "1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU",
    ARCHIVE: "1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk"
  }
};

function MGR_installPermissionRegistry() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MGR_PERMS.REGISTRY_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(MGR_PERMS.REGISTRY_SHEET);
    sheet.appendRow([
      "PermissionID",
      "ResourceCode",
      "ResourceType",
      "ResourceID",
      "Account",
      "RequiredRole",
      "Enabled",
      "LastCheckedAt",
      "LastAppliedAt",
      "Status",
      "Error"
    ]);
    sheet.setFrozenRows(1);
  }

  const desired = MGR_defaultPermissionPlan_();
  const existing = MGR_permObjects_(sheet);

  desired.forEach(function(item) {
    const found = existing.find(function(row) {
      return (
        String(row.ResourceCode || "") === String(item.ResourceCode) &&
        String(row.Account || "").trim().toLowerCase() ===
          String(item.Account || "").trim().toLowerCase()
      );
    });

    if (!found) {
      MGR_permAppend_(sheet, {
        PermissionID: Utilities.getUuid(),
        ResourceCode: item.ResourceCode,
        ResourceType: "SPREADSHEET",
        ResourceID: item.ResourceID,
        Account: item.Account,
        RequiredRole: item.RequiredRole,
        Enabled: true,
        Status: "PENDING"
      });
    }
  });

  const result = {
    success: true,
    version: MGR_PERMS.VERSION,
    desiredPermissions: desired.length
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function MGR_defaultPermissionPlan_() {
  const A = MGR_PERMS.ACCOUNTS;
  const R = MGR_PERMS.RESOURCES;

  return [
    {ResourceCode:"CORE",ResourceID:R.CORE,Account:A.BROKER,RequiredRole:"EDITOR"},
    {ResourceCode:"CRM",ResourceID:R.CRM,Account:A.BROKER,RequiredRole:"EDITOR"},
    {ResourceCode:"MARKETING",ResourceID:R.MARKETING,Account:A.BROKER,RequiredRole:"EDITOR"},
    {ResourceCode:"WEBSITE",ResourceID:R.WEBSITE,Account:A.BROKER,RequiredRole:"EDITOR"},
    {ResourceCode:"ANALYTICS",ResourceID:R.ANALYTICS,Account:A.BROKER,RequiredRole:"EDITOR"},
    {ResourceCode:"ARCHIVE",ResourceID:R.ARCHIVE,Account:A.BROKER,RequiredRole:"EDITOR"},

    {ResourceCode:"CRM",ResourceID:R.CRM,Account:A.STAFF,RequiredRole:"EDITOR"},
    {ResourceCode:"ANALYTICS",ResourceID:R.ANALYTICS,Account:A.STAFF,RequiredRole:"EDITOR"},
    {ResourceCode:"ARCHIVE",ResourceID:R.ARCHIVE,Account:A.STAFF,RequiredRole:"EDITOR"},

    {ResourceCode:"CRM",ResourceID:R.CRM,Account:A.MGR_LEADS,RequiredRole:"EDITOR"},
    {ResourceCode:"ANALYTICS",ResourceID:R.ANALYTICS,Account:A.MGR_LEADS,RequiredRole:"VIEWER"},

    {ResourceCode:"CRM",ResourceID:R.CRM,Account:A.AGENT_LEAD_CENTRAL,RequiredRole:"EDITOR"},
    {ResourceCode:"ANALYTICS",ResourceID:R.ANALYTICS,Account:A.AGENT_LEAD_CENTRAL,RequiredRole:"VIEWER"},

    {ResourceCode:"CRM",ResourceID:R.CRM,Account:A.REALTY,RequiredRole:"EDITOR"},
    {ResourceCode:"MARKETING",ResourceID:R.MARKETING,Account:A.REALTY,RequiredRole:"EDITOR"}
  ];
}

function MGR_previewPermissionChanges() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MGR_PERMS.REGISTRY_SHEET);

  if (!sheet) {
    throw new Error("Run MGR_installPermissionRegistry() first.");
  }

  const results = [];

  MGR_permObjects_(sheet)
    .filter(function(row) {
      return MGR_permBool_(row.Enabled);
    })
    .forEach(function(row) {
      try {
        const file = DriveApp.getFileById(row.ResourceID);

        const ownerEmail = MGR_getOwnerEmail_(file);

        const editors = file.getEditors().map(function(user) {
          return String(user.getEmail() || "").trim().toLowerCase();
        });

        const viewers = file.getViewers().map(function(user) {
          return String(user.getEmail() || "").trim().toLowerCase();
        });

        const account = String(row.Account || "").trim().toLowerCase();
        const required = String(row.RequiredRole || "").trim().toUpperCase();

        let status = "MISSING";
        let effectiveRole = "";
        let note = "";

        if (ownerEmail && ownerEmail === account) {
          status = "OK";
          effectiveRole = "OWNER";
          note = "OWNER satisfies " + required + " requirement";
        } else if (required === "EDITOR" && editors.indexOf(account) !== -1) {
          status = "OK";
          effectiveRole = "EDITOR";
        } else if (required === "VIEWER") {
          if (editors.indexOf(account) !== -1) {
            status = "OK";
            effectiveRole = "EDITOR";
          } else if (viewers.indexOf(account) !== -1) {
            status = "OK";
            effectiveRole = "VIEWER";
          }
        }

        const result = {
          ResourceCode: row.ResourceCode,
          Account: row.Account,
          RequiredRole: required,
          EffectiveRole: effectiveRole,
          Status: status
        };

        if (note) result.Note = note;

        results.push(result);

        MGR_permUpdate_(sheet, row.__rowNumber, {
          LastCheckedAt: new Date(),
          Status: status,
          Error: ""
        });

      } catch (error) {
        const message = String(error && error.stack ? error.stack : error);

        results.push({
          ResourceCode: row.ResourceCode,
          Account: row.Account,
          RequiredRole: row.RequiredRole,
          EffectiveRole: "",
          Status: "ERROR",
          Error: message
        });

        MGR_permUpdate_(sheet, row.__rowNumber, {
          LastCheckedAt: new Date(),
          Status: "ERROR",
          Error: message
        });
      }
    });

  const summary = {
    success: true,
    version: MGR_PERMS.VERSION,
    total: results.length,
    ok: results.filter(function(r) { return r.Status === "OK"; }).length,
    missing: results.filter(function(r) { return r.Status === "MISSING"; }).length,
    errors: results.filter(function(r) { return r.Status === "ERROR"; }).length,
    results: results
  };

  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

function MGR_syncSystemPermissions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MGR_PERMS.REGISTRY_SHEET);

  if (!sheet) {
    throw new Error("Run MGR_installPermissionRegistry() first.");
  }

  const stats = {
    success: true,
    version: MGR_PERMS.VERSION,
    ownerSatisfied: 0,
    addedEditors: 0,
    addedViewers: 0,
    unchanged: 0,
    errors: 0
  };

  MGR_permObjects_(sheet)
    .filter(function(row) {
      return MGR_permBool_(row.Enabled);
    })
    .forEach(function(row) {
      try {
        const file = DriveApp.getFileById(row.ResourceID);

        const account = String(row.Account || "").trim().toLowerCase();
        const required = String(row.RequiredRole || "").trim().toUpperCase();
        const ownerEmail = MGR_getOwnerEmail_(file);

        const editors = file.getEditors().map(function(user) {
          return String(user.getEmail() || "").trim().toLowerCase();
        });

        const viewers = file.getViewers().map(function(user) {
          return String(user.getEmail() || "").trim().toLowerCase();
        });

        if (ownerEmail && ownerEmail === account) {
          stats.ownerSatisfied++;

          MGR_permUpdate_(sheet, row.__rowNumber, {
            LastCheckedAt: new Date(),
            LastAppliedAt: new Date(),
            Status: "OK",
            Error: ""
          });

          return;
        }

        if (required === "EDITOR") {
          if (editors.indexOf(account) === -1) {
            file.addEditor(account);
            stats.addedEditors++;
          } else {
            stats.unchanged++;
          }
        } else if (required === "VIEWER") {
          if (
            viewers.indexOf(account) === -1 &&
            editors.indexOf(account) === -1
          ) {
            file.addViewer(account);
            stats.addedViewers++;
          } else {
            stats.unchanged++;
          }
        }

        MGR_permUpdate_(sheet, row.__rowNumber, {
          LastCheckedAt: new Date(),
          LastAppliedAt: new Date(),
          Status: "OK",
          Error: ""
        });

      } catch (error) {
        stats.errors++;

        MGR_permUpdate_(sheet, row.__rowNumber, {
          LastCheckedAt: new Date(),
          Status: "ERROR",
          Error: String(error && error.stack ? error.stack : error)
        });
      }
    });

  stats.success = stats.errors === 0;

  Logger.log(JSON.stringify(stats, null, 2));
  return stats;
}

function MGR_auditSystemPermissions() {
  return MGR_previewPermissionChanges();
}

function MGR_getOwnerEmail_(file) {
  try {
    const owner = file.getOwner();
    if (!owner) return "";
    return String(owner.getEmail() || "").trim().toLowerCase();
  } catch (error) {
    return "";
  }
}

function MGR_permHeaders_(sheet) {
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(function(value) {
      return String(value || "").trim();
    });
}

function MGR_permObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const headers = MGR_permHeaders_(sheet);
  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues();

  return values.map(function(row, rowIndex) {
    const object = {
      __rowNumber: rowIndex + 2
    };

    headers.forEach(function(header, columnIndex) {
      object[header] = row[columnIndex];
    });

    return object;
  });
}

function MGR_permAppend_(sheet, payload) {
  const headers = MGR_permHeaders_(sheet);

  sheet.appendRow(
    headers.map(function(header) {
      return payload[header] !== undefined ? payload[header] : "";
    })
  );
}

function MGR_permUpdate_(sheet, rowNumber, payload) {
  const headers = MGR_permHeaders_(sheet);

  const current = sheet
    .getRange(rowNumber, 1, 1, headers.length)
    .getValues()[0];

  const updated = headers.map(function(header, index) {
    return payload[header] !== undefined
      ? payload[header]
      : current[index];
  });

  sheet
    .getRange(rowNumber, 1, 1, headers.length)
    .setValues([updated]);
}

function MGR_permBool_(value) {
  if (value === true) return true;

  return ["TRUE", "YES", "1", "Y"].indexOf(
    String(value || "").trim().toUpperCase()
  ) !== -1;
}

function MGR_permissionsSystemCheck() {
  const result = {
    success: true,
    version: MGR_PERMS.VERSION,
    configPresent: typeof MGR_PERMS !== "undefined",
    registrySheet:
      !!SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(MGR_PERMS.REGISTRY_SHEET),
    functions: {
      MGR_installPermissionRegistry:
        typeof MGR_installPermissionRegistry === "function",
      MGR_previewPermissionChanges:
        typeof MGR_previewPermissionChanges === "function",
      MGR_syncSystemPermissions:
        typeof MGR_syncSystemPermissions === "function",
      MGR_auditSystemPermissions:
        typeof MGR_auditSystemPermissions === "function",
      MGR_getOwnerEmail_:
        typeof MGR_getOwnerEmail_ === "function"
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// BEGIN MOS5-G4-RUNTIME-ACL v1.0.0
/**
 * Runtime ACL policy for MelroseOS system operations.
 *
 * This is separate from Drive sharing synchronization. Drive permissions
 * determine whether an account can open a resource; this runtime policy
 * determines whether MelroseOS will permit a requested operation.
 */
const MGR_RUNTIME_ACL = Object.freeze({
  VERSION: "1.0.0",

  ROLE_RANK: Object.freeze({
    NONE: 0,
    VIEWER: 10,
    EDITOR: 20,
    OWNER: 30
  }),

  OPERATIONS: Object.freeze({
    READ_RESOURCE: Object.freeze({
      minimumRole: "VIEWER",
      writeOperation: false
    }),
    WRITE_RESOURCE: Object.freeze({
      minimumRole: "EDITOR",
      writeOperation: true
    }),
    LEAD_INTAKE_WRITE: Object.freeze({
      minimumRole: "EDITOR",
      writeOperation: true,
      allowedResources: ["CRM"]
    }),
    LEAD_ASSIGNMENT_WRITE: Object.freeze({
      minimumRole: "EDITOR",
      writeOperation: true,
      allowedResources: ["CRM"]
    }),
    STORAGE_SNAPSHOT_WRITE: Object.freeze({
      minimumRole: "EDITOR",
      writeOperation: true,
      allowedResources: ["CORE", "ARCHIVE"]
    }),
    BACKUP_WRITE: Object.freeze({
      minimumRole: "EDITOR",
      writeOperation: true,
      allowedResources: ["ARCHIVE"]
    }),
    SYSTEM_CONTROL_WRITE: Object.freeze({
      minimumRole: "EDITOR",
      writeOperation: true,
      brokerOnly: true,
      allowedResources: ["CORE"]
    }),
    PERMISSION_SYNC: Object.freeze({
      minimumRole: "EDITOR",
      writeOperation: true,
      brokerOnly: true
    })
  })
});

/**
 * Evaluates a runtime authorization request without changing permissions.
 *
 * @param {Object} request
 * @return {Object}
 */
function MGR_authorizeRuntimeOperation(request) {
  const input = request || {};
  const operationCode = String(input.operationCode || "")
    .trim()
    .toUpperCase();
  const resourceCode = String(input.resourceCode || "")
    .trim()
    .toUpperCase();
  const account = String(
    input.account ||
    Session.getEffectiveUser().getEmail() ||
    ""
  ).trim().toLowerCase();

  if (!operationCode) {
    throw new Error("operationCode is required.");
  }

  if (!resourceCode) {
    throw new Error("resourceCode is required.");
  }

  if (!account) {
    throw new Error("Unable to determine the requesting account.");
  }

  const operation = MGR_RUNTIME_ACL.OPERATIONS[operationCode];

  if (!operation) {
    return MGR_runtimeAclDecision_({
      allowed: false,
      status: "UNKNOWN_OPERATION",
      operationCode: operationCode,
      resourceCode: resourceCode,
      account: account,
      reason: "Operation is not registered in the runtime ACL."
    });
  }

  if (
    operation.allowedResources &&
    operation.allowedResources.indexOf(resourceCode) === -1
  ) {
    return MGR_runtimeAclDecision_({
      allowed: false,
      status: "RESOURCE_NOT_ALLOWED",
      operationCode: operationCode,
      resourceCode: resourceCode,
      account: account,
      reason: "Operation is not permitted for this resource."
    });
  }

  const knownAccounts = MGR_runtimeKnownAccounts_();

  if (knownAccounts.indexOf(account) === -1) {
    return MGR_runtimeAclDecision_({
      allowed: false,
      status: "UNKNOWN_ACCOUNT",
      operationCode: operationCode,
      resourceCode: resourceCode,
      account: account,
      reason: "Account is not registered in the five-account authority."
    });
  }

  if (
    operation.brokerOnly &&
    account !== String(MGR_PERMS.ACCOUNTS.BROKER).toLowerCase()
  ) {
    return MGR_runtimeAclDecision_({
      allowed: false,
      status: "BROKER_ONLY",
      operationCode: operationCode,
      resourceCode: resourceCode,
      account: account,
      reason: "Operation requires broker authority."
    });
  }

  const effectiveRole = MGR_getRegisteredRuntimeRole_(
    resourceCode,
    account
  );

  const requiredRole = String(operation.minimumRole || "VIEWER")
    .trim()
    .toUpperCase();

  const effectiveRank = MGR_RUNTIME_ACL.ROLE_RANK[effectiveRole] || 0;
  const requiredRank = MGR_RUNTIME_ACL.ROLE_RANK[requiredRole] || 0;

  if (effectiveRank < requiredRank) {
    return MGR_runtimeAclDecision_({
      allowed: false,
      status: "INSUFFICIENT_ROLE",
      operationCode: operationCode,
      resourceCode: resourceCode,
      account: account,
      effectiveRole: effectiveRole,
      requiredRole: requiredRole,
      reason: "Registered role does not satisfy the operation."
    });
  }

  return MGR_runtimeAclDecision_({
    allowed: true,
    status: "AUTHORIZED",
    operationCode: operationCode,
    resourceCode: resourceCode,
    account: account,
    effectiveRole: effectiveRole,
    requiredRole: requiredRole,
    writeOperation: Boolean(operation.writeOperation),
    reason: "Runtime ACL requirements satisfied."
  });
}

/**
 * Throws when the runtime operation is not authorized.
 *
 * Use this at the start of a protected write function.
 *
 * @param {Object} request
 * @return {Object}
 */
function MGR_assertRuntimeAuthorized_(request) {
  const decision = MGR_authorizeRuntimeOperation(request);

  if (!decision.allowed) {
    throw new Error(
      "Runtime authorization denied: " +
      decision.status +
      " - " +
      decision.reason
    );
  }

  return decision;
}

/**
 * Returns a registered role from the intended permission plan.
 *
 * OWNER is inferred for the resource owner when Drive access permits it.
 * During G4, the default registry plan is the fail-closed policy authority.
 *
 * @param {string} resourceCode
 * @param {string} account
 * @return {string}
 */
function MGR_getRegisteredRuntimeRole_(resourceCode, account) {
  const code = String(resourceCode || "").trim().toUpperCase();
  const email = String(account || "").trim().toLowerCase();

  const resourceId = MGR_PERMS.RESOURCES[code];

  if (!resourceId) {
    return "NONE";
  }

  try {
    const file = DriveApp.getFileById(resourceId);
    const ownerEmail = MGR_getOwnerEmail_(file);

    if (ownerEmail && ownerEmail === email) {
      return "OWNER";
    }
  } catch (error) {
    // Fall through to the registry plan. A Drive API failure must not
    // promote the account beyond its registered requirement.
  }

  const plan = MGR_defaultPermissionPlan_();
  const match = plan.find(function(item) {
    return (
      String(item.ResourceCode || "").trim().toUpperCase() === code &&
      String(item.Account || "").trim().toLowerCase() === email
    );
  });

  return match
    ? String(match.RequiredRole || "NONE").trim().toUpperCase()
    : "NONE";
}

/**
 * Returns all five registered account addresses.
 *
 * @return {Array<string>}
 */
function MGR_runtimeKnownAccounts_() {
  return Object.keys(MGR_PERMS.ACCOUNTS)
    .map(function(key) {
      return String(MGR_PERMS.ACCOUNTS[key] || "")
        .trim()
        .toLowerCase();
    })
    .filter(Boolean);
}

/**
 * Produces and logs a normalized runtime ACL decision.
 *
 * @param {Object} data
 * @return {Object}
 */
function MGR_runtimeAclDecision_(data) {
  const result = Object.assign({
    allowed: false,
    status: "DENIED",
    operationCode: "",
    resourceCode: "",
    account: "",
    effectiveRole: "NONE",
    requiredRole: "",
    writeOperation: false,
    permissionsChanged: false,
    productionActivated: false,
    evaluatedAt: new Date().toISOString()
  }, data || {});

  Logger.log(JSON.stringify({
    module: "MOS5_G4_RUNTIME_ACL",
    version: MGR_RUNTIME_ACL.VERSION,
    decision: result
  }));

  return result;
}

/**
 * Read-only G4 diagnostics.
 *
 * @return {Object}
 */
function MGR_runRuntimeAclDiagnostics() {
  const tests = [];

  function add(code, passed, details) {
    tests.push({
      code: code,
      status: passed ? "PASS" : "FAIL",
      details: details
    });
  }

  add(
    "FIVE_KNOWN_ACCOUNTS",
    MGR_runtimeKnownAccounts_().length === 5,
    "Exactly five runtime accounts are registered."
  );

  const broker = String(MGR_PERMS.ACCOUNTS.BROKER).toLowerCase();
  const staff = String(MGR_PERMS.ACCOUNTS.STAFF).toLowerCase();
  const leads = String(MGR_PERMS.ACCOUNTS.MGR_LEADS).toLowerCase();

  const brokerControl = MGR_authorizeRuntimeOperation({
    operationCode: "SYSTEM_CONTROL_WRITE",
    resourceCode: "CORE",
    account: broker
  });

  add(
    "BROKER_SYSTEM_CONTROL",
    brokerControl.allowed === true,
    "Broker is authorized for Core system-control writes."
  );

  const staffControl = MGR_authorizeRuntimeOperation({
    operationCode: "SYSTEM_CONTROL_WRITE",
    resourceCode: "CORE",
    account: staff
  });

  add(
    "STAFF_SYSTEM_CONTROL_DENIED",
    staffControl.allowed === false &&
      staffControl.status === "BROKER_ONLY",
    "Staff is denied broker-only system-control writes."
  );

  const leadWrite = MGR_authorizeRuntimeOperation({
    operationCode: "LEAD_INTAKE_WRITE",
    resourceCode: "CRM",
    account: leads
  });

  add(
    "LEADS_ACCOUNT_CRM_WRITE",
    leadWrite.allowed === true,
    "Leads vault account is authorized for CRM intake writes."
  );

  const unknown = MGR_authorizeRuntimeOperation({
    operationCode: "READ_RESOURCE",
    resourceCode: "CRM",
    account: "unknown@example.com"
  });

  add(
    "UNKNOWN_ACCOUNT_DENIED",
    unknown.allowed === false &&
      unknown.status === "UNKNOWN_ACCOUNT",
    "Unknown accounts are denied."
  );

  const wrongResource = MGR_authorizeRuntimeOperation({
    operationCode: "BACKUP_WRITE",
    resourceCode: "CRM",
    account: broker
  });

  add(
    "BACKUP_RESOURCE_RESTRICTED",
    wrongResource.allowed === false &&
      wrongResource.status === "RESOURCE_NOT_ALLOWED",
    "Backup writes are restricted to Archive."
  );

  const failed = tests.filter(function(test) {
    return test.status === "FAIL";
  }).length;

  const result = {
    release: "MOS5-G4-RUNTIME-ACL",
    version: MGR_RUNTIME_ACL.VERSION,
    overallStatus: failed ? "FAIL" : "PASS",
    passed: tests.length - failed,
    failed: failed,
    tests: tests,
    permissionsChanged: false,
    productionActivated: false,
    completedAt: new Date().toISOString()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
// END MOS5-G4-RUNTIME-ACL v1.0.0
