const INTAKE_LIVE_MONITOR = Object.freeze({

  VERSION: '1.0.0',

  ENABLED: false,

  POLL_MINUTES: 5,

  REQUIRE_PRODUCTION: true

});

function INTAKE_startLiveMonitoring() {

  return {

    started: false,

    reason: 'Production mode required.',

    enabled:

      INTAKE_LIVE_MONITOR.ENABLED,

    developmentMode:

      INTAKE_isDevelopment(),

    safetyLock:

      INTAKE_isSafetyLocked(),

    outboundBlocked:

      INTAKE_isOutboundBlocked(),

    timestamp:

      new Date().toISOString()

  };

}

function INTAKE_previewLiveMonitoring() {

  return INTAKE_getEnabledAccounts().map(

    function(account) {

      return {

        accountId: account.id,

        account: account.email,

        pollingMinutes:

          INTAKE_LIVE_MONITOR.POLL_MINUTES,

        active: false

      };

    }

  );

}

function INTAKE_stopLiveMonitoring() {

  return {

    stopped: true,

    timestamp:

      new Date().toISOString()

  };

}