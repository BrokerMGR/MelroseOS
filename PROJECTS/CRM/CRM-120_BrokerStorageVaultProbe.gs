/**
 * MelroseOS CRM
 * File: CRM-120_BrokerStorageVaultProbe.gs
 * Version: 1.0.0
 *
 * Broker/Core storage probe.
 * Run under melrosegroupbroker@gmail.com.
 */

function MGR_STORAGE_BROKER_install() {
  const result =
    MGR_STORAGE_BROKER_probe();

  MGR_STORAGE_BROKER_ensureTrigger_();

  return result;
}

function MGR_STORAGE_BROKER_probe() {
  const expected =
    'melrosegroupbroker@gmail.com';

  const effectiveUser = String(
    Session.getEffectiveUser().getEmail() ||
    Session.getActiveUser().getEmail() ||
    ''
  ).trim().toLowerCase();

  let driveAccessible = false;
  let rootFolderId = '';
  let storageLimit = 0;
  let storageUsed = 0;
  let error = '';

  try {
    const root = DriveApp.getRootFolder();
    rootFolderId = root.getId();

    storageLimit =
      Number(
        DriveApp.getStorageLimit() || 0
      );

    storageUsed =
      Number(
        DriveApp.getStorageUsed() || 0
      );

    driveAccessible = true;
  } catch (err) {
    error = String(
      err && err.message
        ? err.message
        : err
    );
  }

  const available =
    Math.max(
      0,
      storageLimit - storageUsed
    );

  const percent =
    storageLimit > 0
      ? Number(
          (
            storageUsed /
            storageLimit *
            100
          ).toFixed(2)
        )
      : 0;

  const payload = {
    expectedEmail: expected,
    effectiveUser: effectiveUser,
    probedAt: new Date().toISOString(),
    driveAccessible:
      driveAccessible,
    rootFolderId:
      rootFolderId,
    storageLimitBytes:
      storageLimit,
    storageUsedBytes:
      storageUsed,
    storageAvailableBytes:
      available,
    storageUsedPercent:
      percent,
    probeInstalled: true,
    error: error
  };

  console.log(
    'MGR_STORAGE_BROKER_probe\n' +
    JSON.stringify(
      payload,
      null,
      2
    )
  );

  if (effectiveUser !== expected) {
    throw new Error(
      'BROKER_STORAGE_IDENTITY_MISMATCH: expected ' +
      expected +
      ' but running as ' +
      effectiveUser
    );
  }

  MGR_STORAGE_recordProbe(payload);

  return payload;
}

function MGR_STORAGE_BROKER_ensureTrigger_() {
  const handler =
    'MGR_STORAGE_BROKER_probe';

  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return (
        trigger.getHandlerFunction() ===
        handler
      );
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyHours(6)
    .create();
}
