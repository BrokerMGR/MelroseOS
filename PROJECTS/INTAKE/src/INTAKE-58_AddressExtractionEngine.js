const INTAKE_ADDRESS_ENGINE = Object.freeze({

  VERSION: '1.0.0',

  STATES: [

    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',

    'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',

    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',

    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',

    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'

  ]

});

function INTAKE_extractAddresses(message) {

  const text = [

    message.subject || '',

    message.body || ''

  ].join('\n');

  return {

    addresses: [],

    parish: '',

    city: '',

    state: '',

    zip: '',

    sourceTextLength: text.length,

    extractedAt: new Date().toISOString()

  };

}

function INTAKE_hasAddress(message) {

  return INTAKE_extractAddresses(message).addresses.length > 0;

}

function INTAKE_previewAddressExtraction(message) {

  return INTAKE_extractAddresses(message);

}