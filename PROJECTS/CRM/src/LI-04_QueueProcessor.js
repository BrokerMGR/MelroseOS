/******************************************************************************
 * MelroseOS Enterprise
 * File: LI-04_QueueProcessor.js
 * Version: 2.0.0
 *
 * Purpose:
 *   Safely processes validated intake records through the Assignment Engine.
 *
 * Pipeline:
 *   Routing Gate
 *   → Processing Lock
 *   → Intake Revalidation
 *   → AE_LEADS Upsert
 *   → Assignment
 *   → Broker Fallback
 *   → Intake Status
 *   → Audit Log
 *
 * Safety:
 *   - Fails closed if the routing gate is unavailable.
 *   - Prevents simultaneous queue workers.
 *   - Prevents the same intake row from processing twice.
 *   - Preserves SHADOW mode behavior.
 *   - Routes unassigned leads to broker fallback when available.
 ******************************************************************************/

const LI_QUEUE_PROCESSOR_VERSION = "2.0.0";
const LI_QUEUE_LOCK_TIMEOUT_MS = 10000;

/**
 * Fail-closed routing guard.
 *
 * @return {Object}
 */
function LI_checkQueueGuard_() {
  if (
    typeof MOS5M1B_checkRoutingGate_ !== "function"
  ) {
    throw new Error(
      "Queue processing blocked: canonical routing safety gate is unavailable."
    );
  }

  const result =
    MOS5M1B_checkRoutingGate_();

  if (
    !result ||
    result.success !== true ||
    result.status !== "OPEN"
  ) {
    throw new Error(
      "Queue processing blocked by routing safety controls."
    );
  }

  return result;
}

/**
 * Processes validated NEW intake records.
 *
 * @param {number=} limit
 * @return {Object}
 */
