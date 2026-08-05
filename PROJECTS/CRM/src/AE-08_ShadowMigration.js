/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine Migration
 * File: AE-08_ShadowMigration.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Runs controlled SHADOW comparisons between existing/current assignments
 *   and MelroseOS Assignment Engine recommendations.
 *
 * Requires:
 *   AE-01_Core.gs through AE-07_AssignmentEngine.gs
 ******************************************************************************/

const AE_SHADOW_SUMMARY_SHEET = "AE_SHADOW_SUMMARY";

function AE_runShadowMigration(limit) {
  AE_initializeConfig();
  AE_setShadowMode();

  const max = Math.max(1, Number(limit || 100));
  const leads = AE_sheetObjects_(AE.SHEETS.LEADS)
    .slice(0, max);

  const results = [];

  leads.forEach(function(lead) {
    try {
      results.push(AE_assignLead(lead));
    } catch (error) {
      AE_log_(
        "SHADOW_MIGRATION_ERROR",
        error.message || String(error),
        lead.LeadID || "",
        ""
      );

      results.push({
        success: false,
        leadId: lead.LeadID || "",
        error: error.message || String(error)
      });
    }
  });

  const summary = AE_buildShadowSummary();

  return {
    success: true,
    processed: results.length,
    successful: results.filter(function(r) {
      return r.success;
    }).length,
    failed: results.filter(function(r) {
      return !r.success;
    }).length,
    summary: summary
  };
}

function AE_buildShadowSummary() {
  const ss = workbook_();
  const sheet = createSheetIfMissing_(
    ss,
    AE_SHADOW_SUMMARY_SHEET
  );

  clearSheet_(sheet);

  const headers = [
    "Metric",
    "Value",
    "Status",
    "UpdatedAt"
  ];

  setHeaders_(sheet, headers);

  const results = AE_sheetObjects_(AE.SHEETS.SHADOW);

  const counts = {
    total: results.length,
    match: 0,
    different: 0,
    noCurrent: 0
  };

  results.forEach(function(result) {
    const status = String(
      result.MatchStatus || ""
    ).toUpperCase();

    if (status === "MATCH") {
      counts.match++;
    } else if (status === "DIFFERENT") {
      counts.different++;
    } else if (status === "NO_CURRENT_ASSIGNMENT") {
      counts.noCurrent++;
    }
  });

  const comparable = counts.match + counts.different;

  const matchRate = comparable
    ? Math.round((counts.match / comparable) * 10000) / 100
    : 0;

  const readiness = AE_shadowReadiness_(
    counts,
    matchRate
  );

  const rows = [
    [
      "Total Shadow Evaluations",
      counts.total,
      counts.total ? "OK" : "NO DATA",
      timestamp_()
    ],
    [
      "Matches",
      counts.match,
      "INFO",
      timestamp_()
    ],
    [
      "Different Assignments",
      counts.different,
      counts.different ? "REVIEW" : "OK",
      timestamp_()
    ],
    [
      "No Current Assignment",
      counts.noCurrent,
      "INFO",
      timestamp_()
    ],
    [
      "Comparable Assignments",
      comparable,
      "INFO",
      timestamp_()
    ],
    [
      "Match Rate %",
      matchRate,
      readiness.status,
      timestamp_()
    ],
    [
      "Shadow Readiness",
      readiness.status,
      readiness.message,
      timestamp_()
    ]
  ];

  sheet
    .getRange(2, 1, rows.length, headers.length)
    .setValues(rows);

  sheet.setFrozenRows(1);
  autoResize_(sheet);

  setDocProperty_(
    "AE_SHADOW_LAST_RUN",
    new Date().toISOString()
  );

  setDocProperty_(
    "AE_SHADOW_MATCH_RATE",
    String(matchRate)
  );

  setDocProperty_(
    "AE_SHADOW_READINESS",
    readiness.status
  );

  return {
    total: counts.total,
    match: counts.match,
    different: counts.different,
    noCurrentAssignment: counts.noCurrent,
    comparable: comparable,
    matchRate: matchRate,
    readiness: readiness.status
  };
}

