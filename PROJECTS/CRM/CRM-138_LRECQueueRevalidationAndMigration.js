/**
 * MelroseOS CRM
 * File: CRM-138_LRECQueueRevalidationAndMigration.gs
 * Version: 1.0.0
 *
 * Revalidates currently queued recruit messages using CRM-130 v1.2.
 * Existing license record:
 *   cancel queued recruit message + migrate Prospects row to Active Agents.
 * Clean no-result:
 *   REQUEUE.
 * Error/ambiguous:
 *   HOLD_LREC_RECHECK.
 */

const MGR_RECRUIT_138 = Object.freeze({
  VERSION:'1.0.0',
  ROSTER_ID:'1JK4xYqsic18U_VQ6LrZU_Qg09yDiWkmRpAFdHTMrBIQ',
  ROSTER_SHEET:'Prospects',
  CRM_ID:'1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8',
  OUTBOX_SHEET:'EMAIL_OUTBOX',
  ACTIVE_AGENT_WORKBOOK_ID:'1_IFq26kN310GZtuKDCFKTuDqxD2kx-ntlqio1bp1L0c',
  ACTIVE_AGENT_SHEET:'Active Agents',
  CAMPAIGN:'RECRUIT_MENTORSHIP'
});

function RUN_RECRUIT_LREC_REVALIDATE_AND_REQUEUE() {
  if (typeof MGR_RECRUIT_LREC_lookup !== 'function') {
    throw new Error('CRM-130 v1.2 verifier required.');
  }

  const rosterSS =
    SpreadsheetApp.openById(MGR_RECRUIT_138.ROSTER_ID);

  const roster =
    rosterSS.getSheetByName(MGR_RECRUIT_138.ROSTER_SHEET);

  if (!roster) {
    throw new Error('Prospects roster not found.');
  }

  const crmSS =
    SpreadsheetApp.openById(MGR_RECRUIT_138.CRM_ID);

  const outbox =
    crmSS.getSheetByName(MGR_RECRUIT_138.OUTBOX_SHEET);

  if (!outbox || outbox.getLastRow() < 2) {
    return {
      success:true,
      checked:0,
      cancelledLicensed:0,
      requeuedPending:0,
      held:0
    };
  }

  const rosterData =
    MGR_RECRUIT_138_rosterIndex_(roster);

  const values =
    outbox.getRange(
      2,1,
      outbox.getLastRow()-1,
      outbox.getLastColumn()
    ).getValues();

  let checked = 0;
  let cancelledLicensed = 0;
  let requeuedPending = 0;
  let held = 0;
  let alreadySent = 0;
  const details = [];

  values.forEach(function(row,index) {
    const sheetRow = index + 2;
    const status = String(row[3] || '').toUpperCase();
    const to = String(row[7] || '').trim().toLowerCase();
    const campaign = String(row[12] || '').trim();

    if (campaign !== MGR_RECRUIT_138.CAMPAIGN) return;

    if (status === 'SENT') {
      alreadySent += 1;
      return;
    }

    if (
      ['PENDING','ASSIGNED','REQUEUE','HOLD_LREC_RECHECK']
        .indexOf(status) === -1
    ) return;

    // Quarantine first so sender nodes cannot take/send this row
    // while the live LREC lookup is running.
    outbox.getRange(sheetRow,4).setValue('HOLD_LREC_RECHECK');
    outbox.getRange(sheetRow,19).setValue(new Date().toISOString());

    const recruit = rosterData.byEmail[to];

    if (!recruit) {
      held += 1;
      outbox.getRange(sheetRow,17)
        .setValue('LREC_RECHECK_HOLD: recruit not found in Prospects.');
      details.push({
        email:to,
        action:'HOLD',
        reason:'ROSTER_RECORD_NOT_FOUND'
      });
      return;
    }

    checked += 1;

    const lookup =
      MGR_RECRUIT_LREC_lookup(recruit);

    MGR_RECRUIT_138_writeLiveResult_(
      roster,
      recruit.row,
      lookup
    );

    if (
      lookup.success === true &&
      lookup.recordFound === true
    ) {
      outbox.getRange(sheetRow,4)
        .setValue('CANCELLED_LREC_LICENSED');

      outbox.getRange(sheetRow,17)
        .setValue(
          'Cancelled before send: LREC license record found.'
        );

      outbox.getRange(sheetRow,19)
        .setValue(new Date().toISOString());

      const move =
        MGR_RECRUIT_138_moveToActiveAgents_(
          roster,
          recruit,
          lookup
        );

      cancelledLicensed += 1;

      details.push({
        email:to,
        action:'CANCEL_AND_MIGRATE',
        lrec:lookup,
        migration:move
      });

      return;
    }

    if (
      lookup.success === true &&
      lookup.noResults === true
    ) {
      outbox.getRange(sheetRow,4)
        .setValue('REQUEUE');

      outbox.getRange(sheetRow,5,1,2)
        .clearContent();

      outbox.getRange(sheetRow,17)
        .setValue('');

      outbox.getRange(sheetRow,19)
        .setValue(new Date().toISOString());

      requeuedPending += 1;

      details.push({
        email:to,
        action:'REQUEUE_PENDING',
        lrec:lookup
      });

      return;
    }

    held += 1;

    outbox.getRange(sheetRow,17)
      .setValue(
        'LREC_RECHECK_HOLD: ' +
        String(lookup.error || 'ambiguous result')
      );

    details.push({
      email:to,
      action:'HOLD',
      lrec:lookup
    });
  });

  if (typeof MGR_SENDER_routePendingQueue === 'function') {
    MGR_SENDER_routePendingQueue();
  }

  const result = {
    success:true,
    version:MGR_RECRUIT_138.VERSION,
    checked:checked,
    cancelledLicensed:cancelledLicensed,
    requeuedPending:requeuedPending,
    held:held,
    alreadySent:alreadySent,
    details:details,
    timestamp:new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_LREC_REVALIDATE_AND_REQUEUE\n' +
    JSON.stringify(result,null,2)
  );

  return result;
}

