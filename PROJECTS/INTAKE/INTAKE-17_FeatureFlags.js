const INTAKE_FEATURE_FLAGS = Object.freeze({

  ENABLE_BACKFILL: true,

  ENABLE_LIVE_MONITORING: false,

  ENABLE_BROKER_LEARNING: true,

  ENABLE_AUTO_CLASSIFICATION: false,

  ENABLE_DUPLICATE_DETECTION: true,

  ENABLE_ASSIGNMENT_PREVIEW: true,

  ENABLE_CRM_PUSH: false,

  ENABLE_AGENT_NOTIFICATIONS: false,

  ENABLE_EMAIL_SEND: false,

  ENABLE_API_POSTS: false,

  ENABLE_WEBHOOKS: false,

  ENABLE_AI_ASSIST: false

});

function INTAKE_getFeatureFlags() {

  return JSON.parse(

    JSON.stringify(INTAKE_FEATURE_FLAGS)

  );

}

function INTAKE_featureEnabled(flag) {

  return INTAKE_FEATURE_FLAGS[flag] === true;

}