/******************************************************************************
 * MelroseOS Enterprise
 * Project : Broker Command Center
 * File    : BCC-01_WebAppRouter.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Secure web-app router for the Broker Command Center.
 *
 * Safety:
 *   - Read-only dashboard routes.
 *   - Broker access gate.
 *   - Fails closed when access cannot be verified.
 *   - Does not enable routing, communications, or triggers.
 ******************************************************************************/

const BCC_WEB_VERSION = "1.0.0";

const BCC_WEB = Object.freeze({
    DEFAULT_ROUTE: "dashboard",

    ROUTES: Object.freeze({
        DASHBOARD: "dashboard",
        HEALTH: "health",
        API: "api",
        STATUS: "status"
    }),

    PROPERTIES: Object.freeze({
        ALLOWED_EMAILS:
            "BCC_ALLOWED_EMAILS"
    })
});

/* ========================================================================== */
/* WEB APP ENTRY */
/* ========================================================================== */

function doGet(e) {
    return BCC_routeRequest(e);
}

/* ========================================================================== */
/* ROUTER */
/* ========================================================================== */

function BCC_routeRequest(e) {
    const request =
        BCC_normalizeRequest_(e);

    const access =
        BCC_checkAccess_();

    if (!access.allowed) {
        return BCC_renderAccessDenied_(
            access
        );
    }

    try {
        switch (request.route) {
            case BCC_WEB.ROUTES.API:
                return BCC_renderJson_(
                    BCC_getSafeDashboardPayload_()
                );

            case BCC_WEB.ROUTES.HEALTH:
                return BCC_renderJson_(
                    BCC_getSafeHealthPayload_()
                );

            case BCC_WEB.ROUTES.STATUS:
                return BCC_renderJson_(
                    BCC_getWebAppStatus()
                );

            case BCC_WEB.ROUTES.DASHBOARD:
            default:
                return BCC_renderDashboard_(
                    request
                );
        }
    } catch (error) {
        return BCC_renderWebError_(
            error,
            request
        );
    }
}

/* ========================================================================== */
/* ACCESS GATE */
/* ========================================================================== */

function BCC_checkAccess_() {
    const effectiveEmail =
        BCC_normalizeEmail_(
            Session
                .getEffectiveUser()
                .getEmail()
        );

    const activeEmail =
        BCC_normalizeEmail_(
            Session
                .getActiveUser()
                .getEmail()
        );

    const allowedEmails =
        BCC_getAllowedEmails_();

    if (!allowedEmails.length) {
        return {
            allowed: false,
            status: "DENIED",
            reason:
                "Broker Command Center access has not been configured.",
            activeEmail,
            effectiveEmail,
            checkedAt:
                new Date().toISOString()
        };
    }

    const matchedEmail =
        [activeEmail, effectiveEmail]
            .filter(Boolean)
            .find(function(email) {
                return (
                    allowedEmails.indexOf(
                        email
                    ) !== -1
                );
            }) || "";

    return {
        allowed:
            Boolean(matchedEmail),

        status:
            matchedEmail
                ? "ALLOWED"
                : "DENIED",

        reason:
            matchedEmail
                ? ""
                : "The signed-in account is not authorized.",

        matchedEmail,
        activeEmail,
        effectiveEmail,

        checkedAt:
            new Date().toISOString()
    };
}

function BCC_getAllowedEmails_() {
    const raw =
        PropertiesService
            .getScriptProperties()
            .getProperty(
                BCC_WEB
                    .PROPERTIES
                    .ALLOWED_EMAILS
            ) || "";

    return raw
        .split(/[,;\n]+/)
        .map(BCC_normalizeEmail_)
        .filter(Boolean)
        .filter(function(
            email,
            index,
            values
        ) {
            return (
                values.indexOf(email) ===
                index
            );
        });
}

