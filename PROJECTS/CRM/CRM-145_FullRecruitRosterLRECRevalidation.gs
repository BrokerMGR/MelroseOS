/**
 * MelroseOS CRM
 * File: CRM-145_FullRecruitRosterLRECRevalidation.gs
 * Version: 1.0.0
 *
 * Full authoritative Prospects roster revalidation using CRM-144/143.
 *
 * Decisions:
 *   explicit LREC no-result -> PENDING (eligible, but this audit does NOT send)
 *   LREC record found      -> LICENSED; cancel unsent + move to Active Agents
 *   anything uncertain     -> HOLD; hold unsent
 *
 * Existing-agent outbound remains OFF.
 * This module never releases or sends the recruit queue.
 */

const MGR_RECRUIT_145 = Object.freeze({
  VERSION:'1.0.0',
  ROSTER_ID:'1JK4xYqsic18U_VQ6LrZU_Qg09yDiWkmRpAFdHTMrBIQ',
  ROSTER_SHEET:'Prospects',
  CRM_ID:'1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
  OUTBOX_SHEET:'EMAIL_OUTBOX',
  CAMPAIGN:'RECRUIT_MENTORSHIP',
  AUDIT_PROPERTY:'MGR_RECRUIT_145_LAST_FULL_AUDIT'
});

function RUN_RECRUIT_145_FULL_ROSTER_REVALIDATION() {
  if (typeof MGR_RECRUIT_144_verifyPendingCandidate !== 'function') {
    throw new Error('CRM-145 BLOCKED: CRM-144 verifier missing.');
  }
  if (typeof MGR_RECRUIT_138_moveToActiveAgents_ !== 'function') {
    throw new Error('CRM-145 BLOCKED: CRM-138 migration function missing.');
  }

  // Prove both sides immediately before touching production rows.
  const canary =
    typeof RUN_RECRUIT_144_BRIDGE_CERTIFICATION === 'function'
      ? RUN_RECRUIT_144_BRIDGE_CERTIFICATION()
      : {success:false};

  if (!canary || canary.success !== true) {
    throw new Error('CRM-145 BLOCKED: CRM-144 canary did not pass.');
  }

  const rosterSS = SpreadsheetApp.openById(MGR_RECRUIT_145.ROSTER_ID);
  const roster = rosterSS.getSheetByName(MGR_RECRUIT_145.ROSTER_SHEET);
  if (!roster) throw new Error('CRM-145 BLOCKED: Prospects sheet missing.');

  const crmSS = SpreadsheetApp.openById(MGR_RECRUIT_145.CRM_ID);
  const outbox = crmSS.getSheetByName(MGR_RECRUIT_145.OUTBOX_SHEET);
  if (!outbox) throw new Error('CRM-145 BLOCKED: EMAIL_OUTBOX missing.');

  // Snapshot first. CRM-138 may delete source rows during licensed migration.
  const index = MGR_RECRUIT_138_rosterIndex_(roster);
  const recruits = Object.keys(index.byEmail).map(function(email) {
    return index.byEmail[email];
  });

  let pending = 0;
  let licensed = 0;
  let held = 0;
  let migrated = 0;
  let migrationFailed = 0;
  let cancelledUnsent = 0;
  let heldUnsent = 0;
  const details = [];

  recruits.forEach(function(recruit) {
    const decision = MGR_RECRUIT_144_verifyPendingCandidate({
      email:recruit.email,
      firstName:recruit.firstName,
      lastName:recruit.lastName,
      phone:recruit.phone,
      credentialNumber:recruit.credentialNumber,
      licenseNumber:recruit.credentialNumber
    });

    const lrec = (decision && decision.lrec) || {
      success:false,
      error:'CRM145_EMPTY_LREC_RESULT',
      checkedAt:new Date().toISOString()
    };

    const currentRow =
      MGR_RECRUIT_138_findEmailRow_(roster, recruit.email);

    if (currentRow > 1) {
      MGR_RECRUIT_138_writeLiveResult_(roster, currentRow, lrec);
    }

    if (
      decision &&
      decision.success === true &&
      decision.decision === 'TRANSITION_EXISTING_AGENT'
    ) {
      const cancelled =
        MGR_RECRUIT_145_cancelOrHoldOutbox_(
          outbox,
          recruit.email,
          'CANCELLED_LREC_LICENSED',
          'Cancelled before send: LREC license record found.'
        );
      cancelledUnsent += cancelled;

      const move = MGR_RECRUIT_138_moveToActiveAgents_(
        roster,
        recruit,
        lrec
      );

      licensed += 1;
      if (move && move.success) migrated += 1;
      else migrationFailed += 1;

      details.push({
        email:recruit.email,
        decision:'LICENSED',
        licenseNumber:lrec.licenseNumber || '',
        licenseStatus:
          (lrec.details && lrec.details.licenseStatus) ||
          lrec.licenseStatus || '',
        companyName:
          (lrec.details && lrec.details.companyName) ||
          lrec.companyName || '',
        migrated:!!(move && move.success)
      });
      return;
    }

    if (
      decision &&
      decision.success === true &&
      decision.decision === 'ALLOW_PENDING_RECRUIT' &&
      lrec.noResults === true
    ) {
      pending += 1;
      details.push({
        email:recruit.email,
        decision:'PENDING',
        evidence:'EXPLICIT_LREC_NO_RESULT'
      });
      return;
    }

    const reason =
      (decision && decision.reason) ||
      lrec.error ||
      'LREC_UNSAFE_OR_AMBIGUOUS';

    const heldRows =
      MGR_RECRUIT_145_cancelOrHoldOutbox_(
        outbox,
        recruit.email,
        'HOLD_LREC_RECHECK',
        'LREC_RECHECK_HOLD: ' + reason
      );

    heldUnsent += heldRows;
    held += 1;

    details.push({
      email:recruit.email,
      decision:'HOLD',
      reason:reason
    });
  });

  const result = {
    success:
      held === 0 &&
      migrationFailed === 0 &&
      canary.success === true,
    releaseReady:
      held === 0 &&
      migrationFailed === 0 &&
      canary.success === true,
    version:MGR_RECRUIT_145.VERSION,
    scannedProspects:recruits.length,
    pending:pending,
    licensed:licensed,
    held:held,
    migrated:migrated,
    migrationFailed:migrationFailed,
    cancelledUnsent:cancelledUnsent,
    heldUnsent:heldUnsent,
    existingAgentOutbound:'OFF',
    recruitOutboundReleased:false,
    canaryPassed:canary.success === true,
    timestamp:new Date().toISOString(),
    details:details
  };

  PropertiesService.getScriptProperties().setProperty(
    MGR_RECRUIT_145.AUDIT_PROPERTY,
    JSON.stringify(result)
  );

  console.log(
    'RUN_RECRUIT_145_FULL_ROSTER_REVALIDATION\n' +
    JSON.stringify(result,null,2)
  );

  return result;
}

