const INTAKE_SOURCE_REGISTRY = Object.freeze({

  SOURCES: [

    {
      code: 'CLEVER',
      brokerOnly: true,
      assignable: false
    },

    {
      code: 'POPTIN',
      brokerOnly: true,
      assignable: false
    },

    {
      code: 'RECRUITING',
      brokerOnly: true,
      assignable: false
    },

    {
      code: 'WEBSITE',
      brokerOnly: false,
      assignable: true
    },

    {
      code: 'FACEBOOK',
      brokerOnly: false,
      assignable: true
    },

    {
      code: 'MANUAL',
      brokerOnly: false,
      assignable: true
    },

    {
      code: 'UNKNOWN',
      brokerOnly: true,
      assignable: false
    }

  ]

});

function INTAKE_getSourceRegistry() {

  return JSON.parse(

    JSON.stringify(INTAKE_SOURCE_REGISTRY)

  );

}

function INTAKE_getSource(code) {

  return INTAKE_SOURCE_REGISTRY.SOURCES.find(

    s => s.code === code

  ) || null;

}