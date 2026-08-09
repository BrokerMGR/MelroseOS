const INTAKE_LEAD_TYPE = Object.freeze({

  BUYER: 'BUYER',
  SELLER: 'SELLER',
  RENTER: 'RENTER',
  RECRUITING: 'RECRUITING',
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN'

});

function INTAKE_detectLeadType(message) {

  const text = [

    message.subject || '',

    message.body || ''

  ].join('\n').toLowerCase();

  const patterns = [

    {
      type: INTAKE_LEAD_TYPE.RECRUITING,
      terms: [
        'join the team',
        'career',
        'brokerage',
        'sponsoring broker',
        'real estate license',
        'new agent',
        'realtor opportunity'
      ]
    },

    {
      type: INTAKE_LEAD_TYPE.SELLER,
      terms: [
        'sell my home',
        'selling my home',
        'home value',
        'property value',
        'listing',
        'list my home',
        'seller'
      ]
    },

    {
      type: INTAKE_LEAD_TYPE.BUYER,
      terms: [
        'buy a home',
        'buying a home',
        'home search',
        'property search',
        'buyer',
        'pre-approved',
        'mortgage'
      ]
    },

    {
      type: INTAKE_LEAD_TYPE.RENTER,
      terms: [
        'rent',
        'rental',
        'lease',
        'apartment',
        'tenant'
      ]
    }

  ];

  let bestType =
    INTAKE_LEAD_TYPE.UNKNOWN;

  let bestScore = 0;

  patterns.forEach(function(rule) {

    let score = 0;

    rule.terms.forEach(function(term) {

      if (text.indexOf(term) !== -1) {
        score += 20;
      }

    });

    if (score > bestScore) {

      bestScore = score;

      bestType = rule.type;

    }

  });

  return {

    leadType:
      bestType,

    confidence:
      Math.min(
        100,
        bestScore
      ),

    brokerOnly:
      bestType ===
        INTAKE_LEAD_TYPE.RECRUITING,

    detectedAt:
      new Date().toISOString()

  };

}

function INTAKE_requiresLeadTypeReview(message) {

  const result =
    INTAKE_detectLeadType(message);

  return (

    result.leadType ===
      INTAKE_LEAD_TYPE.UNKNOWN ||

    result.confidence < 60

  );

}