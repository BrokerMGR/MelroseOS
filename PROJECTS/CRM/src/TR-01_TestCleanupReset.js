/******************************************************************************
 * MelroseOS Enterprise
 * Test Record Cleanup & Reset Utility
 * File: TR-01_TestCleanupReset.gs
 * Version: 1.1.0
 *
 * COMPLETE OVERWRITE OF v1
 *
 * Improvements:
 *   - Precision preview with exact match reason per candidate.
 *   - Candidate detail sheet TR_TEST_CLEANUP_PREVIEW.
 *   - Cleanup executes ONLY the exact previewed candidates.
 *   - Requires explicit Approved=YES per candidate before deletion.
 *   - Full backup sheet created before any deletions from an affected sheet.
 *   - Real production records remain untouched unless explicitly approved.
 ******************************************************************************/

const TR = {
  VERSION: "1.1.0",

  TARGET_SHEETS: [
    "LI_INTAKE",
    "AE_LEADS",
    "AE_ASSIGNMENTS",
    "NF_QUEUE",
    "AP_APPOINTMENTS",
    "LC_LEAD_LIFECYCLE",
    "LC_ACTIVITY_LOG",
    "LC_STATUS_HISTORY",
    "AC_LEAD_SLA",
    "AC_ALERT_LOG",
    "AC_AGENT_METRICS"
  ],

  PREVIEW_SHEET: "TR_TEST_CLEANUP_PREVIEW",
  LOG_SHEET: "TR_TEST_CLEANUP_LOG",

  STRONG_TEST_AGENT_PATTERNS: [
    /^AGT-TEST/i,
    /^AGT-LOCK-TEST/i,
    /^AGT-ELIGIBILITY-TEST/i,
    /^AGT-RR-/i,
    /^AGT-ASSIGNMENT-TEST/i,
    /^AGT-SHADOW-TEST/i,
    /^AGT-LI-QUEUE-TEST/i,
    /^AGT-NF-/i
  ],

  STRONG_TEST_LEAD_PATTERNS: [
    /^TEST[-_ ]/i,
    /[-_ ]TEST$/i
  ]
};

function TR_previewTestCleanup() {
  const ss = workbook_();

  const previewSheet = TR_resetPreviewSheet_(ss);

  const details = [];
  const summary = {
    success: true,
    version: TR.VERSION,
    mode: "PRECISION_PREVIEW",
    sheets: {},
    totalCandidates: 0
  };

  TR.TARGET_SHEETS.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet || sheet.getLastRow() < 2) {
      summary.sheets[sheetName] = 0;
      return;
    }

    const rows = TR_getRows_(sheet);
    let count = 0;

    rows.forEach(function(item) {
      const match = TR_getTestMatch_(item.object);

      if (!match.isTest) {
        return;
      }

      count++;
      summary.totalCandidates++;

      details.push([
        sheetName,
        item.rowNumber,
        TR_firstValue_(item.object, [
          "LeadID","Lead Id","Lead ID","ID"
        ]),
        TR_firstValue_(item.object, [
          "AgentID","AssignedAgentID"
        ]),
        TR_firstValue_(item.object, [
          "FullName","LeadName","Name"
        ]),
        TR_firstValue_(item.object, [
          "FirstName"
        ]),
        TR_firstValue_(item.object, [
          "LastName"
        ]),
        TR_firstValue_(item.object, [
          "Email","LeadEmail","AssignedAgentEmail"
        ]),
        TR_firstValue_(item.object, [
          "Phone","LeadPhone"
        ]),
        match.field,
        match.value,
        match.reason,
        match.confidence,
        "NO",
        new Date()
      ]);
    });

    summary.sheets[sheetName] = count;
  });

  if (details.length) {
    previewSheet
      .getRange(
        2,
        1,
        details.length,
        details[0].length
      )
      .setValues(details);
  }

  previewSheet.setFrozenRows(1);
  previewSheet.autoResizeColumns(
    1,
    previewSheet.getLastColumn()
  );

  Logger.log(
    JSON.stringify(
      summary,
      null,
      2
    )
  );

  return summary;
}

