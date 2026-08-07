const INTAKE_EMAIL_PARSER = Object.freeze({

  VERSION: '1.0.0',

  NORMALIZE_WHITESPACE: true,

  STRIP_HTML: true,

  MAX_BODY_LENGTH: 100000

});

function INTAKE_parseEmail(rawMessage) {

  const normalized = INTAKE_normalizeMessage(rawMessage);

  const classification = INTAKE_classifyMessage(normalized);

  const fingerprint = INTAKE_createFingerprint(normalized);

  return {

    normalized: normalized,

    classification: classification,

    fingerprint: fingerprint,

    parsedAt: new Date().toISOString()

  };

}

function INTAKE_previewParser(rawMessage) {

  return {

    success: true,

    result: INTAKE_parseEmail(rawMessage)

  };

}

function INTAKE_validateParser() {

  return {

    version: INTAKE_EMAIL_PARSER.VERSION,

    ready: true,

    timestamp: new Date().toISOString()

  };

}