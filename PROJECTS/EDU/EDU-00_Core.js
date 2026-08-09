/******************************************************************************
 * MelroseOS Enterprise
 * Project : Enterprise Education & Compliance
 * File    : EDU-00_Core.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Core data model and registry for agent education, license monitoring,
 *   continuing education snapshots, mandatory training, and compliance status.
 *
 * Safety:
 *   - Does not scrape external systems.
 *   - Does not send communications.
 *   - Does not install triggers.
 *   - Does not modify CRM routing or agent eligibility.
 ******************************************************************************/

const EDU_VERSION = "1.0.0";

const EDU = Object.freeze({
    RELEASE:
        "MOS5-007",

    STATUS: Object.freeze({
        PASS:
            "PASS",

        WARNING:
            "WARNING",

        CRITICAL:
            "CRITICAL",

        UNKNOWN:
            "UNKNOWN",

        EXEMPT:
            "EXEMPT",

        INACTIVE:
            "INACTIVE"
    }),

    LICENSE_STATUS: Object.freeze({
        ACTIVE:
            "ACTIVE",

        INACTIVE:
            "INACTIVE",

        EXPIRED:
            "EXPIRED",

        SUSPENDED:
            "SUSPENDED",

        UNKNOWN:
            "UNKNOWN"
    }),

    AFFILIATION: Object.freeze({
        MGR:
            "MGR",

        NON_MGR:
            "NON-MGR"
    }),

    SHEETS: Object.freeze({
        AGENTS:
            "EDU_AGENTS",

        SNAPSHOT:
            "EDU_SNAPSHOT",

        COURSES:
            "EDU_COURSES",

        COMPLETIONS:
            "EDU_COMPLETIONS",

        REQUIREMENTS:
            "EDU_REQUIREMENTS",

        VERIFICATION_LOG:
            "EDU_VERIFICATION_LOG",

        SETTINGS:
            "EDU_SETTINGS"
    }),

    HEADERS: Object.freeze({
        AGENTS: Object.freeze([
            "AgentID",
            "AgentName",
            "Email",
            "LicenseNumber",
            "LicenseStatus",
            "LicenseExpiration",
            "AffiliationType",
            "AgentStatus",
            "EducationMonitoringEnabled",
            "CECycle",
            "HoursRequired",
            "MandatoryCourseName",
            "CreatedAt",
            "UpdatedAt"
        ]),

        SNAPSHOT: Object.freeze([
            "SnapshotID",
            "AgentID",
            "AgentName",
            "LicenseNumber",
            "LicenseStatus",
            "LicenseExpiration",
            "CECycle",
            "HoursRequired",
            "HoursCompleted",
            "HoursRemaining",
            "MandatoryCourseName",
            "MandatoryCourseComplete",
            "LastVerificationAt",
            "OverallStatus",
            "StatusReason",
            "CreatedAt",
            "UpdatedAt"
        ]),

        COURSES: Object.freeze([
            "CourseID",
            "CourseName",
            "Provider",
            "CourseType",
            "CreditHours",
            "Mandatory",
            "Active",
            "CreatedAt",
            "UpdatedAt"
        ]),

        COMPLETIONS: Object.freeze([
            "CompletionID",
            "AgentID",
            "CourseID",
            "CourseName",
            "Provider",
            "CreditHours",
            "CompletionDate",
            "CertificateFileID",
            "VerificationStatus",
            "VerifiedAt",
            "CreatedAt",
            "UpdatedAt"
        ]),

        REQUIREMENTS: Object.freeze([
            "RequirementID",
            "CycleName",
            "LicenseType",
            "HoursRequired",
            "MandatoryCourseName",
            "EffectiveDate",
            "ExpirationDate",
            "Active",
            "CreatedAt",
            "UpdatedAt"
        ]),

        VERIFICATION_LOG: Object.freeze([
            "VerificationID",
            "AgentID",
            "LicenseNumber",
            "VerificationType",
            "Result",
            "Details",
            "VerifiedAt",
            "VerifiedBy"
        ]),

        SETTINGS: Object.freeze([
            "Setting",
            "Value",
            "Description",
            "UpdatedAt"
        ])
    })
});

