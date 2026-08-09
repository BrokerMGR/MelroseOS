/******************************************************************************
 * MelroseOS Enterprise
 * Project : Enterprise Education & Compliance
 * File    : EDU-02_CourseCompletionRegistry.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Manages education courses, agent completion records, certificate links,
 *   verification state, and snapshot refresh integration.
 *
 * Safety:
 *   - Does not scrape external systems.
 *   - Does not send communications.
 *   - Does not install triggers.
 *   - Does not alter CRM routing or agent eligibility.
 ******************************************************************************/

const EDU_COMPLETION_REGISTRY_VERSION = "1.0.0";

/* ========================================================================== */
/* COURSE REGISTRY */
/* ========================================================================== */

function EDU_upsertCourse(course) {
    EDU_initializeCore();

    const input =
        course || {};

    const courseId =
        String(
            input.CourseID ||
            input.courseId ||
            ""
        ).trim();

    if (!courseId) {
        throw new Error(
            "CourseID is required."
        );
    }

    const sheet =
        EDU_getSheet_(
            EDU.SHEETS.COURSES
        );

    const existing =
        EDU_findRowByValue_(
            sheet,
            "CourseID",
            courseId
        );

    const now =
        new Date();

    const record = {
        CourseID:
            courseId,

        CourseName:
            String(
                input.CourseName ||
                input.courseName ||
                ""
            ).trim(),

        Provider:
            String(
                input.Provider ||
                input.provider ||
                ""
            ).trim(),

        CourseType:
            String(
                input.CourseType ||
                input.courseType ||
                "CONTINUING_EDUCATION"
            )
                .trim()
                .toUpperCase(),

        CreditHours:
            EDU_nonNegativeNumber_(
                input.CreditHours !== undefined
                    ? input.CreditHours
                    : input.creditHours
            ),

        Mandatory:
            input.Mandatory !== undefined
                ? EDU_isTrue_(
                    input.Mandatory
                )
                : EDU_isTrue_(
                    input.mandatory
                ),

        Active:
            input.Active !== undefined
                ? EDU_isTrue_(
                    input.Active
                )
                : input.active !== undefined
                    ? EDU_isTrue_(
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

        course:
            EDU_getCourse(
                courseId
            )
    };
}

function EDU_getCourse(courseId) {
    const record =
        EDU_findRowByValue_(
            EDU_getSheet_(
                EDU.SHEETS.COURSES
            ),
            "CourseID",
            String(
                courseId || ""
            ).trim()
        );

    return record
        ? EDU_publicRecord_(
            record
        )
        : null;
}

function EDU_getCourses() {
    return EDU_sheetObjects_(
        EDU_getSheet_(
            EDU.SHEETS.COURSES
        )
    )
        .map(
            EDU_publicRecord_
        )
        .sort(function(a, b) {
            return String(
                a.CourseName || ""
            ).localeCompare(
                String(
                    b.CourseName || ""
                )
            );
        });
}

function EDU_getActiveCourses() {
    return EDU_getCourses()
        .filter(function(course) {
            return EDU_isTrue_(
                course.Active
            );
        });
}

function EDU_getMandatoryCourses() {
    return EDU_getActiveCourses()
        .filter(function(course) {
            return EDU_isTrue_(
                course.Mandatory
            );
        });
}

/* ========================================================================== */
/* COMPLETION REGISTRY */
/* ========================================================================== */

function EDU_recordCompletion(completion) {
    EDU_initializeCore();

    const input =
        completion || {};

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

    const agent =
        EDU_getAgent(
            agentId
        );

    if (!agent) {
        throw new Error(
            "Unknown education agent: " +
            agentId
        );
    }

    const courseId =
        String(
            input.CourseID ||
            input.courseId ||
            ""
        ).trim();

    const course =
        courseId
            ? EDU_getCourse(
                courseId
            )
            : null;

    const courseName =
        String(
            input.CourseName ||
            input.courseName ||
            (
                course &&
                course.CourseName
            ) ||
            ""
        ).trim();

    if (!courseName) {
        throw new Error(
            "CourseName is required."
        );
    }

    const completionDate =
        EDU_normalizeDate_(
            input.CompletionDate ||
            input.completionDate
        );

    if (!completionDate) {
        throw new Error(
            "A valid CompletionDate is required."
        );
    }

    const completionId =
        String(
            input.CompletionID ||
            input.completionId ||
            EDU_completionId_(
                agentId,
                courseId,
                courseName,
                completionDate
            )
        ).trim();

    const sheet =
        EDU_getSheet_(
            EDU.SHEETS.COMPLETIONS
        );

    const existing =
        EDU_findRowByValue_(
            sheet,
            "CompletionID",
            completionId
        );

    const now =
        new Date();

    const record = {
        CompletionID:
            completionId,

        AgentID:
            agentId,

        CourseID:
            courseId,

        CourseName:
            courseName,

        Provider:
            String(
                input.Provider ||
                input.provider ||
                (
                    course &&
                    course.Provider
                ) ||
                ""
            ).trim(),

        CreditHours:
            EDU_nonNegativeNumber_(
                input.CreditHours !== undefined
                    ? input.CreditHours
                    : input.creditHours !== undefined
                        ? input.creditHours
                        : course
                            ? course.CreditHours
                            : 0
            ),

        CompletionDate:
            completionDate,

        CertificateFileID:
            String(
                input.CertificateFileID ||
                input.certificateFileId ||
                ""
            ).trim(),

        VerificationStatus:
            EDU_normalizeVerificationStatus_(
                input.VerificationStatus ||
                input.verificationStatus ||
                "PENDING"
            ),

        VerifiedAt:
            EDU_normalizeDate_(
                input.VerifiedAt ||
                input.verifiedAt
            ),

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

    const snapshotResult =
        typeof EDU_buildAgentSnapshot_ ===
        "function"
            ? EDU_buildAgentSnapshot_(
                agent
            )
            : null;

    return {
        success:
            true,

        status:
            existing
                ? "UPDATED"
                : "CREATED",

        completion:
            EDU_getCompletion(
                completionId
            ),

        snapshot:
            snapshotResult
    };
}

function EDU_getCompletion(
    completionId
) {
    const record =
        EDU_findRowByValue_(
            EDU_getSheet_(
                EDU.SHEETS.COMPLETIONS
            ),
            "CompletionID",
            String(
                completionId || ""
            ).trim()
        );

    return record
        ? EDU_publicRecord_(
            record
        )
        : null;
}

function EDU_getCompletions() {
    return EDU_sheetObjects_(
        EDU_getSheet_(
            EDU.SHEETS.COMPLETIONS
        )
    )
        .map(
            EDU_publicRecord_
        )
        .sort(function(a, b) {
            return (
                EDU_dateValue_(
                    b.CompletionDate
                ) -
                EDU_dateValue_(
                    a.CompletionDate
                )
            );
        });
}

function EDU_getAgentCompletions(
    agentId
) {
    return EDU_getCompletions()
        .filter(function(completion) {
            return (
                String(
                    completion.AgentID ||
                    ""
                ).trim() ===
                String(
                    agentId || ""
                ).trim()
            );
        });
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* VERIFICATION */
/* ========================================================================== */

function EDU_verifyCompletion(
    completionId,
    verified,
    verifiedBy
) {
    const sheet =
        EDU_getSheet_(
            EDU.SHEETS.COMPLETIONS
        );

    const record =
        EDU_findRowByValue_(
            sheet,
            "CompletionID",
            String(
                completionId || ""
            ).trim()
        );

    if (!record) {
        throw new Error(
            "Completion record not found."
        );
    }

    record.VerificationStatus =
        verified === true
            ? "VERIFIED"
            : "REJECTED";

    record.VerifiedAt =
        new Date();

    EDU_updateRow_(
        sheet,
        record._row,
        record
    );

    EDU_logVerification_(
        record.AgentID,
        record.CourseName,
        record.VerificationStatus,
        verifiedBy
    );

    const agent =
        EDU_getAgent(
            record.AgentID
        );

    if (
        agent &&
        typeof EDU_buildAgentSnapshot_ ===
            "function"
    ) {
        EDU_buildAgentSnapshot_(
            agent
        );
    }

    return {
        success: true,
        completion:
            EDU_getCompletion(
                completionId
            )
    };
}

/* ========================================================================== */
/* CERTIFICATES */
/* ========================================================================== */

function EDU_attachCertificate(
    completionId,
    driveFileId
) {
    const sheet =
        EDU_getSheet_(
            EDU.SHEETS.COMPLETIONS
        );

    const record =
        EDU_findRowByValue_(
            sheet,
            "CompletionID",
            String(
                completionId || ""
            ).trim()
        );

    if (!record) {
        throw new Error(
            "Completion not found."
        );
    }

    record.CertificateFileID =
        String(
            driveFileId || ""
        ).trim();

    record.UpdatedAt =
        new Date();

    EDU_updateRow_(
        sheet,
        record._row,
        record
    );

    return {
        success: true,
        completion:
            EDU_getCompletion(
                completionId
            )
    };
}

/* ========================================================================== */
/* VERIFICATION LOG */
/* ========================================================================== */

function EDU_logVerification_(
    agentId,
    details,
    result,
    verifiedBy
) {
    EDU_appendRow_(
        EDU_getSheet_(
            EDU.SHEETS
                .VERIFICATION_LOG
        ),
        {
            VerificationID:
                Utilities.getUuid(),

            AgentID:
                agentId,

            LicenseNumber:
                EDU_getAgent(
                    agentId
                )?.LicenseNumber || "",

            VerificationType:
                "COURSE",

            Result:
                result,

            Details:
                details,

            VerifiedAt:
                new Date(),

            VerifiedBy:
                verifiedBy || ""
        }
    );
}

/* ========================================================================== */
/* NORMALIZATION */
/* ========================================================================== */

function EDU_normalizeVerificationStatus_(
    value
) {
    const status =
        String(
            value || "PENDING"
        )
            .trim()
            .toUpperCase();

    switch (status) {
        case "VERIFIED":
        case "REJECTED":
        case "PENDING":
            return status;

        default:
            return "PENDING";
    }
}

/* ========================================================================== */
/* IDS */
/* ========================================================================== */

function EDU_completionId_(
    agentId,
    courseId,
    courseName,
    completionDate
) {
    return [
        "COMP",
        String(agentId || "")
            .trim()
            .toUpperCase(),
        String(courseId || "")
            .trim()
            .toUpperCase() ||
            String(courseName || "")
                .trim()
                .toUpperCase()
                .replace(
                    /[^A-Z0-9]+/g,
                    "-"
                ),
        Utilities.formatDate(
            completionDate,
            Session.getScriptTimeZone(),
            "yyyyMMdd"
        )
    ].join("-");
}

/* ========================================================================== */
/* DASHBOARD SUMMARY */
/* ========================================================================== */

function EDU_getCompletionSummary() {

    const completions =
        EDU_getCompletions();

    const verified =
        completions.filter(
            function(record) {
                return (
                    record.VerificationStatus ===
                    "VERIFIED"
                );
            }
        ).length;

    const pending =
        completions.filter(
            function(record) {
                return (
                    record.VerificationStatus ===
                    "PENDING"
                );
            }
        ).length;

    const rejected =
        completions.filter(
            function(record) {
                return (
                    record.VerificationStatus ===
                    "REJECTED"
                );
            }
        ).length;

    return {

        release:
            "MOS5-007",

        version:
            EDU_COMPLETION_REGISTRY_VERSION,

        total:
            completions.length,

        verified:
            verified,

        pending:
            pending,

        rejected:
            rejected,

        generatedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function EDU_runCompletionRegistryDiagnostics() {

    const required = [

        "EDU_upsertCourse",

        "EDU_recordCompletion",

        "EDU_verifyCompletion",

        "EDU_getCompletionSummary"

    ];

    const tests =
        required.map(function(fn) {

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
            "MOS5-007",

        version:
            EDU_COMPLETION_REGISTRY_VERSION,

        overallStatus:
            failed === 0
                ? "PASS"
                : "FAIL",

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