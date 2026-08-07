const INTAKE_KNOWLEDGE_ENGINE = Object.freeze({

  VERSION: '1.0.0',

  MIN_MATCH_SCORE: 85,

  AUTO_APPLY_SCORE: 98,

  REQUIRE_BROKER_APPROVAL: true

});

function INTAKE_scoreKnowledgeMatch(signature, rules) {

  return {

    matched: false,

    score: 0,

    ruleId: null,

    ruleVersion: null

  };

}

function INTAKE_shouldLearn(score) {

  return score < INTAKE_KNOWLEDGE_ENGINE.MIN_MATCH_SCORE;

}

function INTAKE_shouldAutoApply(score) {

  return score >= INTAKE_KNOWLEDGE_ENGINE.AUTO_APPLY_SCORE;

}

function INTAKE_buildKnowledgeResult(score) {

  return {

    score: score,

    learn: INTAKE_shouldLearn(score),

    autoApply: INTAKE_shouldAutoApply(score),

    brokerApproval:

      INTAKE_KNOWLEDGE_ENGINE.REQUIRE_BROKER_APPROVAL

  };

}