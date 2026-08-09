/******************************************************************************
 * MelroseOS Enterprise
 * Project : Broker Command Center
 * File    : BCC-04_EnterpriseIntegration.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Integrates OPS, EDU, VERIFY, CRM, Scheduler, Notifications, and repository
 *   readiness data into one Broker Command Center enterprise payload.
 *
 * Safety:
 *   - Read-only.
 *   - Does not install triggers.
 *   - Does not send communications.
 *   - Does not alter CRM routing or agent eligibility.
 ******************************************************************************/

const BCC_ENTERPRISE_INTEGRATION_VERSION =
    "1.0.0";

/* ========================================================================== */
/* ENTERPRISE DASHBOARD */
/* ========================================================================== */

function BCC_getEnterpriseDashboard() {
    const sections = {
        operations:
            BCC_ENTERPRISE_collectOperations_(),

        education:
            BCC_ENTERPRISE_collectEducation_(),

        verification:
            BCC_ENTERPRISE_collectVerification_(),

        crm:
            BCC_ENTERPRISE_collectCrm_(),

        scheduler:
            BCC_ENTERPRISE_collectScheduler_(),

        notifications:
            BCC_ENTERPRISE_collectNotifications_(),

        repository:
            BCC_ENTERPRISE_collectRepository_()
    };

    const alerts =
        BCC_ENTERPRISE_buildAlerts_(
            sections
        );

    return {
        release:
            "BCC-04-ENTERPRISE-INTEGRATION",

        version:
            BCC_ENTERPRISE_INTEGRATION_VERSION,

        executive:
            BCC_ENTERPRISE_buildExecutive_(
                sections,
                alerts
            ),

        sections:
            sections,

        alerts:
            alerts,

        generatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* OPERATIONS */
/* ========================================================================== */

function BCC_ENTERPRISE_collectOperations_() {
    try {
        if (
            typeof OPS_refreshEnterpriseHealth ===
            "function"
        ) {
            return BCC_ENTERPRISE_normalizeSection_(
                "OPS",
                "Enterprise Operations",
                OPS_refreshEnterpriseHealth()
            );
        }

        if (
            typeof OPS_exportHealth ===
            "function"
        ) {
            return BCC_ENTERPRISE_normalizeSection_(
                "OPS",
                "Enterprise Operations",
                OPS_exportHealth()
            );
        }

        return BCC_ENTERPRISE_unavailable_(
            "OPS",
            "Enterprise Operations",
            "OPS health API is unavailable."
        );
    } catch (error) {
        return BCC_ENTERPRISE_errorSection_(
            "OPS",
            "Enterprise Operations",
            error
        );
    }
}

/* ========================================================================== */
/* EDUCATION */
/* ========================================================================== */

function BCC_ENTERPRISE_collectEducation_() {
    try {
        let payload = {};

        if (
            typeof EDU_getBrokerPayload ===
            "function"
        ) {
            payload =
                EDU_getBrokerPayload() ||
                {};
        }

        const snapshot =
            typeof EDU_getEducationSnapshotSummary ===
            "function"
                ? EDU_getEducationSnapshotSummary()
                : {};

        const runtime =
            typeof EDU_getRuntimeHealth ===
            "function"
                ? EDU_getRuntimeHealth()
                : {};

        const status =
            BCC_ENTERPRISE_status_(
                runtime.status ||
                payload.status ||
                (
                    Number(
                        snapshot.critical || 0
                    ) > 0
                        ? "FAIL"
                        : Number(
                            snapshot.warning || 0
                        ) > 0
                            ? "WARNING"
                            : Number(
                                snapshot.total || 0
                            ) > 0
                                ? "PASS"
                                : "UNKNOWN"
                )
            );

        return {
            id:
                "EDU",

            title:
                "Education & License Compliance",

            available:
                typeof EDU_getEducationSnapshotSummary ===
                    "function" ||
                typeof EDU_getBrokerPayload ===
                    "function",

            status:
                status,

            score:
                BCC_ENTERPRISE_scoreFromStatus_(
                    status
                ),

            metrics: {
                totalAgents:
                    BCC_ENTERPRISE_number_(
                        snapshot.total,
                        runtime.totalAgents,
                        0
                    ),

                pass:
                    BCC_ENTERPRISE_number_(
                        snapshot.pass,
                        0
                    ),

                warning:
                    BCC_ENTERPRISE_number_(
                        snapshot.warning,
                        0
                    ),

                critical:
                    BCC_ENTERPRISE_number_(
                        snapshot.critical,
                        0
                    ),

                unknown:
                    BCC_ENTERPRISE_number_(
                        snapshot.unknown,
                        0
                    ),

                hoursRequired:
                    BCC_ENTERPRISE_number_(
                        snapshot.hoursRequired,
                        0
                    ),

                hoursCompleted:
                    BCC_ENTERPRISE_number_(
                        snapshot.hoursCompleted,
                        0
                    ),

                hoursRemaining:
                    BCC_ENTERPRISE_number_(
                        snapshot.hoursRemaining,
                        0
                    )
            },

            payload:
                payload,

            runtime:
                runtime,

            generatedAt:
                new Date()
                    .toISOString()
        };
    } catch (error) {
        return BCC_ENTERPRISE_errorSection_(
            "EDU",
            "Education & License Compliance",
            error
        );
    }
}

/* ========================================================================== */
/* VERIFICATION */
/* ========================================================================== */

function BCC_ENTERPRISE_collectVerification_() {
    try {
        const payload =
            typeof VERIFY_getBrokerPayload ===
            "function"
                ? VERIFY_getBrokerPayload() || {}
                : {};

        const summary =
            typeof VERIFY_getVerificationSummary ===
            "function"
                ? VERIFY_getVerificationSummary() || {}
                : {};

        const runtime =
            typeof VERIFY_getRuntimeHealth ===
            "function"
                ? VERIFY_getRuntimeHealth() || {}
                : {};

        const status =
            BCC_ENTERPRISE_status_(
                runtime.status ||
                payload.status ||
                (
                    Number(
                        summary.failed || 0
                    ) > 0
                        ? "FAIL"
                        : Number(
                            summary.pending || 0
                        ) > 0
                            ? "WARNING"
                            : Number(
                                summary.results || 0
                            ) > 0
                                ? "PASS"
                                : "UNKNOWN"
                )
            );

        return {
            id:
                "VERIFY",

            title:
                "Enterprise Verification",

            available:
                typeof VERIFY_getVerificationSummary ===
                    "function" ||
                typeof VERIFY_getBrokerPayload ===
                    "function",

            status:
                status,

            score:
                BCC_ENTERPRISE_number_(
                    runtime.score,
                    BCC_ENTERPRISE_scoreFromStatus_(
                        status
                    )
                ),

            metrics: {
                subjects:
                    BCC_ENTERPRISE_number_(
                        summary.subjects,
                        0
                    ),

                requests:
                    BCC_ENTERPRISE_number_(
                        summary.requests,
                        0
                    ),

                pending:
                    BCC_ENTERPRISE_number_(
                        summary.pending,
                        0
                    ),

                results:
                    BCC_ENTERPRISE_number_(
                        summary.results,
                        0
                    ),

                passed:
                    BCC_ENTERPRISE_number_(
                        summary.passed,
                        0
                    ),

                warnings:
                    BCC_ENTERPRISE_number_(
                        summary.warnings,
                        0
                    ),

                failed:
                    BCC_ENTERPRISE_number_(
                        summary.failed,
                        0
                    ),

                overrides:
                    BCC_ENTERPRISE_number_(
                        summary.overrides,
                        0
                    )
            },

            payload:
                payload,

            runtime:
                runtime,

            generatedAt:
                new Date()
                    .toISOString()
        };
    } catch (error) {
        return BCC_ENTERPRISE_errorSection_(
            "VERIFY",
            "Enterprise Verification",
            error
        );
    }
}

/* ========================================================================== */
/* CRM */
/* ========================================================================== */

function BCC_ENTERPRISE_collectCrm_() {
    try {
        let leads = {};
        let assignments = {};
        let agents = {};

        if (
            typeof LI_getQueueStatus ===
            "function"
        ) {
            leads =
                LI_getQueueStatus() ||
                {};
        }

        if (
            typeof AE_getAssignmentSummary ===
            "function"
        ) {
            assignments =
                AE_getAssignmentSummary() ||
                {};
        }

        if (
            typeof AE_getAgentRosterSyncStatus ===
            "function"
        ) {
            agents =
                AE_getAgentRosterSyncStatus() ||
                {};
        }

        const leadErrors =
            BCC_ENTERPRISE_number_(
                leads.error,
                leads.failed,
                0
            );

        const unassigned =
            BCC_ENTERPRISE_number_(
                leads.unassigned,
                assignments.unassigned,
                0
            );

        const status =
            leadErrors > 0
                ? "FAIL"
                : unassigned > 0
                    ? "WARNING"
                    : (
                        typeof LI_getQueueStatus ===
                            "function" ||
                        typeof AE_getMode ===
                            "function"
                    )
                        ? "PASS"
                        : "UNKNOWN";

        return {
            id:
                "CRM",

            title:
                "Enterprise CRM",

            available:
                typeof LI_getQueueStatus ===
                    "function" ||
                typeof AE_getMode ===
                    "function",

            status:
                status,

            score:
                BCC_ENTERPRISE_scoreFromStatus_(
                    status
                ),

            metrics: {
                leads:
                    BCC_ENTERPRISE_number_(
                        leads.total,
                        0
                    ),

                pending:
                    BCC_ENTERPRISE_number_(
                        leads.pending,
                        leads.new,
                        0
                    ),

                processed:
                    BCC_ENTERPRISE_number_(
                        leads.processed,
                        0
                    ),

                unassigned:
                    unassigned,

                errors:
                    leadErrors,

                assigned:
                    BCC_ENTERPRISE_number_(
                        assignments.assigned,
                        assignments.totalAssigned,
                        0
                    ),

                activeAgents:
                    BCC_ENTERPRISE_number_(
                        agents.activeAgents,
                        agents.active,
                        0
                    ),

                acceptingLeads:
                    BCC_ENTERPRISE_number_(
                        agents.acceptingLeads,
                        agents.accepting,
                        0
                    )
            },

            leads:
                leads,

            assignments:
                assignments,

            agents:
                agents,

            generatedAt:
                new Date()
                    .toISOString()
        };
    } catch (error) {
        return BCC_ENTERPRISE_errorSection_(
            "CRM",
            "Enterprise CRM",
            error
        );
    }
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* SCHEDULER */
/* ========================================================================== */

function BCC_ENTERPRISE_collectScheduler_() {
    try {
        let payload = {};

        if (
            typeof MOS5SCH_getRuntimeHealthSummary ===
            "function"
        ) {
            payload =
                MOS5SCH_getRuntimeHealthSummary() ||
                {};
        } else if (
            typeof MOS5SCH_getSchedulerStatus ===
            "function"
        ) {
            payload =
                MOS5SCH_getSchedulerStatus() ||
                {};
        }

        const failedJobs =
            BCC_ENTERPRISE_number_(
                payload.failedJobs,
                payload.failed,
                0
            );

        const overdueJobs =
            BCC_ENTERPRISE_number_(
                payload.overdueJobs,
                payload.overdue,
                0
            );

        const duplicateTriggers =
            BCC_ENTERPRISE_number_(
                payload.duplicateTriggers,
                payload.trigger &&
                    payload.trigger
                        .duplicateTriggers,
                0
            );

        const available =
            typeof MOS5SCH_getRuntimeHealthSummary ===
                "function" ||
            typeof MOS5SCH_getSchedulerStatus ===
                "function";

        const status =
            !available
                ? "UNKNOWN"
                : failedJobs > 0 ||
                  duplicateTriggers > 0
                    ? "FAIL"
                    : overdueJobs > 0
                        ? "WARNING"
                        : "PASS";

        return {
            id:
                "SCH",

            title:
                "Enterprise Scheduler",

            available:
                available,

            status:
                status,

            score:
                BCC_ENTERPRISE_scoreFromStatus_(
                    status
                ),

            metrics: {
                totalJobs:
                    BCC_ENTERPRISE_number_(
                        payload.totalJobs,
                        0
                    ),

                enabledJobs:
                    BCC_ENTERPRISE_number_(
                        payload.enabledJobs,
                        0
                    ),

                disabledJobs:
                    BCC_ENTERPRISE_number_(
                        payload.disabledJobs,
                        0
                    ),

                overdueJobs:
                    overdueJobs,

                failedJobs:
                    failedJobs,

                duplicateTriggers:
                    duplicateTriggers
            },

            payload:
                payload,

            generatedAt:
                new Date()
                    .toISOString()
        };
    } catch (error) {
        return BCC_ENTERPRISE_errorSection_(
            "SCH",
            "Enterprise Scheduler",
            error
        );
    }
}

/* ========================================================================== */
/* NOTIFICATIONS */
/* ========================================================================== */

function BCC_ENTERPRISE_collectNotifications_() {
    try {
        let payload = {};

        if (
            typeof NF_getSendEngineStatus ===
            "function"
        ) {
            payload =
                NF_getSendEngineStatus() ||
                {};
        } else if (
            typeof MOS5NF_getNotificationRuntimeSummary ===
            "function"
        ) {
            payload =
                MOS5NF_getNotificationRuntimeSummary() ||
                {};
        }

        const failed =
            BCC_ENTERPRISE_number_(
                payload.failed,
                payload.errors,
                0
            );

        const held =
            BCC_ENTERPRISE_number_(
                payload.held,
                0
            );

        const pending =
            BCC_ENTERPRISE_number_(
                payload.pending,
                payload.queued,
                0
            );

        const available =
            typeof NF_getSendEngineStatus ===
                "function" ||
            typeof MOS5NF_getNotificationRuntimeSummary ===
                "function";

        const status =
            !available
                ? "UNKNOWN"
                : failed > 0
                    ? "FAIL"
                    : held > 0 ||
                      pending > 100
                        ? "WARNING"
                        : "PASS";

        return {
            id:
                "NF",

            title:
                "Enterprise Notifications",

            available:
                available,

            status:
                status,

            score:
                BCC_ENTERPRISE_scoreFromStatus_(
                    status
                ),

            metrics: {
                pending:
                    pending,

                held:
                    held,

                processing:
                    BCC_ENTERPRISE_number_(
                        payload.processing,
                        0
                    ),

                sent:
                    BCC_ENTERPRISE_number_(
                        payload.sent,
                        payload.completed,
                        0
                    ),

                failed:
                    failed
            },

            communicationsOpen:
                payload
                    .communicationsOpen ===
                true,

            triggerInstalled:
                payload
                    .triggerInstalled ===
                true,

            payload:
                payload,

            generatedAt:
                new Date()
                    .toISOString()
        };
    } catch (error) {
        return BCC_ENTERPRISE_errorSection_(
            "NF",
            "Enterprise Notifications",
            error
        );
    }
}

/* ========================================================================== */
/* REPOSITORY */
/* ========================================================================== */

function BCC_ENTERPRISE_collectRepository_() {
    const system =
        typeof BCC_getSystemStatus ===
        "function"
            ? BCC_getSystemStatus()
            : {};

    return {
        id:
            "REPOSITORY",

        title:
            "Repository & Production Readiness",

        available:
            true,

        status:
            system.productionReady ===
                true
                ? "PASS"
                : "UNKNOWN",

        score:
            system.productionReady ===
                true
                ? 100
                : 0,

        metrics: {
            productionReady:
                system.productionReady ===
                true,

            initialized:
                system.initialized ===
                true,

            version:
                String(
                    system.version ||
                    ""
                )
        },

        payload:
            system,

        generatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* ALERT GENERATION */
/* ========================================================================== */

function BCC_ENTERPRISE_buildAlerts_(
    sections
) {
    const alerts = [];

    Object.keys(
        sections || {}
    ).forEach(function(key) {
        const section =
            sections[key] || {};

        const status =
            BCC_ENTERPRISE_status_(
                section.status
            );

        if (
            status === "FAIL"
        ) {
            alerts.push({
                subsystem:
                    section.id ||
                    key.toUpperCase(),

                severity:
                    "CRITICAL",

                code:
                    "SUBSYSTEM_FAILURE",

                message:
                    section.title +
                    " is reporting a failure condition.",

                createdAt:
                    new Date()
                        .toISOString()
            });
        } else if (
            status === "WARNING"
        ) {
            alerts.push({
                subsystem:
                    section.id ||
                    key.toUpperCase(),

                severity:
                    "WARNING",

                code:
                    "SUBSYSTEM_WARNING",

                message:
                    section.title +
                    " requires broker review.",

                createdAt:
                    new Date()
                        .toISOString()
            });
        } else if (
            status === "UNKNOWN" ||
            section.available === false
        ) {
            alerts.push({
                subsystem:
                    section.id ||
                    key.toUpperCase(),

                severity:
                    "INFO",

                code:
                    "SUBSYSTEM_UNAVAILABLE",

                message:
                    section.title +
                    " data is unavailable or incomplete.",

                createdAt:
                    new Date()
                        .toISOString()
            });
        }
    });

    return alerts.sort(
        function(a, b) {
            return (
                BCC_ENTERPRISE_alertWeight_(
                    b.severity
                ) -
                BCC_ENTERPRISE_alertWeight_(
                    a.severity
                )
            );
        }
    );
}

/* ========================================================================== */
/* EXECUTIVE SUMMARY */
/* ========================================================================== */

function BCC_ENTERPRISE_buildExecutive_(
    sections,
    alerts
) {
    const values =
        Object.keys(
            sections || {}
        ).map(function(key) {
            return sections[key];
        });

    const available =
        values.filter(
            function(section) {
                return (
                    section.available !==
                    false
                );
            }
        );

    const failures =
        values.filter(
            function(section) {
                return (
                    BCC_ENTERPRISE_status_(
                        section.status
                    ) === "FAIL"
                );
            }
        ).length;

    const warnings =
        values.filter(
            function(section) {
                return (
                    BCC_ENTERPRISE_status_(
                        section.status
                    ) === "WARNING"
                );
            }
        ).length;

    const unknown =
        values.filter(
            function(section) {
                return (
                    BCC_ENTERPRISE_status_(
                        section.status
                    ) === "UNKNOWN"
                );
            }
        ).length;

    const status =
        failures > 0
            ? "FAIL"
            : warnings > 0
                ? "WARNING"
                : unknown > 0
                    ? "UNKNOWN"
                    : "PASS";

    const scored =
        available.filter(
            function(section) {
                return (
                    Number.isFinite(
                        Number(
                            section.score
                        )
                    )
                );
            }
        );

    const score =
        scored.length
            ? Math.round(
                scored.reduce(
                    function(
                        total,
                        section
                    ) {
                        return (
                            total +
                            Number(
                                section.score ||
                                0
                            )
                        );
                    },
                    0
                ) /
                scored.length
            )
            : 0;

    return {
        status:
            status,

        healthy:
            status === "PASS",

        score:
            score,

        totalSections:
            values.length,

        availableSections:
            available.length,

        passing:
            values.filter(
                function(section) {
                    return (
                        BCC_ENTERPRISE_status_(
                            section.status
                        ) === "PASS"
                    );
                }
            ).length,

        warnings:
            warnings,

        failures:
            failures,

        unknown:
            unknown,

        alertCount:
            Array.isArray(alerts)
                ? alerts.length
                : 0,

        message:
            BCC_ENTERPRISE_executiveMessage_(
                status,
                failures,
                warnings,
                unknown
            ),

        generatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* SECTION NORMALIZATION */
/* ========================================================================== */

function BCC_ENTERPRISE_normalizeSection_(
    id,
    title,
    payload
) {
    const source =
        payload || {};

    const summary =
        source.summary || {};

    const status =
        BCC_ENTERPRISE_status_(
            source.status ||
            source.overallStatus ||
            summary.overallStatus ||
            (
                source.healthy === true
                    ? "PASS"
                    : "UNKNOWN"
            )
        );

    return {
        id:
            id,

        title:
            title,

        available:
            true,

        status:
            status,

        score:
            BCC_ENTERPRISE_number_(
                source.score,
                summary.averageScore,
                BCC_ENTERPRISE_scoreFromStatus_(
                    status
                )
            ),

        metrics: {
            total:
                BCC_ENTERPRISE_number_(
                    summary.total,
                    source.subsystemCount,
                    0
                ),

            pass:
                BCC_ENTERPRISE_number_(
                    summary.pass,
                    0
                ),

            warning:
                BCC_ENTERPRISE_number_(
                    summary.warning,
                    0
                ),

            fail:
                BCC_ENTERPRISE_number_(
                    summary.fail,
                    0
                ),

            unknown:
                BCC_ENTERPRISE_number_(
                    summary.unknown,
                    0
                )
        },

        payload:
            source,

        generatedAt:
            source.generatedAt ||
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* ERROR AND UNAVAILABLE SECTIONS */
/* ========================================================================== */

function BCC_ENTERPRISE_unavailable_(
    id,
    title,
    details
) {
    return {
        id:
            id,

        title:
            title,

        available:
            false,

        status:
            "UNKNOWN",

        score:
            0,

        metrics:
            {},

        details:
            String(
                details || ""
            ),

        generatedAt:
            new Date()
                .toISOString()
    };
}

function BCC_ENTERPRISE_errorSection_(
    id,
    title,
    error
) {
    return {
        id:
            id,

        title:
            title,

        available:
            true,

        status:
            "FAIL",

        score:
            0,

        metrics:
            {},

        error:
            BCC_ENTERPRISE_errorMessage_(
                error
            ),

        generatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* END PART 2 */
/* ========================================================================== */
/* ========================================================================== */
/* PUBLIC API */
/* ========================================================================== */

function BCC_getEnterpriseIntegrationPayload() {
    return BCC_getEnterpriseDashboard();
}

function BCC_getEnterpriseSection(
    sectionName
) {
    const dashboard =
        BCC_getEnterpriseDashboard();

    const key =
        String(
            sectionName || ""
        )
            .trim()
            .toLowerCase();

    return (
        dashboard.sections[
            key
        ] || null
    );
}

function BCC_getEnterpriseAlerts() {
    return BCC_getEnterpriseDashboard()
        .alerts;
}

function BCC_getEnterpriseExecutiveSummary() {
    return BCC_getEnterpriseDashboard()
        .executive;
}

/* ========================================================================== */
/* DASHBOARD CONTRACT COMPATIBILITY */
/* ========================================================================== */

function BCC_buildEnterpriseDashboardPayload() {
    const enterprise =
        BCC_getEnterpriseDashboard();

    const legacy =
        typeof BCC_buildDashboardPayload ===
            "function"
            ? BCC_buildDashboardPayload()
            : {};

    return {
        release:
            enterprise.release,

        version:
            enterprise.version,

        executive:
            enterprise.executive,

        metrics: {
            enterpriseScore:
                enterprise
                    .executive
                    .score,

            overallStatus:
                enterprise
                    .executive
                    .status,

            subsystemCount:
                enterprise
                    .executive
                    .totalSections,

            passing:
                enterprise
                    .executive
                    .passing,

            warnings:
                enterprise
                    .executive
                    .warnings,

            failures:
                enterprise
                    .executive
                    .failures,

            unknown:
                enterprise
                    .executive
                    .unknown
        },

        systems:
            BCC_ENTERPRISE_buildLegacySystems_(
                enterprise.sections,
                legacy.systems || {}
            ),

        sections:
            enterprise.sections,

        alerts:
            enterprise.alerts,

        legacy:
            legacy,

        generatedAt:
            enterprise.generatedAt
    };
}

/* ========================================================================== */
/* LEGACY SYSTEM MAPPING */
/* ========================================================================== */

function BCC_ENTERPRISE_buildLegacySystems_(
    sections,
    fallbackSystems
) {
    const source =
        sections || {};

    const fallback =
        fallbackSystems || {};

    return {
        scheduler:
            BCC_ENTERPRISE_toLegacySystem_(
                source.scheduler,
                fallback.scheduler,
                "SCH"
            ),

        notifications:
            BCC_ENTERPRISE_toLegacySystem_(
                source.notifications,
                fallback.notifications,
                "NF"
            ),

        eventBus:
            fallback.eventBus || {
                id:
                    "EB",

                status:
                    "UNKNOWN",

                score:
                    0
            },

        assignment:
            BCC_ENTERPRISE_toLegacySystem_(
                source.crm,
                fallback.assignment,
                "AE"
            ),

        leadIntake:
            BCC_ENTERPRISE_toLegacySystem_(
                source.crm,
                fallback.leadIntake,
                "LI"
            ),

        runtime:
            BCC_ENTERPRISE_toLegacySystem_(
                source.operations,
                fallback.runtime,
                "RT"
            ),

        education:
            BCC_ENTERPRISE_toLegacySystem_(
                source.education,
                fallback.education,
                "EDU"
            ),

        verification:
            BCC_ENTERPRISE_toLegacySystem_(
                source.verification,
                fallback.verification,
                "VERIFY"
            )
    };
}

function BCC_ENTERPRISE_toLegacySystem_(
    section,
    fallback,
    id
) {
    const source =
        section || fallback || {};

    return {
        id:
            source.id ||
            id,

        name:
            source.title ||
            source.name ||
            id,

        status:
            BCC_ENTERPRISE_status_(
                source.status
            ),

        score:
            BCC_ENTERPRISE_number_(
                source.score,
                0
            ),

        severity:
            BCC_ENTERPRISE_severityFromStatus_(
                source.status
            ),

        metadata:
            source.metrics ||
            source.metadata ||
            {},

        updatedAt:
            source.generatedAt ||
            source.updatedAt ||
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* EXECUTIVE MESSAGE */
/* ========================================================================== */

function BCC_ENTERPRISE_executiveMessage_(
    status,
    failures,
    warnings,
    unknown
) {
    const normalized =
        BCC_ENTERPRISE_status_(
            status
        );

    if (
        normalized === "FAIL"
    ) {
        return (
            "MelroseOS requires immediate broker attention. " +
            String(
                failures || 0
            ) +
            " enterprise section(s) are reporting failure conditions."
        );
    }

    if (
        normalized === "WARNING"
    ) {
        return (
            "MelroseOS is operational with conditions requiring review. " +
            String(
                warnings || 0
            ) +
            " section(s) are reporting warnings."
        );
    }

    if (
        normalized === "UNKNOWN"
    ) {
        return (
            "MelroseOS is running, but " +
            String(
                unknown || 0
            ) +
            " enterprise section(s) have incomplete or unavailable data."
        );
    }

    return (
        "MelroseOS enterprise services are operating normally."
    );
}

/* ========================================================================== */
/* NORMALIZATION HELPERS */
/* ========================================================================== */

function BCC_ENTERPRISE_status_(
    value
) {
    const status =
        String(
            value || "UNKNOWN"
        )
            .trim()
            .toUpperCase();

    switch (status) {
        case "PASS":
        case "WARNING":
        case "FAIL":
        case "UNKNOWN":
            return status;

        case "CRITICAL":
        case "ERROR":
        case "FAILED":
            return "FAIL";

        case "WARN":
        case "PENDING":
            return "WARNING";

        default:
            return "UNKNOWN";
    }
}

function BCC_ENTERPRISE_scoreFromStatus_(
    status
) {
    switch (
        BCC_ENTERPRISE_status_(
            status
        )
    ) {
        case "PASS":
            return 100;

        case "WARNING":
            return 75;

        case "FAIL":
            return 0;

        default:
            return 50;
    }
}

function BCC_ENTERPRISE_severityFromStatus_(
    status
) {
    switch (
        BCC_ENTERPRISE_status_(
            status
        )
    ) {
        case "FAIL":
            return "CRITICAL";

        case "WARNING":
            return "MEDIUM";

        case "PASS":
            return "INFO";

        default:
            return "LOW";
    }
}

function BCC_ENTERPRISE_number_() {
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
            Number(
                values[index]
            );

        if (
            Number.isFinite(
                number
            )
        ) {
            return number;
        }
    }

    return 0;
}

function BCC_ENTERPRISE_alertWeight_(
    severity
) {
    const weights = {
        CRITICAL:
            500,

        HIGH:
            400,

        FAIL:
            400,

        WARNING:
            300,

        MEDIUM:
            300,

        LOW:
            200,

        INFO:
            100
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

function BCC_ENTERPRISE_errorMessage_(
    error
) {
    return String(
        error &&
        error.message
            ? error.message
            : error ||
            "Unknown enterprise integration error."
    );
}

/* ========================================================================== */
/* RUNTIME HEALTH */
/* ========================================================================== */

function BCC_getEnterpriseRuntimeHealth() {
    const dashboard =
        BCC_getEnterpriseDashboard();

    return {
        subsystem:
            "BCC",

        subsystemName:
            "Broker Command Center Enterprise Integration",

        release:
            "BCC-04-ENTERPRISE-INTEGRATION",

        version:
            BCC_ENTERPRISE_INTEGRATION_VERSION,

        status:
            dashboard
                .executive
                .status,

        healthy:
            dashboard
                .executive
                .healthy,

        score:
            dashboard
                .executive
                .score,

        sections:
            dashboard
                .executive
                .totalSections,

        alerts:
            dashboard
                .executive
                .alertCount,

        generatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function BCC_runEnterpriseIntegrationDiagnostics() {
    const requiredFunctions = [
        "BCC_getEnterpriseDashboard",
        "BCC_ENTERPRISE_collectOperations_",
        "BCC_ENTERPRISE_collectEducation_",
        "BCC_ENTERPRISE_collectVerification_",
        "BCC_ENTERPRISE_collectCrm_",
        "BCC_ENTERPRISE_collectScheduler_",
        "BCC_ENTERPRISE_collectNotifications_",
        "BCC_ENTERPRISE_collectRepository_"
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
                        ] ===
                        "function"
                            ? "PASS"
                            : "FAIL"
                };
            }
        );

    let payloadStatus =
        "PASS";

    let payloadDetails =
        "";

    try {
        const dashboard =
            BCC_getEnterpriseDashboard();

        if (
            !dashboard ||
            !dashboard.executive ||
            !dashboard.sections ||
            !Array.isArray(
                dashboard.alerts
            )
        ) {
            payloadStatus =
                "FAIL";

            payloadDetails =
                "Enterprise dashboard contract is incomplete.";
        }
    } catch (error) {
        payloadStatus =
            "FAIL";

        payloadDetails =
            BCC_ENTERPRISE_errorMessage_(
                error
            );
    }

    tests.push({
        code:
            "ENTERPRISE_DASHBOARD_CONTRACT",

        status:
            payloadStatus,

        details:
            payloadDetails
    });

    const failed =
        tests.filter(
            function(test) {
                return (
                    test.status ===
                    "FAIL"
                );
            }
        ).length;

    return {
        release:
            "BCC-04-ENTERPRISE-INTEGRATION",

        version:
            BCC_ENTERPRISE_INTEGRATION_VERSION,

        overallStatus:
            failed > 0
                ? "FAIL"
                : "PASS",

        passed:
            tests.length -
            failed,

        failed:
            failed,

        tests:
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

function BCC_testEnterpriseIntegration() {
    const diagnostics =
        BCC_runEnterpriseIntegrationDiagnostics();

    if (
        diagnostics.overallStatus !==
        "PASS"
    ) {
        throw new Error(
            "BCC Enterprise Integration diagnostics failed."
        );
    }

    return {
        success:
            true,

        release:
            "BCC-04-ENTERPRISE-INTEGRATION",

        version:
            BCC_ENTERPRISE_INTEGRATION_VERSION,

        diagnostics:
            diagnostics,

        runtime:
            BCC_getEnterpriseRuntimeHealth(),

        dashboard:
            BCC_getEnterpriseDashboard(),

        compatibilityPayload:
            BCC_buildEnterpriseDashboardPayload()
    };
}

/* ========================================================================== */
/* END OF FILE */
/* ========================================================================== */