function AE_shadowReadiness_(counts, matchRate) {
  if (!counts.total) {
    return {
      status: "NO DATA",
      message: "Run shadow migration against lead records."
    };
  }

  if (!counts.match && !counts.different) {
    return {
      status: "INSUFFICIENT COMPARISON",
      message: "Current assignments are unavailable for comparison."
    };
  }

  if (matchRate >= 95) {
    return {
      status: "READY",
      message: "Shadow routing closely matches current assignments."
    };
  }

  if (matchRate >= 80) {
    return {
      status: "REVIEW",
      message: "Review assignment differences before live migration."
    };
  }

  return {
    status: "NOT READY",
    message: "Significant routing differences require review."
  };
}

function AE_getShadowDifferences(limit) {
  const max = Math.max(1, Number(limit || 100));

  return AE_sheetObjects_(AE.SHEETS.SHADOW)
    .filter(function(result) {
      return String(
        result.MatchStatus || ""
      ).toUpperCase() === "DIFFERENT";
    })
    .slice(0, max);
}

function AE_clearShadowResults() {
  const ss = workbook_();

  const shadow = ss.getSheetByName(
    AE.SHEETS.SHADOW
  );

  const summary = ss.getSheetByName(
    AE_SHADOW_SUMMARY_SHEET
  );

  if (shadow) {
    const headers = shadow
      .getRange(
        1,
        1,
        1,
        shadow.getLastColumn()
      )
      .getValues();

    clearSheet_(shadow);

    if (headers[0].length) {
      shadow
        .getRange(
          1,
          1,
          1,
          headers[0].length
        )
        .setValues(headers);
    }
  }

  if (summary) {
    clearSheet_(summary);
  }

  setDocProperty_(
    "AE_SHADOW_LAST_RUN",
    ""
  );

  setDocProperty_(
    "AE_SHADOW_MATCH_RATE",
    "0"
  );

  setDocProperty_(
    "AE_SHADOW_READINESS",
    ""
  );

  return true;
}

function AE_getShadowMigrationStatus() {
  return {
    lastRun:
      getDocProperty_(
        "AE_SHADOW_LAST_RUN"
      ) || "",

    matchRate:
      Number(
        getDocProperty_(
          "AE_SHADOW_MATCH_RATE"
        ) || 0
      ),

    readiness:
      getDocProperty_(
        "AE_SHADOW_READINESS"
      ) || "",

    totalResults:
      AE_sheetObjects_(
        AE.SHEETS.SHADOW
      ).length
  };
}

function AE_testShadowMigration() {
  AE_initializeConfig();
  AE_setShadowMode();

  AE_upsertAgent({
    AgentID: "AGT-SHADOW-TEST",
    AgentName: "Shadow Migration Test Agent",
    Email: "shadow-test@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "SHADOW TEST PARISH",
    LeadTypes: "BUYER",
    Priority: 1,
    DailyCap: 999
  });

  const leadSheet = workbook_()
    .getSheetByName(
      AE.SHEETS.LEADS
    );

  const existingRow =
    AE_findRowByValue_(
      AE.SHEETS.LEADS,
      "LeadID",
      "LEAD-SHADOW-TEST"
    );

  const payload = [
    "LEAD-SHADOW-TEST",
    timestamp_(),
    "Shadow",
    "Test",
    "shadow-lead@example.com",
    "9855550155",
    "BUYER",
    "SHADOW TEST PARISH",
    "SELF_TEST",
    "ASSIGNED",
    "AGT-SHADOW-TEST",
    "Shadow Migration Test Agent",
    timestamp_(),
    "Existing assignment for shadow test.",
    timestamp_()
  ];

  if (existingRow) {
    leadSheet
      .getRange(
        existingRow,
        1,
        1,
        payload.length
      )
      .setValues([payload]);
  } else {
    leadSheet.appendRow(payload);
  }

  const result =
    AE_runShadowMigration(100);

  if (!result.success) {
    throw new Error(
      "Shadow Migration self-test failed."
    );
  }

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      AE_getShadowMigrationStatus()
    )
  );

  return true;
}