/* ========================================================================== */
/* INITIALIZATION */
/* ========================================================================== */

function EDU_initializeCore() {
    const workbook =
        EDU_workbook_();

    Object.keys(
        EDU.SHEETS
    ).forEach(function(key) {
        const sheetName =
            EDU.SHEETS[key];

        const headers =
            EDU.HEADERS[key];

        const sheet =
            EDU_ensureSheet_(
                workbook,
                sheetName
            );

        EDU_ensureHeaders_(
            sheet,
            headers
        );
    });

    EDU_seedSettings_();

    return {
        success:
            true,

        release:
            EDU.RELEASE,

        version:
            EDU_VERSION,

        sheets:
            Object.keys(
                EDU.SHEETS
            ).map(function(key) {
                return EDU.SHEETS[key];
            }),

        productionChanged:
            true,

        completedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* AGENT REGISTRY */
/* ========================================================================== */

function EDU_upsertAgent(agent) {
    const input =
        agent || {};

    const agentId =
        String(
            input.AgentID ||
            input.agentId ||
            ""
        ).trim();

    if (!agentId) {
        throw new Error(
            "AgentID is required."
        );
    }

    const sheet =
        EDU_getSheet_(
            EDU.SHEETS.AGENTS
        );

    const existing =
        EDU_findRowByValue_(
            sheet,
            "AgentID",
            agentId
        );

    const now =
        new Date();

    const record = {
        AgentID:
            agentId,

        AgentName:
            String(
                input.AgentName ||
                input.agentName ||
                ""
            ).trim(),

        Email:
            EDU_normalizeEmail_(
                input.Email ||
                input.email ||
                ""
            ),

        LicenseNumber:
            String(
                input.LicenseNumber ||
                input.licenseNumber ||
                ""
            ).trim(),

        LicenseStatus:
            EDU_normalizeLicenseStatus_(
                input.LicenseStatus ||
                input.licenseStatus
            ),

        LicenseExpiration:
            EDU_normalizeDate_(
                input.LicenseExpiration ||
                input.licenseExpiration
            ),

        AffiliationType:
            EDU_normalizeAffiliation_(
                input.AffiliationType ||
                input.affiliationType
            ),

        AgentStatus:
            EDU_normalizeAgentStatus_(
                input.AgentStatus ||
                input.agentStatus
            ),

        EducationMonitoringEnabled:
            input.EducationMonitoringEnabled !== undefined
                ? EDU_isTrue_(
                    input.EducationMonitoringEnabled
                )
                : input.educationMonitoringEnabled !== undefined
                    ? EDU_isTrue_(
                        input.educationMonitoringEnabled
                    )
                    : true,

        CECycle:
            String(
                input.CECycle ||
                input.ceCycle ||
                ""
            ).trim(),

        HoursRequired:
            EDU_nonNegativeNumber_(
                input.HoursRequired !== undefined
                    ? input.HoursRequired
                    : input.hoursRequired
            ),

        MandatoryCourseName:
            String(
                input.MandatoryCourseName ||
                input.mandatoryCourseName ||
                ""
            ).trim(),

        CreatedAt:
            existing
                ? existing.CreatedAt
                : now,

        UpdatedAt:
            now
    };

    if (existing) {
        EDU_updateRow_(
            sheet,
            existing._row,
            record
        );
    } else {
        EDU_appendRow_(
            sheet,
            record
        );
    }

    return {
        success:
            true,

        status:
            existing
                ? "UPDATED"
                : "CREATED",

        agent:
            EDU_getAgent(
                agentId
            )
    };
}

function EDU_getAgent(agentId) {
    const sheet =
        EDU_getSheet_(
            EDU.SHEETS.AGENTS
        );

    const record =
        EDU_findRowByValue_(
            sheet,
            "AgentID",
            String(
                agentId || ""
            ).trim()
        );

    return record
        ? EDU_publicRecord_(
            record
        )
        : null;
}

function EDU_getAgents() {
    return EDU_sheetObjects_(
        EDU_getSheet_(
            EDU.SHEETS.AGENTS
        )
    ).map(
        EDU_publicRecord_
    );
}

function EDU_getMonitoredAgents() {
    return EDU_getAgents()
        .filter(function(agent) {
            return (
                EDU_isTrue_(
                    agent
                        .EducationMonitoringEnabled
                ) &&
                String(
                    agent.AffiliationType ||
                    ""
                )
                    .trim()
                    .toUpperCase() ===
                    EDU.AFFILIATION.MGR &&
                String(
                    agent.AgentStatus ||
                    ""
                )
                    .trim()
                    .toUpperCase() ===
                    "ACTIVE" &&
                String(
                    agent.LicenseNumber ||
                    ""
                ).trim() !== ""
            );
        });
}

/* ========================================================================== */
/* STATUS */
/* ========================================================================== */

function EDU_getCoreStatus() {
    const agents =
        EDU_getAgents();

    const monitored =
        EDU_getMonitoredAgents();

    return {
        release:
            EDU.RELEASE,

        version:
            EDU_VERSION,

        totalAgents:
            agents.length,

        monitoredAgents:
            monitored.length,

        inactiveAgents:
            agents.filter(
                function(agent) {
                    return (
                        String(
                            agent.AgentStatus ||
                            ""
                        )
                            .trim()
                            .toUpperCase() !==
                        "ACTIVE"
                    );
                }
            ).length,

        nonMgrAgents:
            agents.filter(
                function(agent) {
                    return (
                        String(
                            agent.AffiliationType ||
                            ""
                        )
                            .trim()
                            .toUpperCase() !==
                        EDU.AFFILIATION.MGR
                    );
                }
            ).length,

        generatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* INTERNAL HELPERS */
/* ========================================================================== */

function EDU_workbook_() {
    return SpreadsheetApp.getActiveSpreadsheet();
}

function EDU_getSheet_(sheetName) {
    const sheet =
        EDU_workbook_().getSheetByName(sheetName);

    if (!sheet) {
        throw new Error(
            "Sheet not found: " + sheetName
        );
    }

    return sheet;
}

function EDU_ensureSheet_(
    workbook,
    sheetName
) {
    let sheet =
        workbook.getSheetByName(
            sheetName
        );

    if (!sheet) {
        sheet =
            workbook.insertSheet(
                sheetName
            );
    }

    return sheet;
}

function EDU_ensureHeaders_(
    sheet,
    headers
) {
    if (!headers || !headers.length) {
        return;
    }

    const existing =
        sheet
            .getRange(
                1,
                1,
                1,
                headers.length
            )
            .getValues()[0];

    const matches =
        existing.every(function(
            value,
            index
        ) {
            return (
                String(value) ===
                String(headers[index])
            );
        });

    if (!matches) {
        sheet
            .getRange(
                1,
                1,
                1,
                headers.length
            )
            .setValues([headers]);

        sheet
            .getRange(1, 1, 1, headers.length)
            .setFontWeight("bold");
    }
}

function EDU_sheetObjects_(sheet) {
    const values =
        sheet.getDataRange().getValues();

    if (values.length <= 1) {
        return [];
    }

    const headers =
        values[0];

    return values
        .slice(1)
        .map(function(row, rowIndex) {

            const object = {
                _row: rowIndex + 2
            };

            headers.forEach(function(
                header,
                column
            ) {
                object[header] =
                    row[column];
            });

            return object;

        });
}

function EDU_findRowByValue_(
    sheet,
    columnName,
    value
) {
    const rows =
        EDU_sheetObjects_(sheet);

    return (
        rows.find(function(
            row
        ) {
            return (
                String(
                    row[columnName]
                ).trim() ===
                String(value).trim()
            );
        }) || null
    );
}

function EDU_appendRow_(
    sheet,
    object
) {
    const headers =
        sheet
            .getRange(
                1,
                1,
                1,
                sheet.getLastColumn()
            )
            .getValues()[0];

    const row =
        headers.map(function(
            header
        ) {
            return (
                object[header] !==
                undefined
            )
                ? object[header]
                : "";
        });

    sheet.appendRow(row);
}

function EDU_updateRow_(
    sheet,
    rowNumber,
    object
) {
    const headers =
        sheet
            .getRange(
                1,
                1,
                1,
                sheet.getLastColumn()
            )
            .getValues()[0];

    const row =
        headers.map(function(
            header
        ) {
            return (
                object[header] !==
                undefined
            )
                ? object[header]
                : "";
        });

    sheet
        .getRange(
            rowNumber,
            1,
            1,
            row.length
        )
        .setValues([row]);
}

function EDU_publicRecord_(
    record
) {
    const clone = {};

    Object.keys(record)
        .forEach(function(
            key
        ) {

            if (
                key !== "_row"
            ) {
                clone[key] =
                    record[key];
            }

        });

    return clone;
}

/* ========================================================================== */
/* NORMALIZATION */
/* ========================================================================== */

function EDU_normalizeEmail_(
    value
) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function EDU_normalizeLicenseStatus_(
    value
) {
    const status =
        String(
            value || "UNKNOWN"
        )
            .trim()
            .toUpperCase();

    return Object.values(
        EDU.LICENSE_STATUS
    ).indexOf(status) >= 0
        ? status
        : EDU.LICENSE_STATUS.UNKNOWN;
}

function EDU_normalizeAffiliation_(
    value
) {
    const affiliation =
        String(value || "")
            .trim()
            .toUpperCase();

    return affiliation ===
        EDU.AFFILIATION.MGR
        ? EDU.AFFILIATION.MGR
        : EDU.AFFILIATION.NON_MGR;
}

function EDU_normalizeAgentStatus_(
    value
) {
    return String(
        value || "ACTIVE"
    )
        .trim()
        .toUpperCase();
}

function EDU_normalizeDate_(
    value
) {
    if (!value) {
        return "";
    }

    const date =
        value instanceof Date
            ? value
            : new Date(value);

    if (
        !Number.isFinite(
            date.getTime()
        )
    ) {
        return "";
    }

    return date;
}

function EDU_nonNegativeNumber_(
    value
) {
    const number =
        Number(value);

    if (
        !Number.isFinite(
            number
        )
    ) {
        return 0;
    }

    return Math.max(
        0,
        number
    );
}

function EDU_isTrue_(
    value
) {
    return (
        value === true ||
        String(value)
            .trim()
            .toUpperCase() ===
            "TRUE"
    );
}

/* ========================================================================== */
/* SETTINGS */
/* ========================================================================== */

function EDU_seedSettings_() {

    const sheet =
        EDU_getSheet_(
            EDU.SHEETS.SETTINGS
        );

    if (
        sheet.getLastRow() > 1
    ) {
        return;
    }

    sheet.appendRow([
        "VerificationIntervalHours",
        24,
        "Hours between license verification runs",
        new Date()
    ]);

    sheet.appendRow([
        "DefaultHoursRequired",
        12,
        "Default CE hours",
        new Date()
    ]);

    sheet.appendRow([
        "EducationEnabled",
        true,
        "Master enable switch",
        new Date()
    ]);

}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function EDU_runDiagnostics() {

    const required = [
        "EDU_initializeCore",
        "EDU_upsertAgent",
        "EDU_getAgents",
        "EDU_getMonitoredAgents",
        "EDU_getCoreStatus"
    ];

    const tests =
        required.map(function(
            fn
        ) {

            return {
                code: fn,

                status:
                    typeof globalThis[
                        fn
                    ] ===
                    "function"
                        ? "PASS"
                        : "FAIL"
            };

        });

    const failed =
        tests.filter(function(
            test
        ) {
            return (
                test.status ===
                "FAIL"
            );
        }).length;

    return {

        release:
            EDU.RELEASE,

        version:
            EDU_VERSION,

        overallStatus:
            failed === 0
                ? "PASS"
                : "FAIL",

        passed:
            tests.length -
            failed,

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
/* END OF FILE */
/* ========================================================================== */