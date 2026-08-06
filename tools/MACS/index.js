const path = require("path");

const RepositoryScanner =
    require("./modules/RepositoryScanner");

const FunctionIndexer =
    require("./modules/FunctionIndexer");

const DependencyGraph =
    require("./modules/DependencyGraph");

const MissingFunctionClassifier =
    require("./modules/MissingFunctionClassifier");

const ArchitectureRules =
    require("./modules/ArchitectureRules");

const ProjectHealth =
    require("./modules/ProjectHealth");

const DependencyHeatmap =
    require("./modules/DependencyHeatmap");

const ProductionReadiness =
    require("./modules/ProductionReadiness");

(async () => {
    try {
        const root = path.resolve(
            __dirname,
            "..",
            ".."
        );

        const reports = path.join(
            __dirname,
            "reports"
        );

        const repositoryScanner =
            new RepositoryScanner(root);

        const functionIndexer =
            new FunctionIndexer(root);

        const dependencyGraph =
            new DependencyGraph(root);

        const missingFunctionClassifier =
            new MissingFunctionClassifier(root);

        const architectureRules =
            new ArchitectureRules(root);

        const projectHealth =
            new ProjectHealth();

        const dependencyHeatmap =
            new DependencyHeatmap();

        const productionReadiness =
            new ProductionReadiness();

        await repositoryScanner.writeReport(
            reports
        );

        await functionIndexer.writeReport(
            reports
        );

        await dependencyGraph.writeReport(
            reports
        );

        missingFunctionClassifier.writeReport(
            reports
        );

        architectureRules.writeReport(
            reports
        );

        projectHealth.writeReport(
            reports
        );

        dependencyHeatmap.writeReport(
            reports
        );

        productionReadiness.writeReport(
            reports
        );

    } catch (error) {
        console.error("");
        console.error("MACS execution failed.");
        console.error("--------------------------");
        console.error(
            error && error.stack
                ? error.stack
                : error
        );

        process.exitCode = 1;
    }
})();