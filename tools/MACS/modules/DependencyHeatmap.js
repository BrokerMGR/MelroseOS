const fs = require("fs");
const path = require("path");

class DependencyHeatmap {
    readJson(filePath, fallback = []) {
        try {
            return JSON.parse(
                fs.readFileSync(
                    filePath,
                    "utf8"
                )
            );
        } catch {
            return fallback;
        }
    }

    projectFromFile(filePath) {
        const normalized =
            String(filePath || "")
                .replace(/\\/g, "/");

        const match =
            normalized.match(
                /^PROJECTS\/([^/]+)\//
            );

        return match
            ? match[1]
            : "UNKNOWN";
    }

    evaluate(reportFolder) {
        const crossProjectCalls =
            this.readJson(
                path.join(
                    reportFolder,
                    "CrossProjectCalls.json"
                ),
                []
            );

        const matrix = {};
        const outbound = {};
        const inbound = {};

        crossProjectCalls.forEach(
            call => {
                const callerFile =
                    call.callerFile ||
                    call.caller ||
                    call.file ||
                    "";

                const sourceProject =
                    call.callerProject ||
                    this.projectFromFile(
                        callerFile
                    );

                const declarationFiles =
                    Array.isArray(
                        call.declarationFiles
                    )
                        ? call.declarationFiles
                        : Array.isArray(
                            call.declarations
                        )
                            ? call.declarations
                            : call.calleeFile
                                ? [
                                    call.calleeFile
                                ]
                                : [];

                const targetProjects =
                    Array.isArray(
                        call.declarationProjects
                    ) &&
                    call.declarationProjects.length
                        ? call.declarationProjects
                        : declarationFiles.map(
                            file =>
                                this.projectFromFile(
                                    file
                                )
                        );

                const uniqueTargets = [
                    ...new Set(
                        targetProjects
                            .map(project =>
                                String(
                                    project || ""
                                ).trim()
                            )
                            .filter(Boolean)
                    )
                ];

                uniqueTargets
                    .filter(
                        targetProject =>
                            targetProject !==
                                "UNKNOWN" &&
                            sourceProject !==
                                "UNKNOWN" &&
                            targetProject !==
                                sourceProject
                    )
                    .forEach(
                        targetProject => {
                            if (
                                !matrix[
                                    sourceProject
                                ]
                            ) {
                                matrix[
                                    sourceProject
                                ] = {};
                            }

                            matrix[
                                sourceProject
                            ][
                                targetProject
                            ] =
                                Number(
                                    matrix[
                                        sourceProject
                                    ][
                                        targetProject
                                    ] || 0
                                ) + 1;

                            outbound[
                                sourceProject
                            ] =
                                Number(
                                    outbound[
                                        sourceProject
                                    ] || 0
                                ) + 1;

                            inbound[
                                targetProject
                            ] =
                                Number(
                                    inbound[
                                        targetProject
                                    ] || 0
                                ) + 1;
                        }
                    );
            }
        );

        const matrixTargets =
            Object.values(matrix)
                .flatMap(
                    targets =>
                        Object.keys(
                            targets
                        )
                );

        const projects = [
            ...new Set([
                ...Object.keys(matrix),
                ...Object.keys(outbound),
                ...Object.keys(inbound),
                ...matrixTargets
            ])
        ].sort();

        const relationships = [];

        Object.keys(matrix)
            .sort()
            .forEach(
                sourceProject => {
                    Object.keys(
                        matrix[
                            sourceProject
                        ]
                    )
                        .sort()
                        .forEach(
                            targetProject => {
                                relationships.push({
                                    sourceProject,
                                    targetProject,
                                    calls:
                                        Number(
                                            matrix[
                                                sourceProject
                                            ][
                                                targetProject
                                            ] || 0
                                        )
                                });
                            }
                        );
                }
            );

        const projectSummary =
            projects.map(
                project => {
                    const outboundCalls =
                        Number(
                            outbound[
                                project
                            ] || 0
                        );

                    const inboundCalls =
                        Number(
                            inbound[
                                project
                            ] || 0
                        );

                    const totalCoupling =
                        outboundCalls +
                        inboundCalls;

                    return {
                        project,
                        outboundCalls,
                        inboundCalls,
                        totalCoupling,
                        risk:
                            this.riskLevel(
                                totalCoupling
                            )
                    };
                }
            );

        const highestCoupling =
            projectSummary
                .slice()
                .sort(
                    (a, b) =>
                        b.totalCoupling -
                        a.totalCoupling
                )[0] || null;

        return {
            generated:
                new Date()
                    .toISOString(),

            totalCrossProjectCalls:
                relationships.reduce(
                    (
                        total,
                        relationship
                    ) =>
                        total +
                        Number(
                            relationship.calls ||
                            0
                        ),
                    0
                ),

            projectCount:
                projects.length,

            relationshipCount:
                relationships.length,

            highestCoupling,

            matrix,

            relationships,

            projects:
                projectSummary
        };
    }

    riskLevel(totalCoupling) {
        const value =
            Number(
                totalCoupling || 0
            );

        if (value >= 1000) {
            return "CRITICAL";
        }

        if (value >= 500) {
            return "HIGH";
        }

        if (value >= 200) {
            return "MEDIUM";
        }

        return "LOW";
    }

    escapeCsv(value) {
        const text =
            String(
                value ?? ""
            );

        return `"${text.replace(
            /"/g,
            '""'
        )}"`;
    }

    writeCsv(
        reportFolder,
        report
    ) {
        const rows = [
            [
                "SourceProject",
                "TargetProject",
                "Calls"
            ]
        ];

        report.relationships
            .forEach(
                relationship => {
                    rows.push([
                        relationship
                            .sourceProject,

                        relationship
                            .targetProject,

                        relationship
                            .calls
                    ]);
                }
            );

        const csv =
            rows
                .map(
                    row =>
                        row
                            .map(
                                value =>
                                    this.escapeCsv(
                                        value
                                    )
                            )
                            .join(",")
                )
                .join("\n");

        fs.writeFileSync(
            path.join(
                reportFolder,
                "DependencyHeatmap.csv"
            ),
            csv
        );
    }

    writeReport(reportFolder) {
        fs.mkdirSync(
            reportFolder,
            {
                recursive: true
            }
        );

        const report =
            this.evaluate(
                reportFolder
            );

        fs.writeFileSync(
            path.join(
                reportFolder,
                "DependencyHeatmap.json"
            ),
            JSON.stringify(
                report,
                null,
                2
            )
        );

        this.writeCsv(
            reportFolder,
            report
        );

        console.log("");
        console.log(
            "Dependency Heatmap"
        );
        console.log(
            "--------------------------"
        );

        if (
            report.projects.length === 0
        ) {
            console.log(
                "No cross-project dependencies detected."
            );
        } else {
            report.projects
                .slice()
                .sort(
                    (a, b) =>
                        b.totalCoupling -
                        a.totalCoupling
                )
                .forEach(
                    project => {
                        console.log(
                            `${project.project.padEnd(
                                18
                            )} ` +
                            `Out ${String(
                                project.outboundCalls
                            ).padStart(5)}  ` +
                            `In ${String(
                                project.inboundCalls
                            ).padStart(5)}  ` +
                            project.risk
                        );
                    }
                );
        }

        console.log(
            "--------------------------"
        );

        console.log(
            "Cross-project calls :",
            report.totalCrossProjectCalls
        );

        console.log(
            "Relationships       :",
            report.relationshipCount
        );

        console.log("[PASS]");

        return report;
    }
}

module.exports = DependencyHeatmap;