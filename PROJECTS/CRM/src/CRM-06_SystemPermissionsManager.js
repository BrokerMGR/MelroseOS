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
  VERSION: "1.0.2",
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