function BCC_setAllowedEmails(emails) {
    const values =
        Array.isArray(emails)
            ? emails
            : String(emails || "")
                .split(/[,;\n]+/);

    const normalized =
        values
            .map(BCC_normalizeEmail_)
            .filter(Boolean)
            .filter(function(
                email,
                index,
                all
            ) {
                return (
                    all.indexOf(email) ===
                    index
                );
            });

    if (!normalized.length) {
        throw new Error(
            "At least one authorized email is required."
        );
    }

    PropertiesService
        .getScriptProperties()
        .setProperty(
            BCC_WEB
                .PROPERTIES
                .ALLOWED_EMAILS,
            normalized.join(",")
        );

    return {
        success: true,
        allowedEmails:
            normalized,
        updatedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* DASHBOARD */
/* ========================================================================== */

function BCC_renderDashboard_(request) {
    const payload =
        BCC_getSafeDashboardPayload_();

    const safeJson =
        BCC_escapeHtml_(
            JSON.stringify(
                payload,
                null,
                2
            )
        );

    const html = `
<!DOCTYPE html>
<html>
<head>
    <base target="_top">
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
    <title>MelroseOS Broker Command Center</title>

    <style>
        :root {
            --background: #f4f6f8;
            --surface: #ffffff;
            --text: #172033;
            --muted: #677085;
            --border: #dfe4ea;
            --success: #18794e;
            --warning: #9a6700;
            --danger: #b42318;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 24px;
            background: var(--background);
            color: var(--text);
            font-family:
                Arial,
                Helvetica,
                sans-serif;
        }

        .shell {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            align-items: center;
            margin-bottom: 24px;
        }

        .title {
            margin: 0;
            font-size: 28px;
        }

        .subtitle {
            margin-top: 6px;
            color: var(--muted);
        }

        .badge {
            padding: 8px 12px;
            border-radius: 999px;
            background: var(--surface);
            border: 1px solid var(--border);
            font-weight: 700;
        }

        .grid {
            display: grid;
            grid-template-columns:
                repeat(
                    auto-fit,
                    minmax(220px, 1fr)
                );
            gap: 16px;
        }

        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 18px;
        }

        .card h2 {
            margin: 0 0 10px;
            font-size: 16px;
        }

        .value {
            font-size: 30px;
            font-weight: 800;
        }

        .muted {
            color: var(--muted);
        }

        pre {
            margin-top: 24px;
            padding: 18px;
            overflow: auto;
            background: #101828;
            color: #f8fafc;
            border-radius: 14px;
            line-height: 1.45;
        }
    </style>
</head>

<body>
    <main class="shell">
        <header class="header">
            <div>
                <h1 class="title">
                    Broker Command Center
                </h1>

                <div class="subtitle">
                    MelroseOS enterprise operations
                </div>
            </div>

            <div class="badge">
                ${BCC_escapeHtml_(
                    String(
                        payload
                            ?.executive
                            ?.status ||
                        payload
                            ?.broker
                            ?.summary
                            ?.overallStatus ||
                        "UNKNOWN"
                    )
                )}
            </div>
        </header>

        <section class="grid">
            <article class="card">
                <h2>Enterprise Score</h2>

                <div class="value">
                    ${Number(
                        payload
                            ?.metrics
                            ?.enterpriseScore ||
                        payload
                            ?.broker
                            ?.score ||
                        0
                    )}%
                </div>
            </article>

            <article class="card">
                <h2>Subsystems</h2>

                <div class="value">
                    ${Number(
                        payload
                            ?.metrics
                            ?.subsystemCount ||
                        payload
                            ?.broker
                            ?.subsystemCount ||
                        0
                    )}
                </div>
            </article>

            <article class="card">
                <h2>Warnings</h2>

                <div class="value">
                    ${Number(
                        payload
                            ?.metrics
                            ?.warnings ||
                        0
                    )}
                </div>
            </article>

            <article class="card">
                <h2>Failures</h2>

                <div class="value">
                    ${Number(
                        payload
                            ?.metrics
                            ?.failures ||
                        0
                    )}
                </div>
            </article>
        </section>

        <pre>${safeJson}</pre>
    </main>
</body>
</html>`;

    return HtmlService
        .createHtmlOutput(html)
        .setTitle(
            "MelroseOS Broker Command Center"
        )
        .setXFrameOptionsMode(
            HtmlService
                .XFrameOptionsMode
                .ALLOWALL
        );
}

/* ========================================================================== */
/* SAFE PAYLOADS */
/* ========================================================================== */

function BCC_getSafeDashboardPayload_() {
    if (
        typeof BCC_buildDashboardPayload ===
        "function"
    ) {
        return BCC_buildDashboardPayload();
    }

    if (
        typeof BCC_getDashboardData ===
        "function"
    ) {
        return BCC_getDashboardData();
    }

    return {
        release:
            "BCC-01",
        version:
            BCC_WEB_VERSION,
        status:
            "CORE_UNAVAILABLE",
        generatedAt:
            new Date().toISOString()
    };
}

function BCC_getSafeHealthPayload_() {
    if (
        typeof BCC_getHealth ===
        "function"
    ) {
        return BCC_getHealth();
    }

    return {
        status: "UNKNOWN",
        score: 0,
        generatedAt:
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* JSON */
/* ========================================================================== */

function BCC_renderJson_(payload) {
    return ContentService
        .createTextOutput(
            JSON.stringify(
                payload,
                null,
                2
            )
        )
        .setMimeType(
            ContentService
                .MimeType
                .JSON
        );
}

/* ========================================================================== */
/* ERROR OUTPUT */
/* ========================================================================== */

function BCC_renderAccessDenied_(access) {
    return HtmlService
        .createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
    <base target="_top">
    <meta charset="UTF-8">
    <title>Access Denied</title>
</head>

<body style="
    margin:0;
    padding:40px;
    font-family:Arial,Helvetica,sans-serif;
    background:#f4f6f8;
    color:#172033;
">
    <div style="
        max-width:720px;
        margin:0 auto;
        background:#ffffff;
        border:1px solid #dfe4ea;
        border-radius:14px;
        padding:28px;
    ">
        <h1>Access Denied</h1>

        <p>
            ${BCC_escapeHtml_(
                access.reason
            )}
        </p>
    </div>
</body>
</html>`)
        .setTitle(
            "Broker Command Center — Access Denied"
        );
}

function BCC_renderWebError_(
    error,
    request
) {
    const message =
        String(
            error &&
            error.message
                ? error.message
                : error
        );

    return HtmlService
        .createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
    <base target="_top">
    <meta charset="UTF-8">
    <title>Broker Command Center Error</title>
</head>

<body style="
    margin:0;
    padding:40px;
    font-family:Arial,Helvetica,sans-serif;
">
    <h1>Broker Command Center Error</h1>

    <p>
        ${BCC_escapeHtml_(message)}
    </p>

    <p>
        Route:
        ${BCC_escapeHtml_(
            request.route
        )}
    </p>
</body>
</html>`)
        .setTitle(
            "Broker Command Center Error"
        );
}

/* ========================================================================== */
/* STATUS AND DIAGNOSTICS */
/* ========================================================================== */

function BCC_getWebAppStatus() {
    const access =
        BCC_checkAccess_();

    return {
        release:
            "BCC-01-WEB-APP-ROUTER",

        version:
            BCC_WEB_VERSION,

        initialized:
            typeof BCC_initialize ===
            "function",

        dashboardAvailable:
            typeof BCC_buildDashboardPayload ===
                "function" ||
            typeof BCC_getDashboardData ===
                "function",

        accessConfigured:
            BCC_getAllowedEmails_()
                .length > 0,

        access,

        generatedAt:
            new Date().toISOString()
    };
}

function BCC_runWebAppDiagnostics() {
    const requiredFunctions = [
        "BCC_initialize",
        "BCC_getDashboardData",
        "BCC_getHealth"
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

    tests.push({
        code:
            "ACCESS_CONFIGURATION",

        status:
            BCC_getAllowedEmails_()
                .length > 0
                ? "PASS"
                : "WARNING"
    });

    const failed =
        tests.filter(function(test) {
            return (
                test.status === "FAIL"
            );
        }).length;

    const warnings =
        tests.filter(function(test) {
            return (
                test.status ===
                "WARNING"
            );
        }).length;

    return {
        release:
            "BCC-01-WEB-APP-ROUTER",

        version:
            BCC_WEB_VERSION,

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
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* HELPERS */
/* ========================================================================== */

function BCC_normalizeRequest_(e) {
    const parameters =
        e && e.parameter
            ? e.parameter
            : {};

    const route =
        String(
            parameters.route ||
            parameters.app ||
            BCC_WEB.DEFAULT_ROUTE
        )
            .trim()
            .toLowerCase();

    return {
        route,
        parameters,
        receivedAt:
            new Date().toISOString()
    };
}

function BCC_normalizeEmail_(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function BCC_escapeHtml_(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}