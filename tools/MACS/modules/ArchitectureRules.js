const fs = require("fs");
const path = require("path");

class ArchitectureRules {
    constructor(root) {
        this.root = root;
    }

    readJson(filePath, fallback = {}) {
        try {
            return JSON.parse(
                fs.readFileSync(filePath, "utf8")
            );
        } catch {
            return fallback;
        }
    }

    evaluate(reportFolder) {
        const functionIndex = this.readJson(
            path.join(
                reportFolder,
                "FunctionIndex.json"
            ),
            []
        );

        const duplicateFunctions = this.readJson(
            path.join(
                reportFolder,
                "DuplicateFunctions.json"
            ),
            []
        );

        const classification = this.readJson(
            path.join(
                reportFolder,
                "MissingFunctionClassification.json"
            ),
            {
                summary: {
                    totalMissing: 0,
                    likelyRealMissing: 0,
                    legacyFrameworkDependency: 0,
                    callbackOrDynamic: 0,
                    testOrInstallerOnly: 0,
                    unresolvedOther: 0
                },
                categories: {}
            }
        );

        const names = new Set(
            functionIndex.map(item => item.name)
        );

        const rules = [];

        const addRule = (
            code,
            passed,
            details,
            severity = "ERROR"
        ) => {
            rules.push({
                code,
                status: passed
                    ? "PASS"
                    : severity,
                details
            });
        };

        addRule(
            "CANONICAL_INTAKE_PRESENT",
            names.has("MOS5_submitCanonicalLead"),
            "Canonical intake function MOS5_submitCanonicalLead must exist."
        );

        addRule(
            "INTAKE_ROUTER_PRESENT",
            names.has("LI_routeIncomingLead"),
            "LI_routeIncomingLead must exist."
        );

        addRule(
            "DEDUPE_ENGINE_PRESENT",
            names.has("LI_receiveLeadWithDedupe"),
            "LI_receiveLeadWithDedupe must exist."
        );

        addRule(
            "ELIGIBILITY_ENGINE_PRESENT",
            names.has("AE_evaluateEligibility"),
            "AE_evaluateEligibility must exist."
        );

        addRule(
            "ROUND_ROBIN_PRESENT",
            names.has("AE_selectAgentForLead"),
            "AE_selectAgentForLead must exist."
        );

        addRule(
            "ASSIGNMENT_ENTRY_PRESENT",
            names.has("AE_assignLead"),
            "AE_assignLead must exist."
        );

        addRule(
            "BROKER_FALLBACK_PRESENT",
            names.has("AE_findBrokerAgent_") ||
                names.has("AE_assignBrokerFallback_"),
            "A broker fallback function must exist."
        );

        addRule(
            "SAFETY_BRIDGE_PRESENT",
            names.has("MOS5M1B_getGlobalSafetyState_"),
            "CRM must contain the Core safety bridge."
        );

        addRule(
            "INTAKE_GATE_PRESENT",
            names.has("MOS5M1B_checkLeadIntakeGate_"),
            "Lead intake safety gate must exist."
        );

        addRule(
            "ROUTING_GATE_PRESENT",
            names.has("MOS5M1B_checkRoutingGate_"),
            "Routing safety gate must exist."
        );

        addRule(
            "COMMUNICATIONS_GATE_PRESENT",
            names.has("MOS5M1B_checkCommunicationsGate_"),
            "Communications safety gate must exist."
        );

        addRule(
            "ASSIGNMENT_CORE_SUPPORT_PRESENT",
            names.has("AE_initializeConfig") &&
                names.has("AE_getMode") &&
                names.has("AE_getAgent") &&
                names.has("AE_upsertAgent"),
            "Canonical Assignment Engine support functions must exist."
        );

        addRule(
            "LEGACY_INTAKE_BRIDGE_PRESENT",
            names.has("LI_intakeLead") &&
                names.has("LI_routeLead") &&
                names.has("CRM_createLead"),
            "Legacy lead entry points must route through compatibility bridges."
        );

        addRule(
            "LEGACY_BCC_ROUTE_PRESENT",
            names.has("MOS5BCC_legacyDoGet_"),
            "Legacy Broker Command Center route must exist."
        );

        const canonicalNames = new Set([
            "MOS5_submitCanonicalLead",
            "LI_routeIncomingLead",
            "submitM5Lead"
        ]);

        const duplicateCanonicalFunctions =
            duplicateFunctions.filter(group =>
                group.some(item =>
                    canonicalNames.has(item.name)
                )
            );

        addRule(
            "NO_DUPLICATE_CANONICAL_INTAKE",
            duplicateCanonicalFunctions.length === 0,
            duplicateCanonicalFunctions.length === 0
                ? "No duplicate canonical intake functions detected."
                : "Duplicate canonical intake functions were detected.",
            "WARNING"
        );

        const likelyRealMissing =
            Number(
                classification.summary
                    ?.likelyRealMissing || 0
            );

        addRule(
            "NO_REAL_MISSING_FUNCTIONS",
            likelyRealMissing === 0,
            likelyRealMissing === 0
                ? "No likely real missing production functions detected."
                : `${likelyRealMissing} likely real missing production function(s) detected.`
        );

        const unresolvedOther =
            Number(
                classification.summary
                    ?.unresolvedOther || 0
            );

        addRule(
            "UNRESOLVED_OTHER_REFERENCES",
            unresolvedOther === 0,
            unresolvedOther === 0
                ? "No unclassified unresolved references remain."
                : `${unresolvedOther} unresolved reference(s) still require classification.`,
            "WARNING"
        );

        const failed = rules.filter(
            rule => rule.status === "ERROR"
        ).length;

        const warnings = rules.filter(
            rule => rule.status === "WARNING"
        ).length;

        const passed = rules.filter(
            rule => rule.status === "PASS"
        ).length;

        const report = {
            generated: new Date().toISOString(),
            overallStatus:
                failed > 0
                    ? "FAIL"
                    : warnings > 0
                        ? "WARNING"
                        : "PASS",
            passed,
            warnings,
            failed,
            classificationSummary:
                classification.summary,
            rules
        };

        return report;
    }

    writeReport(reportFolder) {
        fs.mkdirSync(reportFolder, {
            recursive: true
        });

        const report = this.evaluate(
            reportFolder
        );

        fs.writeFileSync(
            path.join(
                reportFolder,
                "ArchitectureRules.json"
            ),
            JSON.stringify(report, null, 2)
        );

        console.log("");
        console.log("Architecture Rules");
        console.log("--------------------------");
        console.log("Passed   :", report.passed);
        console.log("Warnings :", report.warnings);
        console.log("Failed   :", report.failed);
        console.log(
            "Status   :",
            report.overallStatus
        );

        if (report.overallStatus === "PASS") {
            console.log("[PASS]");
        } else if (
            report.overallStatus === "WARNING"
        ) {
            console.log("[WARNING]");
        } else {
            console.log("[FAIL]");
        }
    }
}

module.exports = ArchitectureRules;