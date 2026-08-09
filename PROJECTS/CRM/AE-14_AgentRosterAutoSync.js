/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine
 * File: AE-14_AgentRosterAutoSync.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Keeps AE_AGENTS synchronized with the independent production Agent Roster.
 *
 * Source:
 *   Spreadsheet ID: 1XeMYTkNhEnvT1IrzYmnUA0pNYh7UcsrVWjH4YlDMo2s
 *   Sheet: Agents
 *
 * Behavior:
 *   - Installable onEdit trigger runs when the source Agents tab is edited.
 *   - A timed fallback sync runs hourly to catch script/API/import changes,
 *     which do not always fire spreadsheet edit triggers.
 *   - Syncs production roster fields into AE_AGENTS.
 *   - Syncs each agent's linked LeadsSheetId.
 *   - Preserves the current MelroseOS LIVE/SHADOW state.
 *
 * Requires:
 *   AE-01 through AE-13
 ******************************************************************************/

const AE_ROSTER_AUTOSYNC = {
  SOURCE_SPREADSHEET_ID: "1XeMYTkNhEnvT1IrzYmnUA0pNYh7UcsrVWjH4YlDMo2s",
  SOURCE_SHEET_NAME: "Agents",
  EDIT_HANDLER: "AE_onSourceAgentRosterEdit",
  FALLBACK_HANDLER: "AE_runAgentRosterFallbackSync",
  LAST_SYNC_PROPERTY: "AE_ROSTER_AUTOSYNC_LAST_SYNC",
  LAST_ERROR_PROPERTY: "AE_ROSTER_AUTOSYNC_LAST_ERROR"
};

function AE_installAgentRosterAutoSync() {
  AE_initializeAgentRosterSync();
  AE_initializeAgentLeadDistributionBridge();

  AE_removeAgentRosterAutoSyncTriggers_();

  ScriptApp
    .newTrigger(AE_ROSTER_AUTOSYNC.EDIT_HANDLER)
    .forSpreadsheet(AE_ROSTER_AUTOSYNC.SOURCE_SPREADSHEET_ID)
    .onEdit()
    .create();

  ScriptApp
    .newTrigger(AE_ROSTER_AUTOSYNC.FALLBACK_HANDLER)
    .timeBased()
    .everyHours(1)
    .create();

  const initialSync = AE_runFullAgentRosterSync_();

  return {
    success: true,
    editTriggers: AE_countTriggersForHandler_(AE_ROSTER_AUTOSYNC.EDIT_HANDLER),
    fallbackTriggers: AE_countTriggersForHandler_(AE_ROSTER_AUTOSYNC.FALLBACK_HANDLER),
    initialSync: initialSync
  };
}

function AE_onSourceAgentRosterEdit(e) {
  try {
    if (!e || !e.range) {
      return;
    }

    const sheet = e.range.getSheet();

    if (
      sheet.getParent().getId() !==
      AE_ROSTER_AUTOSYNC.SOURCE_SPREADSHEET_ID
    ) {
      return;
    }

    if (
      sheet.getName() !==
      AE_ROSTER_AUTOSYNC.SOURCE_SHEET_NAME
    ) {
      return;
    }

    // Ignore header-only edits.
    if (e.range.getLastRow() < 2) {
      return;
    }

    AE_runFullAgentRosterSync_();

  } catch (error) {
    setDocProperty_(
      AE_ROSTER_AUTOSYNC.LAST_ERROR_PROPERTY,
      error.message || String(error)
    );

    throw error;
  }
}

function AE_runAgentRosterFallbackSync() {
  return AE_runFullAgentRosterSync_();
}

function AE_runFullAgentRosterSync_() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    return {
      success: false,
      skipped: true,
      reason: "Agent roster sync is already running."
    };
  }

  try {
    const roster = AE_syncProductionAgentRoster();
    const sheetIds = AE_syncAgentLeadSheetIds();

    setDocProperty_(
      AE_ROSTER_AUTOSYNC.LAST_SYNC_PROPERTY,
      new Date().toISOString()
    );

    setDocProperty_(
      AE_ROSTER_AUTOSYNC.LAST_ERROR_PROPERTY,
      ""
    );

    return {
      success: roster.success !== false && sheetIds.success !== false,
      roster: roster,
      leadSheetIds: sheetIds
    };

  } catch (error) {
    setDocProperty_(
      AE_ROSTER_AUTOSYNC.LAST_ERROR_PROPERTY,
      error.message || String(error)
    );

    throw error;

  } finally {
    lock.releaseLock();
  }
}

function AE_removeAgentRosterAutoSyncTriggers_() {
  const handlers = [
    AE_ROSTER_AUTOSYNC.EDIT_HANDLER,
    AE_ROSTER_AUTOSYNC.FALLBACK_HANDLER
  ];

  ScriptApp
    .getProjectTriggers()
    .forEach(function(trigger) {
      if (
        handlers.indexOf(
          trigger.getHandlerFunction()
        ) !== -1
      ) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
}

function AE_removeAgentRosterAutoSync() {
  AE_removeAgentRosterAutoSyncTriggers_();

  return {
    success: true,
    editTriggers: AE_countTriggersForHandler_(AE_ROSTER_AUTOSYNC.EDIT_HANDLER),
    fallbackTriggers: AE_countTriggersForHandler_(AE_ROSTER_AUTOSYNC.FALLBACK_HANDLER)
  };
}

function AE_countTriggersForHandler_(handler) {
  return ScriptApp
    .getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === handler;
    }).length;
}

function AE_getAgentRosterAutoSyncStatus() {
  return {
    editTriggers:
      AE_countTriggersForHandler_(
        AE_ROSTER_AUTOSYNC.EDIT_HANDLER
      ),

    fallbackTriggers:
      AE_countTriggersForHandler_(
        AE_ROSTER_AUTOSYNC.FALLBACK_HANDLER
      ),

    lastSync:
      getDocProperty_(
        AE_ROSTER_AUTOSYNC.LAST_SYNC_PROPERTY
      ) || "",

    lastError:
      getDocProperty_(
        AE_ROSTER_AUTOSYNC.LAST_ERROR_PROPERTY
      ) || ""
  };
}

function AE_testAgentRosterAutoSync() {
  const result = AE_runFullAgentRosterSync_();

  Logger.log(
    JSON.stringify(result)
  );

  Logger.log(
    JSON.stringify(
      AE_getAgentRosterAutoSyncStatus()
    )
  );

  return true;
}
