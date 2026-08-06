/******************************************************************************
 * MelroseOS Enterprise
 * Project : Enterprise Verification Engine
 * File    : VERIFY-03_VerificationEngine.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Orchestrates verification requests, active broker overrides, valid cached
 *   results, provider resolution, provider execution, result persistence, and
 *   authoritative verification responses.
 *
 * Safety:
 *   - Does not install triggers.
 *   - Does not send communications.
 *   - Does not alter CRM routing or agent eligibility.
 *   - External providers fail closed unless explicitly implemented.
 ******************************************************************************/

const VERIFY_ENGINE_VERSION = "1.0.0";

/* ========================================================================== */
/* PUBLIC VERIFICATION API */
/* ========================================================================== */

function VERIFY_verify(payload) {
    VERIFY_initializeCore();

    const input =
        VERIFY_ENGINE_normalizeRequest_(
            payload
        );

    const subject =
        VERIFY_getSubject(
            input.SubjectID
        );

    if (!subject) {
        throw new Error(
            "Verification subject not found: " +
            input.SubjectID
        );
    }

    if (
        !VERIFY_isTrue_(
            subject.Active
        )
    ) {
        return VERIFY_ENGINE_response_({
            SubjectID:
                input.SubjectID,

            VerificationType:
                input.VerificationType,

            Status:
                VERIFY.STATUS.FAIL,

            Source:
                "SUBJECT",

            Details:
                "Verification subject is inactive.",

            Cached:
                false,

            Overridden:
                false
        });
    }

    const activeOverride =
        VERIFY_ENGINE_findActiveOverride_(
            input.SubjectID,
            input.VerificationType,
            input.AsOfDate
        );

    if (
        activeOverride &&
        input.IgnoreOverride !== true
    ) {
        VERIFY_logAudit_({
            EventType:
                "OVERRIDE_APPLIED",

            SubjectID:
                input.SubjectID,

            VerificationType:
                input.VerificationType,

            ReferenceID:
                activeOverride.OverrideID,

            Status:
                activeOverride.Status,

            Details:
                activeOverride.Reason,

            Actor:
                input.RequestedBy
        });

        return VERIFY_ENGINE_response_({
            SubjectID:
                input.SubjectID,

            VerificationType:
                input.VerificationType,

            Status:
                activeOverride.Status,

            Source:
                "BROKER_OVERRIDE",

            ProviderID:
                "",

            ReferenceID:
                activeOverride.OverrideID,

            VerifiedValue:
                "",

            EffectiveDate:
                activeOverride.EffectiveDate,

            ExpirationDate:
                activeOverride.ExpirationDate,

            EvidenceFileID:
                "",

            Details:
                activeOverride.Reason,

            VerifiedAt:
                activeOverride.ApprovedAt,

            VerifiedBy:
                activeOverride.ApprovedBy,

            Cached:
                false,

            Overridden:
                true
        });
    }

    const cachedResult =
        VERIFY_ENGINE_findValidCachedResult_(
            input.SubjectID,
            input.VerificationType,
            input.AsOfDate
        );

    if (
        cachedResult &&
        input.ForceRefresh !== true
    ) {
        VERIFY_logAudit_({
            EventType:
                "CACHED_RESULT_USED",

            SubjectID:
                input.SubjectID,

            VerificationType:
                input.VerificationType,

            ReferenceID:
                cachedResult.ResultID,

            Status:
                cachedResult.Status,

            Details:
                "A valid cached verification result was returned.",

            Actor:
                input.RequestedBy
        });

        return VERIFY_ENGINE_response_({
            SubjectID:
                input.SubjectID,

            VerificationType:
                input.VerificationType,

            Status:
                cachedResult.Status,

            Source:
                "CACHE",

            ProviderID:
                cachedResult.ProviderID,

            ReferenceID:
                cachedResult.ResultID,

            VerifiedValue:
                cachedResult.VerifiedValue,

            EffectiveDate:
                cachedResult.EffectiveDate,

            ExpirationDate:
                cachedResult.ExpirationDate,

            EvidenceFileID:
                cachedResult.EvidenceFileID,

            Details:
                cachedResult.Details,

            VerifiedAt:
                cachedResult.VerifiedAt,

            VerifiedBy:
                cachedResult.VerifiedBy,

            Cached:
                true,

            Overridden:
                false
        });
    }

    const provider =
        VERIFY_resolveProvider(
            input.VerificationType,
            input.PreferredProviderID
        );

    if (!provider) {
        return VERIFY_ENGINE_recordUnavailableProvider_(
            input
        );
    }

    const requestResult =
        VERIFY_createRequest({
            SubjectID:
                input.SubjectID,

            VerificationType:
                input.VerificationType,

            ProviderID:
                provider.ProviderID,

            ReferenceValue:
                input.ReferenceValue,

            RequestedBy:
                input.RequestedBy,

            Status:
                VERIFY.STATUS.PENDING
        });

    const request =
        requestResult.request;

    let providerResult;

    try {
        providerResult =
            VERIFY_ENGINE_executeProvider_(
                provider,
                subject,
                request,
                input
            );
    } catch (error) {
        providerResult = {
            Status:
                VERIFY.STATUS.UNKNOWN,

            VerifiedValue:
                "",

            EffectiveDate:
                "",

            ExpirationDate:
                "",

            EvidenceFileID:
                "",

            Details:
                VERIFY_ENGINE_errorMessage_(
                    error
                ),

            VerifiedAt:
                new Date(),

            VerifiedBy:
                provider.ProviderID
        };
    }

    const normalizedResult =
        VERIFY_ENGINE_normalizeProviderResult_(
            providerResult,
            provider,
            request,
            input
        );

    const recorded =
        VERIFY_recordResult({
            RequestID:
                request.RequestID,

            SubjectID:
                input.SubjectID,

            VerificationType:
                input.VerificationType,

            ProviderID:
                provider.ProviderID,

            Status:
                normalizedResult.Status,

            VerifiedValue:
                normalizedResult.VerifiedValue,

            EffectiveDate:
                normalizedResult.EffectiveDate,

            ExpirationDate:
                normalizedResult.ExpirationDate,

            EvidenceFileID:
                normalizedResult.EvidenceFileID,

            Details:
                normalizedResult.Details,

            VerifiedAt:
                normalizedResult.VerifiedAt,

            VerifiedBy:
                normalizedResult.VerifiedBy
        });

    const result =
        recorded.result;

    return VERIFY_ENGINE_response_({
        SubjectID:
            input.SubjectID,

        VerificationType:
            input.VerificationType,

        Status:
            result.Status,

        Source:
            "PROVIDER",

        ProviderID:
            result.ProviderID,

        RequestID:
            result.RequestID,

        ReferenceID:
            result.ResultID,

        VerifiedValue:
            result.VerifiedValue,

        EffectiveDate:
            result.EffectiveDate,

        ExpirationDate:
            result.ExpirationDate,

        EvidenceFileID:
            result.EvidenceFileID,

        Details:
            result.Details,

        VerifiedAt:
            result.VerifiedAt,

        VerifiedBy:
            result.VerifiedBy,

        Cached:
            false,

        Overridden:
            false
    });
}

