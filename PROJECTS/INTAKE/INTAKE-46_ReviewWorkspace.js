const INTAKE_REVIEW = Object.freeze({

  VERSION: '1.0.0',

  STATUSES: [
    'NEW',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'IGNORED'
  ]

});

function INTAKE_createReviewItem(parsedMessage) {

  return {

    reviewId: Utilities.getUuid(),

    status: 'NEW',

    source:
      parsedMessage.classification.source,

    confidence:
      parsedMessage.classification.confidence,

    brokerOnly:
      parsedMessage.classification.brokerOnly,

    message:
      parsedMessage.normalized,

    createdAt:
      new Date().toISOString()

  };

}

function INTAKE_updateReviewStatus(
  review,
  status
) {

  if (
    !INTAKE_REVIEW.STATUSES.includes(status)
  ) {

    throw new Error(
      'Invalid review status: ' + status
    );

  }

  review.status = status;

  review.updatedAt =
    new Date().toISOString();

  return review;

}