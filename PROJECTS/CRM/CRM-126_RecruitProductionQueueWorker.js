/**
 * MelroseOS CRM
 * File: CRM-126_RecruitProductionQueueWorker.gs
 * Version: 1.2.0
 *
 * Production queue worker.
 * Critical rule: every pending-recruit message is LREC-verified immediately
 * before enqueue through CRM-129.
 */

const MGR_RECRUIT_WORKER_VERSION = '1.2.0';

const MGR_RECRUIT_WORKER = Object.freeze({
  MAX_QUEUE_PER_TICK: 12,
  STATE_SHEET: 'RECRUIT_COMM_STATE',
  REQUIRED_HEADERS: Object.freeze([
    'email',
    'credentialnumber',
    'applicationdate'
  ]),
  FIRST_NAME_HEADERS: Object.freeze(['firstname','first','givenname']),
  LAST_NAME_HEADERS: Object.freeze(['lastname','last','surname']),
  STATUS_HEADERS: Object.freeze(['status','affiliationstatus','licensestatus']),
  UNSUB_HEADERS: Object.freeze(['unsubscribed','unsubscribe','optout']),
  DNC_HEADERS: Object.freeze(['donotcontact','dnc']),
  REPLIED_HEADERS: Object.freeze(['replied','replyreceived'])
});

function MGR_RECRUIT_processProductionQueue() {
  const production = MGR_RECRUIT_getProductionState();

  if (!production.enabled || production.testMode) {
    return {success:true, queued:0, reason:'NOT_LIVE'};
  }

  if (!MGR_RECRUIT_startReached_(production.startAt)) {
    return {
      success:true,
      queued:0,
      reason:'START_TIME_NOT_REACHED',
      startAt:production.startAt
    };
  }

  if (typeof MGR_SENDER_enqueue !== 'function') {
    throw new Error('RECRUIT_QUEUE_BLOCK: MGR_SENDER_enqueue unavailable.');
  }

  if (typeof MGR_RECRUIT_getFirstFive_ !== 'function') {
    throw new Error('RECRUIT_QUEUE_BLOCK: CRM-114 recruit sequence unavailable.');
  }

  if (typeof MGR_RECRUIT_129_beforePendingSend !== 'function') {
    throw new Error('RECRUIT_QUEUE_BLOCK: CRM-129 LREC status gate unavailable.');
  }

  const roster = MGR_RECRUIT_findRoster_();

  if (!roster) {
    throw new Error('RECRUIT_QUEUE_BLOCK: No locked/valid recruit roster source found.');
  }

  const stateSheet = MGR_RECRUIT_ensureStateSheet_();
  const values = roster.sheet.getDataRange().getValues();

  if (values.length < 2) {
    return {success:true, queued:0, reason:'ROSTER_EMPTY'};
  }

  const headerMap = roster.headerMap;
  const now = new Date();
  const queued = [];
  const skipped = [];
  const transitioned = [];

  for (
    let r = 1;
    r < values.length &&
    queued.length < MGR_RECRUIT_WORKER.MAX_QUEUE_PER_TICK;
    r++
  ) {
    const record = MGR_RECRUIT_rowToRecord_(values[r], headerMap);

    if (!record.email) continue;

    const basicGate = MGR_RECRUIT_canCommunicate(record);

    if (!basicGate.eligible) {
      skipped.push({email:record.email, reasons:basicGate.reasons});
      continue;
    }

    const state = MGR_RECRUIT_getState_(stateSheet, record.email);

    if (
      state.completed === true ||
      Number(state.lastSequence || 0) >= 5
    ) {
      continue;
    }

    if (!MGR_RECRUIT_isDue_(state.lastSentAt, now)) {
      continue;
    }

    const sequence = Number(state.lastSequence || 0) + 1;

    const message = MGR_RECRUIT_getFirstFive_({
      firstName: record.firstName || 'Future Agent',
      credentialNumber: record.credentialNumber,
      applicationDate: record.applicationDate
    })[sequence - 1];

    if (!message) continue;

    const lrecGate = MGR_RECRUIT_129_beforePendingSend(
      {
        email: record.email,
        firstName: record.firstName,
        lastName: record.lastName,
        credentialNumber: record.credentialNumber,
        licenseNumber: record.credentialNumber,
        applicationDate: record.applicationDate
      },
      {
        subject: message.subject,
        htmlBody: message.html
      }
    );

    if (!lrecGate.allowSend) {
      skipped.push({
        email: record.email,
        reasons: [lrecGate.reason],
        route: lrecGate.route
      });

      if (
        lrecGate.route === 'EXISTING_AGENT_PENDING_WORKFLOW'
      ) {
        transitioned.push({
          email: record.email,
          reason: lrecGate.reason
        });
      }

      continue;
    }

    const dedupeKey = [
      'RECRUIT_MENTORSHIP',
      record.email,
      sequence
    ].join('|');

    const enqueueResult = MGR_SENDER_enqueue({
      to: record.email,
      subject: message.subject,
      htmlBody: message.html,
      campaign:'RECRUIT_MENTORSHIP',
      messageClass:'RECRUITING',
      leadId:record.credentialNumber || record.email,
      sequence:sequence,
      dedupeKey:dedupeKey
    });

    if (enqueueResult && enqueueResult.success) {
      MGR_RECRUIT_updateState_(
        stateSheet,
        record,
        sequence,
        now,
        enqueueResult.messageId || ''
      );

      queued.push({
        email:record.email,
        sequence:sequence,
        messageId:enqueueResult.messageId || '',
        duplicate:enqueueResult.duplicate === true
      });
    }
  }

  const result = {
    success:true,
    version:MGR_RECRUIT_WORKER_VERSION,
    rosterSpreadsheet:
      roster.spreadsheet ? roster.spreadsheet.getName() : '',
    rosterSheet:roster.sheet.getName(),
    scannedRows:Math.max(0,values.length - 1),
    queuedCount:queued.length,
    skippedCount:skipped.length,
    transitionedCount:transitioned.length,
    queued:queued,
    skipped:skipped.slice(0,25),
    transitioned:transitioned.slice(0,25),
    timestamp:new Date().toISOString()
  };

  console.log(
    'MGR_RECRUIT_processProductionQueue\n' +
    JSON.stringify(result,null,2)
  );

  return result;
}

