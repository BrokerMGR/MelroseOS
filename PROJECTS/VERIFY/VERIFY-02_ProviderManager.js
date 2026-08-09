/******************************************************************************
 * MelroseOS Enterprise
 * Project : Enterprise Verification Engine
 * File    : VERIFY-02_ProviderManager.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Registers, manages, ranks, and resolves verification providers for the
 *   Enterprise Verification Engine.
 *
 * Safety:
 *   - Does not contact external providers.
 *   - Does not install triggers.
 *   - Does not send communications.
 *   - Does not modify CRM routing or agent eligibility.
 ******************************************************************************/

const VERIFY_PROVIDER_MANAGER_VERSION = "1.0.0";

/* ========================================================================== */
/* PROVIDER REGISTRY */
/* ========================================================================== */

function VERIFY_registerProvider(provider) {
    VERIFY_initializeCore();

    const input =
        provider || {};

    const providerId =
        String(
            input.ProviderID ||
            input.providerId ||
            ""
        ).trim();

    if (!providerId) {
        throw new Error(
            "ProviderID is required."
        );
    }

    const providerName =
        String(
            input.ProviderName ||
            input.providerName ||
            ""
        ).trim();

    if (!providerName) {
        throw new Error(
            "ProviderName is required."
        );
    }

    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.PROVIDERS
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "ProviderID",
            providerId
        );

    const now =
        new Date();

    const record = {
        ProviderID:
            providerId,

        ProviderName:
            providerName,

        ProviderType:
            VERIFY_normalizeProviderType_(
                input.ProviderType ||
                input.providerType ||
                VERIFY.PROVIDER_TYPE.MANUAL
            ),

        VerificationTypes:
            VERIFY_normalizeVerificationTypes_(
                input.VerificationTypes ||
                input.verificationTypes ||
                []
            ).join(","),

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

        Priority:
            VERIFY_normalizeProviderPriority_(
                input.Priority !== undefined
                    ? input.Priority
                    : input.priority
            ),

        ConfigurationJSON:
            VERIFY_normalizeConfigurationJson_(
                input.ConfigurationJSON !== undefined
                    ? input.ConfigurationJSON
                    : input.configuration
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
                ? "PROVIDER_UPDATED"
                : "PROVIDER_REGISTERED",

        VerificationType:
            VERIFY.TYPE.CUSTOM,

        ReferenceID:
            providerId,

        Status:
            VERIFY.STATUS.PASS,

        Details:
            providerName,

        Actor:
            VERIFY_currentUserEmail_() ||
            "SYSTEM"
    });

    return {
        success:
            true,

        status:
            existing
                ? "UPDATED"
                : "CREATED",

        provider:
            VERIFY_getProvider(
                providerId
            )
    };
}

/* ========================================================================== */
/* PROVIDER LOOKUP */
/* ========================================================================== */

function VERIFY_getProvider(providerId) {
    const record =
        VERIFY_findRowByValue_(
            VERIFY_getSheet_(
                VERIFY.SHEETS.PROVIDERS
            ),
            "ProviderID",
            String(
                providerId || ""
            ).trim()
        );

    return record
        ? VERIFY_normalizeProviderRecord_(
            VERIFY_publicRecord_(
                record
            )
        )
        : null;
}

function VERIFY_getProviders() {
    return VERIFY_sheetObjects_(
        VERIFY_getSheet_(
            VERIFY.SHEETS.PROVIDERS
        )
    )
        .map(
            VERIFY_publicRecord_
        )
        .map(
            VERIFY_normalizeProviderRecord_
        )
        .sort(
            VERIFY_providerSort_
        );
}

function VERIFY_getActiveProviders() {
    return VERIFY_getProviders()
        .filter(function(provider) {
            return VERIFY_isTrue_(
                provider.Active
            );
        });
}

