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
const ProductionReadiness =
    require("./modules/ProductionReadiness");

(async () => {
    const root = path.resolve(
        __dirname,
        "..",
        ".."
    );

    const reports = path.join(
        __dirname,
        "reports"
    );

    await new RepositoryScanner(root)
        .writeReport(reports);

    await new FunctionIndexer(root)
        .writeReport(reports);

    await new DependencyGraph(root)
        .writeReport(reports);

    new MissingFunctionClassifier(root)
        .writeReport(reports);

    new ArchitectureRules(root)
        .writeReport(reports);

    new ProductionReadiness()
        .writeReport(reports);
})();