/******************************************************************************
 * MelroseOS Enterprise
 * Module 0 - Inventory & Diagnostics
 * File: INV-01_Core.gs
 * Version: 1.0.0
 *
 * Shared Core Library
 ******************************************************************************/

const M5 = {

  VERSION: "1.0.0",

  MODULE: "Inventory",

  BUILD: "INV-01",

  INVENTORY_SHEET: "SYSTEM_INVENTORY",

  SCHEMA_SHEET: "SCHEMA_INVENTORY",

  SCRIPT_SHEET: "SCRIPT_INVENTORY",

  DIAGNOSTIC_SHEET: "DIAGNOSTICS",

  REPORT_SHEET: "MIGRATION_REPORT",

  PROPERTY_PREFIX: "M5_"

};

/******************************************************************************
 * BOOTSTRAP
 ******************************************************************************/

function M5_initialize(){

  const ss = SpreadsheetApp.getActive();

  createSheetIfMissing_(ss,M5.INVENTORY_SHEET);
  createSheetIfMissing_(ss,M5.SCHEMA_SHEET);
  createSheetIfMissing_(ss,M5.SCRIPT_SHEET);
  createSheetIfMissing_(ss,M5.DIAGNOSTIC_SHEET);
  createSheetIfMissing_(ss,M5.REPORT_SHEET);

  PropertiesService.getDocumentProperties()
    .setProperty("M5_VERSION",M5.VERSION);

  logMessage_("SYSTEM","Initialization Complete");

}

/******************************************************************************
 * VERSION
 ******************************************************************************/

function M5_version(){

  return {
    version:M5.VERSION,
    module:M5.MODULE,
    build:M5.BUILD
  };

}

/******************************************************************************
 * SHEET HELPERS
 ******************************************************************************/

function createSheetIfMissing_(ss,name){

  let sh = ss.getSheetByName(name);

  if(!sh){

    sh = ss.insertSheet(name);

  }

  return sh;

}

function clearSheet_(sheet){

  sheet.clear();

  sheet.clearFormats();

}

function freezeHeader_(sheet){

  sheet.setFrozenRows(1);

}

function autoResize_(sheet){

  const cols = sheet.getLastColumn();

  if(cols>0){

    sheet.autoResizeColumns(1,cols);

  }

}

/******************************************************************************
 * HEADER WRITER
 ******************************************************************************/

function setHeaders_(sheet,headers){

  sheet.getRange(1,1,1,headers.length)
    .setValues([headers]);

  sheet.getRange(1,1,1,headers.length)
    .setFontWeight("bold")
    .setBackground("#1F4E78")
    .setFontColor("white");

  freezeHeader_(sheet);

}

/******************************************************************************
 * DATE HELPERS
 ******************************************************************************/

function now_(){

  return new Date();

}

function timestamp_(){

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

/******************************************************************************
 * UUID
 ******************************************************************************/

function uuid_(){

  return Utilities.getUuid();

}

/******************************************************************************
 * LOGGING
 ******************************************************************************/

function logMessage_(category,message){

  Logger.log(
    "[" + category + "] " + message
  );

}

function logError_(error){

  Logger.log(error);

}

/******************************************************************************
 * PROPERTY HELPERS
 ******************************************************************************/

function getDocProperty_(key){

  return PropertiesService
    .getDocumentProperties()
    .getProperty(key);

}

function setDocProperty_(key,value){

  PropertiesService
    .getDocumentProperties()
    .setProperty(key,value);

}

/******************************************************************************
 * SAFE VALUE
 ******************************************************************************/

function safe_(value){

  if(value===null) return "";

  if(value===undefined) return "";

  return value;

}

/******************************************************************************
 * WORKBOOK
 ******************************************************************************/

function workbook_(){

  return SpreadsheetApp.getActive();

}

/******************************************************************************
 * INVENTORY RESET
 ******************************************************************************/

function M5_resetInventory(){

  const ss = workbook_();

  [
    M5.INVENTORY_SHEET,
    M5.SCHEMA_SHEET,
    M5.SCRIPT_SHEET,
    M5.DIAGNOSTIC_SHEET,
    M5.REPORT_SHEET

  ].forEach(function(name){

    const sh = ss.getSheetByName(name);

    if(sh){

      sh.clear();

    }

  });

  logMessage_("SYSTEM","Inventory Reset");

}

/******************************************************************************
 * SELF TEST
 ******************************************************************************/

function M5_testCore(){

  M5_initialize();

  Logger.log(M5_version());

  return true;

}