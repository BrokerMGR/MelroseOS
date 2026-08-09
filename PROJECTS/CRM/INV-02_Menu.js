/******************************************************************************
 * MelroseOS Enterprise
 * Module 0 - Inventory & Diagnostics
 * File: INV-02_Menu.gs
 * Version: 1.0.0
 *
 * Custom Menu
 ******************************************************************************/

/******************************************************************************
 * ON OPEN
 ******************************************************************************/

function onOpen(e) {

  M5_buildMenu();

}

/******************************************************************************
 * MENU
 ******************************************************************************/

function M5_buildMenu() {

  SpreadsheetApp.getUi()

    .createMenu("MelroseOS")

      .addItem("Initialize Inventory", "M5_initialize")

      .addSeparator()

      .addItem("Run Full Inventory", "M5_runInventory")

      .addItem("Scan Workbook", "M5_scanWorkbook")

      .addItem("Scan Headers", "M5_scanHeaders")

      .addItem("Scan Script", "M5_scanScript")

      .addItem("Diagnostics", "M5_runDiagnostics")

      .addSeparator()

      .addItem("Migration Report", "M5_buildMigrationReport")

      .addSeparator()

      .addItem("Reset Inventory", "M5_resetInventory")

      .addSeparator()

      .addItem("About MelroseOS", "M5_about")

      .addSeparator()

      .addItem("Open Inventory Dashboard", "M5_showInventoryDashboard")

      .addToUi();

}

/******************************************************************************
 * ABOUT
 ******************************************************************************/

function M5_about() {

  const ui = SpreadsheetApp.getUi();

  ui.alert(

    "MelroseOS Enterprise\n\n" +

    "Inventory & Diagnostics\n\n" +

    "Version: " + M5.VERSION +

    "\nBuild: " + M5.BUILD +

    "\nModule: " + M5.MODULE

  );

}

/******************************************************************************
 * PLACEHOLDER WRAPPERS
 *
 * These call functions that will exist in later files.
 ******************************************************************************/

function M5_runInventory() {

  M5_scanWorkbook();

  M5_scanHeaders();

  M5_scanScript();

  M5_runDiagnostics();

  M5_buildMigrationReport();

}

function M5_scanWorkbook() {

  SpreadsheetApp.getUi().alert(

    "Workbook Scanner not installed yet.\n\nInstall INV-03_SheetScanner.gs"

  );

}

function M5_scanHeaders() {

  SpreadsheetApp.getUi().alert(

    "Header Scanner not installed yet.\n\nInstall INV-04_HeaderScanner.gs"

  );

}

function M5_scanScript() {

  SpreadsheetApp.getUi().alert(

    "Script Scanner not installed yet.\n\nInstall INV-05_TriggerScanner.gs"

  );

}

function M5_runDiagnostics() {

  SpreadsheetApp.getUi().alert(

    "Diagnostics not installed yet.\n\nInstall INV-08_Diagnostics.gs"

  );

}

function M5_buildMigrationReport() {

  SpreadsheetApp.getUi().alert(

    "Migration Report not installed yet.\n\nInstall INV-09_ReportBuilder.gs"

  );

}

/******************************************************************************
 * SELF TEST
 ******************************************************************************/

function M5_testMenu() {

  M5_buildMenu();

  return true;

}