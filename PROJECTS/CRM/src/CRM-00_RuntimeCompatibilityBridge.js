/******************************************************************************
 * MelroseOS
 * File: CRM-00_RuntimeCompatibilityBridge.js
 * Version: 1.0.1
 ******************************************************************************/

const CRM_RUNTIME_COMPATIBILITY_VERSION = "1.0.1";

function startM5LeadAutomation() {
  const authorities = [
    "OP_installManagedTriggers",
    "LI_installTriggers",
    "installM5LeadAutomation"
  ];

  for (let i = 0; i < authorities.length; i++) {
    const functionName = authorities[i];
    const handler = globalThis[functionName];

    if (typeof handler === "function") {
      return handler();
    }
  }

  return {
    success: false,
    status: "NO_AUTOMATION_AUTHORITY",
    message:
      "No approved MelroseOS lead automation installer is available.",
    productionChanged: false,
    completedAt: new Date().toISOString()
  };
}

function CRM_runRuntimeCompatibilityDiagnostics() {
  const authorities = [
    "OP_installManagedTriggers",
    "LI_installTriggers",
    "installM5LeadAutomation"
  ];

  const availableAuthorities = authorities.filter(
    function(functionName) {
      return typeof globalThis[functionName] === "function";
    }
  );

  const result = {
    release: "CRM-00-RUNTIME-COMPATIBILITY",
    version: CRM_RUNTIME_COMPATIBILITY_VERSION,
    automationAuthorities: availableAuthorities,
    productionChanged: false,
    completedAt: new Date().toISOString()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}