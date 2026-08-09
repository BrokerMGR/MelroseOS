const INTAKE_ROUTING = Object.freeze({

  REQUIRE_PARISH: true,

  DEFAULT_ROUTE: 'BROKER_REVIEW',

  UNKNOWN_PARISH: 'UNKNOWN',

  BROKER_FALLBACK: 'BROKER'

});

function INTAKE_buildRoutingRequest(lead) {

  return {

    parish: lead.parish || INTAKE_ROUTING.UNKNOWN_PARISH,

    city: lead.city || '',

    zip: lead.zip || '',

    leadType: lead.leadType || '',

    source: lead.source || 'UNKNOWN'

  };

}

function INTAKE_previewRouting(lead) {

  const route = INTAKE_buildRoutingRequest(lead);

  return {

    commit: false,

    routeTo:

      route.parish === INTAKE_ROUTING.UNKNOWN_PARISH

        ? INTAKE_ROUTING.BROKER_FALLBACK

        : 'ROUND_ROBIN',

    reason:

      route.parish === INTAKE_ROUTING.UNKNOWN_PARISH

        ? 'Missing parish'

        : 'Parish available',

    routing: route

  };

}