const INTAKE_PARSER = Object.freeze({

  VERSION: '1.0.0',

  REQUIRED_FIELDS: [

    'subject',

    'from',

    'body'

  ]

});

function INTAKE_parseMessage(message) {

  const normalized = INTAKE_normalizeMessage(message);

  const classification = INTAKE_classifyMessage(normalized);

  const fingerprint = INTAKE_createFingerprint(normalized);

  return {

    success: true,

    normalized,

    classification,

    fingerprint,

    parsedAt: new Date().toISOString()

  };

}

function INTAKE_validateParsedMessage(parsed) {

  return {

    valid:

      !!parsed.normalized &&

      !!parsed.classification &&

      !!parsed.fingerprint

  };

}