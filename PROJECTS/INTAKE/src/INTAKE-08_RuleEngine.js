const INTAKE_RULE_ENGINE = Object.freeze({

  VERSION: '1.0.0',

  AUTO_APPROVAL_THRESHOLD: 95,

  BROKER_REVIEW_THRESHOLD: 75,

  MIN_CONFIDENCE: 0

});

function INTAKE_getRuleEngine() {

  return JSON.parse(

    JSON.stringify(INTAKE_RULE_ENGINE)

  );

}

function INTAKE_requiresBrokerReview(confidence) {

  return confidence <

    INTAKE_RULE_ENGINE.BROKER_REVIEW_THRESHOLD;

}

function INTAKE_canAutoApprove(confidence) {

  return confidence >=

    INTAKE_RULE_ENGINE.AUTO_APPROVAL_THRESHOLD;

}

function INTAKE_getConfidenceStatus(confidence) {

  if (INTAKE_canAutoApprove(confidence)) {

    return 'AUTO_APPROVED';

  }

  if (INTAKE_requiresBrokerReview(confidence)) {

    return 'BROKER_REVIEW';

  }

  return 'MANUAL_CONFIRMATION';

}