/******************************************************************************
 * MelroseOS
 * File: OP-00_LeadLifecycleOrchestrator.js
 * Version: 1.1.0
 *
 * Canonical orchestration entry point:
 * Safety → Intake → Dedupe → Queue → Assignment → Audit
 ******************************************************************************/

const MOS5_LEAD_ORCHESTRATOR_VERSION = "1.1.0";

/**
 * Canonical end-to-end lead lifecycle entry point.
 *
 * Default behavior is queue-only. Assignment runs only when processNow=true
 * and the routing safety gate permits processing.
 *
 * @param {Object} payload
 * @param {Object=} options
 * @return {Object}
 */
function MOS5_processLeadLifecycle(payload, options) {
  const input = payload || {};
  const settings = options || {};
  const executionId = MOS5OP_executionId_();
  const startedAt = new Date();

  const trace = {
    executionId: executionId,
    version: MOS5_LEAD_ORCHESTRATOR_VERSION,
    stages: [],
    startedAt: startedAt.toISOString()
  };

  try {
    MOS5OP_addStage_(
      trace,
      "SAFETY",
      "STARTED",
      "Evaluating lead-intake safety gate."
    );

    MOS5OP_invokeRequired_(
      "MOS5M1B_checkLeadIntakeGate_",
      []
    );

    MOS5OP_addStage_(
      trace,
      "SAFETY",
      "PASS",
      "Lead-intake safety gate is open."
    );

    MOS5OP_addStage_(
      trace,
      "INTAKE",
      "STARTED",
      "Submitting lead through canonical intake."
    );

    const intakeResult = MOS5OP_invokeRequired_(
      "MOS5_submitCanonicalLead",
      [
        input,
        {
          source:
            settings.source ||
            input.Source ||
            input.source ||
            "ORCHESTRATOR",
          processNow: false
        }
      ]
    );

    if (!intakeResult || intakeResult.success !== true) {
      throw new Error(
        "Canonical intake did not return a successful result."
      );
    }

    MOS5OP_addStage_(
      trace,
      "INTAKE",
      "PASS",
      "Lead validated, deduplicated, and queued.",
      {
        stage: intakeResult.stage || "",
        intakeId:
          intakeResult.intake &&
          intakeResult.intake.intakeId ||
          "",
        leadId:
          intakeResult.intake &&
          intakeResult.intake.leadId ||
          ""
      }
    );

    const intakeId =
      intakeResult.intake &&
      intakeResult.intake.intakeId ||
      "";

    const leadId =
      intakeResult.intake &&
      intakeResult.intake.leadId ||
      "";

    const queuedEvent = MOS5OP_publishLifecycleEvent_(
      "MOS5EB_publishLeadQueued",
      {
        intakeId: intakeId,
        leadId: leadId,
        source:
          settings.source ||
          input.Source ||
          input.source ||
          "ORCHESTRATOR",
        stage:
          intakeResult.stage || "QUEUED",
        executionId: executionId
      },
      {
        intakeId: intakeId,
        leadId: leadId,
        executionId: executionId,
        source: "LEAD_LIFECYCLE_ORCHESTRATOR"
      }
    );

    MOS5OP_addStage_(
      trace,
      "EVENT_LEAD_QUEUED",
      queuedEvent.success ? "PASS" : "WARNING",
      queuedEvent.success
        ? "LEAD_QUEUED event published."
        : "LEAD_QUEUED event publication was unavailable.",
      queuedEvent
    );

    const processNow = MOS5OP_isTrue_(
      settings.processNow
    );

    if (!processNow) {
      MOS5OP_addStage_(
        trace,
        "ASSIGNMENT",
        "HELD",
        "Lead remains queued because processNow is false."
      );

      return MOS5OP_complete_(
        trace,
        {
          success: true,
          status: "QUEUED",
          intake: intakeResult,
          assignment: null,
          communications: null,
          productionChanged: false
        }
      );
    }

    MOS5OP_addStage_(
      trace,
      "ROUTING_SAFETY",
      "STARTED",
      "Evaluating routing safety gate."
    );

    const routingGate = MOS5OP_invokeRequired_(
      "MOS5M1B_checkRoutingGate_",
      []
    );

    MOS5OP_addStage_(
      trace,
      "ROUTING_SAFETY",
      "PASS",
      "Routing safety gate is open.",
      {
        brokerOnlyRouting:
          Boolean(
            routingGate &&
            routingGate.brokerOnlyRouting
          ),
        roundRobinPaused:
          Boolean(
            routingGate &&
            routingGate.roundRobinPaused
          )
      }
    );

    if (!intakeId) {
      throw new Error(
        "Canonical intake did not return an IntakeID."
      );
    }

    MOS5OP_addStage_(
      trace,
      "ASSIGNMENT",
      "STARTED",
      "Processing queued intake through Assignment Engine."
    );

    const assignment = MOS5OP_invokeRequired_(
      "LI_processSingleIntake_",
      [intakeId]
    );

    const assignmentSucceeded =
      Boolean(
        assignment &&
        assignment.success === true
      );

    MOS5OP_addStage_(
      trace,
      "ASSIGNMENT",
      assignmentSucceeded ? "PASS" : "HELD",
      assignmentSucceeded
        ? "Lead assignment completed."
        : (
          assignment &&
          assignment.reason ||
          "Lead was not assigned."
        ),
      {
        agentId:
          assignment &&
          assignment.agentId ||
          "",
        agentName:
          assignment &&
          assignment.agentName ||
          "",
        method:
          assignment &&
          assignment.method ||
          "",
        mode:
          assignment &&
          assignment.mode ||
          ""
      }
    );

    const assignmentEvent = MOS5OP_publishLifecycleEvent_(
      "MOS5EB_publishQueueResult",
      assignment || {
        success: false,
        status: "UNASSIGNED",
        intakeId: intakeId,
        leadId: leadId,
        reason: "Lead was not assigned."
      },
      {
        intakeId: intakeId,
        leadId: leadId,
        executionId: executionId,
        source: "LEAD_LIFECYCLE_ORCHESTRATOR"
      }
    );

    MOS5OP_addStage_(
      trace,
      "EVENT_ASSIGNMENT_RESULT",
      assignmentEvent.success ? "PASS" : "WARNING",
      assignmentEvent.success
        ? "Assignment lifecycle event published."
        : "Assignment lifecycle event publication was unavailable.",
      assignmentEvent
    );

    return MOS5OP_complete_(
      trace,
      {
        success: assignmentSucceeded,
        status: assignmentSucceeded
          ? "ASSIGNED"
          : "UNASSIGNED",
        intake: intakeResult,
        assignment: assignment,
        communications: null,
        productionChanged: assignmentSucceeded
      }
    );
  } catch (error) {
    MOS5OP_addStage_(
      trace,
      "ERROR",
      "FAIL",
      String(
        error && error.message
          ? error.message
          : error
      )
    );

    const lifecycleError = String(
      error && error.message
        ? error.message
        : error
    );

    const errorEvent = MOS5OP_publishLifecycleEvent_(
      "MOS5EB_publishLeadError",
      {
        executionId: executionId,
        error: lifecycleError,
        source:
          settings.source ||
          input.Source ||
          input.source ||
          "ORCHESTRATOR"
      },
      {
        executionId: executionId,
        source: "LEAD_LIFECYCLE_ORCHESTRATOR"
      }
    );

    MOS5OP_addStage_(
      trace,
      "EVENT_LEAD_ERROR",
      errorEvent.success ? "PASS" : "WARNING",
      errorEvent.success
        ? "LEAD_ERROR event published."
        : "LEAD_ERROR event publication was unavailable.",
      errorEvent
    );

    const result = MOS5OP_complete_(
      trace,
      {
        success: false,
        status: "ERROR",
        error: String(
          error && error.message
            ? error.message
            : error
        ),
        productionChanged: false
      }
    );

    MOS5OP_log_(
      "LEAD_LIFECYCLE_ERROR",
      executionId,
      result
    );

    return result;
  }
}

