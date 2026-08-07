const INTAKE_BROKER_QUEUE = Object.freeze({

  STATUS: {

    NEW: 'NEW',

    REVIEWING: 'REVIEWING',

    APPROVED: 'APPROVED',

    REJECTED: 'REJECTED'

  }

});

function INTAKE_createBrokerReview(message, classification) {

  return {

    id: Utilities.getUuid(),

    status: INTAKE_BROKER_QUEUE.STATUS.NEW,

    source: classification.source,

    confidence: classification.confidence,

    brokerOnly: classification.brokerOnly,

    reviewRequired: true,

    created: new Date().toISOString(),

    message: message

  };

}

function INTAKE_approveBrokerReview(review) {

  review.status = INTAKE_BROKER_QUEUE.STATUS.APPROVED;

  review.approvedAt = new Date().toISOString();

  return review;

}

function INTAKE_rejectBrokerReview(review) {

  review.status = INTAKE_BROKER_QUEUE.STATUS.REJECTED;

  review.rejectedAt = new Date().toISOString();

  return review;

}