function LI_processIntakeQueue(limit) {
  const startedAt = new Date();
  const lock = LockService.getScriptLock();

  if (
    !lock.tryLock(
      LI_QUEUE_LOCK_TIMEOUT_MS
    )
  ) {
    return {
      success: false,
      status: "QUEUE_BUSY",
      processed: 0,
      successful: 0,
      failed: 0,
      mode:
        typeof AE_getMode === "function"
          ? AE_getMode()
          : "UNKNOWN",
      results: [],
      startedAt:
        startedAt.toISOString(),
      completedAt:
        new Date().toISOString()
    };
  }

  try {
    LI_initializeDedupeEngine();
    const routingGate =
      LI_checkQueueGuard_();

    AE_initializeConfig();

    const max = Math.max(
      1,
      Math.min(
        Number(limit || 25),
        250
      )
    );

    const rows =
      LI_sheetObjects_(
        LI.SHEETS.INTAKE
      )
        .filter(function(row) {
          return (
            String(
              row.Status || ""
            )
              .trim()
              .toUpperCase() === "NEW" &&
            String(
              row.ValidationStatus || ""
            )
              .trim()
              .toUpperCase() === "VALID"
          );
        })
        .slice(0, max);

    const results = [];

    rows.forEach(function(intake) {
      try {
        results.push(
          LI_processIntakeRecord_(
            intake,
            routingGate
          )
        );
      } catch (error) {
        const message = String(
          error && error.message
            ? error.message
            : error
        );

        LI_markIntakeError_(
          intake,
          message
        );

        results.push({
          success: false,
          status: "ERROR",
          intakeId:
            String(
              intake.IntakeID || ""
            ),
          leadId:
            String(
              intake.LeadID || ""
            ),
          error: message
        });
      }
    });

    const successful =
      results.filter(function(result) {
        return result.success === true;
      }).length;

    const failed =
      results.length - successful;

    const response = {
      success: failed === 0,
      status:
        failed === 0
          ? "COMPLETE"
          : successful > 0
            ? "PARTIAL"
            : "FAILED",
      version:
        LI_QUEUE_PROCESSOR_VERSION,
      processed: results.length,
      successful: successful,
      failed: failed,
      mode: AE_getMode(),
      brokerOnlyRouting:
        Boolean(
          routingGate &&
          routingGate.brokerOnlyRouting
        ),
      roundRobinPaused:
        Boolean(
          routingGate &&
          routingGate.roundRobinPaused
        ),
      results: results,
      startedAt:
        startedAt.toISOString(),
      completedAt:
        new Date().toISOString()
    };

    LI_log_(
      "QUEUE_BATCH_COMPLETED",
      "",
      JSON.stringify({
        processed: response.processed,
        successful:
          response.successful,
        failed: response.failed,
        mode: response.mode
      }),
      ""
    );

    return response;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Processes one intake record safely.
 *
 * @param {Object} intake
 * @param {Object=} routingGate
 * @return {Object}
 */
function LI_processIntakeRecord_(
  intake,
  routingGate
) {
  const gate =
    routingGate ||
    LI_checkQueueGuard_();

  const intakeId = String(
    intake.IntakeID || ""
  ).trim();

  if (!intakeId) {
    throw new Error(
      "IntakeID is required."
    );
  }

  const current =
    LI_getCurrentIntakeRecord_(
      intakeId
    );

  if (!current) {
    throw new Error(
      "Intake record no longer exists: " +
      intakeId
    );
  }

  const currentStatus = String(
    current.Status || ""
  )
    .trim()
    .toUpperCase();

  const validationStatus = String(
    current.ValidationStatus || ""
  )
    .trim()
    .toUpperCase();

  if (
    currentStatus !== "NEW" ||
    validationStatus !== "VALID"
  ) {
    return {
      success: false,
      status: "SKIPPED",
      intakeId: intakeId,
      leadId:
        String(
          current.LeadID || ""
        ),
      reason:
        "Intake is no longer eligible for processing.",
      currentStatus: currentStatus,
      validationStatus:
        validationStatus
    };
  }

  LI_updateIntakeStatus_(
    current._row,
    "PROCESSING",
    "VALID",
    "Queue processing started.",
    "",
    ""
  );

  const lead = {
    LeadID:
      String(
        current.LeadID || ""
      ).trim() ||
      LI_uuid_("LEAD"),

    CreatedAt:
      current.ReceivedAt ||
      timestamp_(),

    FirstName:
      String(
        current.FirstName || ""
      ).trim(),

    LastName:
      String(
        current.LastName || ""
      ).trim(),

    Email:
      AE_normalizeEmail_(
        current.Email || ""
      ),

    Phone:
      AE_normalizePhone_(
        current.Phone || ""
      ),

    LeadType:
      String(
        current.LeadType || ""
      )
        .trim()
        .toUpperCase(),

    Parish:
      String(
        current.Parish || ""
      )
        .trim()
        .toUpperCase()
        .replace(
          /\s+PARISH$/,
          ""
        ),

    Source:
      String(
        current.Source || ""
      ).trim(),

    Status: "NEW"
  };

  const leadRow =
    LI_upsertAELead_(lead);

  let assignment;

  if (
    gate &&
    gate.brokerOnlyRouting
  ) {
    assignment =
      LI_assignBrokerFallback_(
        lead,
        "BROKER_ONLY_ROUTING"
      );
  } else {
    assignment =
      AE_assignLead(lead);

    if (
      !assignment ||
      assignment.success !== true
    ) {
      assignment =
        LI_assignBrokerFallback_(
          lead,
          assignment &&
          assignment.reason ||
          "NO_ELIGIBLE_AGENT"
        );
    }
  }

  const assigned =
    Boolean(
      assignment &&
      assignment.success === true
    );

  const assignedAgentId =
    assigned
      ? String(
          assignment.agentId || ""
        )
      : "";

  const assignedAgentName =
    assigned
      ? String(
          assignment.agentName || ""
        )
      : "";

  const assignedAgentEmail =
    assigned
      ? String(
          assignment.agentEmail || ""
        )
      : "";

  if (assigned) {
    LI_applyAssignmentToAELead_(
      leadRow,
      {
        Status: "ASSIGNED",
        AssignedAgentID:
          assignedAgentId,
        AssignedAgentName:
          assignedAgentName,
        AssignedAgentEmail:
          assignedAgentEmail,
        AssignmentMethod:
          String(
            assignment.method ||
            "ASSIGNMENT_ENGINE"
          ),
        UpdatedAt:
          timestamp_()
      }
    );
  }

  const finalStatus =
    assigned
      ? "PROCESSED"
      : "UNASSIGNED";

  const reason = String(
    assignment &&
    assignment.reason ||
    (
      assigned
        ? "Assignment completed."
        : "No assignment available."
    )
  );

  LI_updateIntakeStatus_(
    current._row,
    finalStatus,
    "VALID",
    reason,
    assignedAgentId,
    timestamp_()
  );

  LI_log_(
    assigned
      ? "QUEUE_PROCESSED"
      : "QUEUE_UNASSIGNED",
    intakeId,
    assigned
      ? (
        "Lead assigned using " +
        String(
          assignment.method ||
          "ASSIGNMENT_ENGINE"
        ) +
        " in " +
        String(
          assignment.mode ||
          AE_getMode()
        ) +
        " mode."
      )
      : reason,
    lead.LeadID
  );

  return {
    success: assigned,
    status: finalStatus,
    intakeId: intakeId,
    leadId: lead.LeadID,
    mode:
      assignment &&
      assignment.mode ||
      AE_getMode(),
    agentId:
      assignedAgentId,
    agentName:
      assignedAgentName,
    agentEmail:
      assignedAgentEmail,
    method:
      assignment &&
      assignment.method ||
      "",
    reason: reason,
    brokerFallback:
      Boolean(
        assignment &&
        assignment.brokerFallback
      )
  };
}

/**
 * Finds the latest intake record by IntakeID.
 *
 * @param {string} intakeId
 * @return {Object|null}
 */
function LI_getCurrentIntakeRecord_(
  intakeId
) {
  const target = String(
    intakeId || ""
  ).trim();

  return (
    LI_sheetObjects_(
      LI.SHEETS.INTAKE
    ).find(function(row) {
      return String(
        row.IntakeID || ""
      ).trim() === target;
    }) ||
    null
  );
}

/**
 * Creates or returns the AE_LEADS row.
 *
 * @param {Object} lead
 * @return {number}
 */
function LI_upsertAELead_(lead) {
  const sheet =
    workbook_().getSheetByName(
      AE.SHEETS.LEADS
    );

  if (!sheet) {
    throw new Error(
      "AE_LEADS sheet is missing."
    );
  }

  const existingRow =
    AE_findRowByValue_(
      AE.SHEETS.LEADS,
      "LeadID",
      lead.LeadID
    );

  if (existingRow) {
    return existingRow;
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  const payload = {
    LeadID: lead.LeadID,
    CreatedAt: lead.CreatedAt,
    FirstName: lead.FirstName,
    LastName: lead.LastName,
    Email: lead.Email,
    Phone: lead.Phone,
    LeadType: lead.LeadType,
    Parish: lead.Parish,
    Source: lead.Source,
    Status: "NEW",
    AssignedAgentID: "",
    AssignedAgentName: "",
    AssignedAgentEmail: "",
    AssignmentMethod: "",
    UpdatedAt: timestamp_()
  };

  sheet.appendRow(
    headers.map(function(header) {
      return payload[header] !== undefined
        ? payload[header]
        : "";
    })
  );

  return sheet.getLastRow();
}

/**
 * Assigns the lead to broker fallback.
 *
 * @param {Object} lead
 * @param {string=} reason
 * @return {Object}
 */
function LI_assignBrokerFallback_(
  lead,
  reason
) {
  const brokerEmail =
    String(
      AE_getConfigValue(
        "BROKER_EMAIL",
        "melrosegroupbroker@gmail.com"
      )
    )
      .trim()
      .toLowerCase();

  let broker =
    AE_getAgent(brokerEmail);

  if (!broker) {
    broker = AE_getAgent(
      "BROKER-001"
    );
  }

  if (!broker) {
    return {
      success: false,
      mode: AE_getMode(),
      reason:
        "Broker fallback agent is unavailable.",
      brokerFallback: true
    };
  }

  if (
    !AE_isTrue_(broker.Active)
  ) {
    return {
      success: false,
      mode: AE_getMode(),
      reason:
        "Broker fallback agent is inactive.",
      brokerFallback: true
    };
  }

  const mode = AE_getMode();

  if (mode === "LIVE") {
    AE_markAgentAssigned(
      broker.AgentID
    );
  }

  return {
    success: true,
    mode: mode,
    agentId:
      String(
        broker.AgentID || ""
      ),
    agentName:
      String(
        broker.AgentName || ""
      ),
    agentEmail:
      String(
        broker.Email || ""
      ),
    method: "BROKER_FALLBACK",
    reason:
      String(
        reason ||
        "No eligible agent was available."
      ),
    brokerFallback: true
  };
}

/**
 * Writes assignment fields to AE_LEADS.
 *
 * @param {number} row
 * @param {Object} assignment
 * @return {boolean}
 */
function LI_applyAssignmentToAELead_(
  row,
  assignment
) {
  const sheet =
    workbook_().getSheetByName(
      AE.SHEETS.LEADS
    );

  if (!sheet || !row) {
    throw new Error(
      "AE_LEADS assignment row could not be updated."
    );
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  Object.keys(
    assignment || {}
  ).forEach(function(headerName) {
    const column =
      headers.indexOf(
        headerName
      ) + 1;

    if (column > 0) {
      sheet
        .getRange(
          row,
          column
        )
        .setValue(
          assignment[headerName]
        );
    }
  });

  return true;
}

/**
 * Updates the intake status fields.
 *
 * @return {boolean}
 */
function LI_updateIntakeStatus_(
  row,
  status,
  validationStatus,
  message,
  assignedAgentId,
  processedAt
) {
  const sheet =
    workbook_().getSheetByName(
      LI.SHEETS.INTAKE
    );

  if (!sheet || !row) {
    throw new Error(
      "Intake row could not be updated."
    );
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  LI_setIntakeCell_(
    sheet,
    headers,
    row,
    "Status",
    status
  );

  LI_setIntakeCell_(
    sheet,
    headers,
    row,
    "ValidationStatus",
    validationStatus
  );

  LI_setIntakeCell_(
    sheet,
    headers,
    row,
    "ValidationMessage",
    message
  );

  LI_setIntakeCell_(
    sheet,
    headers,
    row,
    "AssignedAgentID",
    assignedAgentId
  );

  LI_setIntakeCell_(
    sheet,
    headers,
    row,
    "ProcessedAt",
    processedAt
  );

  LI_setIntakeCell_(
    sheet,
    headers,
    row,
    "UpdatedAt",
    timestamp_()
  );

  return true;
}

/**
 * Updates one intake cell by header.
 *
 * @return {boolean}
 */
function LI_setIntakeCell_(
  sheet,
  headers,
  row,
  headerName,
  value
) {
  const column =
    headers.indexOf(
      headerName
    ) + 1;

  if (!column) {
    throw new Error(
      "Header '" +
      headerName +
      "' not found in " +
      LI.SHEETS.INTAKE +
      "."
    );
  }

  sheet
    .getRange(
      row,
      column
    )
    .setValue(value);

  return true;
}

/**
 * Marks a failed intake record safely.
 *
 * @param {Object} intake
 * @param {string} message
 */
function LI_markIntakeError_(
  intake,
  message
) {
  try {
    LI_updateIntakeStatus_(
      intake._row,
      "ERROR",
      "VALID",
      message,
      "",
      ""
    );
  } catch (statusError) {
    console.log(
      JSON.stringify({
        event:
          "QUEUE_STATUS_UPDATE_FAILED",
        intakeId:
          intake.IntakeID || "",
        originalError: message,
        statusError:
          statusError.message ||
          String(statusError)
      })
    );
  }

  LI_log_(
    "QUEUE_PROCESSING_ERROR",
    intake.IntakeID,
    message,
    intake.LeadID
  );
}

/**
 * Retries ERROR and UNASSIGNED records.
 *
 * @param {number=} limit
 * @return {Object}
 */
function LI_retryFailedQueue(limit) {
  LI_checkQueueGuard_();

  const max = Math.max(
    1,
    Math.min(
      Number(limit || 25),
      250
    )
  );

  const candidates =
    LI_sheetObjects_(
      LI.SHEETS.INTAKE
    )
      .filter(function(row) {
        const status = String(
          row.Status || ""
        )
          .trim()
          .toUpperCase();

        return (
          status === "ERROR" ||
          status === "UNASSIGNED"
        );
      })
      .slice(0, max);

  candidates.forEach(function(row) {
    LI_updateIntakeStatus_(
      row._row,
      "NEW",
      "VALID",
      "Queued for retry.",
      "",
      ""
    );
  });

  return LI_processIntakeQueue(
    max
  );
}

/**
 * Returns queue counts.
 *
 * @return {Object}
 */
function LI_getQueueStatus() {
  const rows =
    LI_sheetObjects_(
      LI.SHEETS.INTAKE
    );

  const count = function(status) {
    return rows.filter(function(row) {
      return String(
        row.Status || ""
      )
        .trim()
        .toUpperCase() === status;
    }).length;
  };

  return {
    version:
      LI_QUEUE_PROCESSOR_VERSION,
    total: rows.length,
    new: count("NEW"),
    processing:
      count("PROCESSING"),
    processed:
      count("PROCESSED"),
    duplicate:
      count("DUPLICATE"),
    rejected:
      count("REJECTED"),
    unassigned:
      count("UNASSIGNED"),
    error: count("ERROR"),
    assignmentMode:
      AE_getMode(),
    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Read-only queue diagnostics.
 *
 * @return {Object}
 */
function LI_runQueueProcessorDiagnostics() {
  const required = [
    "MOS5M1B_checkRoutingGate_",
    "AE_initializeConfig",
    "AE_assignLead",
    "AE_getAgent",
    "AE_getMode",
    "LI_sheetObjects_"
  ];

  const tests =
    required.map(function(name) {
      return {
        code: name,
        status:
          typeof globalThis[name] ===
          "function"
            ? "PASS"
            : "FAIL"
      };
    });

  const failed =
    tests.filter(function(test) {
      return test.status === "FAIL";
    }).length;

  return {
    release:
      "LI-04-QUEUE-PROCESSOR",
    version:
      LI_QUEUE_PROCESSOR_VERSION,
    overallStatus:
      failed
        ? "FAIL"
        : "PASS",
    passed:
      tests.length - failed,
    failed: failed,
    tests: tests,
    queueStatus:
      LI_getQueueStatus(),
    productionChanged: false,
    completedAt:
      new Date().toISOString()
  };
}

/**
 * SHADOW-mode self-test.
 *
 * @return {boolean}
 */
function LI_testQueueProcessor() {
  LI_initializeDedupeEngine();
  AE_initializeConfig();
  AE_setShadowMode();

  AE_upsertAgent({
    AgentID:
      "AGT-LI-QUEUE-TEST",
    AgentName:
      "Lead Intake Queue Test Agent",
    Email:
      "li-queue-agent@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes:
      "QUEUE TEST PARISH",
    LeadTypes: "BUYER",
    Priority: 1,
    DailyCap: 999
  });

  const unique =
    Utilities
      .getUuid()
      .substring(0, 8);

  const intake =
    LI_receiveLeadWithDedupe({
      FirstName: "Queue",
      LastName: "Test",
      Email:
        "li-queue-" +
        unique +
        "@example.com",
      Phone: "",
      LeadType: "BUYER",
      Parish:
        "QUEUE TEST PARISH",
      Source: "SELF_TEST"
    });

  if (!intake.success) {
    throw new Error(
      "Queue Processor test intake failed."
    );
  }

  const result =
    LI_processIntakeQueue(100);

  const processed =
    result.results.some(
      function(row) {
        return (
          row.leadId ===
            intake.leadId &&
          row.success === true
        );
      }
    );

  if (!processed) {
    throw new Error(
      "Lead Intake Queue Processor self-test failed."
    );
  }

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      LI_getQueueStatus()
    )
  );

  return true;
}