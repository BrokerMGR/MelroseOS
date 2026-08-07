const INTAKE_KNOWLEDGE = Object.freeze({

  VERSION: '1.0.0',

  ENABLED: true,

  AUTO_LEARNING: false,

  BROKER_APPROVAL_REQUIRED: true,

  MINIMUM_EXAMPLES: 5,

  RULE_VERSIONING: true

});

function INTAKE_getKnowledgeSettings() {

  return JSON.parse(
    JSON.stringify(INTAKE_KNOWLEDGE)
  );

}

function INTAKE_isLearningEnabled() {

  return INTAKE_KNOWLEDGE.ENABLED;

}

function INTAKE_requiresBrokerApprovalForLearning() {

  return INTAKE_KNOWLEDGE.BROKER_APPROVAL_REQUIRED;

}

function INTAKE_canAutoLearn() {

  return INTAKE_KNOWLEDGE.AUTO_LEARNING;

}