/**
 * Processes existing NEW intake records through the orchestrated queue.
 *
 * @param {number=} limit
 * @return {Object}
 */
function MOS5_processQueuedLeadLifecycle(limit) {
  MOS5OP_invokeRequired_(
    "MOS5M1B_checkRoutingGate_",
    []
  );

  const result = MOS5OP_invokeRequired_(
    "LI_processIntakeQueue",
    [
      Math.max(
        1,
        Number(limit || 25)
      )
    ]
  );

  MOS5OP_log_(
    "QUEUED_LEAD_LIFECYCLE_PROCESSED",
    MOS5OP_executionId_(),
    result
  );

  return result;
}

/**
 * Returns current lifecycle health without changing data.
 *
 * @return {Object}
 */
function MOS5_getLeadLifecycleStatus() {
  const status = {
    release: "MOS5-LEAD-LIFECYCLE-ORCHESTRATOR",
    version: MOS5_LEAD_ORCHESTRATOR_VERSION,
    canonicalIntakeAvailable:
      MOS5OP_functionExists_(
        "MOS5_submitCanonicalLead"
      ),
    intakeGateAvailable:
      MOS5OP_functionExists_(
        "MOS5M1B_checkLeadIntakeGate_"
      ),
    routingGateAvailable:
      MOS5OP_functionExists_(
        "MOS5M1B_checkRoutingGate_"
      ),
    queueProcessorAvailable:
      MOS5OP_functionExists_(
        "LI_processIntakeQueue"
      ),
    singleIntakeProcessorAvailable:
      MOS5OP_functionExists_(
        "LI_processSingleIntake_"
      ),
    assignmentAvailable:
      MOS5OP_functionExists_(
        "AE_assignLead"
      ),
    generatedAt:
      new Date().toISOString()
  };

  status.ready =
    status.canonicalIntakeAvailable &&
    status.intakeGateAvailable &&
    status.routingGateAvailable &&
    status.queueProcessorAvailable &&
    status.singleIntakeProcessorAvailable &&
    status.assignmentAvailable;

  return status;
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function MOS5_runLeadLifecycleDiagnostics() {
  const status =
    MOS5_getLeadLifecycleStatus();

  const tests = [
    {
      code: "CANONICAL_INTAKE",
      passed:
        status.canonicalIntakeAvailable
    },
    {
      code: "INTAKE_GATE",
      passed:
        status.intakeGateAvailable
    },
    {
      code: "ROUTING_GATE",
      passed:
        status.routingGateAvailable
    },
    {
      code: "QUEUE_PROCESSOR",
      passed:
        status.queueProcessorAvailable
    },
    {
      code: "SINGLE_INTAKE_PROCESSOR",
      passed:
        status.singleIntakeProcessorAvailable
    },
    {
      code: "ASSIGNMENT_ENGINE",
      passed:
        status.assignmentAvailable
    }
  ].map(function(test) {
    return {
      code: test.code,
      status:
        test.passed
          ? "PASS"
          : "FAIL"
    };
  });

  const failed = tests.filter(
    function(test) {
      return test.status === "FAIL";
    }
  ).length;

  const result = {
    release:
      "MOS5-LEAD-LIFECYCLE-ORCHESTRATOR",
    version:
      MOS5_LEAD_ORCHESTRATOR_VERSION,
    overallStatus:
      failed
        ? "FAIL"
        : "PASS",
    passed:
      tests.length - failed,
    failed: failed,
    tests: tests,
    lifecycleStatus: status,
    productionChanged: false,
    completedAt:
      new Date().toISOString()
  };

  MOS5OP_log_(
    "LEAD_LIFECYCLE_DIAGNOSTICS",
    MOS5OP_executionId_(),
    result
  );

  return result;
}

function MOS5OP_invokeRequired_(
  functionName,
  args
) {
  const handler =
    globalThis[functionName];

  if (typeof handler !== "function") {
    throw new Error(
      "Required function is unavailable: " +
      functionName
    );
  }

  return handler.apply(
    null,
    Array.isArray(args)
      ? args
      : []
  );
}

function MOS5OP_functionExists_(
  functionName
) {
  return typeof globalThis[
    functionName
  ] === "function";
}

function MOS5OP_addStage_(
  trace,
  stage,
  status,
  message,
  details
) {
  trace.stages.push({
    stage:
      String(stage || "").trim(),
    status:
      String(status || "").trim(),
    message:
      String(message || "").trim(),
    details:
      details || {},
    timestamp:
      new Date().toISOString()
  });
}

function MOS5OP_complete_(
  trace,
  payload
) {
  const completedAt = new Date();

  const result = Object.assign(
    {
      executionId:
        trace.executionId,
      release:
        "MOS5-LEAD-LIFECYCLE-ORCHESTRATOR",
      version:
        MOS5_LEAD_ORCHESTRATOR_VERSION,
      trace:
        trace.stages,
      startedAt:
        trace.startedAt,
      completedAt:
        completedAt.toISOString()
    },
    payload || {}
  );

  MOS5OP_log_(
    "LEAD_LIFECYCLE_COMPLETED",
    trace.executionId,
    result
  );

  return result;
}

function MOS5OP_executionId_() {
  return (
    "EXEC-" +
    Utilities
      .getUuid()
      .replace(/-/g, "")
      .substring(0, 20)
      .toUpperCase()
  );
}

function MOS5OP_isTrue_(value) {
  if (value === true) {
    return true;
  }

  return [
    "TRUE",
    "YES",
    "Y",
    "1",
    "ON"
  ].indexOf(
    String(value || "")
      .trim()
      .toUpperCase()
  ) !== -1;
}

function MOS5OP_publishLifecycleEvent_(
  functionName,
  payload,
  context
) {
  const handler =
    globalThis[functionName];

  if (typeof handler !== "function") {
    return {
      success: false,
      status: "EVENT_BRIDGE_UNAVAILABLE",
      functionName: functionName,
      productionChanged: false
    };
  }

  try {
    const response = handler(
      payload || {},
      context || {}
    );

    return response || {
      success: true,
      status: "PUBLISHED"
    };
  } catch (error) {
    return {
      success: false,
      status: "EVENT_PUBLICATION_FAILED",
      functionName: functionName,
      error: String(
        error && error.message
          ? error.message
          : error
      ),
      productionChanged: false
    };
  }
}

function MOS5OP_log_(
  eventType,
  referenceId,
  details
) {
  const record = {
    timestamp:
      new Date().toISOString(),
    eventType:
      String(eventType || ""),
    referenceId:
      String(referenceId || ""),
    details:
      details || {}
  };

  console.log(
    JSON.stringify(record)
  );

  return record;
}