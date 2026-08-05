const fs = require("fs");
const path = require("path");

class MissingFunctionClassifier {
    constructor(root) {
        this.root = root;
    }

    readJson(filePath, fallback = []) {
        try {
            return JSON.parse(
                fs.readFileSync(filePath, "utf8")
            );
        } catch {
            return fallback;
        }
    }

    classify(reportFolder) {
        const missing = this.readJson(
            path.join(
                reportFolder,
                "MissingFunctions.json"
            ),
            []
        );

        const categories = {
            likelyRealMissing: [],
            legacyFrameworkDependency: [],
            callbackOrDynamic: [],
            testOrInstallerOnly: [],
            unresolvedOther: []
        };

        const legacyPrefixes = [
            "registerMelrose",
            "setupMelrose",
            "refreshMelrose",
            "installOrUpgradeMelroseOS",
            "runMelroseCore",
            "getMelroseSetting_",
            "getCommandCenter_"
        ];

        const dynamicNames = new Set([
            "callback",
            "fn",
            "handler",
            "factory",
            "resolver",
            "predicate",
            "mapper",
            "reducer"
        ]);

        for (const item of missing) {
            const callee = String(
                item.callee || ""
            );

            const caller = String(
                item.caller || ""
            );

            const isLegacy =
                legacyPrefixes.some(prefix =>
                    callee.startsWith(prefix)
                );

            const isDynamic =
                dynamicNames.has(callee);

            const isTestOrInstaller =
                /Installer|Tests|Diagnostics|Diag|SmokeTest|Migration|Upgrade|Discovery/i
                    .test(caller);

            const isOperational =
                /^(AE_|LI_|CRM_|MOS5|NF_|OP_|CG_|LC_|AP_|RBR_)/i
                    .test(callee);

            if (
                isOperational &&
                !isTestOrInstaller
            ) {
                categories.likelyRealMissing.push(item);
                continue;
            }

            if (isLegacy) {
                categories.legacyFrameworkDependency.push(
                    item
                );
                continue;
            }

            if (isDynamic) {
                categories.callbackOrDynamic.push(item);
                continue;
            }

            if (isTestOrInstaller) {
                categories.testOrInstallerOnly.push(item);
                continue;
            }

            categories.unresolvedOther.push(item);
        }

        const summary = {
            generated: new Date().toISOString(),
            totalMissing: missing.length,
            likelyRealMissing:
                categories.likelyRealMissing.length,
            legacyFrameworkDependency:
                categories.legacyFrameworkDependency.length,
            callbackOrDynamic:
                categories.callbackOrDynamic.length,
            testOrInstallerOnly:
                categories.testOrInstallerOnly.length,
            unresolvedOther:
                categories.unresolvedOther.length
        };

        return {
            summary,
            categories
        };
    }

    writeReport(reportFolder) {
        const report = this.classify(
            reportFolder
        );

        fs.writeFileSync(
            path.join(
                reportFolder,
                "MissingFunctionClassification.json"
            ),
            JSON.stringify(report, null, 2)
        );

        fs.writeFileSync(
            path.join(
                reportFolder,
                "LikelyRealMissingFunctions.json"
            ),
            JSON.stringify(
                report.categories.likelyRealMissing,
                null,
                2
            )
        );

        console.log("");
        console.log("Missing Function Classification");
        console.log("--------------------------");
        console.log(
            "Total missing       :",
            report.summary.totalMissing
        );
        console.log(
            "Likely real missing :",
            report.summary.likelyRealMissing
        );
        console.log(
            "Legacy dependencies :",
            report.summary
                .legacyFrameworkDependency
        );
        console.log(
            "Callbacks/dynamic   :",
            report.summary.callbackOrDynamic
        );
        console.log(
            "Tests/installers    :",
            report.summary.testOrInstallerOnly
        );
        console.log(
            "Other unresolved    :",
            report.summary.unresolvedOther
        );
        console.log("[PASS]");
    }
}

module.exports = MissingFunctionClassifier;