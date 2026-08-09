/******************************************************************************
 * MelroseOS Enterprise
 * Module 0 - Inventory
 * File: INV-04_HeaderScanner.gs
 * Version: 1.0.0
 ******************************************************************************/

/******************************************************************************
 * HEADER SCANNER
 ******************************************************************************/

function M5_scanHeaders() {

  const ss = SpreadsheetApp.getActive();

  const schema = createSheetIfMissing_(ss, M5.SCHEMA_SHEET);

  clearSheet_(schema);

  const headers = [

    "WorkbookID",
    "SheetID",
    "ColumnID",
    "Sheet Name",
    "Column Letter",
    "Column Number",
    "Header",
    "Normalized Header",
    "Duplicate",
    "Blank",
    "Primary Key",
    "Foreign Key",
    "Suggested Type",
    "Sample Value",
    "Scanned"

  ];

  setHeaders_(schema, headers);

  const workbookId = "WB-000001";

  let row = 2;

  ss.getSheets().forEach(function(sheet, sheetIndex){

    const values = sheet.getDataRange().getValues();

    if(values.length === 0) return;

    const headerRow = values[0];

    const firstDataRow = values.length > 1 ? values[1] : [];

    headerRow.forEach(function(header, colIndex){

      const duplicate = headerRow.filter(function(h){

        return String(h).trim() === String(header).trim();

      }).length > 1;

      const normalized = normalizeHeader_(header);

      const sample = firstDataRow[colIndex] || "";

      schema.getRange(row,1,1,15).setValues([[
        workbookId,
        buildSheetID_(sheetIndex+1),
        buildColumnID_(sheetIndex+1,colIndex+1),
        sheet.getName(),
        columnLetter_(colIndex+1),
        colIndex+1,
        safe_(header),
        normalized,
        duplicate,
        header==="" || header===null,
        isPrimaryKey_(normalized),
        isForeignKey_(normalized),
        detectType_(sample),
        safe_(sample),
        timestamp_()
      ]]);

      row++;

    });

  });

  autoResize_(schema);

  logMessage_("HEADERS","Schema inventory complete.");

}

/******************************************************************************
 * NORMALIZE HEADER
 ******************************************************************************/

function normalizeHeader_(header){

  return String(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g,"_")
    .replace(/[^a-z0-9_]/g,"");

}

/******************************************************************************
 * SHEET ID
 ******************************************************************************/

function buildSheetID_(number){

  return "SH-" + Utilities.formatString("%06d",number);

}

/******************************************************************************
 * COLUMN ID
 ******************************************************************************/

function buildColumnID_(sheet,column){

  return "COL-" +

    Utilities.formatString("%03d",sheet)

    + "-" +

    Utilities.formatString("%03d",column);

}

/******************************************************************************
 * COLUMN LETTER
 ******************************************************************************/

function columnLetter_(column){

  let letter="";

  while(column>0){

    let temp=(column-1)%26;

    letter=String.fromCharCode(temp+65)+letter;

    column=(column-temp-1)/26;

  }

  return letter;

}

/******************************************************************************
 * PRIMARY KEY DETECTION
 ******************************************************************************/

function isPrimaryKey_(header){

  const keys=[

    "id",

    "leadid",

    "agentid",

    "contactid",

    "listingid",

    "propertyid"

  ];

  return keys.indexOf(header)>=0;

}

/******************************************************************************
 * FOREIGN KEY DETECTION
 ******************************************************************************/

function isForeignKey_(header){

  return header.endsWith("_id");

}

/******************************************************************************
 * TYPE DETECTION
 ******************************************************************************/

function detectType_(value){

  if(value==="") return "EMPTY";

  if(value instanceof Date) return "DATE";

  if(typeof value==="number") return "NUMBER";

  if(typeof value==="boolean") return "BOOLEAN";

  if(String(value).indexOf("@")>-1) return "EMAIL";

  if(/^https?:\/\//i.test(String(value))) return "URL";

  return "TEXT";

}

/******************************************************************************
 * SELF TEST
 ******************************************************************************/

function M5_testHeaderScanner(){

  M5_scanHeaders();

  Logger.log("Header scan complete.");

  return true;

}