function TR_getTestMatch_(obj) {
  const checks = [
    {
      fields: ["Email","LeadEmail","AssignedAgentEmail"],
      test: function(value) {
        return /@example\.com$/i.test(value);
      },
      reason: "Email uses example.com test domain.",
      confidence: "HIGH"
    },
    {
      fields: ["AgentID","AssignedAgentID"],
      test: function(value) {
        return TR.STRONG_TEST_AGENT_PATTERNS.some(function(pattern) {
          return pattern.test(value);
        });
      },
      reason: "Matches known MelroseOS test-agent ID pattern.",
      confidence: "HIGH"
    },
    {
      fields: ["LeadID"],
      test: function(value) {
        return TR.STRONG_TEST_LEAD_PATTERNS.some(function(pattern) {
          return pattern.test(value);
        });
      },
      reason: "LeadID explicitly matches TEST naming pattern.",
      confidence: "HIGH"
    },
    {
      fields: ["FirstName","LastName","FullName","LeadName","Name"],
      test: function(value) {
        return (
          /^TEST$/i.test(value) ||
          /^TEST[-_ ]/i.test(value) ||
          /[-_ ]TEST$/i.test(value)
        );
      },
      reason: "Lead name explicitly matches TEST naming pattern.",
      confidence: "HIGH"
    },
    {
      fields: ["Source"],
      test: function(value) {
        return (
          /^TEST$/i.test(value) ||
          /^TEST[-_ ]/i.test(value) ||
          /[-_ ]TEST$/i.test(value)
        );
      },
      reason: "Source explicitly identifies a test record.",
      confidence: "HIGH"
    }
  ];

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i];

    for (let j = 0; j < check.fields.length; j++) {
      const field = check.fields[j];
      const value = String(
        obj[field] || ""
      ).trim();

      if (!value) {
        continue;
      }

      if (check.test(value)) {
        return {
          isTest: true,
          field: field,
          value: value,
          reason: check.reason,
          confidence: check.confidence
        };
      }
    }
  }

  return {
    isTest: false,
    field: "",
    value: "",
    reason: "",
    confidence: ""
  };
}

function TR_executeApprovedTestCleanup() {
  const ss = workbook_();
  const previewSheet = ss.getSheetByName(
    TR.PREVIEW_SHEET
  );

  if (
    !previewSheet ||
    previewSheet.getLastRow() < 2
  ) {
    throw new Error(
      "No precision preview exists. Run TR_previewTestCleanup() first."
    );
  }

  const candidates = TR_previewObjects_(previewSheet)
    .filter(function(row) {
      return String(
        row.Approved || ""
      ).trim().toUpperCase() === "YES";
    });

  if (!candidates.length) {
    return {
      success: true,
      version: TR.VERSION,
      deletedRows: 0,
      message: "No candidates were approved with YES."
    };
  }

  const grouped = {};

  candidates.forEach(function(candidate) {
    const sheetName =
      String(
        candidate.SheetName || ""
      ).trim();

    if (!grouped[sheetName]) {
      grouped[sheetName] = [];
    }

    grouped[sheetName].push(candidate);
  });

  const runId =
    "TR-" +
    Utilities
      .getUuid()
      .substring(0, 8)
      .toUpperCase();

  const stamp =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() ||
        "America/Chicago",
      "yyyyMMdd_HHmmss"
    );

  const result = {
    success: true,
    version: TR.VERSION,
    runId: runId,
    approvedCandidates:
      candidates.length,
    deletedRows: 0,
    backedUpSheets: 0,
    sheets: {}
  };

  TR_ensureLog_();

  Object.keys(grouped)
    .forEach(function(sheetName) {
      const sheet =
        ss.getSheetByName(
          sheetName
        );

      if (!sheet) {
        result.success = false;

        TR_log_(
          runId,
          sheetName,
          0,
          "",
          "FAILED",
          "Source sheet missing during approved cleanup."
        );

        return;
      }

      const currentRows =
        TR_getRows_(sheet);

      const approvedKeys = {};

      grouped[sheetName]
        .forEach(function(candidate) {
          const key =
            TR_candidateKey_(
              candidate
            );

          approvedKeys[key] =
            true;
        });

      const liveMatches =
        currentRows.filter(
          function(item) {
            const match =
              TR_getTestMatch_(
                item.object
              );

            if (!match.isTest) {
              return false;
            }

            const key =
              TR_candidateKey_({
                LeadID:
                  TR_firstValue_(
                    item.object,
                    [
                      "LeadID",
                      "Lead Id",
                      "Lead ID",
                      "ID"
                    ]
                  ),

                AgentID:
                  TR_firstValue_(
                    item.object,
                    [
                      "AgentID",
                      "AssignedAgentID"
                    ]
                  ),

                Email:
                  TR_firstValue_(
                    item.object,
                    [
                      "Email",
                      "LeadEmail",
                      "AssignedAgentEmail"
                    ]
                  ),

                Phone:
                  TR_firstValue_(
                    item.object,
                    [
                      "Phone",
                      "LeadPhone"
                    ]
                  ),

                MatchField:
                  match.field,

                MatchValue:
                  match.value
              });

            return !!approvedKeys[key];
          }
        );

      if (!liveMatches.length) {
        result.sheets[sheetName] =
          0;

        return;
      }

      const backupName =
        TR_uniqueSheetName_(
          ss,
          "TR_BACKUP_" +
            sheetName +
            "_" +
            stamp
        );

      sheet
        .copyTo(ss)
        .setName(
          backupName
        );

      result.backedUpSheets++;

      liveMatches
        .map(function(item) {
          return item.rowNumber;
        })
        .sort(function(a, b) {
          return b - a;
        })
        .forEach(function(rowNumber) {
          sheet.deleteRow(
            rowNumber
          );

          result.deletedRows++;
        });

      result.sheets[sheetName] =
        liveMatches.length;

      TR_log_(
        runId,
        sheetName,
        liveMatches.length,
        backupName,
        "SUCCESS",
        "Deleted only explicitly approved precision-preview candidates."
      );
    });

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