/* ========================================================================== */
/* SUBJECT VERIFICATION */
/* ========================================================================== */

function VERIFY_verifySubject(
    subjectId,
    verificationTypes,
    options
) {
    const types =
        VERIFY_ENGINE_normalizeTypes_(
            verificationTypes
        );

    const settings =
        options || {};

    const results =
        types.map(function(
            verificationType
        ) {
            try {
                return VERIFY_verify({
                    SubjectID:
                        subjectId,

                    VerificationType:
                        verificationType,

                    PreferredProviderID:
                        settings.PreferredProviderID ||
                        "",

                    ReferenceValue:
                        settings.ReferenceValue ||
                        "",

                    ForceRefresh:
                        settings.ForceRefresh ===
                        true,

                    IgnoreOverride:
                        settings.IgnoreOverride ===
                        true,

                    RequestedBy:
                        settings.RequestedBy ||
                        VERIFY_currentUserEmail_() ||
                        "SYSTEM",

                    EvidenceFileID:
                        settings.EvidenceFileID ||
                        "",

                    BrokerDecision:
                        settings.BrokerDecision,

                    Details:
                        settings.Details ||
                        ""
                });
            } catch (error) {
                return VERIFY_ENGINE_response_({
                    SubjectID:
                        subjectId,

                    VerificationType:
                        verificationType,

                    Status:
                        VERIFY.STATUS.UNKNOWN,

                    Source:
                        "ENGINE_ERROR",

                    Details:
                        VERIFY_ENGINE_errorMessage_(
                            error
                        ),

                    Cached:
                        false,

                    Overridden:
                        false
                });
            }
        });

    return {
        success:
            results.every(
                function(result) {
                    return (
                        result.Status ===
                            VERIFY.STATUS.PASS ||
                        result.Status ===
                            VERIFY.STATUS.OVERRIDDEN
                    );
                }
            ),

        subjectId:
            String(
                subjectId || ""
            ).trim(),

        total:
            results.length,

        passed:
            results.filter(
                function(result) {
                    return (
                        result.Status ===
                        VERIFY.STATUS.PASS
                    );
                }
            ).length,

        warnings:
            results.filter(
                function(result) {
                    return (
                        result.Status ===
                        VERIFY.STATUS.WARNING
                    );
                }
            ).length,

        failed:
            results.filter(
                function(result) {
                    return (
                        result.Status ===
                            VERIFY.STATUS.FAIL ||
                        result.Status ===
                            VERIFY.STATUS.EXPIRED
                    );
                }
            ).length,

        unknown:
            results.filter(
                function(result) {
                    return (
                        result.Status ===
                            VERIFY.STATUS.UNKNOWN ||
                        result.Status ===
                            VERIFY.STATUS.PENDING
                    );
                }
            ).length,

        overridden:
            results.filter(
                function(result) {
                    return (
                        result.Overridden ===
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
/* ACTIVE OVERRIDE RESOLUTION */
/* ========================================================================== */

function VERIFY_ENGINE_findActiveOverride_(
    subjectId,
    verificationType,
    asOfDate
) {
    const targetType =
        VERIFY_normalizeVerificationType_(
            verificationType
        );

    const date =
        VERIFY_normalizeDate_(
            asOfDate
        ) ||
        new Date();

    const overrides =
        VERIFY_getSubjectOverrides(
            subjectId
        )
            .filter(
                function(override) {
                    if (
                        !VERIFY_isTrue_(
                            override.Active
                        )
                    ) {
                        return false;
                    }

                    if (
                        VERIFY_normalizeVerificationType_(
                            override.VerificationType
                        ) !==
                        targetType
                    ) {
                        return false;
                    }

                    const effectiveDate =
                        VERIFY_normalizeDate_(
                            override.EffectiveDate
                        );

                    const expirationDate =
                        VERIFY_normalizeDate_(
                            override.ExpirationDate
                        );

                    if (
                        effectiveDate &&
                        date < effectiveDate
                    ) {
                        return false;
                    }

                    if (
                        expirationDate &&
                        date > expirationDate
                    ) {
                        return false;
                    }

                    return true;
                }
            )
            .sort(
                function(a, b) {
                    return (
                        VERIFY_dateValue_(
                            b.ApprovedAt
                        ) -
                        VERIFY_dateValue_(
                            a.ApprovedAt
                        )
                    );
                }
            );

    return overrides.length
        ? overrides[0]
        : null;
}

/* ========================================================================== */
/* CACHED RESULT RESOLUTION */
/* ========================================================================== */

function VERIFY_ENGINE_findValidCachedResult_(
    subjectId,
    verificationType,
    asOfDate
) {
    const targetType =
        VERIFY_normalizeVerificationType_(
            verificationType
        );

    const date =
        VERIFY_normalizeDate_(
            asOfDate
        ) ||
        new Date();

    const results =
        VERIFY_getSubjectResults(
            subjectId
        )
            .filter(
                function(result) {
                    if (
                        VERIFY_normalizeVerificationType_(
                            result.VerificationType
                        ) !==
                        targetType
                    ) {
                        return false;
                    }

                    const status =
                        VERIFY_normalizeStatus_(
                            result.Status
                        );

                    if (
                        status ===
                            VERIFY.STATUS.PENDING ||
                        status ===
                            VERIFY.STATUS.UNKNOWN
                    ) {
                        return false;
                    }

                    const effectiveDate =
                        VERIFY_normalizeDate_(
                            result.EffectiveDate
                        );

                    const expirationDate =
                        VERIFY_normalizeDate_(
                            result.ExpirationDate
                        );

                    if (
                        effectiveDate &&
                        date < effectiveDate
                    ) {
                        return false;
                    }

                    if (
                        expirationDate &&
                        date > expirationDate
                    ) {
                        return false;
                    }

                    return true;
                }
            )
            .sort(
                function(a, b) {
                    return (
                        VERIFY_dateValue_(
                            b.VerifiedAt
                        ) -
                        VERIFY_dateValue_(
                            a.VerifiedAt
                        )
                    );
                }
            );

    return results.length
        ? results[0]
        : null;
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* PROVIDER EXECUTION */
/* ========================================================================== */

function VERIFY_ENGINE_executeProvider_(
    provider,
    subject,
    request,
    options
) {

    const type =
        VERIFY_normalizeProviderType_(
            provider.ProviderType
        );

    switch (type) {

        case VERIFY.PROVIDER_TYPE.BROKER:

            return VERIFY_ENGINE_executeBrokerProvider_(
                provider,
                subject,
                request,
                options
            );

        case VERIFY.PROVIDER_TYPE.FILE:

            return VERIFY_ENGINE_executeFileProvider_(
                provider,
                subject,
                request,
                options
            );

        case VERIFY.PROVIDER_TYPE.MANUAL:

            return VERIFY_ENGINE_executeManualProvider_(
                provider,
                subject,
                request,
                options
            );

        case VERIFY.PROVIDER_TYPE.LREC:

            return VERIFY_ENGINE_executeLRECProvider_(
                provider,
                subject,
                request,
                options
            );

        case VERIFY.PROVIDER_TYPE.FUTURE_API:

            return VERIFY_ENGINE_executeFutureApiProvider_(
                provider,
                subject,
                request,
                options
            );

        default:

            return {

                Status:
                    VERIFY.STATUS.UNKNOWN,

                Details:
                    "Unsupported provider type."

            };

    }

}

/* ========================================================================== */
/* PROVIDER IMPLEMENTATIONS */
/* ========================================================================== */

function VERIFY_ENGINE_executeBrokerProvider_(
    provider,
    subject,
    request,
    options
) {

    return {

        Status:
            options.BrokerDecision ||
            VERIFY.STATUS.PENDING,

        VerifiedValue:
            "",

        EffectiveDate:
            new Date(),

        ExpirationDate:
            "",

        EvidenceFileID:
            options.EvidenceFileID || "",

        Details:
            options.Details ||
            "Broker verification pending.",

        VerifiedAt:
            new Date(),

        VerifiedBy:
            provider.ProviderID

    };

}

function VERIFY_ENGINE_executeFileProvider_(
    provider,
    subject,
    request,
    options
) {

    if (!options.EvidenceFileID) {

        return {

            Status:
                VERIFY.STATUS.WARNING,

            Details:
                "Evidence file not supplied."

        };

    }

    return {

        Status:
            VERIFY.STATUS.PASS,

        VerifiedValue:
            options.EvidenceFileID,

        EffectiveDate:
            new Date(),

        ExpirationDate:
            "",

        EvidenceFileID:
            options.EvidenceFileID,

        Details:
            "Evidence file accepted.",

        VerifiedAt:
            new Date(),

        VerifiedBy:
            provider.ProviderID

    };

}

function VERIFY_ENGINE_executeManualProvider_(
    provider
) {

    return {

        Status:
            VERIFY.STATUS.PENDING,

        Details:
            "Manual verification required.",

        VerifiedAt:
            new Date(),

        VerifiedBy:
            provider.ProviderID

    };

}

function VERIFY_ENGINE_executeLRECProvider_(
    provider
) {

    return {

        Status:
            VERIFY.STATUS.UNKNOWN,

        Details:
            "LREC provider not yet implemented.",

        VerifiedAt:
            new Date(),

        VerifiedBy:
            provider.ProviderID

    };

}

function VERIFY_ENGINE_executeFutureApiProvider_(
    provider
) {

    return {

        Status:
            VERIFY.STATUS.UNKNOWN,

        Details:
            "Future API provider placeholder.",

        VerifiedAt:
            new Date(),

        VerifiedBy:
            provider.ProviderID

    };

}

/* ========================================================================== */
/* RESULT NORMALIZATION */
/* ========================================================================== */

function VERIFY_ENGINE_normalizeProviderResult_(
    result,
    provider,
    request,
    options
) {

    const input =
        result || {};

    return {

        Status:
            VERIFY_normalizeStatus_(
                input.Status
            ),

        VerifiedValue:
            String(
                input.VerifiedValue || ""
            ),

        EffectiveDate:
            VERIFY_normalizeDate_(
                input.EffectiveDate
            ) || new Date(),

        ExpirationDate:
            VERIFY_normalizeDate_(
                input.ExpirationDate
            ),

        EvidenceFileID:
            String(
                input.EvidenceFileID || ""
            ),

        Details:
            String(
                input.Details || ""
            ),

        VerifiedAt:
            VERIFY_normalizeDate_(
                input.VerifiedAt
            ) || new Date(),

        VerifiedBy:
            String(
                input.VerifiedBy ||
                provider.ProviderID
            )

    };

}

/* ========================================================================== */
/* NO PROVIDER */
/* ========================================================================== */

function VERIFY_ENGINE_recordUnavailableProvider_(
    request
) {

    VERIFY_logAudit_({

        EventType:
            "NO_PROVIDER",

        SubjectID:
            request.SubjectID,

        VerificationType:
            request.VerificationType,

        Status:
            VERIFY.STATUS.UNKNOWN,

        Details:
            "No provider available."

    });

    return VERIFY_ENGINE_response_({

        SubjectID:
            request.SubjectID,

        VerificationType:
            request.VerificationType,

        Status:
            VERIFY.STATUS.UNKNOWN,

        Source:
            "NO_PROVIDER",

        Details:
            "No verification provider available.",

        Cached:
            false,

        Overridden:
            false

    });

}

/* ========================================================================== */
/* REQUEST NORMALIZATION */
/* ========================================================================== */

function VERIFY_ENGINE_normalizeRequest_(
    payload
) {

    const input =
        payload || {};

    return {

        SubjectID:
            String(
                input.SubjectID ||
                input.subjectId ||
                ""
            ).trim(),

        VerificationType:
            VERIFY_normalizeVerificationType_(
                input.VerificationType ||
                input.verificationType
            ),

        PreferredProviderID:
            String(
                input.PreferredProviderID ||
                input.preferredProviderId ||
                ""
            ).trim(),

        ReferenceValue:
            String(
                input.ReferenceValue ||
                ""
            ),

        RequestedBy:
            String(
                input.RequestedBy ||
                VERIFY_currentUserEmail_() ||
                "SYSTEM"
            ),

        ForceRefresh:
            input.ForceRefresh === true,

        IgnoreOverride:
            input.IgnoreOverride === true,

        EvidenceFileID:
            String(
                input.EvidenceFileID ||
                ""
            ),

        BrokerDecision:
            input.BrokerDecision,

        Details:
            String(
                input.Details ||
                ""
            ),

        AsOfDate:
            VERIFY_normalizeDate_(
                input.AsOfDate
            )

    };

}

/* ========================================================================== */
/* RESPONSE */
/* ========================================================================== */

function VERIFY_ENGINE_response_(
    response
) {

    const output =
        response || {};

    output.EngineVersion =
        VERIFY_ENGINE_VERSION;

    output.Release =
        VERIFY.RELEASE;

    output.GeneratedAt =
        new Date()
            .toISOString();

    return output;

}

function VERIFY_ENGINE_errorMessage_(
    error
) {

    return String(
        error &&
        error.message
            ? error.message
            : error ||
            "Unknown verification error."
    );

}

function VERIFY_ENGINE_normalizeTypes_(
    types
) {

    if (!types) {

        return [
            VERIFY.TYPE.LICENSE
        ];

    }

    return (
        Array.isArray(types)
            ? types
            : [types]
    ).map(function(type){

        return VERIFY_normalizeVerificationType_(type);

    });

}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function VERIFY_runEngineDiagnostics() {

    const required = [

        "VERIFY_verify",

        "VERIFY_verifySubject",

        "VERIFY_ENGINE_executeProvider_"

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

            return t.status === "FAIL";

        }).length;

    return {

        release:
            VERIFY.RELEASE,

        version:
            VERIFY_ENGINE_VERSION,

        overallStatus:
            failed === 0
                ? "PASS"
                : "FAIL",

        passed:
            tests.length - failed,

        failed:
            failed,

        tests:
            tests,

        completedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* END OF FILE */
/* ========================================================================== */