/******************************************************************************
 * MelroseOS Enterprise
 * Project : Enterprise Verification Engine
 * File    : VERIFY-00_Core.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Defines the shared verification model used by EDU, CRM, Recruiting,
 *   Compliance, Transactions, and the Broker Command Center.
 *
 * Safety:
 *   - Does not contact external providers.
 *   - Does not install triggers.
 *   - Does not send communications.
 *   - Does not modify routing or agent eligibility.
 ******************************************************************************/

const VERIFY_VERSION = "1.0.0";

const VERIFY = Object.freeze({
    RELEASE:
        "MOS5-008",

    STATUS: Object.freeze({
        PASS:
            "PASS",

        WARNING:
            "WARNING",

        FAIL:
            "FAIL",

        UNKNOWN:
            "UNKNOWN",

        PENDING:
            "PENDING",

        OVERRIDDEN:
            "OVERRIDDEN",

        EXPIRED:
            "EXPIRED"
    }),

    TYPE: Object.freeze({
        LICENSE:
            "LICENSE",

        CONTINUING_EDUCATION:
            "CONTINUING_EDUCATION",

        DESIGNATION:
            "DESIGNATION",

        MLS:
            "MLS",

        REALTOR:
            "REALTOR",

        E_AND_O:
            "E_AND_O",

        ACADEMY:
            "ACADEMY",

        BROKER_APPROVAL:
            "BROKER_APPROVAL",

        BACKGROUND:
            "BACKGROUND",

        CUSTOM:
            "CUSTOM"
    }),

    PROVIDER_TYPE: Object.freeze({
        MANUAL:
            "MANUAL",

        BROKER:
            "BROKER",

        FILE:
            "FILE",

        LREC:
            "LREC",

        FUTURE_API:
            "FUTURE_API"
    }),

    SHEETS: Object.freeze({
        SUBJECTS:
            "VERIFY_SUBJECTS",

        REQUESTS:
            "VERIFY_REQUESTS",

        RESULTS:
            "VERIFY_RESULTS",

        PROVIDERS:
            "VERIFY_PROVIDERS",

        OVERRIDES:
            "VERIFY_OVERRIDES",

        AUDIT_LOG:
            "VERIFY_AUDIT_LOG",

        SETTINGS:
            "VERIFY_SETTINGS"
    }),

    HEADERS: Object.freeze({
        SUBJECTS: Object.freeze([
            "SubjectID",
            "SubjectType",
            "DisplayName",
            "Email",
            "ExternalID",
            "Active",
            "CreatedAt",
            "UpdatedAt"
        ]),

        REQUESTS: Object.freeze([
            "RequestID",
            "SubjectID",
            "VerificationType",
            "ProviderID",
            "ReferenceValue",
            "RequestedAt",
            "RequestedBy",
            "Status",
            "CompletedAt",
            "CreatedAt",
            "UpdatedAt"
        ]),

        RESULTS: Object.freeze([
            "ResultID",
            "RequestID",
            "SubjectID",
            "VerificationType",
            "ProviderID",
            "Status",
            "VerifiedValue",
            "EffectiveDate",
            "ExpirationDate",
            "EvidenceFileID",
            "Details",
            "VerifiedAt",
            "VerifiedBy",
            "CreatedAt",
            "UpdatedAt"
        ]),

        PROVIDERS: Object.freeze([
            "ProviderID",
            "ProviderName",
            "ProviderType",
            "VerificationTypes",
            "Active",
            "Priority",
            "ConfigurationJSON",
            "CreatedAt",
            "UpdatedAt"
        ]),

        OVERRIDES: Object.freeze([
            "OverrideID",
            "SubjectID",
            "VerificationType",
            "Status",
            "Reason",
            "EffectiveDate",
            "ExpirationDate",
            "ApprovedBy",
            "ApprovedAt",
            "Active",
            "CreatedAt",
            "UpdatedAt"
        ]),

        AUDIT_LOG: Object.freeze([
            "AuditID",
            "EventType",
            "SubjectID",
            "VerificationType",
            "ReferenceID",
            "Status",
            "Details",
            "Actor",
            "OccurredAt"
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

function VERIFY_initializeCore() {
    const workbook =
        VERIFY_workbook_();

    Object.keys(
        VERIFY.SHEETS
    ).forEach(function(key) {
        const sheet =
            VERIFY_ensureSheet_(
                workbook,
                VERIFY.SHEETS[key]
            );

        VERIFY_ensureHeaders_(
            sheet,
            VERIFY.HEADERS[key]
        );
    });

    VERIFY_seedSettings_();

    return {
        success:
            true,

        release:
            VERIFY.RELEASE,

        version:
            VERIFY_VERSION,

        sheets:
            Object.keys(
                VERIFY.SHEETS
            ).map(function(key) {
                return VERIFY.SHEETS[key];
            }),

        productionChanged:
            true,

        completedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* SUBJECT REGISTRY */
/* ========================================================================== */

function VERIFY_upsertSubject(subject) {
    VERIFY_initializeCore();

    const input =
        subject || {};

    const subjectId =
        String(
            input.SubjectID ||
            input.subjectId ||
            ""
        ).trim();

    if (!subjectId) {
        throw new Error(
            "SubjectID is required."
        );
    }

    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.SUBJECTS
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "SubjectID",
            subjectId
        );

    const now =
        new Date();

    const record = {
        SubjectID:
            subjectId,

        SubjectType:
            String(
                input.SubjectType ||
                input.subjectType ||
                "AGENT"
            )
                .trim()
                .toUpperCase(),

        DisplayName:
            String(
                input.DisplayName ||
                input.displayName ||
                ""
            ).trim(),

        Email:
            VERIFY_normalizeEmail_(
                input.Email ||
                input.email ||
                ""
            ),

        ExternalID:
            String(
                input.ExternalID ||
                input.externalId ||
                ""
            ).trim(),

        Active:
            input.Active !== undefined
                ? VERIFY_isTrue_(
                    input.Active
                )
                : input.active !== undefined
                    ? VERIFY_isTrue_(
                        input.active
                    )
                    : true,

        CreatedAt:
            existing
                ? existing.CreatedAt
                : now,

        UpdatedAt:
            now
    };

    if (existing) {
        VERIFY_updateRow_(
            sheet,
            existing._row,
            record
        );
    } else {
        VERIFY_appendRow_(
            sheet,
            record
        );
    }

    VERIFY_logAudit_({
        EventType:
            existing
                ? "SUBJECT_UPDATED"
                : "SUBJECT_CREATED",

        SubjectID:
            subjectId,

        Status:
            "PASS",

        Details:
            "Verification subject registry updated."
    });

    return {
        success:
            true,

        status:
            existing
                ? "UPDATED"
                : "CREATED",

        subject:
            VERIFY_getSubject(
                subjectId
            )
    };
}

function VERIFY_getSubject(subjectId) {
    const record =
        VERIFY_findRowByValue_(
            VERIFY_getSheet_(
                VERIFY.SHEETS.SUBJECTS
            ),
            "SubjectID",
            String(
                subjectId || ""
            ).trim()
        );

    return record
        ? VERIFY_publicRecord_(
            record
        )
        : null;
}

function VERIFY_getSubjects() {
    return VERIFY_sheetObjects_(
        VERIFY_getSheet_(
            VERIFY.SHEETS.SUBJECTS
        )
    )
        .map(
            VERIFY_publicRecord_
        )
        .sort(function(a, b) {
            return String(
                a.DisplayName || ""
            ).localeCompare(
                String(
                    b.DisplayName || ""
                )
            );
        });
}

function VERIFY_getActiveSubjects() {
    return VERIFY_getSubjects()
        .filter(function(subject) {
            return VERIFY_isTrue_(
                subject.Active
            );
        });
}

/* ========================================================================== */
/* STATUS */
/* ========================================================================== */

function VERIFY_getCoreStatus() {
    const subjects =
        VERIFY_getSubjects();

    return {
        release:
            VERIFY.RELEASE,

        version:
            VERIFY_VERSION,

        totalSubjects:
            subjects.length,

        activeSubjects:
            subjects.filter(
                function(subject) {
                    return VERIFY_isTrue_(
                        subject.Active
                    );
                }
            ).length,

        inactiveSubjects:
            subjects.filter(
                function(subject) {
                    return !VERIFY_isTrue_(
                        subject.Active
                    );
                }
            ).length,

        generatedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* WORKBOOK AND SHEET HELPERS */
/* ========================================================================== */

function VERIFY_workbook_() {
    return SpreadsheetApp.getActiveSpreadsheet();
}

function VERIFY_getSheet_(sheetName) {
    const sheet =
        VERIFY_workbook_()
            .getSheetByName(
                sheetName
            );

    if (!sheet) {
        throw new Error(
            "Sheet not found: " +
            sheetName
        );
    }

    return sheet;
}

function VERIFY_ensureSheet_(
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

function VERIFY_ensureHeaders_(
    sheet,
    headers
) {
    if (
        !sheet ||
        !Array.isArray(headers) ||
        headers.length === 0
    ) {
        return false;
    }

    const lastColumn =
        Math.max(
            sheet.getLastColumn(),
            headers.length
        );

    if (
        sheet.getMaxColumns() <
        lastColumn
    ) {
        sheet.insertColumnsAfter(
            sheet.getMaxColumns(),
            lastColumn -
            sheet.getMaxColumns()
        );
    }

    const existing =
        sheet
            .getRange(
                1,
                1,
                1,
                headers.length
            )
            .getDisplayValues()[0];

    const matches =
        headers.every(
            function(header, index) {
                return (
                    String(
                        existing[index] ||
                        ""
                    ).trim() ===
                    String(
                        header || ""
                    ).trim()
                );
            }
        );

    if (!matches) {
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

        sheet
            .getRange(
                1,
                1,
                1,
                headers.length
            )
            .setFontWeight(
                "bold"
            );

        sheet.setFrozenRows(1);
    }

    return true;
}

/* ========================================================================== */
/* ROW HELPERS */
/* ========================================================================== */

function VERIFY_sheetObjects_(sheet) {
    if (
        !sheet ||
        sheet.getLastRow() < 2 ||
        sheet.getLastColumn() < 1
    ) {
        return [];
    }

    const values =
        sheet
            .getDataRange()
            .getValues();

    const headers =
        values.shift()
            .map(function(header) {
                return String(
                    header || ""
                ).trim();
            });

    return values
        .filter(function(row) {
            return row.some(
                function(value) {
                    return (
                        String(
                            value || ""
                        ).trim() !== ""
                    );
                }
            );
        })
        .map(
            function(row, index) {
                const record = {
                    _row:
                        index + 2
                };

                headers.forEach(
                    function(
                        header,
                        columnIndex
                    ) {
                        record[header] =
                            row[columnIndex];
                    }
                );

                return record;
            }
        );
}

function VERIFY_findRowByValue_(
    sheet,
    headerName,
    value
) {
    const target =
        String(
            value || ""
        ).trim();

    if (!target) {
        return null;
    }

    return (
        VERIFY_sheetObjects_(
            sheet
        ).find(
            function(record) {
                return (
                    String(
                        record[
                            headerName
                        ] || ""
                    ).trim() ===
                    target
                );
            }
        ) || null
    );
}

function VERIFY_appendRow_(
    sheet,
    record
) {
    const headers =
        sheet
            .getRange(
                1,
                1,
                1,
                sheet.getLastColumn()
            )
            .getDisplayValues()[0]
            .map(function(header) {
                return String(
                    header || ""
                ).trim();
            });

    sheet.appendRow(
        headers.map(
            function(header) {
                return (
                    record &&
                    record[header] !==
                        undefined
                )
                    ? record[header]
                    : "";
            }
        )
    );

    return sheet.getLastRow();
}

function VERIFY_updateRow_(
    sheet,
    rowNumber,
    updates
) {
    if (
        !sheet ||
        !rowNumber
    ) {
        throw new Error(
            "A valid sheet and row number are required."
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
            .getDisplayValues()[0]
            .map(function(header) {
                return String(
                    header || ""
                ).trim();
            });

    const current =
        sheet
            .getRange(
                rowNumber,
                1,
                1,
                headers.length
            )
            .getValues()[0];

    const next =
        headers.map(
            function(
                header,
                index
            ) {
                return (
                    updates &&
                    updates[header] !==
                        undefined
                )
                    ? updates[header]
                    : current[index];
            }
        );

    sheet
        .getRange(
            rowNumber,
            1,
            1,
            next.length
        )
        .setValues([
            next
        ]);

    return true;
}

function VERIFY_publicRecord_(
    record
) {
    if (!record) {
        return null;
    }

    const output = {};

    Object.keys(record)
        .forEach(function(key) {
            if (key !== "_row") {
                output[key] =
                    record[key];
            }
        });

    return output;
}

/* ========================================================================== */
/* SETTINGS */
/* ========================================================================== */

function VERIFY_seedSettings_() {
    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.SETTINGS
        );

    if (
        sheet.getLastRow() > 1
    ) {
        return false;
    }

    const now =
        new Date();

    [
        {
            Setting:
                "VerificationEngineEnabled",

            Value:
                true,

            Description:
                "Master enable switch for the Enterprise Verification Engine.",

            UpdatedAt:
                now
        },
        {
            Setting:
                "DefaultResultValidityDays",

            Value:
                365,

            Description:
                "Default validity period for verification results without an explicit expiration date.",

            UpdatedAt:
                now
        },
        {
            Setting:
                "AllowBrokerOverrides",

            Value:
                true,

            Description:
                "Allows authorized broker overrides to supersede provider results.",

            UpdatedAt:
                now
        },
        {
            Setting:
                "FailClosedOnProviderError",

            Value:
                true,

            Description:
                "Returns UNKNOWN or FAIL rather than assuming a verification passed when a provider errors.",

            UpdatedAt:
                now
        }
    ].forEach(
        function(setting) {
            VERIFY_appendRow_(
                sheet,
                setting
            );
        }
    );

    return true;
}

function VERIFY_getSettings_() {
    const settings = {};

    VERIFY_sheetObjects_(
        VERIFY_getSheet_(
            VERIFY.SHEETS.SETTINGS
        )
    ).forEach(
        function(row) {
            settings[
                String(
                    row.Setting || ""
                ).trim()
            ] = row.Value;
        }
    );

    return settings;
}

function VERIFY_getSetting_(
    settingName,
    fallback
) {
    const settings =
        VERIFY_getSettings_();

    return settings[
        settingName
    ] !== undefined
        ? settings[
            settingName
        ]
        : fallback;
}

function VERIFY_setSetting(
    settingName,
    value,
    description
) {
    VERIFY_initializeCore();

    const name =
        String(
            settingName || ""
        ).trim();

    if (!name) {
        throw new Error(
            "Setting name is required."
        );
    }

    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.SETTINGS
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "Setting",
            name
        );

    const record = {
        Setting:
            name,

        Value:
            value,

        Description:
            String(
                description ||
                (
                    existing &&
                    existing.Description
                ) ||
                ""
            ),

        UpdatedAt:
            new Date()
    };

    if (existing) {
        VERIFY_updateRow_(
            sheet,
            existing._row,
            record
        );
    } else {
        VERIFY_appendRow_(
            sheet,
            record
        );
    }

    return {
        success:
            true,

        setting:
            name,

        value:
            value,

        updatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* AUDIT LOG */
/* ========================================================================== */

function VERIFY_logAudit_(
    payload
) {
    const input =
        payload || {};

    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.AUDIT_LOG
        );

    const record = {
        AuditID:
            String(
                input.AuditID ||
                Utilities.getUuid()
            ),

        EventType:
            String(
                input.EventType ||
                "GENERAL"
            )
                .trim()
                .toUpperCase(),

        SubjectID:
            String(
                input.SubjectID ||
                ""
            ).trim(),

        VerificationType:
            VERIFY_normalizeVerificationType_(
                input.VerificationType ||
                VERIFY.TYPE.CUSTOM
            ),

        ReferenceID:
            String(
                input.ReferenceID ||
                ""
            ).trim(),

        Status:
            VERIFY_normalizeStatus_(
                input.Status ||
                VERIFY.STATUS.UNKNOWN
            ),

        Details:
            String(
                input.Details ||
                ""
            ),

        Actor:
            String(
                input.Actor ||
                VERIFY_currentUserEmail_() ||
                "SYSTEM"
            ),

        OccurredAt:
            input.OccurredAt ||
            new Date()
    };

    VERIFY_appendRow_(
        sheet,
        record
    );

    return record.AuditID;
}

function VERIFY_getAuditLog(
    limit
) {
    const max =
        Math.max(
            1,
            Number(
                limit || 100
            )
        );

    return VERIFY_sheetObjects_(
        VERIFY_getSheet_(
            VERIFY.SHEETS.AUDIT_LOG
        )
    )
        .sort(function(a, b) {
            return (
                VERIFY_dateValue_(
                    b.OccurredAt
                ) -
                VERIFY_dateValue_(
                    a.OccurredAt
                )
            );
        })
        .slice(
            0,
            max
        )
        .map(
            VERIFY_publicRecord_
        );
}

/* ========================================================================== */
/* NORMALIZATION */
/* ========================================================================== */

function VERIFY_normalizeEmail_(
    value
) {
    return String(
        value || ""
    )
        .trim()
        .toLowerCase();
}

function VERIFY_normalizeStatus_(
    value
) {
    const status =
        String(
            value ||
            VERIFY.STATUS.UNKNOWN
        )
            .trim()
            .toUpperCase();

    const allowed =
        Object.keys(
            VERIFY.STATUS
        ).map(function(key) {
            return VERIFY.STATUS[key];
        });

    return allowed.indexOf(
        status
    ) >= 0
        ? status
        : VERIFY.STATUS.UNKNOWN;
}

function VERIFY_normalizeVerificationType_(
    value
) {
    const type =
        String(
            value ||
            VERIFY.TYPE.CUSTOM
        )
            .trim()
            .toUpperCase();

    const allowed =
        Object.keys(
            VERIFY.TYPE
        ).map(function(key) {
            return VERIFY.TYPE[key];
        });

    return allowed.indexOf(
        type
    ) >= 0
        ? type
        : VERIFY.TYPE.CUSTOM;
}

function VERIFY_normalizeProviderType_(
    value
) {
    const type =
        String(
            value ||
            VERIFY.PROVIDER_TYPE.MANUAL
        )
            .trim()
            .toUpperCase();

    const allowed =
        Object.keys(
            VERIFY.PROVIDER_TYPE
        ).map(function(key) {
            return VERIFY
                .PROVIDER_TYPE[
                    key
                ];
        });

    return allowed.indexOf(
        type
    ) >= 0
        ? type
        : VERIFY
            .PROVIDER_TYPE
            .MANUAL;
}

function VERIFY_normalizeDate_(
    value
) {
    if (!value) {
        return "";
    }

    const date =
        value instanceof Date
            ? value
            : new Date(value);

    return Number.isFinite(
        date.getTime()
    )
        ? date
        : "";
}

function VERIFY_isTrue_(
    value
) {
    return (
        value === true ||
        String(
            value || ""
        )
            .trim()
            .toUpperCase() ===
            "TRUE"
    );
}

function VERIFY_nonNegativeNumber_(
    value
) {
    const number =
        Number(value);

    return Number.isFinite(number)
        ? Math.max(
            0,
            number
        )
        : 0;
}

function VERIFY_dateValue_(
    value
) {
    const date =
        VERIFY_normalizeDate_(
            value
        );

    return date
        ? date.getTime()
        : 0;
}

function VERIFY_currentUserEmail_() {
    try {
        return VERIFY_normalizeEmail_(
            Session
                .getEffectiveUser()
                .getEmail()
        );
    } catch (error) {
        return "";
    }
}

/* ========================================================================== */
/* CORE DIAGNOSTICS */
/* ========================================================================== */

function VERIFY_runCoreDiagnostics() {
    const requiredFunctions = [
        "VERIFY_initializeCore",
        "VERIFY_upsertSubject",
        "VERIFY_getSubject",
        "VERIFY_getSubjects",
        "VERIFY_getCoreStatus",
        "VERIFY_logAudit_"
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
            VERIFY.RELEASE,

        version:
            VERIFY_VERSION,

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

function VERIFY_testCore() {
    VERIFY_initializeCore();

    const unique =
        Utilities
            .getUuid()
            .substring(
                0,
                8
            );

    const subjectId =
        "VERIFY-TEST-" +
        unique;

    const upsert =
        VERIFY_upsertSubject({
            SubjectID:
                subjectId,

            SubjectType:
                "TEST",

            DisplayName:
                "Verification Core Test",

            Email:
                "verify-" +
                unique +
                "@example.com",

            ExternalID:
                unique,

            Active:
                true
        });

    const diagnostics =
        VERIFY_runCoreDiagnostics();

    if (
        diagnostics.overallStatus !==
        "PASS"
    ) {
        throw new Error(
            "Verification Core diagnostics failed."
        );
    }

    if (
        !upsert.success ||
        !VERIFY_getSubject(
            subjectId
        )
    ) {
        throw new Error(
            "Verification subject registry self-test failed."
        );
    }

    return {
        success:
            true,

        release:
            VERIFY.RELEASE,

        version:
            VERIFY_VERSION,

        diagnostics:
            diagnostics,

        subject:
            VERIFY_getSubject(
                subjectId
            ),

        status:
            VERIFY_getCoreStatus()
    };
}

/* ========================================================================== */
/* END OF FILE */
/* ========================================================================== */