function VERIFY_getProvidersForType(
    verificationType
) {
    const normalizedType =
        VERIFY_normalizeVerificationType_(
            verificationType
        );

    return VERIFY_getActiveProviders()
        .filter(function(provider) {
            return (
                provider
                    .VerificationTypes
                    .indexOf(
                        normalizedType
                    ) !== -1
            );
        })
        .sort(
            VERIFY_providerSort_
        );
}

/* ========================================================================== */
/* PROVIDER RESOLUTION */
/* ========================================================================== */

function VERIFY_findProviderForType(
    verificationType
) {
    const providers =
        VERIFY_getProvidersForType(
            verificationType
        );

    return providers.length
        ? providers[0]
        : null;
}

function VERIFY_resolveProvider(
    verificationType,
    preferredProviderId
) {
    const normalizedType =
        VERIFY_normalizeVerificationType_(
            verificationType
        );

    const preferredId =
        String(
            preferredProviderId || ""
        ).trim();

    if (preferredId) {
        const preferred =
            VERIFY_getProvider(
                preferredId
            );

        if (
            preferred &&
            VERIFY_isTrue_(
                preferred.Active
            ) &&
            preferred
                .VerificationTypes
                .indexOf(
                    normalizedType
                ) !== -1
        ) {
            return preferred;
        }
    }

    return VERIFY_findProviderForType(
        normalizedType
    );
}

/* ========================================================================== */
/* ENABLE / DISABLE */
/* ========================================================================== */

function VERIFY_enableProvider(
    providerId
) {
    return VERIFY_setProviderActive_(
        providerId,
        true
    );
}

function VERIFY_disableProvider(
    providerId
) {
    return VERIFY_setProviderActive_(
        providerId,
        false
    );
}

function VERIFY_setProviderActive_(
    providerId,
    active
) {
    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.PROVIDERS
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "ProviderID",
            String(
                providerId || ""
            ).trim()
        );

    if (!existing) {
        throw new Error(
            "Verification provider not found."
        );
    }

    VERIFY_updateRow_(
        sheet,
        existing._row,
        {
            Active:
                active === true,

            UpdatedAt:
                new Date()
        }
    );

    VERIFY_logAudit_({
        EventType:
            active === true
                ? "PROVIDER_ENABLED"
                : "PROVIDER_DISABLED",

        ReferenceID:
            existing.ProviderID,

        Status:
            active === true
                ? VERIFY.STATUS.PASS
                : VERIFY.STATUS.WARNING,

        Details:
            existing.ProviderName,

        Actor:
            VERIFY_currentUserEmail_() ||
            "SYSTEM"
    });

    return {
        success:
            true,

        provider:
            VERIFY_getProvider(
                providerId
            )
    };
}

/* ========================================================================== */
/* PRIORITY */
/* ========================================================================== */

function VERIFY_setProviderPriority(
    providerId,
    priority
) {
    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.PROVIDERS
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "ProviderID",
            String(
                providerId || ""
            ).trim()
        );

    if (!existing) {
        throw new Error(
            "Verification provider not found."
        );
    }

    const normalizedPriority =
        VERIFY_normalizeProviderPriority_(
            priority
        );

    VERIFY_updateRow_(
        sheet,
        existing._row,
        {
            Priority:
                normalizedPriority,

            UpdatedAt:
                new Date()
        }
    );

    VERIFY_logAudit_({
        EventType:
            "PROVIDER_PRIORITY_UPDATED",

        ReferenceID:
            existing.ProviderID,

        Status:
            VERIFY.STATUS.PASS,

        Details:
            "Priority set to " +
            normalizedPriority,

        Actor:
            VERIFY_currentUserEmail_() ||
            "SYSTEM"
    });

    return {
        success:
            true,

        provider:
            VERIFY_getProvider(
                providerId
            )
    };
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* PROVIDER CONFIGURATION */
/* ========================================================================== */

