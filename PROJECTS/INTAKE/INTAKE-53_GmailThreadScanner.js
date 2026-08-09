const INTAKE_THREAD_SCANNER = Object.freeze({

  VERSION: '1.0.0',

  MAX_THREADS_PER_BATCH: 100,

  INCLUDE_ARCHIVED: true

});

function INTAKE_scanThreads(account, query, limit) {

  limit = limit || INTAKE_THREAD_SCANNER.MAX_THREADS_PER_BATCH;

  return {

    accountId: account.id,

    account: account.email,

    query: query,

    batchSize: limit,

    threadsFound: 0,

    messagesFound: 0,

    completed: false,

    scannedAt: new Date().toISOString()

  };

}

function INTAKE_previewThreadScan(account) {

  return INTAKE_scanThreads(

    account,

    INTAKE_buildSearchQuery(),

    INTAKE_THREAD_SCANNER.MAX_THREADS_PER_BATCH

  );

}

function INTAKE_scanAllAccounts() {

  return INTAKE_getEnabledAccounts().map(

    function(account) {

      return INTAKE_previewThreadScan(account);

    }

  );

}