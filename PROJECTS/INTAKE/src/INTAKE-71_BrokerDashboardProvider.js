function INTAKE_getBrokerDashboardPayload() {

  const runtime =
    INTAKE_getRuntimeHealth();

  return {

    subsystem:
      'INTAKE',

    title:
      'Enterprise Intake Intelligence',

    status:
      runtime.status,

    cards: [

      {
        label: 'Configured Accounts',
        value: INTAKE_getEnabledAccounts().length
      },

      {
        label: 'Safety Lock',
        value: INTAKE_isSafetyLocked() ? 'ON' : 'OFF'
      },

      {
        label: 'Outbound',
        value: INTAKE_isOutboundBlocked() ? 'BLOCKED' : 'OPEN'
      },

      {
        label: 'Live Monitoring',
        value:
          INTAKE_SETTINGS.LIVE_MONITORING_ENABLED
            ? 'ON'
            : 'OFF'
      }

    ],

    runtime:
      runtime,

    generatedAt:
      new Date().toISOString()

  };

}