function VERIFY_updateProviderConfiguration(
    providerId,
    configuration
) {
    const sheet =
        VERIFY_getSheet_(
            VERIFY.SHEETS.PROVIDERS
        );

    const existing =
        VERIFY_findRowByValue_(
            sheet,
            "ProviderID",
            String(
                providerId || ""
            ).trim()
        );

    if (!existing) {
        throw new Error(
            "Verification provider not found."
        );
    }

    const configurationJson =
        VERIFY_normalizeConfigurationJson_(
            configuration
        );

    VERIFY_updateRow_(
        sheet,
        existing._row,
        {
            ConfigurationJSON:
                configurationJson,

            UpdatedAt:
                new Date()
        }
    );

    VERIFY_logAudit_({
        EventType:
            "PROVIDER_CONFIGURATION_UPDATED",

        ReferenceID:
            existing.ProviderID,

        Status:
            VERIFY.STATUS.PASS,

        Details:
            "Provider configuration updated.",

        Actor:
            VERIFY_currentUserEmail_() ||
            "SYSTEM"
    });

    return {
        success:
            true,

        provider:
            VERIFY_getProvider(
                providerId
            )
    };
}

function VERIFY_getProviderConfiguration(
    providerId
) {
    const provider =
        VERIFY_getProvider(
            providerId
        );

    if (!provider) {
        return null;
    }

    return provider.Configuration;
}

/* ========================================================================== */
/* NORMALIZATION */
/* ========================================================================== */

function VERIFY_normalizeVerificationTypes_(
    value
) {
    const values =
        Array.isArray(value)
            ? value
            : String(
                value || ""
            )
                .split(
                    /[,;|\n]+/
                );

    return values
        .map(function(type) {
            return VERIFY_normalizeVerificationType_(
                type
            );
        })
        .filter(function(
            type,
            index,
            all
        ) {
            return (
                type &&
                all.indexOf(type) ===
                    index
            );
        });
}

function VERIFY_normalizeProviderPriority_(
    value
) {
    const priority =
        Number(value);

    if (
        !Number.isFinite(
            priority
        )
    ) {
        return 100;
    }

    return Math.max(
        0,
        Math.floor(priority)
    );
}

function VERIFY_normalizeConfigurationJson_(
    value
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return "{}";
    }

    if (
        typeof value === "string"
    ) {
        try {
            const parsed =
                JSON.parse(value);

            return JSON.stringify(
                parsed
            );
        } catch (error) {
            throw new Error(
                "Provider configuration must be valid JSON."
            );
        }
    }

    try {
        return JSON.stringify(
            value
        );
    } catch (error) {
        throw new Error(
            "Provider configuration could not be serialized."
        );
    }
}

function VERIFY_parseConfigurationJson_(
    value
) {
    try {
        return JSON.parse(
            String(
                value || "{}"
            )
        );
    } catch (error) {
        return {};
    }
}

function VERIFY_normalizeProviderRecord_(
    provider
) {
    const source =
        provider || {};

    return {
        ProviderID:
            String(
                source.ProviderID ||
                ""
            ).trim(),

        ProviderName:
            String(
                source.ProviderName ||
                ""
            ).trim(),

        ProviderType:
            VERIFY_normalizeProviderType_(
                source.ProviderType
            ),

        VerificationTypes:
            VERIFY_normalizeVerificationTypes_(
                source.VerificationTypes
            ),

        Active:
            VERIFY_isTrue_(
                source.Active
            ),

        Priority:
            VERIFY_normalizeProviderPriority_(
                source.Priority
            ),

        ConfigurationJSON:
            String(
                source.ConfigurationJSON ||
                "{}"
            ),

        Configuration:
            VERIFY_parseConfigurationJson_(
                source.ConfigurationJSON
            ),

        CreatedAt:
            source.CreatedAt || "",

        UpdatedAt:
            source.UpdatedAt || ""
    };
}

/* ========================================================================== */
/* SORTING */
/* ========================================================================== */

