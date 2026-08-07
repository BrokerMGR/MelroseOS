const INTAKE_RULE_TRAINING = Object.freeze({

  VERSION: '1.0.0',

  MIN_APPROVED_EXAMPLES: 3,

  AUTO_PROMOTE_EXAMPLES: 10,

  MAX_CONFIDENCE: 100

});

function INTAKE_trainRule(rule, approvedExample) {

  if (!rule) {

    throw new Error(
      'Rule is required.'
    );

  }

  if (!approvedExample) {

    throw new Error(
      'Approved training example is required.'
    );

  }

  const examples =
    Number(
      rule.examples || 0
    ) + 1;

  const priorConfidence =
    Number(
      rule.confidence || 0
    );

  const confidenceIncrease =
    examples <= 3
      ? 15
      : examples <= 10
        ? 7
        : 2;

  rule.examples =
    examples;

  rule.confidence =
    Math.min(
      INTAKE_RULE_TRAINING.MAX_CONFIDENCE,
      priorConfidence +
      confidenceIncrease
    );

  rule.updatedAt =
    new Date().toISOString();

  return rule;

}

function INTAKE_ruleTrainingStatus(rule) {

  const examples =
    Number(
      rule.examples || 0
    );

  const confidence =
    Number(
      rule.confidence || 0
    );

  return {

    examples:
      examples,

    confidence:
      confidence,

    trained:
      examples >=
      INTAKE_RULE_TRAINING.MIN_APPROVED_EXAMPLES,

    autoPromotionEligible:
      examples >=
      INTAKE_RULE_TRAINING.AUTO_PROMOTE_EXAMPLES &&
      confidence >= 95,

    checkedAt:
      new Date().toISOString()

  };

}

function INTAKE_refreshRuleTraining(
  rule,
  approvedExamples
) {

  const examples =
    Array.isArray(
      approvedExamples
    )
      ? approvedExamples
      : [];

  let trainedRule =
    Object.assign(
      {},
      rule
    );

  examples.forEach(
    function(example) {

      trainedRule =
        INTAKE_trainRule(
          trainedRule,
          example
        );

    }
  );

  return {

    rule:
      trainedRule,

    status:
      INTAKE_ruleTrainingStatus(
        trainedRule
      ),

    refreshedAt:
      new Date().toISOString()

  };

}