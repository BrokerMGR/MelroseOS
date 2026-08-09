/******************************************************************************
 * MelroseOS Enterprise
 * Project : Enterprise Verification Engine
 * File    : VERIFY-01_VerificationRegistry.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Manages verification requests, results, overrides, and subject-level
 *   verification summaries.
 *
 * Safety:
 *   - Does not contact external providers.
 *   - Does not install triggers.
 *   - Does not send communications.
 *   - Does not alter CRM routing or agent eligibility.
 ******************************************************************************/

const VERIFY_REGISTRY_VERSION = "1.0.0";

/* ========================================================================== */
/* CREATE VERIFICATION REQUEST */
/* ========================================================================== */

function VERIFY_createRequest(payload) {
    VERIFY_initializeCore();

    const input =
        payload || {};

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

    const subject =
        VERIFY_getSubject(
            subjectId
        );

    if (!subject) {
        throw new Error(
            "Verification subject not found: " +
            subjectId
        );
    }

    const verificationType =
        VERIFY_normalizeVerificationType_(
            input.VerificationType ||
            input.verificationType
        );

    const providerId =
        String(
            input.ProviderID ||
            input.providerId ||
            ""
        ).trim();

    const requestId =
        String(
            input.RequestID ||
            input.requestId ||
            VERIFY_requestId_(
                subjectId,
                verificationType
            )
        ).trim();

    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.REQUESTS
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "RequestID",
            requestId
        );

    const now =
        new Date();

    const record = {
        RequestID:
            requestId,

        SubjectID:
            subjectId,

        VerificationType:
            verificationType,

        ProviderID:
            providerId,

        ReferenceValue:
            String(
                input.ReferenceValue ||
                input.referenceValue ||
                subject.ExternalID ||
                ""
            ).trim(),

        RequestedAt:
            input.RequestedAt ||
            input.requestedAt ||
            now,

        RequestedBy:
            String(
                input.RequestedBy ||
                input.requestedBy ||
                VERIFY_currentUserEmail_() ||
                "SYSTEM"
            ),

        Status:
            VERIFY_normalizeStatus_(
                input.Status ||
                input.status ||
                VERIFY.STATUS.PENDING
            ),

        CompletedAt:
            VERIFY_normalizeDate_(
                input.CompletedAt ||
                input.completedAt
            ),

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
                ? "REQUEST_UPDATED"
                : "REQUEST_CREATED",

        SubjectID:
            subjectId,

        VerificationType:
            verificationType,

        ReferenceID:
            requestId,

        Status:
            record.Status,

        Details:
            "Verification request registry updated.",

        Actor:
            record.RequestedBy
    });

    return {
        success:
            true,

        status:
            existing
                ? "UPDATED"
                : "CREATED",

        request:
            VERIFY_getRequest(
                requestId
            )
    };
}

/* ========================================================================== */
/* REQUEST LOOKUP */
/* ========================================================================== */

function VERIFY_getRequest(requestId) {
    const record =
        VERIFY_findRowByValue_(
            VERIFY_getSheet_(
                VERIFY.SHEETS.REQUESTS
            ),
            "RequestID",
            String(
                requestId || ""
            ).trim()
        );

    return record
        ? VERIFY_publicRecord_(
            record
        )
        : null;
}

function VERIFY_getRequests() {
    return VERIFY_sheetObjects_(
        VERIFY_getSheet_(
            VERIFY.SHEETS.REQUESTS
        )
    )
        .map(
            VERIFY_publicRecord_
        )
        .sort(function(a, b) {
            return (
                VERIFY_dateValue_(
                    b.RequestedAt
                ) -
                VERIFY_dateValue_(
                    a.RequestedAt
                )
            );
        });
}

function VERIFY_getSubjectRequests(
    subjectId
) {
    const target =
        String(
            subjectId || ""
        ).trim();

    return VERIFY_getRequests()
        .filter(function(request) {
            return (
                String(
                    request.SubjectID ||
                    ""
                ).trim() ===
                target
            );
        });
}

function VERIFY_getPendingRequests() {
    return VERIFY_getRequests()
        .filter(function(request) {
            return (
                VERIFY_normalizeStatus_(
                    request.Status
                ) ===
                VERIFY.STATUS.PENDING
            );
        });
}

/* ========================================================================== */
/* UPDATE REQUEST STATUS */
/* ========================================================================== */

function VERIFY_updateRequestStatus(
    requestId,
    status,
    details
) {
    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.REQUESTS
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "RequestID",
            String(
                requestId || ""
            ).trim()
        );

    if (!existing) {
        throw new Error(
            "Verification request not found."
        );
    }

    const normalizedStatus =
        VERIFY_normalizeStatus_(
            status
        );

    const updates = {
        Status:
            normalizedStatus,

        UpdatedAt:
            new Date()
    };

    if (
        normalizedStatus !==
        VERIFY.STATUS.PENDING
    ) {
        updates.CompletedAt =
            new Date();
    }

    VERIFY_updateRow_(
        sheet,
        existing._row,
        updates
    );

    VERIFY_logAudit_({
        EventType:
            "REQUEST_STATUS_UPDATED",

        SubjectID:
            existing.SubjectID,

        VerificationType:
            existing.VerificationType,

        ReferenceID:
            existing.RequestID,

        Status:
            normalizedStatus,

        Details:
            String(
                details ||
                "Verification request status updated."
            )
    });

    return VERIFY_getRequest(
        requestId
    );
}

