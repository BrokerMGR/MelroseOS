/******************************************************************************
 * MelroseOS Enterprise
 * Project : Broker Command Center
 * File    : BCC-03_DashboardDataAdapter.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Normalizes OPS and CRM runtime data into one stable Broker Command Center
 *   dashboard contract.
 *
 * Safety:
 *   - Read-only.
 *   - Does not install triggers.
 *   - Does not enable routing or communications.
 ******************************************************************************/

const BCC_DATA_ADAPTER_VERSION = "1.0.0";

/* ========================================================================== */
/* PUBLIC DASHBOARD CONTRACT */
/* ========================================================================== */

function BCC_getNormalizedDashboardData() {
    const generatedAt =
        new Date().toISOString();

    const operations =
        BCC_ADAPTER_collectOperations_();

    const leads =
        BCC_ADAPTER_collectLeadMetrics_();

    const assignments =
        BCC_ADAPTER_collectAssignmentMetrics_();

    const notifications =
        BCC_ADAPTER_collectNotificationMetrics_();

    const scheduler =
        BCC_ADAPTER_collectSchedulerMetrics_();

    const events =
        BCC_ADAPTER_collectEventMetrics_();

    const agents =
        BCC_ADAPTER_collectAgentMetrics_();

    const alerts =
        BCC_ADAPTER_collectAlerts_();

    return {
        release:
            "BCC-03-DASHBOARD-DATA-ADAPTER",

        version:
            BCC_DATA_ADAPTER_VERSION,

        executive:
            BCC_ADAPTER_buildExecutive_(
                operations,
                alerts
            ),

        operations,
        leads,
        assignments,
        notifications,
        scheduler,
        events,
        agents,
        alerts,

        generatedAt
    };
}

/* ========================================================================== */
/* OPERATIONS */
/* ========================================================================== */

