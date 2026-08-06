const fs = require("fs");
const path = require("path");

class ProductionReadiness {
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
        const inventory = this.readJson(
            path.join(
                reportFolder,
                "RepositoryInventory.json"
            ),
            {}
        );

        const functions = this.readJson(
            path.join(
                reportFolder,
                "FunctionSummary.json"
            ),
            {}
        );

        const dependency = this.readJson(
            path.join(
                reportFolder,
                "DependencySummary.json"
            ),
            {}
        );

        const classification = this.readJson(
            path.join(
                reportFolder,
                "MissingFunctionClassification.json"
            ),
            {
                summary: {
                    likelyRealMissing: 999,
                    unresolvedOther: 999
                }
            }
        );

        const architecture = this.readJson(
            path.join(
                reportFolder,
                "ArchitectureRules.json"
            ),
            {}
        );

        const likelyRealMissing =
            Number(
                classification.summary
                    ?.likelyRealMissing || 0
            );

        const unresolvedOther =
            Number(
                classification.summary
                    ?.unresolvedOther || 0
            );

        const parseErrors =
            Number(
                dependency.parseErrors || 0
            );

        const categories = [];

        const addCategory = (
            name,
            status,
            details,
            score
        ) => {
            categories.push({
                name,
                status,
                details,
                score
            });
        };

/* ------------------------------------------------------------------------- */
/* Dynamic Repository Validation (MACS v2) */
/* ------------------------------------------------------------------------- */

const detectedProjects =
    Number(inventory.projectCount || 0);

const detectedProjectList =
    Array.isArray(inventory.projects)
        ? inventory.projects
        : [];

const projectNames =
    detectedProjectList
        .map(project => {

            if (typeof project === "string") {
                return project;
            }

            return (
                project.name ||
                project.project ||
                "Unknown"
            );

        })
        .join(", ");

addCategory(

    "Repository",

    detectedProjects > 0
        ? "PASS"
        : "FAIL",

    detectedProjects > 0

        ? `${detectedProjects} project(s) detected.` +
          (projectNames.length
              ? ` [ ${projectNames} ]`
              : "")

        : "No enterprise projects detected.",

    detectedProjects > 0
        ? 100
        : 0

);

        addCategory(
            "Parser integrity",
            parseErrors === 0
                ? "PASS"
                : "FAIL",
            `${parseErrors} parser error(s) detected.`,
            parseErrors === 0
                ? 100
                : 0
        );

        addCategory(
            "Architecture",
            architecture.overallStatus || "FAIL",
            `${architecture.passed || 0} rules passed, ` +
                `${architecture.warnings || 0} warning(s), ` +
                `${architecture.failed || 0} failure(s).`,
            architecture.failed > 0
                ? 35
                : architecture.warnings > 0
                    ? 90
                    : 100
        );

        addCategory(
            "Production functions",
            likelyRealMissing === 0
                ? "PASS"
                : "FAIL",
            `${likelyRealMissing} likely real missing production function(s).`,
            likelyRealMissing === 0
                ? 100
                : Math.max(
                    0,
                    100 - likelyRealMissing * 20
                )
        );

        addCategory(
            "Unresolved classification",
            unresolvedOther === 0
                ? "PASS"
                : "WARNING",
            `${unresolvedOther} unresolved reference(s) still require classification.`,
            unresolvedOther === 0
                ? 100
                : Math.max(
                    70,
                    100 - unresolvedOther * 10
                )
        );

        const failed = categories.filter(
            category =>
                category.status === "FAIL"
        ).length;

        const warnings = categories.filter(
            category =>
                category.status === "WARNING"
        ).length;

        const rawScore =
            categories.reduce(
                (
                    total,
                    category
                ) =>
                    total +
                    Number(category.score || 0),
                0
            ) / categories.length;

        const score = Math.round(rawScore);

        const productionReady =
            failed === 0 &&
            warnings === 0 &&
            score >= 95;

        const status =
            failed > 0
                ? "FAIL"
                : warnings > 0
                    ? "WARNING"
                    : "PASS";

        return {
            generated:
                new Date().toISOString(),
            score,
            productionReady,
            status,
            failed,
            warnings,
            likelyRealMissing,
            unresolvedOther,
            categories
        };
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
                "ProductionReadiness.json"
            ),
            JSON.stringify(report, null, 2)
        );

        console.log("");
        console.log("Production Readiness");
        console.log("--------------------------");

        report.categories.forEach(
            category => {
                console.log(
                    `${category.name.padEnd(26)} ${category.status}`
                );
            }
        );

        console.log("--------------------------");
        console.log(
            "Real missing functions :",
            report.likelyRealMissing
        );
        console.log(
            "Unresolved references  :",
            report.unresolvedOther
        );
        console.log(
            "Score                  :",
            `${report.score}%`
        );
        console.log(
            "Ready                  :",
            report.productionReady
                ? "YES"
                : "NO"
        );

        if (report.status === "PASS") {
            console.log("[PASS]");
        } else if (
            report.status === "WARNING"
        ) {
            console.log("[WARNING]");
        } else {
            console.log("[FAIL]");
        }
    }
}

module.exports = ProductionReadiness;