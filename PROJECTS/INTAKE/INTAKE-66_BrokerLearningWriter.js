const INTAKE_BROKER_LEARNING = Object.freeze({

  VERSION: '1.0.0',

  REQUIRE_BROKER_APPROVAL: true,

  CREATE_RULE_FROM_APPROVED_REVIEW: true,

  KEEP_SOURCE_EXAMPLE: true

});

function INTAKE_buildLearningRule(review) {

  if (!review) {

    throw new Error(
      'Broker review is required.'
    );

  }

  return {

    ruleId:
      Utilities.getUuid(),

    version:
      1,

    source:
      review.source || 'UNKNOWN',

    leadType:
      review.leadType || 'UNKNOWN',

    brokerOnly:
      review.brokerOnly === true,

    assignmentMode:
      review.assignmentMode ||
      'BROKER_REVIEW',

    senderPattern:
      review.senderPattern || '',

    subjectPattern:
      review.subjectPattern || '',

    bodySignature:
      review.bodySignature || '',

    active:
      true,

    brokerApproved:
      true,

    examples:
      1,

    createdFromReview:
      review.reviewId || '',

    createdAt:
      new Date().toISOString()

  };

}

function INTAKE_applyBrokerLearning(review) {

  if (
    review.status !== 'APPROVED'
  ) {

    throw new Error(
      'Broker review must be APPROVED before learning.'
    );

  }

  const rule =
    INTAKE_buildLearningRule(
      review
    );

  return {

    success:
      true,

    rule:
      rule,

    refreshRequired:
      true,

    learnedAt:
      new Date().toISOString()

  };

}

function INTAKE_shouldRefreshKnowledge(result) {

  return !!(
    result &&
    result.refreshRequired === true
  );

}