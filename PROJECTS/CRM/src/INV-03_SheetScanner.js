/******************************************************************************
 * MelroseOS Enterprise
 * Module 0 - Inventory
 * INV-03_SheetScanner.gs
 * Version 1.0.0
 ******************************************************************************/

/******************************************************************************
 * RUN WORKBOOK SCAN
 ******************************************************************************/

function M5_scanWorkbook() {

  const ss = SpreadsheetApp.getActive();

  const inventory = createSheetIfMissing_(ss, M5.INVENTORY_SHEET);

  clearSheet_(inventory);

  const headers = [

    "Sheet Name",
    "Hidden",
    "Protected",
    "Rows",
    "Columns",
    "Frozen Rows",
    "Frozen Columns",
    "Filter",
    "Last Row",
    "Last Column",
    "Data Rows",
    "Scanned"

  ];

  setHeaders_(inventory, headers);

  const sheets = ss.getSheets();

  let output = [];

  sheets.forEach(function (sheet) {

    output.push(scanSingleSheet_(sheet));

  });

  if (output.length) {

    inventory.getRange(2, 1, output.length, headers.length)

      .setValues(output);

  }

  autoResize_(inventory);

  logMessage_("SCAN", "Workbook scan complete.");

}

/******************************************************************************
 * SCAN ONE SHEET
 ******************************************************************************/

function scanSingleSheet_(sheet) {

  const protections = sheet.getProtections(
    SpreadsheetApp.ProtectionType.SHEET
  );

  const protectedSheet = protections.length > 0;

  const filter = sheet.getFilter();

  const lastRow = sheet.getLastRow();

  const lastColumn = sheet.getLastColumn();

  return [

    sheet.getName(),

    sheet.isSheetHidden(),

    protectedSheet,

    sheet.getMaxRows(),

    sheet.getMaxColumns(),

    sheet.getFrozenRows(),

    sheet.getFrozenColumns(),

    filter ? "YES" : "NO",

    lastRow,

    lastColumn,

    Math.max(lastRow - 1, 0),

    timestamp_()

  ];

}

/******************************************************************************
 * FIND SHEET
 ******************************************************************************/

function M5_findSheet(name) {

  return SpreadsheetApp

    .getActive()

    .getSheetByName(name);

}

/******************************************************************************
 * LIST SHEETS
 ******************************************************************************/

function M5_listSheets() {

  return SpreadsheetApp

    .getActive()

    .getSheets()

    .map(function (s) {

      return s.getName();

    });

}

/******************************************************************************
 * WORKBOOK SUMMARY
 ******************************************************************************/

function M5_workbookSummary() {

  const sheets = SpreadsheetApp

    .getActive()

    .getSheets();

  let summary = {

    workbook: SpreadsheetApp

      .getActive()

      .getName(),

    sheetCount: sheets.length,

    totalRows: 0,

    totalColumns: 0

  };

  sheets.forEach(function (s) {

    summary.totalRows += s.getMaxRows();

    summary.totalColumns += s.getMaxColumns();

  });

  return summary;

}

/******************************************************************************
 * SELF TEST
 ******************************************************************************/

function M5_testSheetScanner() {

  M5_scanWorkbook();

  Logger.log(M5_workbookSummary());

  return true;

}