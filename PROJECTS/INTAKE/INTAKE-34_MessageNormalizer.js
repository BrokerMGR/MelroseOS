const INTAKE_NORMALIZER = Object.freeze({

  VERSION: '1.0.0',

  REQUIRED_FIELDS: [

    'source',

    'subject',

    'from',

    'receivedAt'

  ]

});

function INTAKE_normalizeMessage(message) {

  return {

    source: message.source || 'UNKNOWN',

    subject: message.subject || '',

    from: message.from || '',

    email: message.email || '',

    phone: message.phone || '',

    body: message.body || '',

    receivedAt: message.receivedAt || '',

    normalizedAt: new Date().toISOString(),

    normalized: true

  };

}

function INTAKE_isNormalized(message) {

  return message && message.normalized === true;

}