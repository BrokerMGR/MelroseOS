/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine Migration
 * File: AE-10_Installer.gs
 * Version: 1.0.0
 *
 * Requires: AE-01 through AE-09
 ******************************************************************************/

const AE_INSTALL_STATUS_SHEET="AE_INSTALL_STATUS";

function AE_installAssignmentEngine(){
  AE_initializeCore();
  AE_initializeConfig();

  const ss=workbook_();
  const sheet=createSheetIfMissing_(ss,AE_INSTALL_STATUS_SHEET);
  clearSheet_(sheet);

  const headers=["Check","Status","Details","UpdatedAt"];
  setHeaders_(sheet,headers);

  const checks=AE_runInstallChecks_();
  const rows=checks.map(function(c){
    return [c.name,c.status,c.details,timestamp_()];
  });

  if(rows.length){
    sheet.getRange(2,1,rows.length,headers.length).setValues(rows);
  }

  sheet.setFrozenRows(1);
  autoResize_(sheet);

  const failed=checks.filter(function(c){return c.status==="FAILED";});

  setDocProperty_("AE_INSTALLED",failed.length?"FALSE":"TRUE");
  setDocProperty_("AE_INSTALL_DATE",new Date().toISOString());
  setDocProperty_("AE_INSTALL_FAILURES",String(failed.length));

  AE_log_(
    failed.length?"INSTALL_FAILED":"INSTALL_COMPLETE",
    failed.length
      ? failed.length+" installation check(s) failed."
      : "Assignment Engine installation checks passed."
  );

  return {
    success:failed.length===0,
    checks:checks.length,
    failed:failed.length,
    mode:AE_getMode()
  };
}

function AE_runInstallChecks_(){
  const checks=[];
  const functions=[
    ["AE_initializeCore","AE-01 Core"],
    ["AE_initializeConfig","AE-02 Config"],
    ["AE_upsertAgent","AE-03 Agent Registry"],
    ["AE_findLeadLock","AE-04 Lead Lock"],
    ["AE_evaluateEligibility","AE-05 Eligibility Engine"],
    ["AE_selectAgentForLead","AE-06 Round Robin Engine"],
    ["AE_assignLead","AE-07 Assignment Engine"],
    ["AE_runShadowMigration","AE-08 Shadow Migration"],
    ["AE_validateLiveMigration","AE-09 Live Migration"]
  ];

  functions.forEach(function(item){
    const exists=AE_installerFunctionExists_(item[0]);
    checks.push({
      name:item[1],
      status:exists?"PASSED":"FAILED",
      details:exists?item[0]+" is available.":item[0]+" is missing."
    });
  });

  const ss=workbook_();

  Object.keys(AE.SHEETS).forEach(function(key){
    const name=AE.SHEETS[key];
    const exists=!!ss.getSheetByName(name);
    checks.push({
      name:"Sheet: "+name,
      status:exists?"PASSED":"FAILED",
      details:exists?"Required sheet exists.":"Required sheet is missing."
    });
  });

  const mode=AE_getMode();
  checks.push({
    name:"Safe Initial Mode",
    status:mode==="SHADOW"?"PASSED":"WARNING",
    details:"Current engine mode is "+mode+"."
  });

  return checks;
}

function AE_installerFunctionExists_(name){
  try{return typeof this[name]==="function";}
  catch(e){return false;}
}

function AE_runAssignmentEngineSetup(){
  const install=AE_installAssignmentEngine();

  if(!install.success){
    throw new Error(
      "Assignment Engine installation failed. Review AE_INSTALL_STATUS."
    );
  }

  AE_setShadowMode();

  const result={
    success:true,
    mode:AE_getMode(),
    install:install,
    core:AE_getCoreStatus(),
    config:AE_getConfigSummary(),
    assignments:AE_getAssignmentSummary(),
    shadow:AE_getShadowMigrationStatus(),
    live:AE_getLiveMigrationStatus()
  };

  setDocProperty_("AE_SETUP_COMPLETE","TRUE");
  setDocProperty_("AE_SETUP_COMPLETED_AT",new Date().toISOString());

  AE_log_(
    "SETUP_COMPLETE",
    "Assignment Engine setup completed in SHADOW mode."
  );

  return result;
}

function AE_getInstallStatus(){
  return {
    installed:getDocProperty_("AE_INSTALLED")||"FALSE",
    installedAt:getDocProperty_("AE_INSTALL_DATE")||"",
    failures:Number(getDocProperty_("AE_INSTALL_FAILURES")||0),
    setupComplete:getDocProperty_("AE_SETUP_COMPLETE")||"FALSE",
    setupCompletedAt:getDocProperty_("AE_SETUP_COMPLETED_AT")||"",
    mode:AE_getMode()
  };
}

function AE_testInstaller(){
  const result=AE_installAssignmentEngine();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(AE_getInstallStatus()));

  if(!result.success){
    throw new Error(
      "Assignment Engine installer failed. Review AE_INSTALL_STATUS."
    );
  }

  return true;
}
