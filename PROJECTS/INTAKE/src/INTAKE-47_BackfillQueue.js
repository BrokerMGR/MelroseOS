const INTAKE_BACKFILL_QUEUE = Object.freeze({

  VERSION: '1.0.0',

  STATUS: {
    NEW: 'NEW',
    PROCESSING: 'PROCESSING',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED',
    SKIPPED: 'SKIPPED'
  },

  DEFAULT_BATCH_SIZE: 250

});

function INTAKE_createBackfillQueueItem(account, cursor) {

  return {

    queueId: Utilities.getUuid(),

    accountId: account.id,

    email: account.email,

    cursor: cursor || '',

    status: INTAKE_BACKFILL_QUEUE.STATUS.NEW,

    processed: 0,

    failed: 0,

    createdAt: new Date().toISOString()

  };

}

function INTAKE_updateBackfillQueueItem(
  item,
  status,
  processed,
  failed
) {

  item.status = status;

  item.processed =
    Number(processed || 0);

  item.failed =
    Number(failed || 0);

  item.updatedAt =
    new Date().toISOString();

  return item;

}

function INTAKE_buildBackfillQueue() {

  return INTAKE_getEnabledAccounts().map(
    function(account) {

      return INTAKE_createBackfillQueueItem(
        account,
        ''
      );

    }
  );

}