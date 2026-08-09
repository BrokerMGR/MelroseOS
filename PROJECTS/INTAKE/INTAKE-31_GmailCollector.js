function INTAKE_collectMailbox(account) {

  return {

    success: true,

    account: account.email,

    accountId: account.id,

    mode: INTAKE.MODE,

    liveMonitoring: false,

    historicalBackfill: true,

    messagesCollected: 0,

    nextPageToken: null,

    collectedAt: new Date().toISOString()

  };

}

function INTAKE_collectAllMailboxes() {

  return INTAKE_getEnabledAccounts().map(

    INTAKE_collectMailbox

  );

}

function INTAKE_previewMailboxCollection() {

  return {

    accounts: INTAKE_getEnabledAccounts().length,

    collectors: INTAKE_collectAllMailboxes(),

    outboundBlocked: INTAKE_isOutboundBlocked(),

    safetyLock: INTAKE_isSafetyLocked()

  };

}