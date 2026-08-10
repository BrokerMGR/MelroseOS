/**
 * MelroseOS CRM
 * File: CRM-128_RecruitRosterProductionLock.gs
 * Version: 1.0.0
 *
 * Hard-locks the authoritative New Agent Master roster.
 */

const MGR_RECRUIT_MASTER_SOURCE = Object.freeze({
  SPREADSHEET_ID:
    '1JK4xYqsic18U_VQ6LrZU_Qg09yDiWkmRpAFdHTMrBIQ',
  SHEET_NAME:
    'Prospects'
});

function RUN_LOCK_RECRUIT_ROSTER_SOURCE() {
  if (
    typeof MGR_RECRUIT_lockRosterSource !==
    'function'
  ) {
    throw new Error(
      'CRM-127 roster source lock function is unavailable.'
    );
  }

  const result =
    MGR_RECRUIT_lockRosterSource(
      MGR_RECRUIT_MASTER_SOURCE.SPREADSHEET_ID,
      MGR_RECRUIT_MASTER_SOURCE.SHEET_NAME
    );

  console.log(
    'RUN_LOCK_RECRUIT_ROSTER_SOURCE\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

function RUN_RECRUIT_ROSTER_MASTER_CERTIFICATION() {
  const source =
    RUN_RECRUIT_ROSTER_SOURCE_CERTIFICATION();

  const expectedId =
    MGR_RECRUIT_MASTER_SOURCE.SPREADSHEET_ID;

  const expectedSheet =
    MGR_RECRUIT_MASTER_SOURCE.SHEET_NAME;

  const result = {
    success:
      source.success === true &&
      String(source.spreadsheetId || '') ===
        expectedId &&
      String(source.sheetName || '') ===
        expectedSheet,

    expectedSpreadsheetId:
      expectedId,

    actualSpreadsheetId:
      String(source.spreadsheetId || ''),

    expectedSheetName:
      expectedSheet,

    actualSheetName:
      String(source.sheetName || ''),

    spreadsheetName:
      String(source.spreadsheetName || ''),

    rowCount:
      Number(source.rowCount || 0),

    validation:
      source.validation || null,

    error:
      String(source.error || ''),

    timestamp:
      new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_ROSTER_MASTER_CERTIFICATION\n' +
    JSON.stringify(result, null, 2)
  );

  if (result.success) {
    console.log(
      'RECRUIT ROSTER CERTIFICATION: PASS - authoritative Prospects roster is locked.'
    );
  } else {
    console.error(
      'RECRUIT ROSTER CERTIFICATION: FAIL - source lock does not match authoritative master.'
    );
  }

  return result;
}
