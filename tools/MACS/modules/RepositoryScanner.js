const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");

class RepositoryScanner {
    constructor(root) {
        this.root = root;
    }

    async scan() {

        const files = await fg(
            [
                "**/*.js",
                "**/*.gs",
                "**/*.html",
                "**/*.json"
            ],
            {
                cwd: this.root,
                absolute: false,
                ignore: [
                    "node_modules/**",
                    ".git/**"
                ]
            }
        );

        const projects = await fg(
            [
                "PROJECTS/*"
            ],
            {
                cwd: this.root,
                onlyDirectories: true
            }
        );

        const duplicates = {};

        files.forEach(file => {

            const name = path.basename(file);

            duplicates[name] ??= [];

            duplicates[name].push(file);

        });

        const duplicateFiles = Object
            .entries(duplicates)
            .filter(x => x[1].length > 1)
            .map(x => ({
                file: x[0],
                count: x[1].length,
                locations: x[1]
            }));

        return {
            generated: new Date().toISOString(),
            projectCount: projects.length,
            fileCount: files.length,
            projects,
            duplicateFiles
        };

    }

    async writeReport(reportFolder) {

        fs.mkdirSync(reportFolder,{recursive:true});

        const report = await this.scan();

        fs.writeFileSync(
            path.join(reportFolder,"RepositoryInventory.json"),
            JSON.stringify(report,null,2)
        );

        console.log("");
        console.log("Repository Scan");
        console.log("--------------------------");
        console.log("Projects :",report.projectCount);
        console.log("Files    :",report.fileCount);
        console.log("Duplicates:",report.duplicateFiles.length);
        console.log("");
        console.log("[PASS]");

    }

}

module.exports = RepositoryScanner;