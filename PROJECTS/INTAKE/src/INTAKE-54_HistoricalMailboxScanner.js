const INTAKE_HISTORY = Object.freeze({

  VERSION: '1.0.0',

  DEFAULT_LOOKBACK_DAYS: 3650,

  DEFAULT_BATCH_SIZE: 250,

  SAVE_CHECKPOINTS: true,

  RESUME_SUPPORTED: true

});

function INTAKE_buildHistoricalScan(account) {

  return {

    accountId: account.id,

    account: account.email,

    daysBack:

      INTAKE_HISTORY.DEFAULT_LOOKBACK_DAYS,

    batchSize:

      INTAKE_HISTORY.DEFAULT_BATCH_SIZE,

    checkpointEnabled:

      INTAKE_HISTORY.SAVE_CHECKPOINTS,

    resumeSupported:

      INTAKE_HISTORY.RESUME_SUPPORTED,

    startedAt:

      new Date().toISOString()

  };

}

function INTAKE_previewHistoricalScan() {

  return INTAKE_getEnabledAccounts().map(

    function(account) {

      return INTAKE_buildHistoricalScan(account);

    }

  );

}

function INTAKE_resumeHistoricalScan(checkpoint) {

  return {

    resumed: true,

    checkpoint: checkpoint || '',

    resumedAt: new Date().toISOString()

  };

}