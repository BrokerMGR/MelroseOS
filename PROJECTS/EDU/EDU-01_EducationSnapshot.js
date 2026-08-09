/******************************************************************************
 * MelroseOS Enterprise
 * Project : Enterprise Education & Compliance
 * File    : EDU-01_EducationSnapshot.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Builds and maintains the broker-facing education and license compliance
 *   snapshot for monitored MGR agents.
 *
 * Safety:
 *   - Does not scrape LREC.
 *   - Does not send communications.
 *   - Does not install triggers.
 *   - Does not modify CRM lead routing or agent eligibility.
 ******************************************************************************/

const EDU_SNAPSHOT_VERSION = "1.0.0";

/* ========================================================================== */
/* BUILD SNAPSHOT */
/* ========================================================================== */

function EDU_buildEducationSnapshot() {
    EDU_initializeCore();

    const agents =
        EDU_getAgents();

    const results =
        agents.map(function(agent) {
            return EDU_buildAgentSnapshot_(
                agent
            );
        });

    return {
        success:
            true,

        release:
            "MOS5-007-EDUCATION-SNAPSHOT",

        version:
            EDU_SNAPSHOT_VERSION,

        totalAgents:
            results.length,

        monitoredAgents:
            results.filter(
                function(result) {
                    return (
                        result.monitored ===
                        true
                    );
                }
            ).length,

        updated:
            results.filter(
                function(result) {
                    return (
                        result.success ===
                        true
                    );
                }
            ).length,

        failed:
            results.filter(
                function(result) {
                    return (
                        result.success !==
                        true
                    );
                }
            ).length,

        results:
            results,

        completedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* BUILD AGENT SNAPSHOT */
/* ========================================================================== */

function EDU_buildAgentSnapshot_(
    agent
) {
    const source =
        agent || {};

    const agentId =
        String(
            source.AgentID || ""
        ).trim();

    if (!agentId) {
        return {
            success:
                false,

            monitored:
                false,

            error:
                "AgentID is missing."
        };
    }

    const monitored =
        EDU_isMonitoredAgent_(
            source
        );

    const completions =
        EDU_getAgentCompletions_(
            agentId
        );

    const requirement =
        EDU_resolveRequirement_(
            source
        );

    const hoursCompleted =
        EDU_calculateCompletedHours_(
            completions,
            requirement
        );

    const hoursRequired =
        EDU_nonNegativeNumber_(
            requirement.HoursRequired
        );

    const hoursRemaining =
        Math.max(
            0,
            hoursRequired -
            hoursCompleted
        );

    const mandatoryCourseName =
        String(
            requirement
                .MandatoryCourseName ||
            source
                .MandatoryCourseName ||
            ""
        ).trim();

    const mandatoryCourseComplete =
        EDU_isMandatoryCourseComplete_(
            completions,
            mandatoryCourseName
        );

    const evaluation =
        EDU_evaluateAgentEducationStatus_({
            agent:
                source,

            monitored:
                monitored,

            hoursRequired:
                hoursRequired,

            hoursCompleted:
                hoursCompleted,

            hoursRemaining:
                hoursRemaining,

            mandatoryCourseName:
                mandatoryCourseName,

            mandatoryCourseComplete:
                mandatoryCourseComplete
        });

    const snapshot = {
        SnapshotID:
            EDU_snapshotId_(
                agentId,
                source.CECycle
            ),

        AgentID:
            agentId,

        AgentName:
            String(
                source.AgentName || ""
            ).trim(),

        LicenseNumber:
            String(
                source.LicenseNumber || ""
            ).trim(),

        LicenseStatus:
            EDU_normalizeLicenseStatus_(
                source.LicenseStatus
            ),

        LicenseExpiration:
            EDU_normalizeDate_(
                source.LicenseExpiration
            ),

        CECycle:
            String(
                requirement.CycleName ||
                source.CECycle ||
                ""
            ).trim(),

        HoursRequired:
            hoursRequired,

        HoursCompleted:
            hoursCompleted,

        HoursRemaining:
            hoursRemaining,

        MandatoryCourseName:
            mandatoryCourseName,

        MandatoryCourseComplete:
            mandatoryCourseComplete,

        LastVerificationAt:
            EDU_getLastVerificationAt_(
                agentId
            ),

        OverallStatus:
            evaluation.status,

        StatusReason:
            evaluation.reason,

        CreatedAt:
            new Date(),

        UpdatedAt:
            new Date()
    };

    EDU_upsertSnapshot_(
        snapshot
    );

    return {
        success:
            true,

        monitored:
            monitored,

        agentId:
            agentId,

        status:
            evaluation.status,

        snapshot:
            EDU_getAgentSnapshot(
                agentId
            )
    };
}

/* ========================================================================== */
/* GET SNAPSHOT */
/* ========================================================================== */

function EDU_getAgentSnapshot(
    agentId
) {
    const sheet =
        EDU_getSheet_(
            EDU.SHEETS.SNAPSHOT
        );

    const row =
        EDU_findRowByValue_(
            sheet,
            "AgentID",
            String(
                agentId || ""
            ).trim()
        );

    return row
        ? EDU_publicRecord_(
            row
        )
        : null;
}

function EDU_getEducationSnapshot() {
    return EDU_sheetObjects_(
        EDU_getSheet_(
            EDU.SHEETS.SNAPSHOT
        )
    )
        .map(
            EDU_publicRecord_
        )
        .sort(function(a, b) {
            return (
                EDU_statusWeight_(
                    b.OverallStatus
                ) -
                EDU_statusWeight_(
                    a.OverallStatus
                )
            );
        });
}

/* ========================================================================== */
/* SNAPSHOT SUMMARY */
/* ========================================================================== */

function EDU_getEducationSnapshotSummary() {
    const rows =
        EDU_getEducationSnapshot();

    return {
        release:
            "MOS5-007-EDUCATION-SNAPSHOT",

        version:
            EDU_SNAPSHOT_VERSION,

        total:
            rows.length,

        pass:
            EDU_countSnapshotStatus_(
                rows,
                EDU.STATUS.PASS
            ),

        warning:
            EDU_countSnapshotStatus_(
                rows,
                EDU.STATUS.WARNING
            ),

        critical:
            EDU_countSnapshotStatus_(
                rows,
                EDU.STATUS.CRITICAL
            ),

        unknown:
            EDU_countSnapshotStatus_(
                rows,
                EDU.STATUS.UNKNOWN
            ),

        exempt:
            EDU_countSnapshotStatus_(
                rows,
                EDU.STATUS.EXEMPT
            ),

        inactive:
            EDU_countSnapshotStatus_(
                rows,
                EDU.STATUS.INACTIVE
            ),

        hoursRequired:
            rows.reduce(
                function(total, row) {
                    return (
                        total +
                        EDU_nonNegativeNumber_(
                            row.HoursRequired
                        )
                    );
                },
                0
            ),

        hoursCompleted:
            rows.reduce(
                function(total, row) {
                    return (
                        total +
                        EDU_nonNegativeNumber_(
                            row.HoursCompleted
                        )
                    );
                },
                0
            ),

        hoursRemaining:
            rows.reduce(
                function(total, row) {
                    return (
                        total +
                        EDU_nonNegativeNumber_(
                            row.HoursRemaining
                        )
                    );
                },
                0
            ),

        generatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* COMPLETIONS */
/* ========================================================================== */

function EDU_getAgentCompletions_(
    agentId
) {
    return EDU_sheetObjects_(
        EDU_getSheet_(
            EDU.SHEETS.COMPLETIONS
        )
    ).filter(function(completion) {
        return (
            String(
                completion.AgentID || ""
            ).trim() ===
            String(
                agentId || ""
            ).trim()
        );
    });
}

function EDU_calculateCompletedHours_(
    completions,
    requirement
) {
    const cycleStart =
        EDU_normalizeDate_(
            requirement.EffectiveDate
        );

    const cycleEnd =
        EDU_normalizeDate_(
            requirement.ExpirationDate
        );

    return (
        completions || []
    )
        .filter(function(completion) {
            const verificationStatus =
                String(
                    completion
                        .VerificationStatus ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            if (
                verificationStatus ===
                "REJECTED"
            ) {
                return false;
            }

            const completionDate =
                EDU_normalizeDate_(
                    completion
                        .CompletionDate
                );

            if (!completionDate) {
                return false;
            }

            if (
                cycleStart &&
                completionDate < cycleStart
            ) {
                return false;
            }

            if (
                cycleEnd &&
                completionDate > cycleEnd
            ) {
                return false;
            }

            return true;
        })
        .reduce(
            function(total, completion) {
                return (
                    total +
                    EDU_nonNegativeNumber_(
                        completion.CreditHours
                    )
                );
            },
            0
        );
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* REQUIREMENT RESOLUTION */
/* ========================================================================== */

function EDU_resolveRequirement_(
    agent
) {
    const source =
        agent || {};

    const requirements =
        EDU_sheetObjects_(
            EDU_getSheet_(
                EDU.SHEETS.REQUIREMENTS
            )
        );

    const today =
        new Date();

    const activeRequirements =
        requirements.filter(
            function(requirement) {
                const active =
                    EDU_isTrue_(
                        requirement.Active
                    );

                if (!active) {
                    return false;
                }

                const effectiveDate =
                    EDU_normalizeDate_(
                        requirement
                            .EffectiveDate
                    );

                const expirationDate =
                    EDU_normalizeDate_(
                        requirement
                            .ExpirationDate
                    );

                if (
                    effectiveDate &&
                    today < effectiveDate
                ) {
                    return false;
                }

                if (
                    expirationDate &&
                    today > expirationDate
                ) {
                    return false;
                }

                return true;
            }
        );

    const exactCycle =
        activeRequirements.find(
            function(requirement) {
                return (
                    String(
                        requirement.CycleName ||
                        ""
                    )
                        .trim()
                        .toUpperCase() ===
                    String(
                        source.CECycle ||
                        ""
                    )
                        .trim()
                        .toUpperCase()
                );
            }
        );

    if (exactCycle) {
        return exactCycle;
    }

    const firstActive =
        activeRequirements[0];

    if (firstActive) {
        return firstActive;
    }

    return {
        CycleName:
            String(
                source.CECycle ||
                ""
            ).trim(),

        HoursRequired:
            EDU_nonNegativeNumber_(
                source.HoursRequired
            ),

        MandatoryCourseName:
            String(
                source
                    .MandatoryCourseName ||
                ""
            ).trim(),

        EffectiveDate:
            "",

        ExpirationDate:
            ""
    };
}

/* ========================================================================== */
/* MANDATORY COURSE */
/* ========================================================================== */

function EDU_isMandatoryCourseComplete_(
    completions,
    mandatoryCourseName
) {
    const requiredName =
        String(
            mandatoryCourseName || ""
        )
            .trim()
            .toUpperCase();

    if (!requiredName) {
        return true;
    }

    return (
        completions || []
    ).some(function(completion) {
        const completionName =
            String(
                completion.CourseName ||
                ""
            )
                .trim()
                .toUpperCase();

        const verificationStatus =
            String(
                completion
                    .VerificationStatus ||
                ""
            )
                .trim()
                .toUpperCase();

        return (
            completionName ===
                requiredName &&
            verificationStatus !==
                "REJECTED"
        );
    });
}

/* ========================================================================== */
/* STATUS EVALUATION */
/* ========================================================================== */

function EDU_evaluateAgentEducationStatus_(
    context
) {
    const input =
        context || {};

    const agent =
        input.agent || {};

    if (!input.monitored) {
        const agentStatus =
            String(
                agent.AgentStatus || ""
            )
                .trim()
                .toUpperCase();

        if (
            agentStatus !==
            "ACTIVE"
        ) {
            return {
                status:
                    EDU.STATUS.INACTIVE,

                reason:
                    "Agent is not active."
            };
        }

        return {
            status:
                EDU.STATUS.EXEMPT,

            reason:
                "Education monitoring is not enabled for this agent."
        };
    }

    const licenseStatus =
        EDU_normalizeLicenseStatus_(
            agent.LicenseStatus
        );

    if (
        licenseStatus ===
            EDU.LICENSE_STATUS.EXPIRED ||
        licenseStatus ===
            EDU.LICENSE_STATUS.SUSPENDED ||
        licenseStatus ===
            EDU.LICENSE_STATUS.INACTIVE
    ) {
        return {
            status:
                EDU.STATUS.CRITICAL,

            reason:
                "License status requires immediate broker review."
        };
    }

    const expirationDate =
        EDU_normalizeDate_(
            agent.LicenseExpiration
        );

    if (expirationDate) {
        const daysRemaining =
            EDU_daysBetween_(
                new Date(),
                expirationDate
            );

        if (daysRemaining < 0) {
            return {
                status:
                    EDU.STATUS.CRITICAL,

                reason:
                    "License expiration date has passed."
            };
        }

        if (daysRemaining <= 30) {
            return {
                status:
                    EDU.STATUS.WARNING,

                reason:
                    "License expires within 30 days."
            };
        }
    }

    if (
        input.hoursRemaining > 0
    ) {
        return {
            status:
                EDU.STATUS.WARNING,

            reason:
                String(
                    input.hoursRemaining
                ) +
                " continuing education hour(s) remain."
        };
    }

    if (
        input.mandatoryCourseName &&
        input.mandatoryCourseComplete !==
            true
    ) {
        return {
            status:
                EDU.STATUS.WARNING,

            reason:
                "Mandatory course has not been completed."
        };
    }

    if (
        licenseStatus ===
        EDU.LICENSE_STATUS.UNKNOWN
    ) {
        return {
            status:
                EDU.STATUS.UNKNOWN,

            reason:
                "License status has not been verified."
        };
    }

    return {
        status:
            EDU.STATUS.PASS,

        reason:
            "Education and license requirements are currently satisfied."
    };
}

/* ========================================================================== */
/* SNAPSHOT UPSERT */
/* ========================================================================== */

function EDU_upsertSnapshot_(
    snapshot
) {
    const sheet =
        EDU_getSheet_(
            EDU.SHEETS.SNAPSHOT
        );

    const existing =
        EDU_findRowByValue_(
            sheet,
            "AgentID",
            snapshot.AgentID
        );

    if (existing) {
        snapshot.CreatedAt =
            existing.CreatedAt ||
            snapshot.CreatedAt;

        EDU_updateRow_(
            sheet,
            existing._row,
            snapshot
        );

        return {
            success:
                true,

            status:
                "UPDATED"
        };
    }

    EDU_appendRow_(
        sheet,
        snapshot
    );

    return {
        success:
            true,

        status:
            "CREATED"
    };
}

/* ========================================================================== */
/* VERIFICATION LOOKUP */
/* ========================================================================== */

function EDU_getLastVerificationAt_(
    agentId
) {
    const rows =
        EDU_sheetObjects_(
            EDU_getSheet_(
                EDU.SHEETS
                    .VERIFICATION_LOG
            )
        )
            .filter(
                function(row) {
                    return (
                        String(
                            row.AgentID ||
                            ""
                        ).trim() ===
                        String(
                            agentId ||
                            ""
                        ).trim()
                    );
                }
            )
            .sort(
                function(a, b) {
                    return (
                        EDU_dateValue_(
                            b.VerifiedAt
                        ) -
                        EDU_dateValue_(
                            a.VerifiedAt
                        )
                    );
                }
            );

    return rows.length
        ? rows[0].VerifiedAt
        : "";
}

/* ========================================================================== */
/* MONITORING ELIGIBILITY */
/* ========================================================================== */

function EDU_isMonitoredAgent_(
    agent
) {
    const source =
        agent || {};

    return (
        EDU_isTrue_(
            source
                .EducationMonitoringEnabled
        ) &&
        String(
            source.AffiliationType ||
            ""
        )
            .trim()
            .toUpperCase() ===
            EDU.AFFILIATION.MGR &&
        String(
            source.AgentStatus ||
            ""
        )
            .trim()
            .toUpperCase() ===
            "ACTIVE" &&
        String(
            source.LicenseNumber ||
            ""
        ).trim() !== ""
    );
}

/* ========================================================================== */
/* HELPERS */
/* ========================================================================== */

function EDU_snapshotId_(
    agentId,
    cycle
) {
    const safeCycle =
        String(
            cycle || "CURRENT"
        )
            .trim()
            .toUpperCase()
            .replace(
                /[^A-Z0-9]+/g,
                "-"
            );

    return (
        "EDU-SNAPSHOT-" +
        String(
            agentId || ""
        )
            .trim()
            .toUpperCase() +
        "-" +
        safeCycle
    );
}

function EDU_countSnapshotStatus_(
    rows,
    status
) {
    return (
        rows || []
    ).filter(function(row) {
        return (
            String(
                row.OverallStatus ||
                ""
            )
                .trim()
                .toUpperCase() ===
            String(
                status || ""
            )
                .trim()
                .toUpperCase()
        );
    }).length;
}

function EDU_statusWeight_(
    status
) {
    const weights = {};

    weights[
        EDU.STATUS.CRITICAL
    ] = 600;

    weights[
        EDU.STATUS.WARNING
    ] = 500;

    weights[
        EDU.STATUS.UNKNOWN
    ] = 400;

    weights[
        EDU.STATUS.PASS
    ] = 300;

    weights[
        EDU.STATUS.EXEMPT
    ] = 200;

    weights[
        EDU.STATUS.INACTIVE
    ] = 100;

    return Number(
        weights[
            String(
                status || ""
            )
                .trim()
                .toUpperCase()
        ] || 0
    );
}

function EDU_daysBetween_(
    start,
    end
) {
    const startDate =
        EDU_normalizeDate_(
            start
        );

    const endDate =
        EDU_normalizeDate_(
            end
        );

    if (
        !startDate ||
        !endDate
    ) {
        return 0;
    }

    const milliseconds =
        endDate.getTime() -
        startDate.getTime();

    return Math.floor(
        milliseconds /
        86400000
    );
}

function EDU_dateValue_(
    value
) {
    const date =
        EDU_normalizeDate_(
            value
        );

    return date
        ? date.getTime()
        : 0;
}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function EDU_runSnapshotDiagnostics() {
    const requiredFunctions = [
        "EDU_buildEducationSnapshot",
        "EDU_getAgentSnapshot",
        "EDU_getEducationSnapshot",
        "EDU_getEducationSnapshotSummary"
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
                            : "FAIL"
                };
            }
        );

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
            "MOS5-007-EDUCATION-SNAPSHOT",

        version:
            EDU_SNAPSHOT_VERSION,

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
/* END OF FILE */
/* ========================================================================== */