function MGR_RECRUIT_findRoster_() {
  if (typeof MGR_RECRUIT_getLockedRoster_ === 'function') {
    const locked = MGR_RECRUIT_getLockedRoster_();
    if (locked) return locked;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;

  const candidates = [];

  ss.getSheets().forEach(function(sheet) {
    if (sheet.getLastColumn() < 1 || sheet.getLastRow() < 1) return;

    const headers = sheet
      .getRange(1,1,1,sheet.getLastColumn())
      .getDisplayValues()[0];

    const map = MGR_RECRUIT_headerMap_(headers);

    const hasRequired = MGR_RECRUIT_WORKER.REQUIRED_HEADERS.every(
      function(name) { return map[name] !== undefined; }
    );

    if (hasRequired) {
      candidates.push({
        spreadsheet:ss,
        sheet:sheet,
        headerMap:map,
        score:MGR_RECRUIT_rosterScore_(sheet.getName(),headers)
      });
    }
  });

  candidates.sort(function(a,b){return b.score-a.score;});
  return candidates.length ? candidates[0] : null;
}

function MGR_RECRUIT_rosterScore_(sheetName, headers) {
  const name = String(sheetName || '').toLowerCase();
  let score = 0;

  ['recruit','new agent','newagent','pending','lrec','applicant'].forEach(
    function(token){if(name.indexOf(token)>=0)score+=10;}
  );

  const normalized = headers.map(MGR_RECRUIT_normalizeHeader_);
  if (normalized.indexOf('firstname') >= 0) score += 3;
  if (normalized.indexOf('status') >= 0) score += 2;

  return score;
}

function MGR_RECRUIT_headerMap_(headers) {
  const map = {};
  headers.forEach(function(header,index){
    const n=MGR_RECRUIT_normalizeHeader_(header);
    if(n)map[n]=index;
  });
  return map;
}

function MGR_RECRUIT_normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
}

function MGR_RECRUIT_firstValue_(row,map,candidates) {
  for(let i=0;i<candidates.length;i++){
    const key=candidates[i];
    if(map[key]!==undefined){
      const value=row[map[key]];
      if(value!==''&&value!==null&&value!==undefined)return value;
    }
  }
  return '';
}

function MGR_RECRUIT_rowToRecord_(row,map) {
  return {
    firstName:String(MGR_RECRUIT_firstValue_(row,map,MGR_RECRUIT_WORKER.FIRST_NAME_HEADERS)||'').trim(),
    lastName:String(MGR_RECRUIT_firstValue_(row,map,MGR_RECRUIT_WORKER.LAST_NAME_HEADERS)||'').trim(),
    email:String(row[map.email]||'').trim().toLowerCase(),
    credentialNumber:String(row[map.credentialnumber]||'').trim(),
    applicationDate:MGR_RECRUIT_formatDateValue_(row[map.applicationdate]),
    status:String(MGR_RECRUIT_firstValue_(row,map,MGR_RECRUIT_WORKER.STATUS_HEADERS)||'').trim(),
    unsubscribed:MGR_RECRUIT_firstValue_(row,map,MGR_RECRUIT_WORKER.UNSUB_HEADERS),
    doNotContact:MGR_RECRUIT_firstValue_(row,map,MGR_RECRUIT_WORKER.DNC_HEADERS),
    replied:MGR_RECRUIT_firstValue_(row,map,MGR_RECRUIT_WORKER.REPLIED_HEADERS)
  };
}