function TR_candidateKey_(candidate) {
  return [
    String(candidate.LeadID || "").trim(),
    String(candidate.AgentID || "").trim(),
    String(candidate.Email || "")
      .trim()
      .toLowerCase(),
    String(candidate.Phone || "")
      .replace(/\D/g, ""),
    String(candidate.MatchField || "").trim(),
    String(candidate.MatchValue || "")
      .trim()
      .toLowerCase()
  ].join("|");
}

function TR_resetPreviewSheet_(ss) {
  let sheet =
    ss.getSheetByName(
      TR.PREVIEW_SHEET
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        TR.PREVIEW_SHEET
      );
  }

  sheet.clearContents();

  const headers = [
    "SheetName",
    "SourceRow",
    "LeadID",
    "AgentID",
    "FullName",
    "FirstName",
    "LastName",
    "Email",
    "Phone",
    "MatchField",
    "MatchValue",
    "MatchReason",
    "Confidence",
    "Approved",
    "PreviewedAt"
  ];

  sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .setValues([
      headers
    ]);

  return sheet;
}

function TR_previewObjects_(sheet) {
  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values.shift()
      .map(function(value) {
        return String(
          value || ""
        ).trim();
      });

  return values
    .filter(function(row) {
      return row.some(function(value) {
        return String(
          value || ""
        ).trim() !== "";
      });
    })
    .map(function(row) {
      const obj = {};

      headers.forEach(
        function(header, i) {
          obj[header] =
            row[i];
        }
      );

      return obj;
    });
}

function TR_firstValue_(obj, names) {
  for (
    let i = 0;
    i < names.length;
    i++
  ) {
    const value =
      obj[names[i]];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function TR_getRows_(sheet) {
  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values.shift()
      .map(function(value) {
        return String(
          value || ""
        ).trim();
      });

  return values.map(
    function(row, index) {
      const obj = {};

      headers.forEach(
        function(header, i) {
          obj[header] =
            row[i];
        }
      );

      return {
        rowNumber:
          index + 2,
        object:
          obj
      };
    }
  );
}

function TR_ensureLog_() {
  const ss =
    workbook_();

  let sheet =
    ss.getSheetByName(
      TR.LOG_SHEET
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        TR.LOG_SHEET
      );
  }

  if (
    sheet.getLastRow() === 0
  ) {
    sheet
      .getRange(
        1,
        1,
        1,
        7
      )
      .setValues([[
        "RunID",
        "SheetName",
        "DeletedRows",
        "BackupSheet",
        "Status",
        "Details",
        "ExecutedAt"
      ]]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}

function TR_log_(
  runId,
  sheetName,
  deletedRows,
  backupSheet,
  status,
  details
) {
  TR_ensureLog_()
    .appendRow([
      runId,
      sheetName,
      deletedRows,
      backupSheet,
      status,
      details,
      new Date()
    ]);
}

function TR_uniqueSheetName_(
  ss,
  base
) {
  const name =
    base.substring(
      0,
      95
    );

  let candidate =
    name;

  let i =
    1;

  while (
    ss.getSheetByName(
      candidate
    )
  ) {
    i++;

    candidate =
      name.substring(
        0,
        88
      ) +
      "_" +
      i;
  }

  return candidate;
}

function TR_testCleanupUtility() {
  const result =
    TR_previewTestCleanup();

  if (!result.success) {
    throw new Error(
      "Precision preview failed."
    );
  }

  return true;
}