function VERIFY_providerSort_(
    a,
    b
) {
    const priorityDifference =
        VERIFY_normalizeProviderPriority_(
            a.Priority
        ) -
        VERIFY_normalizeProviderPriority_(
            b.Priority
        );

    if (
        priorityDifference !== 0
    ) {
        return priorityDifference;
    }

    const typeDifference =
        VERIFY_providerTypeWeight_(
            a.ProviderType
        ) -
        VERIFY_providerTypeWeight_(
            b.ProviderType
        );

    if (
        typeDifference !== 0
    ) {
        return typeDifference;
    }

    return String(
        a.ProviderName || ""
    ).localeCompare(
        String(
            b.ProviderName || ""
        )
    );
}

function VERIFY_providerTypeWeight_(
    providerType
) {
    const weights = {};

    weights[
        VERIFY.PROVIDER_TYPE.BROKER
    ] = 10;

    weights[
        VERIFY.PROVIDER_TYPE.FILE
    ] = 20;

    weights[
        VERIFY.PROVIDER_TYPE.LREC
    ] = 30;

    weights[
        VERIFY.PROVIDER_TYPE.FUTURE_API
    ] = 40;

    weights[
        VERIFY.PROVIDER_TYPE.MANUAL
    ] = 50;

    return Number(
        weights[
            VERIFY_normalizeProviderType_(
                providerType
            )
        ] || 100
    );
}

/* ========================================================================== */
/* DEFAULT PROVIDERS */
/* ========================================================================== */

