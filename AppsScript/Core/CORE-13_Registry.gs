/**
 * MelroseOS Enterprise Core
 * File: CORE-13_Registry.gs
 * Release: MOS5-CORE-13
 * Version: 1.0.0
 * Purpose: Runtime module/service registry and dependency visibility.
 */

const MGR_MODULE_REGISTRY = Object.freeze({
  CORE_00: Object.freeze({ file: 'CORE-00_Bootstrap.gs', version: '1.0.0', required: true }),
  CORE_01: Object.freeze({ file: 'CORE-01_Config.gs', version: '1.0.0', required: true }),
  CORE_02: Object.freeze({ file: 'CORE-02_Constants.gs', version: '1.0.0', required: true }),
  CORE_03: Object.freeze({ file: 'CORE-03_Utilities.gs', version: '1.0.0', required: true }),
  CORE_04: Object.freeze({ file: 'CORE-04_Logging.gs', version: '1.0.0', required: true }),
  CORE_05: Object.freeze({ file: 'CORE-05_Properties.gs', version: '1.0.0', required: true }),
  CORE_06: Object.freeze({ file: 'CORE-06_Validation.gs', version: '1.0.0', required: true }),
  CORE_07: Object.freeze({ file: 'CORE-07_Audit.gs', version: '1.0.0', required: true }),
  CORE_08: Object.freeze({ file: 'CORE-08_Locking.gs', version: '1.0.0', required: true }),
  CORE_09: Object.freeze({ file: 'CORE-09_IDs.gs', version: '1.0.0', required: true }),
  CORE_10: Object.freeze({ file: 'CORE-10_DateTime.gs', version: '1.0.0', required: true }),
  CORE_11: Object.freeze({ file: 'CORE-11_Sheets.gs', version: '1.0.0', required: true }),
  CORE_12: Object.freeze({ file: 'CORE-12_Schema.gs', version: '1.0.0', required: true }),
  CORE_13: Object.freeze({ file: 'CORE-13_Registry.gs', version: '1.0.0', required: true }),
  CORE_14: Object.freeze({ file: 'CORE-14_Diagnostics.gs', version: '1.0.0', required: true })
});

function MGR_getModuleRegistry() {
  return JSON.parse(JSON.stringify(MGR_MODULE_REGISTRY));
}

function MGR_getModuleInfo(key) {
  const normalized = MGR_normalizeKey(key);

  if (!Object.prototype.hasOwnProperty.call(MGR_MODULE_REGISTRY, normalized)) {
    throw new Error('Unknown MelroseOS module: ' + key);
  }

  return JSON.parse(JSON.stringify(MGR_MODULE_REGISTRY[normalized]));
}

function MGR_listRequiredModules() {
  return Object.keys(MGR_MODULE_REGISTRY)
    .filter(function(key) { return MGR_MODULE_REGISTRY[key].required === true; })
    .map(function(key) {
      return MGR_mergeObjects({ key: key }, MGR_MODULE_REGISTRY[key]);
    });
}

function MGR_registryDiagnostics() {
  const required = MGR_listRequiredModules();

  return {
    success: required.length === 15,
    moduleCount: Object.keys(MGR_MODULE_REGISTRY).length,
    requiredCount: required.length,
    modules: required,
    timestamp: MGR_nowIso()
  };
}
