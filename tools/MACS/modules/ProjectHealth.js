const fs = require("fs");
const path = require("path");

class ProjectHealth {

    readJson(file, fallback = {}) {

        try {
            return JSON.parse(
                fs.readFileSync(file, "utf8")
            );
        }
        catch {

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

        const architecture = this.readJson(
            path.join(
                reportFolder,
                "ArchitectureRules.json"
            ),
            {}
        );

        const parseErrors = this.readJson(
            path.join(
                reportFolder,
                "ParseErrors.json"
            ),
            []
        );

        const projects =
            Array.isArray(inventory.projects)
                ? inventory.projects
                : [];

        return projects.map(project => {

            const projectName =
                typeof project === "string"
                    ? project
                    : project.name || "Unknown";

            const projectPath =
                typeof project === "string"
                    ? project
                    : project.path || "";

            const parserIssues =
                parseErrors.filter(error =>
                    (error.file || "")
                        .startsWith(projectPath)
                ).length;

            return {

                name: projectName,

                path: projectPath,

                parserErrors:
                    parserIssues,

                architecture:
                    architecture.overallStatus || "UNKNOWN",

                status:
                    parserIssues === 0
                        ? "PASS"
                        : "FAIL"

            };

        });

    }

    writeReport(reportFolder) {

        const report =
            this.evaluate(reportFolder);

        fs.writeFileSync(

            path.join(
                reportFolder,
                "ProjectHealth.json"
            ),

            JSON.stringify(
                report,
                null,
                2
            )

        );

        console.log("");
        console.log("Project Health");
        console.log("--------------------------");

        report.forEach(project => {

            console.log(
                `${project.name.padEnd(20)} ${project.status}`
            );

        });

        console.log("[PASS]");

    }

}

module.exports = ProjectHealth;