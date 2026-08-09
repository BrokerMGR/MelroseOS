const INTAKE_MODULES = Object.freeze([

  'INTAKE-00_Core',
  'INTAKE-01_Settings',
  'INTAKE-02_Registry',
  'INTAKE-03_Installer',
  'INTAKE-04_Diagnostics',
  'INTAKE-05_Schema',
  'INTAKE-06_Constants',
  'INTAKE-07_SourceRegistry',
  'INTAKE-08_RuleEngine',
  'INTAKE-09_SafetyGate',
  'INTAKE-10_BrokerRules',
  'INTAKE-11_ModuleRegistry'

]);

function INTAKE_getModules() {

  return INTAKE_MODULES.slice();

}

function INTAKE_moduleExists(name) {

  return INTAKE_MODULES.indexOf(name) >= 0;

}

function INTAKE_moduleCount() {

  return INTAKE_MODULES.length;

}