function MGR_RECRUIT_formatDateValue_(value) {
  if (
    Object.prototype.toString.call(value)==='[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone()||'America/Chicago',
      'MM/dd/yyyy'
    );
  }
  return String(value||'').trim();
}

function MGR_RECRUIT_ensureStateSheet_() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('RECRUIT_STATE_BLOCK: CRM active spreadsheet unavailable.');

  let sheet=ss.getSheetByName(MGR_RECRUIT_WORKER.STATE_SHEET);
  const headers=[
    'Email','CredentialNumber','FirstName','LastSequence',
    'LastSentAt','LastMessageID','Completed','UpdatedAt'
  ];

  if(!sheet)sheet=ss.insertSheet(MGR_RECRUIT_WORKER.STATE_SHEET);

  if(sheet.getLastRow()===0){
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function MGR_RECRUIT_getState_(sheet,email) {
  if(sheet.getLastRow()<2){
    return {email:email,lastSequence:0,lastSentAt:'',lastMessageId:'',completed:false,row:0};
  }

  const match=sheet
    .getRange(2,1,sheet.getLastRow()-1,1)
    .createTextFinder(email)
    .matchEntireCell(true)
    .findNext();

  if(!match){
    return {email:email,lastSequence:0,lastSentAt:'',lastMessageId:'',completed:false,row:0};
  }

  const row=match.getRow();
  const v=sheet.getRange(row,1,1,8).getValues()[0];

  return {
    email:String(v[0]||''),
    credentialNumber:String(v[1]||''),
    firstName:String(v[2]||''),
    lastSequence:Number(v[3]||0),
    lastSentAt:v[4]||'',
    lastMessageId:String(v[5]||''),
    completed:v[6]===true||String(v[6]).toLowerCase()==='true',
    row:row
  };
}

function MGR_RECRUIT_updateState_(sheet,record,sequence,sentAt,messageId) {
  const existing=MGR_RECRUIT_getState_(sheet,record.email);
  const completed=Number(sequence)>=5;

  const values=[[
    record.email,
    record.credentialNumber,
    record.firstName,
    Number(sequence),
    sentAt,
    String(messageId||''),
    completed,
    new Date().toISOString()
  ]];

  if(existing.row){
    sheet.getRange(existing.row,1,1,8).setValues(values);
  }else{
    sheet.appendRow(values[0]);
  }
}

function MGR_RECRUIT_isDue_(lastSentAt,now) {
  if(!lastSentAt)return true;
  const last=new Date(lastSentAt);
  if(isNaN(last.getTime()))return true;
  return (now.getTime()-last.getTime()) >=
    MGR_RECRUIT_PROD.CADENCE_DAYS*24*60*60*1000;
}

function MGR_RECRUIT_startReached_(startAt) {
  if(!startAt)return true;
  const start=new Date(startAt);
  if(isNaN(start.getTime()))return true;
  return Date.now()>=start.getTime();
}

function RUN_RECRUIT_QUEUE_WORKER_DIAGNOSTICS() {
  const roster=MGR_RECRUIT_findRoster_();

  const result={
    success:
      !!roster &&
      typeof MGR_RECRUIT_129_beforePendingSend==='function' &&
      typeof MGR_RECRUIT_LREC_lookup==='function',
    version:MGR_RECRUIT_WORKER_VERSION,
    rosterDetected:!!roster,
    rosterSpreadsheet:
      roster&&roster.spreadsheet?roster.spreadsheet.getName():'',
    rosterSheet:roster?roster.sheet.getName():'',
    productionWorkerPresent:
      typeof MGR_RECRUIT_processProductionQueue==='function',
    senderEnqueuePresent:
      typeof MGR_SENDER_enqueue==='function',
    sequenceEnginePresent:
      typeof MGR_RECRUIT_getFirstFive_==='function',
    stopGatePresent:
      typeof MGR_RECRUIT_canCommunicate==='function',
    lrecGatePresent:
      typeof MGR_RECRUIT_129_beforePendingSend==='function',
    liveLrecVerifierPresent:
      typeof MGR_RECRUIT_LREC_lookup==='function',
    rosterLockPresent:
      typeof MGR_RECRUIT_getLockedRoster_==='function',
    timestamp:new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_QUEUE_WORKER_DIAGNOSTICS\n'+
    JSON.stringify(result,null,2)
  );

  return result;
}
