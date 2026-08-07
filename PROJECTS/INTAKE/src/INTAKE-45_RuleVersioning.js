const INTAKE_RULE_VERSIONING = Object.freeze({

  VERSION: '1.0.0',

  ENABLED: true,

  KEEP_HISTORY: true,

  REQUIRE_BROKER_APPROVAL: true

});

function INTAKE_createRuleVersion(rule, changes) {

  return {

    ruleId: rule.ruleId || Utilities.getUuid(),

    version: (rule.version || 0) + 1,

    previousVersion: rule.version || 0,

    createdAt: new Date().toISOString(),

    approved: false,

    changes: changes || {}

  };

}

function INTAKE_archiveRule(rule) {

  rule.archived = true;

  rule.archivedAt = new Date().toISOString();

  return rule;

}

function INTAKE_activateRule(rule) {

  rule.active = true;

  rule.activatedAt = new Date().toISOString();

  return rule;

}