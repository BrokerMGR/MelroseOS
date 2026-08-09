/******************************************************************************
 * MelroseOS Enterprise
 * Project : Broker Command Center
 * File    : BCC-02_DashboardView.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Broker-facing dashboard view for the secure BCC web app.
 *
 * Safety:
 *   - Read-only.
 *   - Uses the existing BCC access gate and router.
 *   - Does not enable routing, communications, or triggers.
 ******************************************************************************/

const BCC_DASHBOARD_VIEW_VERSION = "1.0.0";

/* ========================================================================== */
/* DASHBOARD RENDERER */
/* ========================================================================== */

function BCC_renderDashboard_(request) {
    const payload =
        BCC_getSafeDashboardPayload_();

    const viewModel =
        BCC_buildDashboardViewModel_(
            payload
        );

    const html =
        BCC_buildDashboardHtml_(
            viewModel,
            request || {}
        );

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
/* VIEW MODEL */
/* ========================================================================== */

function BCC_buildDashboardViewModel_(
    payload
) {
    const source =
        payload || {};

    const metrics =
        source.metrics || {};

    const executive =
        source.executive || {};

    const systems =
        source.systems || {};

    const alerts =
        Array.isArray(source.alerts)
            ? source.alerts
            : [];

    return {
        release:
            source.release ||
            "BCC-02",

        version:
            source.version ||
            BCC_DASHBOARD_VIEW_VERSION,

        title:
            "Broker Command Center",

        subtitle:
            "MelroseOS Enterprise Operations",

        overallStatus:
            String(
                executive.status ||
                metrics.overallStatus ||
                "UNKNOWN"
            )
                .trim()
                .toUpperCase(),

        enterpriseScore:
            BCC_number_(
                metrics.enterpriseScore,
                0
            ),

        subsystemCount:
            BCC_number_(
                metrics.subsystemCount,
                0
            ),

        passing:
            BCC_number_(
                metrics.passing,
                0
            ),

        warnings:
            BCC_number_(
                metrics.warnings,
                0
            ),

        failures:
            BCC_number_(
                metrics.failures,
                0
            ),

        unknown:
            BCC_number_(
                metrics.unknown,
                0
            ),

        systems:
            BCC_buildSystemCards_(
                systems
            ),

        alerts:
            BCC_buildAlertRows_(
                alerts
            ),

        generatedAt:
            source.generatedAt ||
            new Date().toISOString()
    };
}

/* ========================================================================== */
/* SYSTEM CARDS */
/* ========================================================================== */

function BCC_buildSystemCards_(
    systems
) {
    const source =
        systems || {};

    const definitions = [
        {
            key: "scheduler",
            label:
                "Enterprise Scheduler",
            icon:
                "SCH"
        },
        {
            key: "notifications",
            label:
                "Notifications",
            icon:
                "NF"
        },
        {
            key: "eventBus",
            label:
                "Event Bus",
            icon:
                "EB"
        },
        {
            key: "assignment",
            label:
                "Assignment Engine",
            icon:
                "AE"
        },
        {
            key: "leadIntake",
            label:
                "Lead Intake",
            icon:
                "LI"
        },
        {
            key: "runtime",
            label:
                "Enterprise Runtime",
            icon:
                "RT"
        }
    ];

    return definitions.map(
        function(definition) {
            const item =
                source[
                    definition.key
                ] || {};

            return {
                key:
                    definition.key,

                label:
                    definition.label,

                icon:
                    definition.icon,

                status:
                    String(
                        item.status ||
                        "UNKNOWN"
                    )
                        .trim()
                        .toUpperCase(),

                score:
                    BCC_number_(
                        item.score,
                        0
                    ),

                severity:
                    String(
                        item.severity ||
                        "INFO"
                    )
                        .trim()
                        .toUpperCase(),

                metadata:
                    item.metadata || {},

                updatedAt:
                    item.updatedAt || ""
            };
        }
    );
}

/* ========================================================================== */
/* ALERT ROWS */
/* ========================================================================== */

function BCC_buildAlertRows_(
    alerts
) {
    return (
        alerts || []
    )
        .map(function(alert) {
            return {
                subsystem:
                    String(
                        alert.subsystem ||
                        alert.system ||
                        "SYSTEM"
                    ),

                severity:
                    String(
                        alert.severity ||
                        "INFO"
                    )
                        .trim()
                        .toUpperCase(),

                code:
                    String(
                        alert.code ||
                        "GENERAL"
                    ),

                message:
                    String(
                        alert.message ||
                        ""
                    ),

                createdAt:
                    alert.createdAt || ""
            };
        })
        .sort(function(a, b) {
            return (
                BCC_severityWeight_(
                    b.severity
                ) -
                BCC_severityWeight_(
                    a.severity
                )
            );
        });
}

/* ========================================================================== */
/* HTML BUILDER */
/* ========================================================================== */

function BCC_buildDashboardHtml_(
    model,
    request
) {
    const statusClass =
        BCC_statusClass_(
            model.overallStatus
        );

    const systemCards =
        model.systems
            .map(
                BCC_renderSystemCard_
            )
            .join("");

    const alertRows =
        model.alerts.length
            ? model.alerts
                .map(
                    BCC_renderAlertRow_
                )
                .join("")
            : `
                <div class="empty-state">
                    No enterprise alerts are currently registered.
                </div>
            `;

    return `
<!DOCTYPE html>
<html>
<head>
    <base target="_top">

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>
        MelroseOS Broker Command Center
    </title>

    ${BCC_dashboardStyles_()}
</head>

<body>
    <div class="app-shell">
        <aside class="sidebar">
            <div class="brand-block">
                <div class="brand-mark">
                    MGR
                </div>

                <div>
                    <div class="brand-name">
                        MelroseOS
                    </div>

                    <div class="brand-subtitle">
                        Broker Command Center
                    </div>
                </div>
            </div>

            <nav class="nav">
                <a
                    class="nav-item active"
                    href="?route=dashboard"
                >
                    Dashboard
                </a>

                <a
                    class="nav-item"
                    href="?route=health"
                >
                    Health API
                </a>

                <a
                    class="nav-item"
                    href="?route=status"
                >
                    Web App Status
                </a>

                <a
                    class="nav-item"
                    href="?route=api"
                >
                    Dashboard API
                </a>
            </nav>

            <div class="sidebar-footer">
                Version
                ${BCC_escapeHtml_(
                    model.version
                )}
            </div>
        </aside>

        <main class="main-content">
            <header class="topbar">
                <div>
                    <h1>
                        ${BCC_escapeHtml_(
                            model.title
                        )}
                    </h1>

                    <p>
                        ${BCC_escapeHtml_(
                            model.subtitle
                        )}
                    </p>
                </div>

                <div
                    class="status-pill ${statusClass}"
                >
                    ${BCC_escapeHtml_(
                        model.overallStatus
                    )}
                </div>
            </header>

            <section class="metric-grid">
                ${BCC_renderMetricCard_(
                    "Enterprise Score",
                    model.enterpriseScore + "%",
                    model.overallStatus
                )}

                ${BCC_renderMetricCard_(
                    "Subsystems",
                    model.subsystemCount,
                    "INFO"
                )}

                ${BCC_renderMetricCard_(
                    "Passing",
                    model.passing,
                    "PASS"
                )}

                ${BCC_renderMetricCard_(
                    "Warnings",
                    model.warnings,
                    model.warnings > 0
                        ? "WARNING"
                        : "PASS"
                )}

                ${BCC_renderMetricCard_(
                    "Failures",
                    model.failures,
                    model.failures > 0
                        ? "FAIL"
                        : "PASS"
                )}
            </section>

            <section class="section">
                <div class="section-header">
                    <div>
                        <h2>
                            Enterprise Systems
                        </h2>

                        <p>
                            Current operational status by subsystem
                        </p>
                    </div>
                </div>

                <div class="system-grid">
                    ${systemCards}
                </div>
            </section>

            <section class="section">
                <div class="section-header">
                    <div>
                        <h2>
                            Enterprise Alerts
                        </h2>

                        <p>
                            Issues reported by the OPS health registry
                        </p>
                    </div>

                    <span class="count-badge">
                        ${model.alerts.length}
                    </span>
                </div>

                <div class="alert-list">
                    ${alertRows}
                </div>
            </section>

            <footer class="footer">
                Generated:
                ${BCC_escapeHtml_(
                    BCC_formatDateTime_(
                        model.generatedAt
                    )
                )}
            </footer>
        </main>
    </div>
</body>
</html>`;
}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* METRIC CARD */
/* ========================================================================== */

function BCC_renderMetricCard_(
    label,
    value,
    status
) {
    const statusClass =
        BCC_statusClass_(
            status
        );

    return `
        <article class="metric-card">
            <div class="metric-label">
                ${BCC_escapeHtml_(
                    label
                )}
            </div>

            <div
                class="metric-value ${statusClass}"
            >
                ${BCC_escapeHtml_(
                    value
                )}
            </div>
        </article>
    `;
}

/* ========================================================================== */
/* SYSTEM CARD */
/* ========================================================================== */

function BCC_renderSystemCard_(
    system
) {
    const statusClass =
        BCC_statusClass_(
            system.status
        );

    return `
        <article class="system-card">
            <div class="system-card-header">
                <div class="system-icon">
                    ${BCC_escapeHtml_(
                        system.icon
                    )}
                </div>

                <div>
                    <h3>
                        ${BCC_escapeHtml_(
                            system.label
                        )}
                    </h3>

                    <div class="system-updated">
                        ${system.updatedAt
                            ? BCC_escapeHtml_(
                                BCC_formatDateTime_(
                                    system.updatedAt
                                )
                            )
                            : "No runtime update"}
                    </div>
                </div>
            </div>

            <div class="system-card-body">
                <div
                    class="system-status ${statusClass}"
                >
                    ${BCC_escapeHtml_(
                        system.status
                    )}
                </div>

                <div class="system-score">
                    ${BCC_number_(
                        system.score,
                        0
                    )}%
                </div>
            </div>

            <div class="score-track">
                <div
                    class="score-fill ${statusClass}"
                    style="width:${BCC_clamp_(
                        system.score,
                        0,
                        100
                    )}%"
                ></div>
            </div>

            <div class="system-severity">
                Severity:
                <strong>
                    ${BCC_escapeHtml_(
                        system.severity
                    )}
                </strong>
            </div>
        </article>
    `;
}

/* ========================================================================== */
/* ALERT ROW */
/* ========================================================================== */

function BCC_renderAlertRow_(
    alert
) {
    const severityClass =
        BCC_statusClass_(
            alert.severity
        );

    return `
        <article class="alert-row">
            <div
                class="alert-severity ${severityClass}"
            >
                ${BCC_escapeHtml_(
                    alert.severity
                )}
            </div>

            <div class="alert-content">
                <div class="alert-title">
                    ${BCC_escapeHtml_(
                        alert.subsystem
                    )}
                    ·
                    ${BCC_escapeHtml_(
                        alert.code
                    )}
                </div>

                <div class="alert-message">
                    ${BCC_escapeHtml_(
                        alert.message
                    )}
                </div>

                <div class="alert-time">
                    ${alert.createdAt
                        ? BCC_escapeHtml_(
                            BCC_formatDateTime_(
                                alert.createdAt
                            )
                        )
                        : ""}
                </div>
            </div>
        </article>
    `;
}

/* ========================================================================== */
/* STYLES */
/* ========================================================================== */

function BCC_dashboardStyles_() {
    return `
<style>
    :root {
        --navy: #0f1f3d;
        --navy-soft: #172a4f;
        --gold: #c9a227;
        --background: #f4f6f8;
        --surface: #ffffff;
        --text: #172033;
        --muted: #667085;
        --border: #dfe4ea;
        --success: #18794e;
        --success-bg: #e8f5ee;
        --warning: #9a6700;
        --warning-bg: #fff4cc;
        --danger: #b42318;
        --danger-bg: #feeceb;
        --info: #175cd3;
        --info-bg: #eaf2ff;
        --unknown: #667085;
        --unknown-bg: #eef1f4;
        --shadow:
            0 10px 30px
            rgba(15, 31, 61, 0.08);
    }

    * {
        box-sizing: border-box;
    }

    html,
    body {
        margin: 0;
        min-height: 100%;
        background:
            var(--background);
        color:
            var(--text);
        font-family:
            Arial,
            Helvetica,
            sans-serif;
    }

    body {
        min-height: 100vh;
    }

    .app-shell {
        display: grid;
        grid-template-columns:
            260px minmax(0, 1fr);
        min-height: 100vh;
    }

    .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 24px 18px;
        background:
            var(--navy);
        color: #ffffff;
    }

    .brand-block {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 6px 26px;
        border-bottom:
            1px solid
            rgba(255, 255, 255, 0.12);
    }

    .brand-mark {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background:
            var(--gold);
        color:
            var(--navy);
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.5px;
    }

    .brand-name {
        font-size: 18px;
        font-weight: 800;
    }

    .brand-subtitle {
        margin-top: 3px;
        color:
            rgba(255, 255, 255, 0.68);
        font-size: 12px;
    }

    .nav {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 24px;
    }

    .nav-item {
        padding: 12px 14px;
        border-radius: 10px;
        color:
            rgba(255, 255, 255, 0.78);
        text-decoration: none;
        font-size: 14px;
        font-weight: 700;
        transition:
            background 0.15s ease,
            color 0.15s ease;
    }

    .nav-item:hover,
    .nav-item.active {
        background:
            var(--navy-soft);
        color:
            #ffffff;
    }

    .nav-item.active {
        border-left:
            3px solid
            var(--gold);
    }

    .sidebar-footer {
        margin-top: auto;
        padding: 20px 8px 4px;
        color:
            rgba(255, 255, 255, 0.56);
        font-size: 12px;
    }

    .main-content {
        width: 100%;
        padding: 30px;
        overflow: hidden;
    }

    .topbar {
        display: flex;
        justify-content:
            space-between;
        align-items: center;
        gap: 20px;
        margin-bottom: 24px;
    }

    .topbar h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.2;
    }

    .topbar p {
        margin: 7px 0 0;
        color:
            var(--muted);
    }

    .status-pill {
        padding: 9px 14px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.4px;
    }

    .metric-grid {
        display: grid;
        grid-template-columns:
            repeat(
                5,
                minmax(0, 1fr)
            );
        gap: 14px;
        margin-bottom: 26px;
    }

    .metric-card,
    .system-card,
    .section {
        background:
            var(--surface);
        border:
            1px solid
            var(--border);
        box-shadow:
            var(--shadow);
    }

    .metric-card {
        min-height: 118px;
        padding: 18px;
        border-radius: 14px;
    }

    .metric-label {
        color:
            var(--muted);
        font-size: 13px;
        font-weight: 700;
    }

    .metric-value {
        margin-top: 14px;
        font-size: 30px;
        font-weight: 900;
    }

    .section {
        margin-bottom: 24px;
        padding: 22px;
        border-radius: 16px;
    }

    .section-header {
        display: flex;
        justify-content:
            space-between;
        align-items: center;
        gap: 20px;
        margin-bottom: 18px;
    }

    .section-header h2 {
        margin: 0;
        font-size: 20px;
    }

    .section-header p {
        margin: 5px 0 0;
        color:
            var(--muted);
        font-size: 13px;
    }

    .count-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 34px;
        height: 28px;
        padding: 0 9px;
        border-radius: 999px;
        background:
            var(--navy);
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
    }

    .system-grid {
        display: grid;
        grid-template-columns:
            repeat(
                3,
                minmax(0, 1fr)
            );
        gap: 14px;
    }

    .system-card {
        padding: 18px;
        border-radius: 14px;
    }

    .system-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .system-icon {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 11px;
        background:
            var(--navy);
        color:
            var(--gold);
        font-size: 12px;
        font-weight: 900;
    }

    .system-card h3 {
        margin: 0;
        font-size: 15px;
    }

    .system-updated {
        margin-top: 4px;
        color:
            var(--muted);
        font-size: 11px;
    }

    .system-card-body {
        display: flex;
        justify-content:
            space-between;
        align-items: center;
        margin-top: 20px;
    }

    .system-status {
        padding: 6px 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
    }

    .system-score {
        font-size: 23px;
        font-weight: 900;
    }

    .score-track {
        height: 7px;
        margin-top: 14px;
        overflow: hidden;
        border-radius: 999px;
        background: #eef1f4;
    }

    .score-fill {
        height: 100%;
        border-radius: inherit;
    }

    .system-severity {
        margin-top: 12px;
        color:
            var(--muted);
        font-size: 11px;
    }

    .alert-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .alert-row {
        display: grid;
        grid-template-columns:
            90px minmax(0, 1fr);
        gap: 14px;
        padding: 14px;
        border:
            1px solid
            var(--border);
        border-radius: 12px;
    }

    .alert-severity {
        align-self: start;
        padding: 7px 8px;
        border-radius: 8px;
        text-align: center;
        font-size: 10px;
        font-weight: 900;
    }

    .alert-title {
        font-size: 13px;
        font-weight: 800;
    }

    .alert-message {
        margin-top: 5px;
        color:
            var(--muted);
        font-size: 13px;
        line-height: 1.45;
    }

    .alert-time {
        margin-top: 7px;
        color:
            var(--muted);
        font-size: 11px;
    }

    .empty-state {
        padding: 26px;
        border:
            1px dashed
            var(--border);
        border-radius: 12px;
        color:
            var(--muted);
        text-align: center;
        font-size: 13px;
    }

    .footer {
        padding: 6px 2px 20px;
        color:
            var(--muted);
        font-size: 11px;
        text-align: right;
    }

    .status-pass,
    .status-info {
        color:
            var(--success);
    }

    .status-warning,
    .status-medium {
        color:
            var(--warning);
    }

    .status-fail,
    .status-high,
    .status-critical {
        color:
            var(--danger);
    }

    .status-unknown,
    .status-low {
        color:
            var(--unknown);
    }

    .status-pill.status-pass,
    .system-status.status-pass,
    .alert-severity.status-pass,
    .alert-severity.status-info {
        background:
            var(--success-bg);
        color:
            var(--success);
    }

    .status-pill.status-warning,
    .system-status.status-warning,
    .alert-severity.status-warning,
    .alert-severity.status-medium {
        background:
            var(--warning-bg);
        color:
            var(--warning);
    }

    .status-pill.status-fail,
    .system-status.status-fail,
    .alert-severity.status-fail,
    .alert-severity.status-high,
    .alert-severity.status-critical {
        background:
            var(--danger-bg);
        color:
            var(--danger);
    }

    .status-pill.status-unknown,
    .system-status.status-unknown,
    .alert-severity.status-unknown,
    .alert-severity.status-low {
        background:
            var(--unknown-bg);
        color:
            var(--unknown);
    }

    .score-fill.status-pass,
    .score-fill.status-info {
        background:
            var(--success);
    }

    .score-fill.status-warning,
    .score-fill.status-medium {
        background:
            var(--warning);
    }

    .score-fill.status-fail,
    .score-fill.status-high,
    .score-fill.status-critical {
        background:
            var(--danger);
    }

    .score-fill.status-unknown,
    .score-fill.status-low {
        background:
            var(--unknown);
    }

    @media (
        max-width: 1100px
    ) {
        .metric-grid {
            grid-template-columns:
                repeat(
                    3,
                    minmax(0, 1fr)
                );
        }

        .system-grid {
            grid-template-columns:
                repeat(
                    2,
                    minmax(0, 1fr)
                );
        }
    }

    @media (
        max-width: 760px
    ) {
        .app-shell {
            display: block;
        }

        .sidebar {
            position: static;
            width: 100%;
            height: auto;
        }

        .nav {
            flex-direction: row;
            flex-wrap: wrap;
        }

        .sidebar-footer {
            display: none;
        }

        .main-content {
            padding: 18px;
        }

        .topbar {
            align-items: flex-start;
        }

        .metric-grid,
        .system-grid {
            grid-template-columns:
                1fr;
        }

        .alert-row {
            grid-template-columns:
                1fr;
        }
    }
</style>
`;
}

/* ========================================================================== */
/* HELPERS */
/* ========================================================================== */

function BCC_number_(
    value,
    fallback
) {
    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : Number(fallback || 0);
}

function BCC_clamp_(
    value,
    minimum,
    maximum
) {
    return Math.min(
        Number(maximum),
        Math.max(
            Number(minimum),
            BCC_number_(
                value,
                minimum
            )
        )
    );
}

function BCC_statusClass_(
    value
) {
    const normalized =
        String(value || "UNKNOWN")
            .trim()
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            );

    return (
        "status-" +
        (
            normalized ||
            "unknown"
        )
    );
}