/* ========================================================================== */
/* RECORD VERIFICATION RESULT */
/* ========================================================================== */

function VERIFY_recordResult(payload) {
    VERIFY_initializeCore();

    const input =
        payload || {};

    const requestId =
        String(
            input.RequestID ||
            input.requestId ||
            ""
        ).trim();

    if (!requestId) {
        throw new Error(
            "RequestID is required."
        );
    }

    const request =
        VERIFY_getRequest(
            requestId
        );

    if (!request) {
        throw new Error(
            "Verification request not found: " +
            requestId
        );
    }

    const resultId =
        String(
            input.ResultID ||
            input.resultId ||
            VERIFY_resultId_(
                requestId
            )
        ).trim();

    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.RESULTS
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "ResultID",
            resultId
        );

    const now =
        new Date();

    const status =
        VERIFY_normalizeStatus_(
            input.Status ||
            input.status ||
            VERIFY.STATUS.UNKNOWN
        );

    const record = {
        ResultID:
            resultId,

        RequestID:
            requestId,

        SubjectID:
            String(
                input.SubjectID ||
                input.subjectId ||
                request.SubjectID ||
                ""
            ).trim(),

        VerificationType:
            VERIFY_normalizeVerificationType_(
                input.VerificationType ||
                input.verificationType ||
                request.VerificationType
            ),

        ProviderID:
            String(
                input.ProviderID ||
                input.providerId ||
                request.ProviderID ||
                ""
            ).trim(),

        Status:
            status,

        VerifiedValue:
            String(
                input.VerifiedValue ||
                input.verifiedValue ||
                ""
            ),

        EffectiveDate:
            VERIFY_normalizeDate_(
                input.EffectiveDate ||
                input.effectiveDate
            ),

        ExpirationDate:
            VERIFY_normalizeDate_(
                input.ExpirationDate ||
                input.expirationDate
            ),

        EvidenceFileID:
            String(
                input.EvidenceFileID ||
                input.evidenceFileId ||
                ""
            ).trim(),

        Details:
            String(
                input.Details ||
                input.details ||
                ""
            ),

        VerifiedAt:
            VERIFY_normalizeDate_(
                input.VerifiedAt ||
                input.verifiedAt
            ) ||
            now,

        VerifiedBy:
            String(
                input.VerifiedBy ||
                input.verifiedBy ||
                VERIFY_currentUserEmail_() ||
                "SYSTEM"
            ),

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

    VERIFY_updateRequestStatus(
        requestId,
        status,
        "Verification result recorded."
    );

    VERIFY_logAudit_({
        EventType:
            existing
                ? "RESULT_UPDATED"
                : "RESULT_RECORDED",

        SubjectID:
            record.SubjectID,

        VerificationType:
            record.VerificationType,

        ReferenceID:
            resultId,

        Status:
            record.Status,

        Details:
            record.Details,

        Actor:
            record.VerifiedBy
    });

    return {
        success:
            true,

        status:
            existing
                ? "UPDATED"
                : "CREATED",

        result:
            VERIFY_getResult(
                resultId
            )
    };
}

/* ========================================================================== */
/* RESULT LOOKUP */
/* ========================================================================== */

function VERIFY_getResult(resultId) {
    const record =
        VERIFY_findRowByValue_(
            VERIFY_getSheet_(
                VERIFY.SHEETS.RESULTS
            ),
            "ResultID",
            String(
                resultId || ""
            ).trim()
        );

    return record
        ? VERIFY_publicRecord_(
            record
        )
        : null;
}

function VERIFY_getResults() {
    return VERIFY_sheetObjects_(
        VERIFY_getSheet_(
            VERIFY.SHEETS.RESULTS
        )
    )
        .map(
            VERIFY_publicRecord_
        )
        .sort(function(a, b) {
            return (
                VERIFY_dateValue_(
                    b.VerifiedAt
                ) -
                VERIFY_dateValue_(
                    a.VerifiedAt
                )
            );
        });
}

