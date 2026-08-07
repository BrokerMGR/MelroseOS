const INTAKE_SEARCH = Object.freeze({

  DEFAULT_DAYS_BACK: 3650,

  DEFAULT_BATCH_SIZE: 250,

  INCLUDE_SPAM: false,

  INCLUDE_TRASH: false

});

function INTAKE_buildSearchQuery(options) {

  options = options || {};

  const days =
    options.daysBack ||
    INTAKE_SEARCH.DEFAULT_DAYS_BACK;

  const after = new Date();

  after.setDate(after.getDate() - days);

  return [

    'after:' +

      Utilities.formatDate(

        after,

        Session.getScriptTimeZone(),

        'yyyy/MM/dd'

      ),

    '-in:trash',

    '-in:spam'

  ].join(' ');

}

function INTAKE_previewSearch(account, options) {

  return {

    account: account.email,

    query:

      INTAKE_buildSearchQuery(options),

    batchSize:

      options?.batchSize ||

      INTAKE_SEARCH.DEFAULT_BATCH_SIZE,

    historicalOnly: true,

    outboundBlocked:

      INTAKE_isOutboundBlocked(),

    safetyLock:

      INTAKE_isSafetyLocked()

  };

}