function VERIFY_seedDefaultProviders() {
    VERIFY_initializeCore();

    const defaults = [
        {
            ProviderID:
                "VERIFY-PROVIDER-BROKER",

            ProviderName:
                "Broker Verification",

            ProviderType:
                VERIFY.PROVIDER_TYPE.BROKER,

            VerificationTypes: [
                VERIFY.TYPE.LICENSE,
                VERIFY.TYPE.CONTINUING_EDUCATION,
                VERIFY.TYPE.DESIGNATION,
                VERIFY.TYPE.MLS,
                VERIFY.TYPE.REALTOR,
                VERIFY.TYPE.E_AND_O,
                VERIFY.TYPE.ACADEMY,
                VERIFY.TYPE.BROKER_APPROVAL,
                VERIFY.TYPE.BACKGROUND,
                VERIFY.TYPE.CUSTOM
            ],

            Active:
                true,

            Priority:
                10,

            ConfigurationJSON: {
                requiresBrokerApproval:
                    true
            }
        },
        {
            ProviderID:
                "VERIFY-PROVIDER-FILE",

            ProviderName:
                "File Evidence Verification",

            ProviderType:
                VERIFY.PROVIDER_TYPE.FILE,

            VerificationTypes: [
                VERIFY.TYPE.LICENSE,
                VERIFY.TYPE.CONTINUING_EDUCATION,
                VERIFY.TYPE.DESIGNATION,
                VERIFY.TYPE.MLS,
                VERIFY.TYPE.REALTOR,
                VERIFY.TYPE.E_AND_O,
                VERIFY.TYPE.ACADEMY,
                VERIFY.TYPE.BACKGROUND,
                VERIFY.TYPE.CUSTOM
            ],

            Active:
                true,

            Priority:
                20,

            ConfigurationJSON: {
                requiresEvidenceFile:
                    true
            }
        },
        {
            ProviderID:
                "VERIFY-PROVIDER-MANUAL",

            ProviderName:
                "Manual Verification",

            ProviderType:
                VERIFY.PROVIDER_TYPE.MANUAL,

            VerificationTypes: [
                VERIFY.TYPE.LICENSE,
                VERIFY.TYPE.CONTINUING_EDUCATION,
                VERIFY.TYPE.DESIGNATION,
                VERIFY.TYPE.MLS,
                VERIFY.TYPE.REALTOR,
                VERIFY.TYPE.E_AND_O,
                VERIFY.TYPE.ACADEMY,
                VERIFY.TYPE.BROKER_APPROVAL,
                VERIFY.TYPE.BACKGROUND,
                VERIFY.TYPE.CUSTOM
            ],

            Active:
                true,

            Priority:
                100,

            ConfigurationJSON: {
                requiresManualReview:
                    true
            }
        }
    ];

    const results =
        defaults.map(function(provider) {
            return VERIFY_registerProvider(
                provider
            );
        });

    return {
        success:
            true,

        registered:
            results.length,

        providers:
            VERIFY_getProviders(),

        completedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* SUMMARY */
/* ========================================================================== */

function VERIFY_getProviderSummary() {
    const providers =
        VERIFY_getProviders();

    return {
        release:
            VERIFY.RELEASE,

        version:
            VERIFY_PROVIDER_MANAGER_VERSION,

        total:
            providers.length,

        active:
            providers.filter(
                function(provider) {
                    return (
                        provider.Active ===
                        true
                    );
                }
            ).length,

        inactive:
            providers.filter(
                function(provider) {
                    return (
                        provider.Active !==
                        true
                    );
                }
            ).length,

        byType:
            providers.reduce(
                function(
                    summary,
                    provider
                ) {
                    const type =
                        provider.ProviderType;

                    summary[type] =
                        Number(
                            summary[type] ||
                            0
                        ) + 1;

                    return summary;
                },
                {}
            ),

        generatedAt:
            new Date()
                .toISOString()
    };
}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function VERIFY_runProviderDiagnostics() {
    const requiredFunctions = [
        "VERIFY_registerProvider",
        "VERIFY_getProvider",
        "VERIFY_getProviders",
        "VERIFY_findProviderForType",
        "VERIFY_resolveProvider"
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

    let registryStatus =
        "PASS";

    let registryDetails =
        "";

    try {
        const providers =
            VERIFY_getProviders();

        if (
            !Array.isArray(
                providers
            )
        ) {
            registryStatus =
                "FAIL";

            registryDetails =
                "Provider registry did not return an array.";
        }
    } catch (error) {
        registryStatus =
            "FAIL";

        registryDetails =
            String(
                error &&
                error.message
                    ? error.message
                    : error
            );
    }

    tests.push({
        code:
            "PROVIDER_REGISTRY",

        status:
            registryStatus,

        details:
            registryDetails
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
            VERIFY.RELEASE,

        version:
            VERIFY_PROVIDER_MANAGER_VERSION,

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

function VERIFY_testProviderManager() {
    VERIFY_initializeCore();

    const unique =
        Utilities
            .getUuid()
            .substring(
                0,
                8
            );

    const providerId =
        "VERIFY-TEST-PROVIDER-" +
        unique;

    const registration =
        VERIFY_registerProvider({
            ProviderID:
                providerId,

            ProviderName:
                "Verification Provider Test",

            ProviderType:
                VERIFY.PROVIDER_TYPE.MANUAL,

            VerificationTypes: [
                VERIFY.TYPE.CUSTOM
            ],

            Active:
                true,

            Priority:
                999,

            ConfigurationJSON: {
                test:
                    true
            }
        });

    const resolved =
        VERIFY_resolveProvider(
            VERIFY.TYPE.CUSTOM,
            providerId
        );

    const diagnostics =
        VERIFY_runProviderDiagnostics();

    if (
        !registration.success ||
        !resolved ||
        resolved.ProviderID !==
            providerId
    ) {
        throw new Error(
            "Verification provider manager self-test failed."
        );
    }

    if (
        diagnostics.overallStatus !==
        "PASS"
    ) {
        throw new Error(
            "Verification provider diagnostics failed."
        );
    }

    return {
        success:
            true,

        release:
            VERIFY.RELEASE,

        version:
            VERIFY_PROVIDER_MANAGER_VERSION,

        provider:
            resolved,

        diagnostics:
            diagnostics,

        summary:
            VERIFY_getProviderSummary()
    };
}

/* ========================================================================== */
/* END OF FILE */
/* ========================================================================== */