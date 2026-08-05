const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

class DependencyGraph {
    constructor(root) {
        this.root = root;
    }

    async build() {
        const files = await fg(
            [
                "PROJECTS/**/*.js",
                "PROJECTS/**/*.gs"
            ],
            {
                cwd: this.root,
                absolute: false,
                ignore: [
                    "**/node_modules/**",
                    "**/.git/**",
                    "**/backup/**",
                    "**/logs/**",
                    "**/reports/**"
                ]
            }
        );

        const ignoredGlobals = new Set([
            // Standard JavaScript globals
            "Array",
            "ArrayBuffer",
            "BigInt",
            "Boolean",
            "Date",
            "Error",
            "EvalError",
            "Function",
            "Infinity",
            "Intl",
            "JSON",
            "Map",
            "Math",
            "NaN",
            "Number",
            "Object",
            "Promise",
            "Proxy",
            "RangeError",
            "ReferenceError",
            "Reflect",
            "RegExp",
            "Set",
            "String",
            "Symbol",
            "SyntaxError",
            "TypeError",
            "URIError",
            "WeakMap",
            "WeakSet",

            // Standard JavaScript functions
            "clearInterval",
            "clearTimeout",
            "decodeURI",
            "decodeURIComponent",
            "encodeURI",
            "encodeURIComponent",
            "escape",
            "eval",
            "isFinite",
            "isNaN",
            "parseFloat",
            "parseInt",
            "setInterval",
            "setTimeout",
            "unescape",

            // Console
            "console",

            // Google Apps Script services
            "AdminDirectory",
            "AdminReports",
            "Browser",
            "CalendarApp",
            "CardService",
            "Charts",
            "Classroom",
            "ContactsApp",
            "ContentService",
            "DataStudioApp",
            "DocumentApp",
            "Drive",
            "DriveApp",
            "FormApp",
            "GmailApp",
            "GroupsApp",
            "HtmlService",
            "Jdbc",
            "LanguageApp",
            "LinearOptimizationService",
            "LockService",
            "Logger",
            "MailApp",
            "Maps",
            "MimeType",
            "OptimizationService",
            "PropertiesService",
            "ScriptApp",
            "Session",
            "SitesApp",
            "SlidesApp",
            "SpreadsheetApp",
            "UrlFetchApp",
            "Utilities",
            "XmlService",

            // Advanced Google services commonly used in Apps Script
            "Analytics",
            "AnalyticsData",
            "BigQuery",
            "Calendar",
            "DriveActivity",
            "Gmail",
            "People",
            "Sheets",
            "Tasks",
            "YouTube"
        ]);

        const declaredFunctions = new Map();
        const calls = [];
        const parseErrors = [];

        for (const file of files) {
            const fullPath = path.join(this.root, file);

            let source;

            try {
                source = fs.readFileSync(fullPath, "utf8");
            } catch (error) {
                parseErrors.push({
                    file,
                    error: `Unable to read file: ${error.message}`
                });

                continue;
            }

            let ast;

            try {
                ast = parser.parse(source, {
                    sourceType: "script",
                    errorRecovery: true,
                    allowReturnOutsideFunction: true,
                    plugins: [
                        "classProperties",
                        "objectRestSpread",
                        "optionalChaining",
                        "nullishCoalescingOperator"
                    ]
                });
            } catch (error) {
                parseErrors.push({
                    file,
                    error: error.message
                });

                continue;
            }

            const fileLocalIdentifiers = new Set();

            const registerDeclaration = (
                name,
                node,
                declarationType
            ) => {
                if (!name) {
                    return;
                }

                if (!declaredFunctions.has(name)) {
                    declaredFunctions.set(name, []);
                }

                declaredFunctions.get(name).push({
                    file,
                    line: node.loc?.start?.line || null,
                    type: declarationType
                });
            };

            const registerParameters = parameters => {
                for (const parameter of parameters || []) {
                    if (parameter.type === "Identifier") {
                        fileLocalIdentifiers.add(parameter.name);
                    }

                    if (
                        parameter.type === "AssignmentPattern" &&
                        parameter.left?.type === "Identifier"
                    ) {
                        fileLocalIdentifiers.add(
                            parameter.left.name
                        );
                    }

                    if (
                        parameter.type === "RestElement" &&
                        parameter.argument?.type === "Identifier"
                    ) {
                        fileLocalIdentifiers.add(
                            parameter.argument.name
                        );
                    }
                }
            };

            traverse(ast, {
                FunctionDeclaration(nodePath) {
                    const node = nodePath.node;

                    if (node.id?.name) {
                        registerDeclaration(
                            node.id.name,
                            node,
                            "FunctionDeclaration"
                        );
                    }

                    registerParameters(node.params);
                },

                FunctionExpression(nodePath) {
                    const node = nodePath.node;

                    if (node.id?.name) {
                        registerDeclaration(
                            node.id.name,
                            node,
                            "FunctionExpression"
                        );
                    }

                    registerParameters(node.params);
                },

                ArrowFunctionExpression(nodePath) {
                    registerParameters(nodePath.node.params);
                },

                VariableDeclarator(nodePath) {
                    const node = nodePath.node;

                    if (node.id?.type !== "Identifier") {
                        return;
                    }

                    fileLocalIdentifiers.add(node.id.name);

                    if (
                        node.init?.type === "FunctionExpression" ||
                        node.init?.type ===
                            "ArrowFunctionExpression"
                    ) {
                        registerDeclaration(
                            node.id.name,
                            node,
                            node.init.type
                        );
                    }
                },

                ClassMethod(nodePath) {
                    const node = nodePath.node;

                    if (
                        node.key?.type === "Identifier" &&
                        node.key.name
                    ) {
                        registerDeclaration(
                            node.key.name,
                            node,
                            "ClassMethod"
                        );
                    }

                    registerParameters(node.params);
                },

                ObjectMethod(nodePath) {
                    const node = nodePath.node;

                    if (
                        node.key?.type === "Identifier" &&
                        node.key.name
                    ) {
                        registerDeclaration(
                            node.key.name,
                            node,
                            "ObjectMethod"
                        );
                    }

                    registerParameters(node.params);
                },

                CallExpression(nodePath) {
                    const node = nodePath.node;

                    if (
                        !node.callee ||
                        node.callee.type !== "Identifier"
                    ) {
                        return;
                    }

                    const callee = node.callee.name;

                    calls.push({
                        caller: file,
                        callee,
                        line: node.loc?.start?.line || null,

                        // Babel determines whether the called identifier
                        // is defined in the current lexical scope.
                        hasLocalBinding:
                            nodePath.scope.hasBinding(callee),

                        localIdentifiers:
                            new Set(fileLocalIdentifiers)
                    });
                }
            });
        }

        const missingMap = new Map();
        const graph = [];
        const graphMap = {};
        const crossProjectCalls = [];

        for (const call of calls) {
            const record = {
                caller: call.caller,
                callee: call.callee,
                line: call.line
            };

            graph.push(record);

            graphMap[call.caller] ??= [];
            graphMap[call.caller].push(call.callee);

            const callerProject =
                this.getProjectName(call.caller);

            const declarations =
                declaredFunctions.get(call.callee) || [];

            const declarationProjects = [
                ...new Set(
                    declarations
                        .map(item =>
                            this.getProjectName(item.file)
                        )
                        .filter(Boolean)
                )
            ];

            if (
                callerProject &&
                declarationProjects.length > 0 &&
                declarationProjects.some(
                    project => project !== callerProject
                )
            ) {
                crossProjectCalls.push({
                    callerProject,
                    callerFile: call.caller,
                    callee: call.callee,
                    declarationProjects,
                    line: call.line
                });
            }

            const isMissing =
                !declaredFunctions.has(call.callee) &&
                !ignoredGlobals.has(call.callee) &&
                !call.hasLocalBinding &&
                !call.localIdentifiers.has(call.callee);

            if (isMissing) {
                const key =
                    `${call.caller}::${call.callee}`;

                missingMap.set(key, {
                    caller: call.caller,
                    callee: call.callee,
                    line: call.line
                });
            }
        }

        const calledFunctionNames = new Set(
            calls.map(call => call.callee)
        );

        const orphanFunctions = [];

        for (
            const [name, declarations]
            of declaredFunctions.entries()
        ) {
            if (!calledFunctionNames.has(name)) {
                orphanFunctions.push({
                    name,
                    declarations
                });
            }
        }

        const duplicateFunctions = [];

        for (
            const [name, declarations]
            of declaredFunctions.entries()
        ) {
            if (declarations.length > 1) {
                duplicateFunctions.push({
                    name,
                    count: declarations.length,
                    declarations
                });
            }
        }

        return {
            generated: new Date().toISOString(),
            filesScanned: files.length,
            declaredFunctions: declaredFunctions.size,
            totalCalls: calls.length,
            missingFunctions: [...missingMap.values()],
            orphanFunctions,
            duplicateFunctions,
            crossProjectCalls,
            graph,
            graphMap,
            parseErrors
        };
    }

