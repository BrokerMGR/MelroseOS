/**
 * MelroseOS CRM
 * File: CRM-118_SenderPoolCertificationV2.gs
 * Version: 2.0.0
 *
 * Separates infrastructure health from current sending availability.
 */

function RUN_SENDER_POOL_CERTIFICATION_V2() {
  const expected = [
    { email: 'melrosegrouprealty@gmail.com', priority: 1 },
    { email: 'melrosegroupstaff@gmail.com', priority: 2 },
    { email: 'melrosegroupleads@gmail.com', priority: 3 },
    { email: 'agentleadcentral@gmail.com', priority: 4 }
  ];

  const pool = MGR_SENDER_getPoolStatus();
  const now = Date.now();
  const maxHeartbeatAgeMs = 15 * 60 * 1000;

  const checks = expected.map(function(item) {
    const sender = (pool.senders || []).filter(function(row) {
      return String(row.email || '').toLowerCase() === item.email;
    })[0];

    if (!sender) {
      return {
        email: item.email,
        linkedHealthy: false,
        availableNow: false,
        error: 'Sender missing from registry.'
      };
    }

    const heartbeatMs = new Date(
      sender.lastHeartbeatAt || 0
    ).getTime();

    const heartbeatRecent =
      isFinite(heartbeatMs) &&
      heartbeatMs > 0 &&
      now - heartbeatMs <= maxHeartbeatAgeMs;

    const linkedHealthy =
      sender.active === true &&
      sender.nodeInstalled === true &&
      heartbeatRecent === true &&
      Number(sender.priority) === Number(item.priority);

    const quota = Number(sender.googleQuotaRemaining);
    const quotaKnown = quota >= 0;

    const belowLocalCap =
      Number(sender.local24hCount || 0) <
      Number(sender.local24hCap || 75);

    const availableNow =
      linkedHealthy &&
      quotaKnown &&
      quota > Number(pool.googleQuotaReserve || 20) &&
      belowLocalCap;

    let availabilityReason = 'AVAILABLE';

    if (!linkedHealthy) {
      availabilityReason = 'NODE_NOT_HEALTHY';
    } else if (!quotaKnown) {
      availabilityReason = 'GOOGLE_QUOTA_UNKNOWN_OR_UNAVAILABLE';
    } else if (quota <= Number(pool.googleQuotaReserve || 20)) {
      availabilityReason = 'GOOGLE_QUOTA_RESERVE_PROTECTED';
    } else if (!belowLocalCap) {
      availabilityReason = 'LOCAL_24H_CAP_REACHED';
    }

    return {
      email: item.email,
      priorityExpected: item.priority,
      priorityActual: Number(sender.priority),
      active: sender.active === true,
      nodeInstalled: sender.nodeInstalled === true,
      lastHeartbeatAt: sender.lastHeartbeatAt || '',
      heartbeatRecent: heartbeatRecent,
      linkedHealthy: linkedHealthy,
      googleQuotaRemaining: quota,
      quotaKnown: quotaKnown,
      local24hCount: Number(sender.local24hCount || 0),
      local24hCap: Number(sender.local24hCap || 75),
      availableNow: availableNow,
      availabilityReason: availabilityReason
    };
  });

  const linkedCount = checks.filter(function(row) {
    return row.linkedHealthy === true;
  }).length;

  const availableCount = checks.filter(function(row) {
    return row.availableNow === true;
  }).length;

  const result = {
    success: linkedCount === expected.length,
    infrastructureCertification:
      linkedCount === expected.length ? 'PASS' : 'FAIL',
    expectedSenderCount: expected.length,
    linkedHealthyCount: linkedCount,
    availableNowCount: availableCount,
    temporarilyUnavailableCount:
      expected.length - availableCount,
    perAccount24hCap: pool.perAccount24hCap,
    googleQuotaReserve: pool.googleQuotaReserve,
    checks: checks,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_SENDER_POOL_CERTIFICATION_V2\n' +
    JSON.stringify(result, null, 2)
  );

  if (result.success) {
    console.log(
      'INFRASTRUCTURE CERTIFICATION: PASS - 4/4 sender nodes linked and healthy.'
    );
    console.log(
      'CURRENT SEND CAPACITY: ' +
      availableCount +
      '/4 sender nodes available now.'
    );
  } else {
    console.error(
      'INFRASTRUCTURE CERTIFICATION: FAIL - One or more sender nodes are not linked/healthy.'
    );
  }

  return result;
}