function VERIFY_getSubjectResults(
    subjectId
) {
    const target =
        String(
            subjectId || ""
        ).trim();

    return VERIFY_getResults()
        .filter(function(result) {
            return (
                String(
                    result.SubjectID ||
                    ""
                ).trim() ===
                target
            );
        });
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* BROKER OVERRIDES */
/* ========================================================================== */

function VERIFY_applyOverride(payload) {

    VERIFY_initializeCore();

    const input =
        payload || {};

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

    const verificationType =
        VERIFY_normalizeVerificationType_(
            input.VerificationType ||
            input.verificationType
        );

    const overrideId =
        String(
            input.OverrideID ||
            input.overrideId ||
            VERIFY_overrideId_(
                subjectId,
                verificationType
            )
        ).trim();

    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.OVERRIDES
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "OverrideID",
            overrideId
        );

    const now =
        new Date();

    const record = {

        OverrideID:
            overrideId,

        SubjectID:
            subjectId,

        VerificationType:
            verificationType,

        Status:
            VERIFY_normalizeStatus_(
                input.Status ||
                input.status ||
                VERIFY.STATUS.OVERRIDDEN
            ),

        Reason:
            String(
                input.Reason ||
                input.reason ||
                ""
            ),

        EffectiveDate:
            VERIFY_normalizeDate_(
                input.EffectiveDate ||
                input.effectiveDate
            ) || now,

        ExpirationDate:
            VERIFY_normalizeDate_(
                input.ExpirationDate ||
                input.expirationDate
            ),

        ApprovedBy:
            String(
                input.ApprovedBy ||
                input.approvedBy ||
                VERIFY_currentUserEmail_()
            ),

        ApprovedAt:
            now,

        Active:
            input.Active !== undefined
                ? VERIFY_isTrue_(
                    input.Active
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
            "BROKER_OVERRIDE",

        SubjectID:
            subjectId,

        VerificationType:
            verificationType,

        ReferenceID:
            overrideId,

        Status:
            record.Status,

        Details:
            record.Reason,

        Actor:
            record.ApprovedBy

    });

    return {

        success:
            true,

        override:
            VERIFY_getOverride(
                overrideId
            )

    };

}

function VERIFY_getOverride(
    overrideId
) {

    const record =
        VERIFY_findRowByValue_(
            VERIFY_getSheet_(
                VERIFY.SHEETS.OVERRIDES
            ),
            "OverrideID",
            String(
                overrideId || ""
            ).trim()
        );

    return record
        ? VERIFY_publicRecord_(
            record
        )
        : null;

}

function VERIFY_getSubjectOverrides(
    subjectId
) {

    return VERIFY_sheetObjects_(
        VERIFY_getSheet_(
            VERIFY.SHEETS.OVERRIDES
        )
    )
        .filter(function(row){

            return (
                String(
                    row.SubjectID || ""
                ).trim() ===
                String(
                    subjectId || ""
                ).trim()
            );

        })
        .map(
            VERIFY_publicRecord_
        );

}

/* ========================================================================== */
/* SUMMARY */
/* ========================================================================== */

function VERIFY_getVerificationSummary() {

    const requests =
        VERIFY_getRequests();

    const results =
        VERIFY_getResults();

    const overrides =
        VERIFY_sheetObjects_(
            VERIFY_getSheet_(
                VERIFY.SHEETS.OVERRIDES
            )
        );

    return {

        release:
            VERIFY.RELEASE,

        version:
            VERIFY_REGISTRY_VERSION,

        subjects:
            VERIFY_getSubjects()
                .length,

        requests:
            requests.length,

        pending:
            requests.filter(function(r){

                return (
                    VERIFY_normalizeStatus_(
                        r.Status
                    ) ===
                    VERIFY.STATUS.PENDING
                );

            }).length,

        results:
            results.length,

        passed:
            results.filter(function(r){

                return (
                    VERIFY_normalizeStatus_(
                        r.Status
                    ) ===
                    VERIFY.STATUS.PASS
                );

            }).length,

        warnings:
            results.filter(function(r){

                return (
                    VERIFY_normalizeStatus_(
                        r.Status
                    ) ===
                    VERIFY.STATUS.WARNING
                );

            }).length,

        failed:
            results.filter(function(r){

                return (
                    VERIFY_normalizeStatus_(
                        r.Status
                    ) ===
                    VERIFY.STATUS.FAIL
                );

            }).length,

        overrides:
            overrides.length,

        generatedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* IDS */
/* ========================================================================== */

function VERIFY_requestId_(
    subjectId,
    verificationType
) {

    return [

        "REQ",

        String(subjectId)
            .trim()
            .toUpperCase(),

        String(
            verificationType
        )
            .trim()
            .toUpperCase(),

        Utilities.getUuid()
            .substring(0,8)

    ].join("-");

}

function VERIFY_resultId_(
    requestId
) {

    return [

        "RES",

        String(requestId)
            .trim()
            .toUpperCase(),

        Utilities.getUuid()
            .substring(0,8)

    ].join("-");

}

function VERIFY_overrideId_(
    subjectId,
    verificationType
) {

    return [

        "OVR",

        String(subjectId)
            .trim()
            .toUpperCase(),

        String(
            verificationType
        )
            .trim()
            .toUpperCase()

    ].join("-");

}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function VERIFY_runRegistryDiagnostics() {

    const required = [

        "VERIFY_createRequest",

        "VERIFY_recordResult",

        "VERIFY_applyOverride",

        "VERIFY_getVerificationSummary"

    ];

    const tests =
        required.map(function(fn){

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
        tests.filter(function(t){

            return (
                t.status ===
                "FAIL"
            );

        }).length;

    return {

        release:
            VERIFY.RELEASE,

        version:
            VERIFY_REGISTRY_VERSION,

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