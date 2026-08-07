const INTAKE_FORMAT_LEARNING = Object.freeze({

  VERSION: '1.0.0',

  MIN_EXAMPLES: 3,

  AUTO_PROMOTE_THRESHOLD: 25,

  REQUIRE_BROKER_APPROVAL: true

});

function INTAKE_buildLearningCandidate(parsedMessage) {

  return {

    id: Utilities.getUuid(),

    source: parsedMessage.classification.source,

    fingerprint: parsedMessage.fingerprint,

    confidence: parsedMessage.classification.confidence,

    examples: 1,

    approved: false,

    createdAt: new Date().toISOString()

  };

}

function INTAKE_recordLearningExample(candidate) {

  candidate.examples++;

  return candidate;

}

function INTAKE_readyForPromotion(candidate) {

  return (

    candidate.examples >=

    INTAKE_FORMAT_LEARNING.AUTO_PROMOTE_THRESHOLD

  );

}