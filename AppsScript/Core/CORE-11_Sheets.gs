/**
 * MelroseOS Enterprise Core
 * File: CORE-11_Sheets.gs
 * Release: MOS5-CORE-11
 * Version: 1.0.0
 * Purpose: Safe workbook/sheet access and tabular data helpers.
 */

function MGR_openWorkbook(keyOrId) {
  MGR_require(keyOrId, 'Workbook key or ID');
  let id = String(keyOrId).trim();

  if (typeof MGR_getWorkbookId === 'function') {
    try { id = MGR_getWorkbookId(id); } catch (err) {}
  }

  return SpreadsheetApp.openById(id);
}

function MGR_getSheet(workbookKeyOrId, sheetName, createIfMissing) {
  MGR_require(sheetName, 'Sheet name');
  const ss = MGR_openWorkbook(workbookKeyOrId);
  let sheet = ss.getSheetByName(String(sheetName));

  if (!sheet && createIfMissing === true) {
    sheet = ss.insertSheet(String(sheetName));
  }

  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  return sheet;
}

function MGR_ensureSheet(workbookKeyOrId, sheetName, headers) {
  const sheet = MGR_getSheet(workbookKeyOrId, sheetName, true);

  if (Array.isArray(headers) && headers.length) {
    const currentLastColumn = sheet.getLastColumn();

    if (sheet.getLastRow() === 0 || currentLastColumn === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else {
      const existing = sheet.getRange(1, 1, 1, Math.max(headers.length, currentLastColumn))
        .getValues()[0];

      headers.forEach(function(header, index) {
        if (String(existing[index] || '').trim() === '') {
          sheet.getRange(1, index + 1).setValue(header);
        }
      });
    }
  }

  return sheet;
}

function MGR_getHeaders(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(value) { return String(value || '').trim(); });
}

function MGR_headersToMap(headers) {
  return (headers || []).reduce(function(map, header, index) {
    if (header) map[String(header)] = index + 1;
    return map;
  }, {});
}

function MGR_appendObjectRow(sheet, object, headers) {
  MGR_assertObject(object, 'Row object');
  const actualHeaders = headers || MGR_getHeaders(sheet);

  if (!actualHeaders.length) throw new Error('Sheet has no headers.');

  const row = actualHeaders.map(function(header) {
    return Object.prototype.hasOwnProperty.call(object, header)
      ? object[header]
      : '';
  });

  sheet.appendRow(row);
  return sheet.getLastRow();
}

function MGR_readSheetObjects(sheet, options) {
  options = options || {};
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) return [];

  const headers = MGR_getHeaders(sheet);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  return values.map(function(row, index) {
    const object = { _row: index + 2 };

    headers.forEach(function(header, column) {
      if (header) object[header] = row[column];
    });

    return object;
  }).filter(function(object) {
    if (options.includeBlankRows === true) return true;
    return headers.some(function(header) {
      return header && String(object[header] || '').trim() !== '';
    });
  });
}

function MGR_findRowByValue(sheet, header, value) {
  const headers = MGR_getHeaders(sheet);
  const map = MGR_headersToMap(headers);
  const column = map[header];

  if (!column) throw new Error('Header not found: ' + header);
  if (sheet.getLastRow() < 2) return 0;

  const finder = sheet.getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true);

  const match = finder.findNext();
  return match ? match.getRow() : 0;
}

function MGR_updateObjectRow(sheet, rowNumber, updates) {
  MGR_assertObject(updates, 'Updates');
  if (Number(rowNumber) < 2) throw new Error('Data row must be 2 or greater.');

  const headers = MGR_getHeaders(sheet);
  const map = MGR_headersToMap(headers);

  Object.keys(updates).forEach(function(header) {
    if (!map[header]) throw new Error('Header not found: ' + header);
    sheet.getRange(Number(rowNumber), map[header]).setValue(updates[header]);
  });

  return true;
}
