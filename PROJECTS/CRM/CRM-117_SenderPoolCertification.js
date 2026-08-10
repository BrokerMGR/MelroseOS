/**
 * MelroseOS CRM
 * File: CRM-117_SenderPoolCertification.gs
 * Version: 1.0.0
 *
 * Visible certification wrapper for the multi-account sender pool.
 */

function MGR_SENDER_certifyPool() {
  if (
    typeof MGR_SENDER_getPoolStatus !== 'function'
  ) {
    throw new Error(
      'CRM-116 sender pool is not available.'
    );
  }

  const expected = [
    {
      email: 'melrosegrouprealty@gmail.com',
      priority: 1
    },
    {
      email: 'melrosegroupstaff@gmail.com',
      priority: 2
    },
    {
      email: 'melrosegroupleads@gmail.com',
      priority: 3
    },
    {
      email: 'agentleadcentral@gmail.com',
      priority: 4
    }
  ];

  const pool = MGR_SENDER_getPoolStatus();
  const now = Date.now();
  const maxHeartbeatAgeMs =
    15 * 60 * 1000;

  const checks = expected.map(function(item) {
    const sender = (pool.senders || [])
      .filter(function(row) {
        return (
          String(row.email || '')
            .toLowerCase() === item.email
        );
      })[0];

    if (!sender) {
      return {
        email: item.email,
        priorityExpected: item.priority,
        present: false,
        active: false,
        nodeInstalled: false,
        heartbeatRecent: false,
        googleQuotaReported: false,
        belowLocalCap: false,
        success: false,
        error: 'Sender missing from registry.'
      };
    }

    const heartbeatMs =
      new Date(
        sender.lastHeartbeatAt || 0
      ).getTime();

    const heartbeatRecent =
      isFinite(heartbeatMs) &&
      heartbeatMs > 0 &&
      now - heartbeatMs <=
        maxHeartbeatAgeMs;

    const googleQuotaReported =
      Number(
        sender.googleQuotaRemaining
      ) >= 0;

    const belowLocalCap =
      Number(sender.local24hCount || 0) <
      Number(sender.local24hCap || 75);

    const success =
      sender.active === true &&
      sender.nodeInstalled === true &&
      heartbeatRecent === true &&
      googleQuotaReported === true &&
      belowLocalCap === true &&
      Number(sender.priority) ===
        Number(item.priority);

    return {
      email: item.email,
      priorityExpected: item.priority,
      priorityActual:
        Number(sender.priority),
      present: true,
      active: sender.active === true,
      nodeInstalled:
        sender.nodeInstalled === true,
      lastHeartbeatAt:
        sender.lastHeartbeatAt || '',
      heartbeatRecent:
        heartbeatRecent,
      googleQuotaRemaining:
        Number(
          sender.googleQuotaRemaining || 0
        ),
      googleQuotaReported:
        googleQuotaReported,
      local24hCount:
        Number(
          sender.local24hCount || 0
        ),
      local24hCap:
        Number(
          sender.local24hCap || 75
        ),
      belowLocalCap:
        belowLocalCap,
      success: success
    };
  });

  const result = {
    success: checks.every(
      function(row) {
        return row.success === true;
      }
    ),
    expectedSenderCount:
      expected.length,
    detectedSenderCount:
      (pool.senders || []).length,
    perAccount24hCap:
      pool.perAccount24hCap,
    googleQuotaReserve:
      pool.googleQuotaReserve,
    checks: checks,
    pool: pool,
    timestamp:
      new Date().toISOString()
  };

  console.log(
    'MGR_SENDER_certifyPool\n' +
    JSON.stringify(
      result,
      null,
      2
    )
  );

  if (result.success) {
    console.log(
      'CERTIFICATION: PASS - 4/4 sender nodes linked and operational.'
    );
  } else {
    console.error(
      'CERTIFICATION: FAIL - One or more sender nodes need attention.'
    );
  }

  return result;
}

function RUN_SENDER_POOL_CERTIFICATION() {
  return MGR_SENDER_certifyPool();
}
