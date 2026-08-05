/******************************************************************************
 * MelroseOS Enterprise
 * Agent Accountability + Lead SLA
 * File: AC-01_AccountabilityCore.gs
 * Version: 1.0.0
 ******************************************************************************/

const AC = {
  VERSION: "1.0.0",
  SHEETS: {
    CONFIG: "AC_SLA_CONFIG",
    TRACKING: "AC_LEAD_SLA",
    ALERTS: "AC_ALERT_LOG",
    METRICS: "AC_AGENT_METRICS"
  },
  DEFAULTS: {
    FIRST_CONTACT_MINUTES: 15,
    ESCALATION_MINUTES: 30,
    REPEAT_ALERT_MINUTES: 120,
    BROKER_EMAIL: "melrosegroupbroker@gmail.com",
    SEND_AGENT_ALERTS: true,
    SEND_BROKER_ESCALATIONS: true
  },
  TERMINAL_STATUSES: [
    "CONTACTED",
    "CONSULTATION_SCHEDULED",
    "CONSULTATION_COMPLETED",
    "ACTIVE_CLIENT",
    "UNDER_CONTRACT",
    "CLOSED",
    "NURTURE",
    "LOST",
    "DO_NOT_CONTACT"
  ]
};

function AC_initialize() {
  const ss = workbook_();

  Object.keys(AC.SHEETS).forEach(function(k) {
    createSheetIfMissing_(ss, AC.SHEETS[k]);
  });

  AC_headers_(ss.getSheetByName(AC.SHEETS.CONFIG),
    ["Setting","Value","Description","UpdatedAt"]);
  AC_headers_(ss.getSheetByName(AC.SHEETS.TRACKING),
    ["LeadID","AgentID","AgentName","AgentEmail","LeadName","LeadEmail","LeadPhone",
     "LeadType","Parish","AssignedAt","FirstContactDueAt","EscalationDueAt",
     "FirstContactAt","SLAStatus","LastAlertAt","EscalatedAt","CurrentLifecycleStatus","UpdatedAt"]);
  AC_headers_(ss.getSheetByName(AC.SHEETS.ALERTS),
    ["AlertID","LeadID","AgentID","AlertType","Recipient","Status","Details","CreatedAt"]);
  AC_headers_(ss.getSheetByName(AC.SHEETS.METRICS),
    ["AgentID","AgentName","AssignedLeads","ContactedWithinSLA","MissedSLA","OpenOverdue",
     "Escalated","SLACompliancePct","AvgFirstContactMinutes","UpdatedAt"]);

  AC_seedConfig_();
  return {success:true, version:AC.VERSION};
}

function AC_headers_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    autoResize_(sheet);
  }
}

function AC_seedConfig_() {
  const sheet = workbook_().getSheetByName(AC.SHEETS.CONFIG);
  if (sheet.getLastRow() > 1) return;

  const rows = [
    ["FIRST_CONTACT_MINUTES", AC.DEFAULTS.FIRST_CONTACT_MINUTES,
      "Minutes from assignment until first-contact SLA is due.", timestamp_()],
    ["ESCALATION_MINUTES", AC.DEFAULTS.ESCALATION_MINUTES,
      "Minutes from assignment until an overdue lead escalates to broker.", timestamp_()],
    ["REPEAT_ALERT_MINUTES", AC.DEFAULTS.REPEAT_ALERT_MINUTES,
      "Minimum minutes before another overdue alert for the same lead.", timestamp_()],
    ["BROKER_EMAIL", AC.DEFAULTS.BROKER_EMAIL,
      "Broker escalation email.", timestamp_()],
    ["SEND_AGENT_ALERTS", AC.DEFAULTS.SEND_AGENT_ALERTS,
      "TRUE/FALSE: email assigned agent when SLA is overdue.", timestamp_()],
    ["SEND_BROKER_ESCALATIONS", AC.DEFAULTS.SEND_BROKER_ESCALATIONS,
      "TRUE/FALSE: email broker when escalation threshold is reached.", timestamp_()]
  ];
  sheet.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}

function AC_getConfig_() {
  AC_initialize();
  const rows = AC_objects_(AC.SHEETS.CONFIG);
  const c = {};
  rows.forEach(function(r){ c[String(r.Setting)] = r.Value; });

  return {
    firstContactMinutes: Number(c.FIRST_CONTACT_MINUTES || AC.DEFAULTS.FIRST_CONTACT_MINUTES),
    escalationMinutes: Number(c.ESCALATION_MINUTES || AC.DEFAULTS.ESCALATION_MINUTES),
    repeatAlertMinutes: Number(c.REPEAT_ALERT_MINUTES || AC.DEFAULTS.REPEAT_ALERT_MINUTES),
    brokerEmail: String(c.BROKER_EMAIL || AC.DEFAULTS.BROKER_EMAIL),
    sendAgentAlerts: AC_bool_(c.SEND_AGENT_ALERTS, true),
    sendBrokerEscalations: AC_bool_(c.SEND_BROKER_ESCALATIONS, true)
  };
}

function AC_bool_(v, fallback) {
  if (v === true || String(v).toUpperCase() === "TRUE") return true;
  if (v === false || String(v).toUpperCase() === "FALSE") return false;
  return fallback;
}

function AC_objects_(sheetName) {
  const sheet = workbook_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift().map(function(x){return String(x||"").trim();});
  return data.filter(function(r){
    return r.some(function(v){return String(v||"").trim()!=="";});
  }).map(function(r,i){
    const o={_row:i+2};
    headers.forEach(function(h,j){o[h]=r[j];});
    return o;
  });
}

function AC_findTracking_(leadId) {
  const target=String(leadId||"").trim();
  const rows=AC_objects_(AC.SHEETS.TRACKING);
  for (let i=0;i<rows.length;i++) {
    if (String(rows[i].LeadID||"").trim()===target) return rows[i];
  }
  return null;
}

function AC_set_(sheet,row,header,value) {
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  const col=headers.indexOf(header)+1;
  if (!col) throw new Error("Missing header: "+header);
  sheet.getRange(row,col).setValue(value);
}

function AC_testCore() {
  const result=AC_initialize();
  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(AC_getConfig_()));
  return true;
}
