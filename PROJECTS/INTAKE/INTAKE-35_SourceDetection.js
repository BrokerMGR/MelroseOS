const INTAKE_SOURCE_PATTERNS = Object.freeze({

  CLEVER: [
    /clever/i,
    /team@movewithclever\.com/i,
    /@cleverrealestate\.com/i
  ],

  POPTIN: [
    /poptin/i
  ],

  RECRUITING: [
    /career/i,
    /join.*team/i,
    /license/i
  ],

  WEBSITE: [
    /book-now/i,
    /contact form/i
  ]

});

function INTAKE_detectSource(message) {

  const text = [

    message.from || '',

    message.subject || '',

    message.body || ''

  ].join('\n');

  for (const [source, patterns] of Object.entries(INTAKE_SOURCE_PATTERNS)) {

    if (patterns.some(p => p.test(text))) {

      return {

        source,

        confidence: 100

      };

    }

  }

  return {

    source: 'UNKNOWN',

    confidence: 0

  };

}

function INTAKE_classifyMessage(message) {

  const detection = INTAKE_detectSource(message);

  const brokerOnly = INTAKE_isBrokerOnly(detection.source);

  return {

    source: detection.source,

    confidence: detection.confidence,

    brokerOnly,

    reviewRequired: INTAKE_requiresBrokerReview(detection.confidence)

  };

}