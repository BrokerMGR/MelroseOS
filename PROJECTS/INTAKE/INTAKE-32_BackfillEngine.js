const INTAKE_BACKFILL = Object.freeze({

  ENABLED: true,

  MODE: 'HISTORICAL_ONLY',

  BATCH_SIZE: 250,

  MAX_THREADS: 1,

  SEND_EMAILS: false,

  ASSIGN_LEADS: false,

  NOTIFY_AGENTS: false

});

function INTAKE_getBackfillSettings() {

  return JSON.parse(

    JSON.stringify(INTAKE_BACKFILL)

  );

}

function INTAKE_startBackfill() {

  return {

    success: true,

    status: 'READY',

    mode: INTAKE_BACKFILL.MODE,

    batchSize: INTAKE_BACKFILL.BATCH_SIZE,

    outboundBlocked: INTAKE_isOutboundBlocked(),

    safetyLock: INTAKE_isSafetyLocked(),

    startedAt: new Date().toISOString()

  };

}

function INTAKE_previewBackfill() {

  return {

    accounts: INTAKE_getEnabledAccounts(),

    settings: INTAKE_getBackfillSettings(),

    productionGate: INTAKE_productionGate()

  };

}