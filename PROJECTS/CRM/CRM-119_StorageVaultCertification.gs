/**
 * MelroseOS CRM
 * File: CRM-119_StorageVaultCertification.gs
 * Version: 1.0.0
 *
 * Central certification for the five-account SMART storage federation.
 */

const MGR_STORAGE_CERT_VERSION = '1.0.0';

const MGR_STORAGE_CERT = Object.freeze({
  CRM_WORKBOOK_ID:
    '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
  SHEET: 'STORAGE_VAULT_CERTIFICATION',
  MAX_HEARTBEAT_AGE_MINUTES: 30
});

const MGR_STORAGE_EXPECTED = Object.freeze([
  Object.freeze({
    vaultId: 'VAULT-1',
    priority: 1,
    email: 'melrosegroupbroker@gmail.com',
    role: 'BROKER_CORE'
  }),
  Object.freeze({
    vaultId: 'VAULT-2',
    priority: 2,
    email: 'melrosegrouprealty@gmail.com',
    role: 'BROKERAGE_SHARED'
  }),
  Object.freeze({
    vaultId: 'VAULT-3',
    priority: 3,
    email: 'agentleadcentral@gmail.com',
    role: 'LEAD_DISTRIBUTION'
  }),
  Object.freeze({
    vaultId: 'VAULT-4',
    priority: 4,
    email: 'melrosegroupstaff@gmail.com',
    role: 'STAFF_OPERATIONS'
  }),
  Object.freeze({
    vaultId: 'VAULT-5',
    priority: 5,
    email: 'melrosegroupleads@gmail.com',
    role: 'LEADS_VAULT'
  })
]);