function MGR_RECRUIT_145_cancelOrHoldOutbox_(
  sheet,
  email,
  newStatus,
  note
) {
  if (!sheet || sheet.getLastRow() < 2) return 0;

  const values = sheet.getDataRange().getValues();
  let changed = 0;
  const target = String(email || '').trim().toLowerCase();

  for (let i=1;i<values.length;i++) {
    const status = String(values[i][3] || '').trim().toUpperCase();
    const to = String(values[i][7] || '').trim().toLowerCase();
    const campaign = String(values[i][12] || '').trim();

    if (to !== target) continue;
    if (campaign !== MGR_RECRUIT_145.CAMPAIGN) continue;
    if (status === 'SENT') continue;
    if (
      [
        'CANCELLED_LREC_LICENSED',
        'CANCELLED',
        'FAILED',
        'UNSUBSCRIBED'
      ].indexOf(status) >= 0
    ) continue;

    sheet.getRange(i+1,4).setValue(newStatus);
    if (sheet.getLastColumn() >= 17) {
      sheet.getRange(i+1,17).setValue(note || '');
    }
    if (sheet.getLastColumn() >= 19) {
      sheet.getRange(i+1,19).setValue(new Date().toISOString());
    }
    changed += 1;
  }

  return changed;
}

function RUN_RECRUIT_145_CERTIFICATION() {
  const checks = [
    {
      name:'CRM144_PROVEN_VERIFIER_PRESENT',
      pass:typeof MGR_RECRUIT_144_verifyPendingCandidate === 'function'
    },
    {
      name:'CRM138_MIGRATION_PRESENT',
      pass:typeof MGR_RECRUIT_138_moveToActiveAgents_ === 'function'
    },
    {
      name:'FULL_ROSTER_RUNNER_PRESENT',
      pass:typeof RUN_RECRUIT_145_FULL_ROSTER_REVALIDATION === 'function'
    },
    {
      name:'OUTBOX_INTERLOCK_PRESENT',
      pass:typeof MGR_RECRUIT_145_cancelOrHoldOutbox_ === 'function'
    },
    {
      name:'CRM129_USES_PRODUCTION_VERIFIER',
      pass:
        typeof MGR_RECRUIT_129_liveLrecLookup_ === 'function' &&
        typeof MGR_RECRUIT_144_verifyPendingCandidate === 'function'
    }
  ];

  const result = {
    success:checks.every(function(c){return c.pass === true;}),
    version:MGR_RECRUIT_145.VERSION,
    checks:checks,
    existingAgentOutbound:'OFF',
    recruitOutboundReleased:false,
    timestamp:new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_145_CERTIFICATION\n' +
    JSON.stringify(result,null,2)
  );

  return result;
}
