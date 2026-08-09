const INTAKE_LOCATION_RESOLVER = Object.freeze({

  VERSION: '1.0.0',

  DEFAULT_STATE: 'LA',

  UNKNOWN_PARISH: 'UNKNOWN',

  BROKER_REVIEW_ON_UNKNOWN: true

});

function INTAKE_resolveLocation(lead) {

  const parish =
    String(
      lead.parish || ''
    ).trim();

  const city =
    String(
      lead.city || ''
    ).trim();

  const zip =
    String(
      lead.zip || ''
    ).trim();

  const state =
    String(
      lead.state ||
      INTAKE_LOCATION_RESOLVER.DEFAULT_STATE
    ).trim();

  if (parish) {

    return {

      resolved: true,

      parish: parish,

      city: city,

      zip: zip,

      state: state,

      method: 'EXPLICIT_PARISH',

      brokerReview: false

    };

  }

  return {

    resolved: false,

    parish:
      INTAKE_LOCATION_RESOLVER.UNKNOWN_PARISH,

    city: city,

    zip: zip,

    state: state,

    method: 'UNRESOLVED',

    brokerReview:
      INTAKE_LOCATION_RESOLVER
        .BROKER_REVIEW_ON_UNKNOWN

  };

}

function INTAKE_applyLocationResolution(lead) {

  const result =
    INTAKE_resolveLocation(
      lead
    );

  lead.parish =
    result.parish;

  lead.city =
    result.city;

  lead.zip =
    result.zip;

  lead.state =
    result.state;

  return {

    lead: lead,

    location: result,

    resolvedAt:
      new Date().toISOString()

  };

}