function MGR_RECRUIT_138_rosterIndex_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(h) {
    return String(h || '').trim();
  });

  const map = {};
  headers.forEach(function(h,i) {
    map[String(h).toLowerCase().replace(/[^a-z0-9]/g,'')] = i;
  });

  const byEmail = {};

  for (let i=1;i<values.length;i++) {
    const row = values[i];

    const email = String(
      row[map.email] || ''
    ).trim().toLowerCase();

    if (!email) continue;

    byEmail[email] = {
      row:i+1,
      email:email,
      firstName:String(row[map.firstname] || '').trim(),
      lastName:String(row[map.lastname] || '').trim(),
      phone:String(row[map.phone] || '').trim(),
      credentialNumber:String(row[map.credentialnumber] || '').trim(),
      sourceRecord:MGR_RECRUIT_138_rowObject_(headers,row)
    };
  }

  return {
    headers:headers,
    map:map,
    byEmail:byEmail
  };
}

function MGR_RECRUIT_138_rowObject_(headers,row) {
  const o = {};
  headers.forEach(function(h,i) {
    if (h) o[h] = row[i];
  });
  return o;
}

function MGR_RECRUIT_138_writeLiveResult_(sheet,row,lookup) {
  const headers =
    sheet.getRange(1,1,1,sheet.getLastColumn())
      .getValues()[0]
      .map(function(h){return String(h || '').trim();});

  const fields = {
    'Live LREC Check Status':
      lookup.recordFound ? 'LICENSE_RECORD_FOUND' :
      lookup.noResults ? 'PENDING_NO_RESULTS' :
      'HOLD',
    'Live LREC Checked At':
      lookup.checkedAt || new Date().toISOString(),
    'Live LREC Status':
      lookup.licenseStatus || '',
    'Live LREC Broker Name':
      lookup.sponsoringBroker || '',
    'Live LREC Company Name':
      lookup.companyName || '',
    'Live LREC Raw Result':
      JSON.stringify(lookup)
  };

  Object.keys(fields).forEach(function(name) {
    let col = headers.indexOf(name) + 1;

    if (!col) {
      col = sheet.getLastColumn() + 1;
      sheet.getRange(1,col).setValue(name);
      headers.push(name);
    }

    sheet.getRange(row,col).setValue(fields[name]);
  });
}