    getProjectName(file) {
        const normalized = file.replace(/\\/g, "/");
        const match =
            normalized.match(/^PROJECTS\/([^/]+)\//);

        return match ? match[1] : null;
    }

    writeJson(reportFolder, filename, value) {
        fs.writeFileSync(
            path.join(reportFolder, filename),
            JSON.stringify(value, null, 2)
        );
    }

    async writeReport(reportFolder) {
        fs.mkdirSync(reportFolder, {
            recursive: true
        });

        const report = await this.build();

        this.writeJson(
            reportFolder,
            "DependencyGraph.json",
            report.graph
        );

        this.writeJson(
            reportFolder,
            "MissingFunctions.json",
            report.missingFunctions
        );

        this.writeJson(
            reportFolder,
            "OrphanFunctions.json",
            report.orphanFunctions
        );

        this.writeJson(
            reportFolder,
            "DuplicateFunctionDeclarations.json",
            report.duplicateFunctions
        );

        this.writeJson(
            reportFolder,
            "CrossProjectCalls.json",
            report.crossProjectCalls
        );

        this.writeJson(
            reportFolder,
            "DependencyGraphByFile.json",
            report.graphMap
        );

        this.writeJson(
            reportFolder,
            "ParseErrors.json",
            report.parseErrors
        );

        this.writeJson(
            reportFolder,
            "DependencySummary.json",
            {
                generated: report.generated,
                filesScanned: report.filesScanned,
                declaredFunctions:
                    report.declaredFunctions,
                totalCalls:
                    report.totalCalls,
                missingFunctions:
                    report.missingFunctions.length,
                orphanFunctions:
                    report.orphanFunctions.length,
                duplicateFunctions:
                    report.duplicateFunctions.length,
                crossProjectCalls:
                    report.crossProjectCalls.length,
                parseErrors:
                    report.parseErrors.length
            }
        );

        console.log("");
        console.log("Dependency Graph");
        console.log("--------------------------");
        console.log(
            "Files     :",
            report.filesScanned
        );
        console.log(
            "Declared  :",
            report.declaredFunctions
        );
        console.log(
            "Calls     :",
            report.totalCalls
        );
        console.log(
            "Missing   :",
            report.missingFunctions.length
        );
        console.log(
            "Orphans   :",
            report.orphanFunctions.length
        );
        console.log(
            "Duplicates:",
            report.duplicateFunctions.length
        );
        console.log(
            "Cross-project:",
            report.crossProjectCalls.length
        );
        console.log(
            "Parse errors:",
            report.parseErrors.length
        );

        if (report.parseErrors.length > 0) {
            console.log("[WARNING]");
        } else {
            console.log("[PASS]");
        }
    }
}

module.exports = DependencyGraph;