function MGR_STORAGE_installCertificationRegistry() {
  const ss = SpreadsheetApp.openById(
    MGR_STORAGE_CERT.CRM_WORKBOOK_ID
  );

  let sheet = ss.getSheetByName(
    MGR_STORAGE_CERT.SHEET
  );

  const headers = [
    'VaultID',
    'Priority',
    'ExpectedEmail',
    'Role',
    'EffectiveUser',
    'LastProbeAt',
    'DriveAccessible',
    'RootFolderId',
    'StorageLimitBytes',
    'StorageUsedBytes',
    'StorageAvailableBytes',
    'StorageUsedPercent',
    'ProbeInstalled',
    'LastError',
    'UpdatedAt'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(
      MGR_STORAGE_CERT.SHEET
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(
      1,
      1,
      1,
      headers.length
    ).setValues([headers]);

    sheet.setFrozenRows(1);
  }

  MGR_STORAGE_EXPECTED.forEach(
    function(vault) {
      MGR_STORAGE_upsertExpected_(sheet, vault);
    }
  );

  return RUN_STORAGE_VAULT_CERTIFICATION();
}

function MGR_STORAGE_recordProbe(probe) {
  const p = probe || {};

  const email = String(
    p.expectedEmail ||
    p.effectiveUser ||
    ''
  ).trim().toLowerCase();

  const expected = MGR_STORAGE_EXPECTED.filter(
    function(vault) {
      return vault.email === email;
    }
  )[0];

  if (!expected) {
    throw new Error(
      'Unknown storage vault identity: ' + email
    );
  }

  const ss = SpreadsheetApp.openById(
    MGR_STORAGE_CERT.CRM_WORKBOOK_ID
  );

  let sheet = ss.getSheetByName(
    MGR_STORAGE_CERT.SHEET
  );

  if (!sheet) {
    MGR_STORAGE_installCertificationRegistry();
    sheet = ss.getSheetByName(
      MGR_STORAGE_CERT.SHEET
    );
  }

  const row = MGR_STORAGE_findVaultRow_(
    sheet,
    expected.vaultId
  );

  if (!row) {
    throw new Error(
      'Storage vault registry row missing: ' +
      expected.vaultId
    );
  }

  const now = new Date().toISOString();

  sheet.getRange(
    row,
    1,
    1,
    15
  ).setValues([[
    expected.vaultId,
    expected.priority,
    expected.email,
    expected.role,
    String(p.effectiveUser || ''),
    String(p.probedAt || now),
    p.driveAccessible === true,
    String(p.rootFolderId || ''),
    Number(p.storageLimitBytes || 0),
    Number(p.storageUsedBytes || 0),
    Number(p.storageAvailableBytes || 0),
    Number(p.storageUsedPercent || 0),
    p.probeInstalled !== false,
    String(p.error || ''),
    now
  ]]);

  return {
    success: true,
    vaultId: expected.vaultId,
    email: expected.email,
    timestamp: now
  };
}

function RUN_STORAGE_VAULT_CERTIFICATION() {
  const ss = SpreadsheetApp.openById(
    MGR_STORAGE_CERT.CRM_WORKBOOK_ID
  );

  const sheet = ss.getSheetByName(
    MGR_STORAGE_CERT.SHEET
  );

  if (!sheet) {
    return MGR_STORAGE_installCertificationRegistry();
  }

  const rows = sheet.getLastRow() >= 2
    ? sheet.getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        15
      ).getValues()
    : [];

  const now = Date.now();
  const maxAge =
    MGR_STORAGE_CERT.MAX_HEARTBEAT_AGE_MINUTES *
    60 *
    1000;

  const checks = MGR_STORAGE_EXPECTED.map(
    function(expected) {
      const row = rows.filter(function(r) {
        return String(r[0] || '') ===
          expected.vaultId;
      })[0];

      if (!row) {
        return {
          vaultId: expected.vaultId,
          priority: expected.priority,
          email: expected.email,
          role: expected.role,
          registered: false,
          success: false,
          error: 'Registry row missing.'
        };
      }

      const effectiveUser = String(
        row[4] || ''
      ).trim().toLowerCase();

      const probeAt = String(
        row[5] || ''
      );

      const probeMs = new Date(
        probeAt || 0
      ).getTime();

      const heartbeatRecent =
        isFinite(probeMs) &&
        probeMs > 0 &&
        now - probeMs <= maxAge;

      const identityMatches =
        effectiveUser === expected.email;

      const driveAccessible =
        row[6] === true ||
        String(row[6]).toUpperCase() ===
          'TRUE';

      const storageLimit =
        Number(row[8] || 0);

      const storageUsed =
        Number(row[9] || 0);

      const storageAvailable =
        Number(row[10] || 0);

      const storageUsedPercent =
        Number(row[11] || 0);

      const installed =
        row[12] === true ||
        String(row[12]).toUpperCase() ===
          'TRUE';

      const error = String(
        row[13] || ''
      );

      const success =
        identityMatches &&
        heartbeatRecent &&
        driveAccessible &&
        installed &&
        storageLimit > 0 &&
        storageUsed >= 0 &&
        storageAvailable >= 0 &&
        !error;

      return {
        vaultId: expected.vaultId,
        priority: expected.priority,
        email: expected.email,
        role: expected.role,
        registered: true,
        effectiveUser: effectiveUser,
        identityMatches: identityMatches,
        lastProbeAt: probeAt,
        heartbeatRecent: heartbeatRecent,
        driveAccessible: driveAccessible,
        probeInstalled: installed,
        rootFolderId: String(row[7] || ''),
        storageLimitBytes: storageLimit,
        storageUsedBytes: storageUsed,
        storageAvailableBytes:
          storageAvailable,
        storageUsedPercent:
          storageUsedPercent,
        error: error,
        success: success
      };
    }
  );

  const passed = checks.filter(
    function(row) {
      return row.success === true;
    }
  ).length;

  const totalLimit = checks.reduce(
    function(total, row) {
      return total +
        Number(row.storageLimitBytes || 0);
    },
    0
  );

  const totalUsed = checks.reduce(
    function(total, row) {
      return total +
        Number(row.storageUsedBytes || 0);
    },
    0
  );

  const result = {
    success:
      passed ===
      MGR_STORAGE_EXPECTED.length,
    certification:
      passed ===
      MGR_STORAGE_EXPECTED.length
        ? 'PASS'
        : 'FAIL',
    expectedVaults:
      MGR_STORAGE_EXPECTED.length,
    vaultsPassed: passed,
    vaultsFailed:
      MGR_STORAGE_EXPECTED.length -
      passed,
    totalStorageLimitBytes:
      totalLimit,
    totalStorageUsedBytes:
      totalUsed,
    totalStorageAvailableBytes:
      Math.max(
        0,
        totalLimit - totalUsed
      ),
    checks: checks,
    timestamp:
      new Date().toISOString()
  };

  console.log(
    'RUN_STORAGE_VAULT_CERTIFICATION\n' +
    JSON.stringify(
      result,
      null,
      2
    )
  );

  if (result.success) {
    console.log(
      'STORAGE CERTIFICATION: PASS - 5/5 SMART storage vaults linked, accessible, and reporting.'
    );
  } else {
    console.error(
      'STORAGE CERTIFICATION: FAIL - One or more storage vaults need attention.'
    );
  }

  return result;
}

function MGR_STORAGE_upsertExpected_(
  sheet,
  vault
) {
  const row = MGR_STORAGE_findVaultRow_(
    sheet,
    vault.vaultId
  );

  const now = new Date().toISOString();

  if (row) {
    sheet.getRange(
      row,
      1,
      1,
      4
    ).setValues([[
      vault.vaultId,
      vault.priority,
      vault.email,
      vault.role
    ]]);

    sheet.getRange(
      row,
      15
    ).setValue(now);

    return;
  }

  sheet.appendRow([
    vault.vaultId,
    vault.priority,
    vault.email,
    vault.role,
    '',
    '',
    false,
    '',
    0,
    0,
    0,
    0,
    false,
    '',
    now
  ]);
}

function MGR_STORAGE_findVaultRow_(
  sheet,
  vaultId
) {
  if (!sheet || sheet.getLastRow() < 2) {
    return 0;
  }

  const match = sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    1
  )
    .createTextFinder(
      String(vaultId)
    )
    .matchEntireCell(true)
    .findNext();

  return match
    ? match.getRow()
    : 0;
}
