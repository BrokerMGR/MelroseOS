const INTAKE_CONFIGURATION = Object.freeze({

  GMAIL_ACCOUNTS: [

    'melrosegroupbroker@gmail.com',

    'melrosegrouprealty@gmail.com',

    'agentleadcentral@gmail.com',

    'melrosegroupstaff@gmail.com',

    'melrosegroupleads@gmail.com'

  ],

  DEFAULT_TIMEZONE: 'America/Chicago',

  DEFAULT_BATCH_SIZE: 100,

  MAX_BACKFILL_BATCH: 500,

  PARSER_VERSION: '1.0.0',

  KNOWLEDGE_REFRESH_MINUTES: 15,

  DUPLICATE_LOOKBACK_DAYS: 3650

});

function INTAKE_getConfiguration() {

  return JSON.parse(

    JSON.stringify(INTAKE_CONFIGURATION)

  );

}

function INTAKE_getConfiguredAccounts() {

  return INTAKE_CONFIGURATION.GMAIL_ACCOUNTS.slice();

}

function INTAKE_isConfiguredAccount(email) {

  return INTAKE_CONFIGURATION.GMAIL_ACCOUNTS.includes(email);

}