function BCC_ADAPTER_collectOperations_() {
    let health = null;

    if (
        typeof OPS_refreshEnterpriseHealth ===
        "function"
    ) {
        try {
            health =
                OPS_refreshEnterpriseHealth();
        } catch (error) {
            health = null;
        }
    }

    if (
        !health &&
        typeof OPS_exportHealth ===
        "function"
    ) {
        try {
            health =
                OPS_exportHealth();
        } catch (error) {
            health = null;
        }
    }

    health =
        health || {};

    const summary =
        health.summary || {};

    const subsystems =
        Array.isArray(
            health.subsystems
        )
            ? health.subsystems
            : [];

    return {
        status:
            String(
                summary.overallStatus ||
                health.status ||
                "UNKNOWN"
            )
                .trim()
                .toUpperCase(),

        score:
            BCC_ADAPTER_number_(
                health.score,
                summary.averageScore,
                0
            ),

        healthy:
            health.healthy === true,

        subsystemCount:
            BCC_ADAPTER_number_(
                summary.total,
                subsystems.length,
                0
            ),

        passing:
            BCC_ADAPTER_number_(
                summary.pass,
                0
            ),

        warnings:
            BCC_ADAPTER_number_(
                summary.warning,
                0
            ),

        failures:
            BCC_ADAPTER_number_(
                summary.fail,
                0
            ),

        unknown:
            BCC_ADAPTER_number_(
                summary.unknown,
                0
            ),

        subsystems:
            subsystems.map(
                BCC_ADAPTER_normalizeSubsystem_
            ),

        generatedAt:
            health.generatedAt ||
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* LEAD METRICS */
/* ========================================================================== */

function BCC_ADAPTER_collectLeadMetrics_() {
    let queue = {};

    if (
        typeof LI_getQueueStatus ===
        "function"
    ) {
        try {
            queue =
                LI_getQueueStatus() ||
                {};
        } catch (error) {
            queue = {
                errorMessage:
                    BCC_ADAPTER_errorMessage_(
                        error
                    )
            };
        }
    }

    const total =
        BCC_ADAPTER_number_(
            queue.total,
            0
        );

    const pending =
        BCC_ADAPTER_number_(
            queue.new,
            queue.pending,
            0
        );

    const processed =
        BCC_ADAPTER_number_(
            queue.processed,
            0
        );

    const duplicate =
        BCC_ADAPTER_number_(
            queue.duplicate,
            0
        );

    const rejected =
        BCC_ADAPTER_number_(
            queue.rejected,
            0
        );

    const unassigned =
        BCC_ADAPTER_number_(
            queue.unassigned,
            0
        );

    const errors =
        BCC_ADAPTER_number_(
            queue.error,
            queue.failed,
            0
        );

    return {
        available:
            typeof LI_getQueueStatus ===
            "function",

        status:
            errors > 0
                ? "FAIL"
                : unassigned > 0 ||
                  pending > 100
                    ? "WARNING"
                    : "PASS",

        total,
        pending,
        processed,
        duplicate,
        rejected,
        unassigned,
        errors,

        assignmentMode:
            String(
                queue.assignmentMode ||
                ""
            ),

        raw:
            queue,

        generatedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* ASSIGNMENT METRICS */
/* ========================================================================== */

function BCC_ADAPTER_collectAssignmentMetrics_() {
    let summary = {};
    let mode = "UNKNOWN";

    if (
        typeof AE_getAssignmentSummary ===
        "function"
    ) {
        try {
            summary =
                AE_getAssignmentSummary() ||
                {};
        } catch (error) {
            summary = {
                errorMessage:
                    BCC_ADAPTER_errorMessage_(
                        error
                    )
            };
        }
    }

    if (
        typeof AE_getMode ===
        "function"
    ) {
        try {
            mode =
                String(
                    AE_getMode() ||
                    "UNKNOWN"
                )
                    .trim()
                    .toUpperCase();
        } catch (error) {
            mode =
                "UNKNOWN";
        }
    }

    const assigned =
        BCC_ADAPTER_number_(
            summary.assigned,
            summary.totalAssigned,
            0
        );

    const unassigned =
        BCC_ADAPTER_number_(
            summary.unassigned,
            summary.totalUnassigned,
            0
        );

    const shadow =
        BCC_ADAPTER_number_(
            summary.shadow,
            summary.shadowAssignments,
            0
        );

    const failed =
        BCC_ADAPTER_number_(
            summary.failed,
            summary.errors,
            0
        );

    return {
        available:
            typeof AE_getMode ===
                "function" ||
            typeof AE_getAssignmentSummary ===
                "function",

        status:
            failed > 0
                ? "FAIL"
                : unassigned > 0
                    ? "WARNING"
                    : "PASS",

        mode,
        assigned,
        unassigned,
        shadow,
        failed,

        raw:
            summary,

        generatedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* NOTIFICATION METRICS */
/* ========================================================================== */

function BCC_ADAPTER_collectNotificationMetrics_() {
    let summary = {};

    if (
        typeof NF_getSendEngineStatus ===
        "function"
    ) {
        try {
            summary =
                NF_getSendEngineStatus() ||
                {};
        } catch (error) {
            summary = {
                errorMessage:
                    BCC_ADAPTER_errorMessage_(
                        error
                    )
            };
        }
    } else if (
        typeof MOS5NF_getNotificationRuntimeSummary ===
        "function"
    ) {
        try {
            summary =
                MOS5NF_getNotificationRuntimeSummary() ||
                {};
        } catch (error) {
            summary = {
                errorMessage:
                    BCC_ADAPTER_errorMessage_(
                        error
                    )
            };
        }
    }

    const pending =
        BCC_ADAPTER_number_(
            summary.pending,
            0
        );

    const held =
        BCC_ADAPTER_number_(
            summary.held,
            0
        );

    const processing =
        BCC_ADAPTER_number_(
            summary.processing,
            0
        );

    const sent =
        BCC_ADAPTER_number_(
            summary.sent,
            summary.completed,
            0
        );

    const failed =
        BCC_ADAPTER_number_(
            summary.failed,
            summary.errors,
            0
        );

    return {
        available:
            typeof NF_getSendEngineStatus ===
                "function" ||
            typeof MOS5NF_getNotificationRuntimeSummary ===
                "function",

        status:
            failed > 0
                ? "FAIL"
                : held > 0 ||
                  pending > 100
                    ? "WARNING"
                    : "PASS",

        pending,
        held,
        processing,
        sent,
        failed,

        communicationsOpen:
            summary.communicationsOpen === true,

        triggerInstalled:
            summary.triggerInstalled === true,

        raw:
            summary,

        generatedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* SCHEDULER METRICS */
/* ========================================================================== */

function BCC_ADAPTER_collectSchedulerMetrics_() {
    let summary = {};

    if (
        typeof MOS5SCH_getRuntimeHealthSummary ===
        "function"
    ) {
        try {
            summary =
                MOS5SCH_getRuntimeHealthSummary() ||
                {};
        } catch (error) {
            summary = {
                errorMessage:
                    BCC_ADAPTER_errorMessage_(
                        error
                    )
            };
        }
    } else if (
        typeof MOS5SCH_getSchedulerStatus ===
        "function"
    ) {
        try {
            summary =
                MOS5SCH_getSchedulerStatus() ||
                {};
        } catch (error) {
            summary = {
                errorMessage:
                    BCC_ADAPTER_errorMessage_(
                        error
                    )
            };
        }
    }

    const totalJobs =
        BCC_ADAPTER_number_(
            summary.totalJobs,
            0
        );

    const enabledJobs =
        BCC_ADAPTER_number_(
            summary.enabledJobs,
            0
        );

    const disabledJobs =
        BCC_ADAPTER_number_(
            summary.disabledJobs,
            0
        );

    const overdueJobs =
        BCC_ADAPTER_number_(
            summary.overdueJobs,
            0
        );

    const failedJobs =
        BCC_ADAPTER_number_(
            summary.failedJobs,
            0
        );

    const duplicateTriggers =
        BCC_ADAPTER_number_(
            summary.duplicateTriggers,
            summary.trigger &&
                summary.trigger.duplicateTriggers,
            0
        );

    return {
        available:
            typeof MOS5SCH_getRuntimeHealthSummary ===
                "function" ||
            typeof MOS5SCH_getSchedulerStatus ===
                "function",

        status:
            failedJobs > 0 ||
            duplicateTriggers > 0
                ? "FAIL"
                : overdueJobs > 0
                    ? "WARNING"
                    : "PASS",

        totalJobs,
        enabledJobs,
        disabledJobs,
        overdueJobs,
        failedJobs,
        duplicateTriggers,

        triggerInstalled:
            summary.triggerInstalled === true ||
            Boolean(
                summary.trigger &&
                summary.trigger.installed
            ),

        raw:
            summary,

        generatedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* EVENT METRICS */
/* ========================================================================== */

function BCC_ADAPTER_collectEventMetrics_() {
    let summary = {};

    if (
        typeof MOS5_getEventBusStatus ===
        "function"
    ) {
        try {
            summary =
                MOS5_getEventBusStatus() ||
                {};
        } catch (error) {
            summary = {
                errorMessage:
                    BCC_ADAPTER_errorMessage_(
                        error
                    )
            };
        }
    }

    const pending =
        BCC_ADAPTER_number_(
            summary.pending,
            summary.queued,
            0
        );

    const processing =
        BCC_ADAPTER_number_(
            summary.processing,
            0
        );

    const completed =
        BCC_ADAPTER_number_(
            summary.completed,
            summary.processed,
            0
        );

    const failed =
        BCC_ADAPTER_number_(
            summary.failed,
            summary.errors,
            0
        );

    return {
        available:
            typeof MOS5_getEventBusStatus ===
            "function",

        status:
            failed > 0
                ? "FAIL"
                : pending > 250
                    ? "WARNING"
                    : "PASS",

        pending,
        processing,
        completed,
        failed,

        raw:
            summary,

        generatedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* AGENT METRICS */
/* ========================================================================== */

function BCC_ADAPTER_collectAgentMetrics_() {
    let summary = {};

    if (
        typeof AE_getAgentRosterSyncStatus ===
        "function"
    ) {
        try {
            summary =
                AE_getAgentRosterSyncStatus() ||
                {};
        } catch (error) {
            summary = {
                errorMessage:
                    BCC_ADAPTER_errorMessage_(
                        error
                    )
            };
        }
    } else if (
        typeof AE_getAllAgents ===
        "function"
    ) {
        try {
            const agents =
                AE_getAllAgents() || [];

            summary = {
                totalAgents:
                    agents.length,

                activeAgents:
                    agents.filter(
                        function(agent) {
                            return (
                                agent.Active === true ||
                                String(
                                    agent.Active || ""
                                )
                                    .trim()
                                    .toUpperCase() ===
                                    "TRUE"
                            );
                        }
                    ).length,

                acceptingLeads:
                    agents.filter(
                        function(agent) {
                            return (
                                agent.AcceptingLeads ===
                                    true ||
                                String(
                                    agent.AcceptingLeads ||
                                    ""
                                )
                                    .trim()
                                    .toUpperCase() ===
                                    "TRUE"
                            );
                        }
                    ).length
            };
        } catch (error) {
            summary = {
                errorMessage:
                    BCC_ADAPTER_errorMessage_(
                        error
                    )
            };
        }
    }

    const totalAgents =
        BCC_ADAPTER_number_(
            summary.totalAgents,
            summary.total,
            0
        );

    const activeAgents =
        BCC_ADAPTER_number_(
            summary.activeAgents,
            summary.active,
            0
        );

    const acceptingLeads =
        BCC_ADAPTER_number_(
            summary.acceptingLeads,
            summary.accepting,
            0
        );

    const inactiveAgents =
        Math.max(
            0,
            totalAgents -
            activeAgents
        );

    return {
        available:
            typeof AE_getAgentRosterSyncStatus ===
                "function" ||
            typeof AE_getAllAgents ===
                "function",

        status:
            totalAgents === 0
                ? "UNKNOWN"
                : activeAgents === 0
                    ? "FAIL"
                    : acceptingLeads === 0
                        ? "WARNING"
                        : "PASS",

        totalAgents,
        activeAgents,
        inactiveAgents,
        acceptingLeads,

        raw:
            summary,

        generatedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* END PART 2 */
/* ========================================================================== */
/* ========================================================================== */
/* ALERTS */
/* ========================================================================== */

function BCC_ADAPTER_collectAlerts_() {
    let alerts = [];

    if (
        typeof OPS_allIssues ===
        "function"
    ) {
        try {
            alerts =
                OPS_allIssues() || [];
        } catch (error) {
            alerts = [
                {
                    subsystem:
                        "OPS",

                    severity:
                        "HIGH",

                    code:
                        "ALERT_COLLECTION_FAILED",

                    message:
                        BCC_ADAPTER_errorMessage_(
                            error
                        ),

                    createdAt:
                        new Date()
                            .toISOString()
                }
            ];
        }
    }

    return alerts
        .map(
            BCC_ADAPTER_normalizeAlert_
        )
        .sort(
            function(a, b) {
                return (
                    BCC_ADAPTER_severityWeight_(
                        b.severity
                    ) -
                    BCC_ADAPTER_severityWeight_(
                        a.severity
                    )
                );
            }
        );
}

/* ========================================================================== */
/* EXECUTIVE SUMMARY */
/* ========================================================================== */

function BCC_ADAPTER_buildExecutive_(
    operations,
    alerts
) {
    const source =
        operations || {};

    const issueList =
        Array.isArray(alerts)
            ? alerts
            : [];

    const criticalAlerts =
        issueList.filter(
            function(alert) {
                return (
                    String(
                        alert.severity || ""
                    )
                        .trim()
                        .toUpperCase() ===
                    "CRITICAL"
                );
            }
        ).length;

    const highAlerts =
        issueList.filter(
            function(alert) {
                const severity =
                    String(
                        alert.severity || ""
                    )
                        .trim()
                        .toUpperCase();

                return (
                    severity === "HIGH" ||
                    severity === "FAIL"
                );
            }
        ).length;

    let status =
        String(
            source.status ||
            "UNKNOWN"
        )
            .trim()
            .toUpperCase();

    if (criticalAlerts > 0) {
        status = "FAIL";
    } else if (
        highAlerts > 0 &&
        status === "PASS"
    ) {
        status = "WARNING";
    }

    return {
        status,

        healthy:
            status === "PASS",

        score:
            BCC_ADAPTER_number_(
                source.score,
                0
            ),

        alertCount:
            issueList.length,

        criticalAlerts,
        highAlerts,

        summary:
            BCC_ADAPTER_executiveMessage_(
                status,
                source,
                issueList.length
            ),

        generatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* SUBSYSTEM NORMALIZATION */
/* ========================================================================== */

function BCC_ADAPTER_normalizeSubsystem_(
    subsystem
) {
    const source =
        subsystem || {};

    return {
        id:
            String(
                source.id ||
                source.subsystemId ||
                ""
            ),

        name:
            String(
                source.name ||
                source.label ||
                source.id ||
                "Unknown Subsystem"
            ),

        category:
            String(
                source.category ||
                "OTHER"
            )
                .trim()
                .toUpperCase(),

        status:
            String(
                source.status ||
                "UNKNOWN"
            )
                .trim()
                .toUpperCase(),

        severity:
            String(
                source.severity ||
                "INFO"
            )
                .trim()
                .toUpperCase(),

        score:
            BCC_ADAPTER_clamp_(
                BCC_ADAPTER_number_(
                    source.score,
                    0
                ),
                0,
                100
            ),

        issueCount:
            Array.isArray(
                source.issues
            )
                ? source.issues.length
                : 0,

        issues:
            Array.isArray(
                source.issues
            )
                ? source.issues.map(
                    BCC_ADAPTER_normalizeAlert_
                )
                : [],

        metadata:
            source.metadata || {},

        updatedAt:
            source.updatedAt || ""
    };
}

/* ========================================================================== */
/* ALERT NORMALIZATION */
/* ========================================================================== */

function BCC_ADAPTER_normalizeAlert_(
    alert
) {
    const source =
        alert || {};

    return {
        subsystem:
            String(
                source.subsystem ||
                source.system ||
                source.id ||
                "SYSTEM"
            ),

        severity:
            String(
                source.severity ||
                "INFO"
            )
                .trim()
                .toUpperCase(),

        code:
            String(
                source.code ||
                "GENERAL"
            ),

        message:
            String(
                source.message ||
                source.details ||
                ""
            ),

        createdAt:
            source.createdAt ||
            source.updatedAt ||
            ""
    };
}

/* ========================================================================== */
/* STABLE DASHBOARD CONTRACT */
/* ========================================================================== */

function BCC_ADAPTER_getContractVersion() {
    return {
        release:
            "BCC-03-DASHBOARD-DATA-ADAPTER",

        version:
            BCC_DATA_ADAPTER_VERSION,

        contract:
            "BCC_DASHBOARD_V1"
    };
}

function BCC_ADAPTER_exportJson() {
    return JSON.stringify(
        BCC_getNormalizedDashboardData(),
        null,
        2
    );
}

/* ========================================================================== */
/* EXECUTIVE MESSAGE */
/* ========================================================================== */

function BCC_ADAPTER_executiveMessage_(
    status,
    operations,
    alertCount
) {
    const normalized =
        String(status || "UNKNOWN")
            .trim()
            .toUpperCase();

    if (normalized === "FAIL") {
        return (
            "MelroseOS requires immediate attention. " +
            String(alertCount || 0) +
            " operational alert(s) are registered."
        );
    }

    if (normalized === "WARNING") {
        return (
            "MelroseOS is operational with conditions requiring review. " +
            String(alertCount || 0) +
            " alert(s) are registered."
        );
    }

    if (normalized === "PASS") {
        return (
            "MelroseOS is operating normally across " +
            String(
                operations &&
                operations.subsystemCount ||
                0
            ) +
            " registered subsystem(s)."
        );
    }

    return (
        "MelroseOS health data is currently incomplete or unavailable."
    );
}

/* ========================================================================== */
/* HELPERS */
/* ========================================================================== */

function BCC_ADAPTER_number_() {
    const values =
        Array.prototype.slice.call(
            arguments
        );

    for (
        let index = 0;
        index < values.length;
        index += 1
    ) {
        const number =
            Number(values[index]);

        if (
            Number.isFinite(number)
        ) {
            return number;
        }
    }

    return 0;
}

function BCC_ADAPTER_clamp_(
    value,
    minimum,
    maximum
) {
    return Math.min(
        Number(maximum),
        Math.max(
            Number(minimum),
            Number(value || 0)
        )
    );
}

function BCC_ADAPTER_errorMessage_(
    error
) {
    return String(
        error &&
        error.message
            ? error.message
            : error
    );
}

function BCC_ADAPTER_severityWeight_(
    severity
) {
    const weights = {
        CRITICAL: 500,
        HIGH: 400,
        FAIL: 400,
        MEDIUM: 300,
        WARNING: 300,
        LOW: 200,
        INFO: 100,
        PASS: 0
    };

    return Number(
        weights[
            String(
                severity || "INFO"
            )
                .trim()
                .toUpperCase()
        ] || 0
    );
}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function BCC_ADAPTER_runDiagnostics() {
    const requiredFunctions = [
        "OPS_exportHealth",
        "LI_getQueueStatus",
        "AE_getMode"
    ];

    const tests =
        requiredFunctions.map(
            function(functionName) {
                return {
                    code:
                        functionName,

                    status:
                        typeof globalThis[
                            functionName
                        ] === "function"
                            ? "PASS"
                            : "WARNING"
                };
            }
        );

    let contractStatus =
        "PASS";

    let contractError =
        "";

    try {
        const payload =
            BCC_getNormalizedDashboardData();

        if (
            !payload ||
            !payload.executive ||
            !payload.operations ||
            !payload.leads ||
            !payload.assignments ||
            !payload.notifications ||
            !payload.scheduler ||
            !payload.events ||
            !payload.agents ||
            !Array.isArray(
                payload.alerts
            )
        ) {
            contractStatus =
                "FAIL";

            contractError =
                "Dashboard contract is incomplete.";
        }
    } catch (error) {
        contractStatus =
            "FAIL";

        contractError =
            BCC_ADAPTER_errorMessage_(
                error
            );
    }

    tests.push({
        code:
            "DASHBOARD_CONTRACT",

        status:
            contractStatus,

        details:
            contractError
    });

    const failed =
        tests.filter(
            function(test) {
                return (
                    test.status === "FAIL"
                );
            }
        ).length;

    const warnings =
        tests.filter(
            function(test) {
                return (
                    test.status ===
                    "WARNING"
                );
            }
        ).length;

    return {
        release:
            "BCC-03-DASHBOARD-DATA-ADAPTER",

        version:
            BCC_DATA_ADAPTER_VERSION,

        overallStatus:
            failed > 0
                ? "FAIL"
                : warnings > 0
                    ? "WARNING"
                    : "PASS",

        passed:
            tests.length -
            failed -
            warnings,

        warnings,
        failed,
        tests,

        productionChanged:
            false,

        completedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* SELF TEST */
/* ========================================================================== */

function BCC_ADAPTER_selfTest() {
    const diagnostics =
        BCC_ADAPTER_runDiagnostics();

    if (
        diagnostics.failed > 0
    ) {
        throw new Error(
            "BCC Dashboard Data Adapter diagnostics failed."
        );
    }

    return {
        success: true,

        release:
            "BCC-03-DASHBOARD-DATA-ADAPTER",

        version:
            BCC_DATA_ADAPTER_VERSION,

        diagnostics,

        payload:
            BCC_getNormalizedDashboardData()
    };
}

/* ========================================================================== */
/* END OF FILE */
/* ========================================================================== */