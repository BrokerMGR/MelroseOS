
/******************************************************************************
 * MelroseOS Master Upgrade Health Check
 ******************************************************************************/

function MGR_masterUpgradeSystemCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    success:true,
    spreadsheet:ss.getName(),
    sheets:{
      AE_AGENTS:!!ss.getSheetByName("AE_AGENTS"),
      AE_LEADS:!!ss.getSheetByName("AE_LEADS"),
      SYS_RESOURCE_PERMISSIONS:!!ss.getSheetByName("SYS_RESOURCE_PERMISSIONS"),
      SYS_NOTIFICATION_RULES:!!ss.getSheetByName("SYS_NOTIFICATION_RULES"),
      SYS_NOTIFICATION_LOG:!!ss.getSheetByName("SYS_NOTIFICATION_LOG"),
      SYS_EMAIL_WORKERS:!!ss.getSheetByName("SYS_EMAIL_WORKERS")
    },
    functions:{
      MGR_installAffiliationFields:typeof MGR_installAffiliationFields==="function",
      MGR_capacityMonitor:typeof MGR_capacityMonitor==="function",
      MGR_installPermissionRegistry:typeof MGR_installPermissionRegistry==="function",
      MGR_previewPermissionChanges:typeof MGR_previewPermissionChanges==="function",
      MGR_syncSystemPermissions:typeof MGR_syncSystemPermissions==="function",
      NG_installNotificationGovernor:typeof NG_installNotificationGovernor==="function",
      NG_notify:typeof NG_notify==="function",
      MGR_installEmailWorkerRegistry:typeof MGR_installEmailWorkerRegistry==="function"
    }
  };

  result.success =
    result.sheets.AE_AGENTS &&
    result.sheets.AE_LEADS &&
    Object.keys(result.functions).every(function(k){ return result.functions[k] === true; });

  Logger.log(JSON.stringify(result,null,2));
  return result;
}