function BCC_severityWeight_(
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

function BCC_formatDateTime_(
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
        return String(value);
    }

    return Utilities.formatDate(
        date,
        Session.getScriptTimeZone() ||
            "America/Chicago",
        "MMM d, yyyy h:mm a"
    );
}

/* ========================================================================== */
/* VIEW DIAGNOSTICS */
/* ========================================================================== */

function BCC_runDashboardViewDiagnostics() {
    const requiredFunctions = [
        "BCC_getSafeDashboardPayload_",
        "BCC_escapeHtml_",
        "BCC_buildDashboardViewModel_",
        "BCC_buildDashboardHtml_"
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

    let renderStatus = "PASS";
    let renderError = "";

    try {
        const model =
            BCC_buildDashboardViewModel_({
                release:
                    "BCC-02-TEST",

                metrics: {
                    enterpriseScore: 100,
                    subsystemCount: 6,
                    passing: 6,
                    warnings: 0,
                    failures: 0,
                    unknown: 0,
                    overallStatus:
                        "PASS"
                },

                executive: {
                    status: "PASS"
                },

                systems: {},

                alerts: [],

                generatedAt:
                    new Date()
                        .toISOString()
            });

        const html =
            BCC_buildDashboardHtml_(
                model,
                {}
            );

        if (
            typeof html !== "string" ||
            html.indexOf(
                "Broker Command Center"
            ) === -1
        ) {
            renderStatus =
                "FAIL";

            renderError =
                "Dashboard HTML was not generated correctly.";
        }
    } catch (error) {
        renderStatus =
            "FAIL";

        renderError =
            String(
                error &&
                error.message
                    ? error.message
                    : error
            );
    }

    tests.push({
        code:
            "DASHBOARD_RENDER",

        status:
            renderStatus,

        details:
            renderError
    });

    const failed =
        tests.filter(
            function(test) {
                return (
                    test.status === "FAIL"
                );
            }
        ).length;

    return {
        release:
            "BCC-02-DASHBOARD-VIEW",

        version:
            BCC_DASHBOARD_VIEW_VERSION,

        overallStatus:
            failed > 0
                ? "FAIL"
                : "PASS",

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