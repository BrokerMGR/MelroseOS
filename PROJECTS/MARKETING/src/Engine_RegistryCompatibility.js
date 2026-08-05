/******************************************************************************
 * MelroseOS
 * File: Engine_RegistryCompatibility.js
 * Version: 1.0.1
 ******************************************************************************/

const MGR_REGISTRY_COMPATIBILITY_VERSION = "1.0.1";

function getMelroseRegistryComponent(componentCode) {
  const code = String(componentCode || "")
    .trim()
    .toUpperCase();

  if (!code) {
    return null;
  }

  const authorities = [
    "getMelroseComponent",
    "MOS5_getRegisteredComponent"
  ];

  for (let i = 0; i < authorities.length; i++) {
    const handler = globalThis[authorities[i]];

    if (typeof handler === "function") {
      return handler(code);
    }
  }

  if (
    typeof MELROSE_REGISTRY !== "undefined" &&
    MELROSE_REGISTRY &&
    Object.prototype.hasOwnProperty.call(
      MELROSE_REGISTRY,
      code
    )
  ) {
    return MELROSE_REGISTRY[code];
  }

  return null;
}

function MGR_runRegistryCompatibilityDiagnostics() {
  const result = {
    release: "MGR-REGISTRY-COMPATIBILITY",
    version: MGR_REGISTRY_COMPATIBILITY_VERSION,
    compatibilityFunctionAvailable:
      typeof getMelroseRegistryComponent === "function",
    productionChanged: false,
    completedAt: new Date().toISOString()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}