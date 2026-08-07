const INTAKE_LEAD_MODEL = Object.freeze({

  VERSION: '1.0.0',

  REQUIRED_FIELDS: [

    'leadId',
    'source',
    'leadType',
    'status',
    'firstName',
    'lastName',
    'email',
    'phone',
    'city',
    'parish',
    'state',
    'assignedTo',
    'brokerOnly',
    'locked',
    'confidence',
    'createdAt'

  ]

});

function INTAKE_createLeadModel() {

  return {

    leadId: Utilities.getUuid(),

    source: 'UNKNOWN',

    leadType: 'UNKNOWN',

    status: 'NEW',

    firstName: '',

    lastName: '',

    email: '',

    phone: '',

    address: '',

    city: '',

    parish: '',

    state: '',

    zip: '',

    assignedTo: '',

    brokerOnly: true,

    locked: false,

    confidence: 0,

    notes: '',

    tags: [],

    createdAt: new Date().toISOString(),

    updatedAt: new Date().toISOString()

  };

}

function INTAKE_buildLeadModel(parsed) {

  const lead = INTAKE_createLeadModel();

  lead.source = parsed.classification.source;

  lead.confidence = parsed.classification.confidence;

  lead.brokerOnly = parsed.classification.brokerOnly;

  lead.email = parsed.normalized.email || '';

  lead.phone = parsed.normalized.phone || '';

  return lead;

}

function INTAKE_validateLeadModel(lead) {

  return INTAKE_LEAD_MODEL.REQUIRED_FIELDS.every(

    function(field) {

      return Object.prototype.hasOwnProperty.call(

        lead,

        field

      );

    }

  );

}