function MGR_RECRUIT_138_moveToActiveAgents_(sourceSheet,recruit,lookup) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const activeSS =
      SpreadsheetApp.openById(
        MGR_RECRUIT_138.ACTIVE_AGENT_WORKBOOK_ID
      );

    let active =
      activeSS.getSheetByName(
        MGR_RECRUIT_138.ACTIVE_AGENT_SHEET
      );

    if (!active) {
      active =
        activeSS.insertSheet(
          MGR_RECRUIT_138.ACTIVE_AGENT_SHEET
        );
    }

    const record =
      Object.assign(
        {},
        recruit.sourceRecord || {},
        {
          RecruitingSegment:'ACTIVE_AGENT',
          PreviousRecruitingSegment:'PENDING_RECRUIT',
          LRECVerifiedAt:lookup.checkedAt || new Date().toISOString(),
          LRECLicenseRecord:
            lookup.licenseNumber || '',
          LRECLicenseStatus:
            lookup.licenseStatus || 'License Record Found',
          LRECOwnerName:
            lookup.ownerName || '',
          LRECSearchMode:
            lookup.searchMode || '',
          LRECRawVerificationJSON:
            JSON.stringify(lookup),
          AffiliationDetectedAt:
            new Date().toISOString()
        }
      );

    const existing =
      MGR_RECRUIT_138_findActive_(
        active,
        recruit
      );

    let destinationRow = existing;

    if (!existing) {
      destinationRow =
        MGR_RECRUIT_138_appendObject_(
          active,
          record
        );
    }

    // Re-find source row by email immediately before delete because other
    // migrations may shift row numbers during the sweep.
    const currentSourceRow =
      MGR_RECRUIT_138_findEmailRow_(
        sourceSheet,
        recruit.email
      );

    if (currentSourceRow > 1) {
      sourceSheet.deleteRow(currentSourceRow);
    }

    return {
      success:true,
      moved:!existing,
      alreadyActive:!!existing,
      sourceRemoved:currentSourceRow > 1,
      destinationRow:destinationRow
    };
  } finally {
    lock.releaseLock();
  }
}

function MGR_RECRUIT_138_findActive_(sheet,recruit) {
  if (!sheet || sheet.getLastRow() < 2) return 0;

  const headers =
    sheet.getRange(1,1,1,sheet.getLastColumn())
      .getValues()[0]
      .map(function(h) {
        return String(h || '').trim().toLowerCase()
          .replace(/[^a-z0-9]/g,'');
      });

  const emailCol = headers.indexOf('email') + 1;
  const credCol =
    Math.max(
      headers.indexOf('credentialnumber') + 1,
      headers.indexOf('lreclicenserecord') + 1
    );

  if (emailCol) {
    const hit =
      sheet.getRange(2,emailCol,sheet.getLastRow()-1,1)
        .createTextFinder(recruit.email)
        .matchEntireCell(true)
        .findNext();

    if (hit) return hit.getRow();
  }

  if (credCol && recruit.credentialNumber) {
    const hit =
      sheet.getRange(2,credCol,sheet.getLastRow()-1,1)
        .createTextFinder(recruit.credentialNumber)
        .matchEntireCell(true)
        .findNext();

    if (hit) return hit.getRow();
  }

  return 0;
}

function MGR_RECRUIT_138_findEmailRow_(sheet,email) {
  const headers =
    sheet.getRange(1,1,1,sheet.getLastColumn())
      .getValues()[0]
      .map(function(h) {
        return String(h || '').trim().toLowerCase()
          .replace(/[^a-z0-9]/g,'');
      });

  const col = headers.indexOf('email') + 1;
  if (!col || sheet.getLastRow() < 2) return 0;

  const hit =
    sheet.getRange(2,col,sheet.getLastRow()-1,1)
      .createTextFinder(email)
      .matchEntireCell(true)
      .findNext();

  return hit ? hit.getRow() : 0;
}

function MGR_RECRUIT_138_appendObject_(sheet,object) {
  let headers = [];

  if (sheet.getLastColumn() > 0) {
    headers =
      sheet.getRange(1,1,1,sheet.getLastColumn())
        .getValues()[0]
        .map(function(h){return String(h || '').trim();});
  }

  const missing =
    Object.keys(object).filter(function(k) {
      return headers.indexOf(k) === -1;
    });

  if (missing.length) {
    const start = headers.length + 1;
    sheet.getRange(1,start,1,missing.length)
      .setValues([missing]);
    headers = headers.concat(missing);
  }

  const row =
    headers.map(function(h) {
      return Object.prototype.hasOwnProperty.call(object,h)
        ? object[h]
        : '';
    });

  sheet.appendRow(row);
  sheet.setFrozenRows(1);
  return sheet.getLastRow();
}

function RUN_RECRUIT_138_CERTIFICATION() {
  const checks = [
    {
      name:'CRM130_V12',
      pass:
        typeof MGR_RECRUIT_LREC_lookup === 'function' &&
        typeof MGR_LREC_LIVE !== 'undefined' &&
        MGR_LREC_LIVE.VERSION === '1.2.0'
    },
    {
      name:'REAL_ESTATE_LICENSE_TYPE_DYNAMIC',
      pass:
        typeof MGR_LREC_parseSearchForm_ === 'function'
    },
    {
      name:'QUEUE_REVALIDATOR_PRESENT',
      pass:
        typeof RUN_RECRUIT_LREC_REVALIDATE_AND_REQUEUE === 'function'
    }
  ];

  const result = {
    success:checks.every(function(c){return c.pass;}),
    checks:checks,
    timestamp:new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_138_CERTIFICATION\n' +
    JSON.stringify(result,null,2)
  );

  return result;
}
