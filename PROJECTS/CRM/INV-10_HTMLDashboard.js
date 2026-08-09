/******************************************************************************
 * MelroseOS Enterprise
 * Module 0 - Inventory & Diagnostics
 * File: INV-10_HTMLDashboard.gs
 * Version: 1.0.0
 *
 * Requires:
 *   INV-01_Core.gs
 *   INV-08_Diagnostics.gs
 *   INV-09_ReportBuilder.gs
 ******************************************************************************/

const M5_DASHBOARD_TITLE = "MelroseOS Inventory Dashboard";

function M5_showInventoryDashboard() {
  const html = HtmlService
    .createHtmlOutput(M5_buildInventoryDashboardHtml_())
    .setTitle(M5_DASHBOARD_TITLE);

  SpreadsheetApp.getUi().showSidebar(html);
}

function M5_buildInventoryDashboardHtml_() {
  const data = M5_getInventoryDashboardData_();
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="utf-8">
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;background:#f5f7fa;color:#172033}
    .wrap{padding:18px}
    h1{font-size:20px;margin:0 0 4px}
    .sub{font-size:12px;color:#667085;margin-bottom:16px}
    .hero{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:16px;margin-bottom:14px}
    .score{font-size:38px;font-weight:700}
    .status{font-size:13px;font-weight:700;margin-top:4px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .card{background:#fff;border:1px solid #e4e7ec;border-radius:10px;padding:12px}
    .label{font-size:11px;color:#667085}
    .value{font-size:22px;font-weight:700;margin-top:4px}
    .section{margin-top:16px}
    .section h2{font-size:14px;margin:0 0 8px}
    .action{background:#fff;border:1px solid #e4e7ec;border-radius:8px;padding:10px;margin-bottom:7px;font-size:12px}
    button{width:100%;border:0;border-radius:8px;padding:11px;margin-top:8px;font-weight:700;cursor:pointer;background:#1f4e78;color:#fff}
    button.secondary{background:#344054}
    .foot{font-size:10px;color:#98a2b3;margin-top:14px;text-align:center}
  </style>
</head>
<body>
<div class="wrap">
  <h1>${M5_escapeHtml_(M5_DASHBOARD_TITLE)}</h1>
  <div class="sub">${M5_escapeHtml_(data.workbook)} · ${M5_escapeHtml_(data.generated)}</div>

  <div class="hero">
    <div class="label">Migration Readiness</div>
    <div class="score">${data.readinessScore}</div>
    <div class="status">${M5_escapeHtml_(data.readinessStatus)}</div>
  </div>

  <div class="grid">
    <div class="card"><div class="label">Diagnostics</div><div class="value">${data.diagnostics}</div></div>
    <div class="card"><div class="label">Critical</div><div class="value">${data.critical}</div></div>
    <div class="card"><div class="label">High</div><div class="value">${data.high}</div></div>
    <div class="card"><div class="label">Orphans</div><div class="value">${data.orphans}</div></div>
    <div class="card"><div class="label">Relationships</div><div class="value">${data.relationships}</div></div>
    <div class="card"><div class="label">Triggers</div><div class="value">${data.triggers}</div></div>
  </div>

  <div class="section">
    <h2>Recommended Actions</h2>
    <div id="actions"></div>
  </div>

  <div class="section">
    <h2>Run Tools</h2>
    <button onclick="run('full')">Run Full Inventory</button>
    <button class="secondary" onclick="run('diagnostics')">Run Diagnostics</button>
    <button class="secondary" onclick="run('report')">Build Migration Report</button>
  </div>

  <div class="foot">MelroseOS Inventory & Diagnostics v${M5_escapeHtml_(String(typeof M5 !== "undefined" ? M5.VERSION : ""))}</div>
</div>

<script>
const DATA=${json};

function renderActions(){
  const box=document.getElementById('actions');
  if(!DATA.actions.length){
    box.innerHTML='<div class="action">No immediate actions reported.</div>';
    return;
  }
  DATA.actions.forEach(function(a){
    const d=document.createElement('div');
    d.className='action';
    d.textContent=a;
    box.appendChild(d);
  });
}

function run(type){
  const map={
    full:'M5_runFullInventorySuite',
    diagnostics:'M5_runDiagnostics',
    report:'M5_buildMigrationReport'
  };
  const fn=map[type];
  if(!fn)return;
  google.script.run
    .withSuccessHandler(function(){google.script.host.close();})
    .withFailureHandler(function(e){alert(e.message||e);})
    [fn]();
}
renderActions();
</script>
</body>
</html>`;
}

function M5_getInventoryDashboardData_() {
  const ss = workbook_();
  const severity = M5_dashboardSeverityCounts_(ss);

  return {
    workbook: ss.getName(),
    generated: timestamp_(),
    readinessStatus: getDocProperty_("M5_MIGRATION_READINESS") || "NOT EVALUATED",
    readinessScore: Number(getDocProperty_("M5_MIGRATION_READINESS_SCORE") || 0),
    diagnostics: M5_dashboardRowCount_(ss, "DIAGNOSTICS"),
    critical: severity.CRITICAL,
    high: severity.HIGH,
    orphans: M5_dashboardRowCount_(ss, "ORPHAN_RECORDS"),
    relationships: M5_dashboardRowCount_(ss, "RELATIONSHIPS"),
    triggers: M5_dashboardRowCount_(ss, "AUTOMATION_INVENTORY"),
    actions: M5_dashboardActions_(ss)
  };
}

function M5_dashboardSeverityCounts_(ss) {
  const counts = {CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0,INFO:0};
  const sheet = ss.getSheetByName("DIAGNOSTICS");
  if (!sheet || sheet.getLastRow() < 2) return counts;

  sheet.getRange(2,2,sheet.getLastRow()-1,1).getDisplayValues()
    .forEach(function(row){
      const key=String(row[0]||"").toUpperCase();
      if(counts.hasOwnProperty(key)) counts[key]++;
    });

  return counts;
}

function M5_dashboardActions_(ss) {
  const actions = [];
  const status = getDocProperty_("M5_MIGRATION_READINESS") || "";

  if (status === "BLOCKED") actions.push("Resolve all critical diagnostics before migration.");
  if (M5_dashboardRowCount_(ss,"ORPHAN_RECORDS") > 0) actions.push("Resolve or approve orphan-record exceptions.");
  if (M5_dashboardRowCount_(ss,"AUTOMATION_WARNINGS") > 0) actions.push("Review automation warnings and duplicate triggers.");
  if (M5_dashboardRowCount_(ss,"DATA_QUALITY_ISSUES") > 0) actions.push("Review data-quality findings before production cutover.");
  if (!actions.length && status === "READY") actions.push("Proceed to controlled migration validation.");
  if (!actions.length) actions.push("Run the full inventory suite to refresh readiness.");

  return actions;
}

function M5_dashboardRowCount_(ss, name) {
  const sheet=ss.getSheetByName(name);
  return sheet ? Math.max(sheet.getLastRow()-1,0) : 0;
}

function M5_escapeHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function M5_runFullInventorySuite() {
  const result = {};

  if (typeof M5_scanWorkbook === "function") result.workbook = M5_scanWorkbook();
  if (typeof M5_scanHeaders === "function") result.headers = M5_scanHeaders();
  if (typeof M5_runDataProfiler === "function") result.profile = M5_runDataProfiler();
  if (typeof M5_runRelationshipScanner === "function") result.relationships = M5_runRelationshipScanner();
  if (typeof M5_runAutomationScanner === "function") result.automations = M5_runAutomationScanner();
  if (typeof M5_runDiagnostics === "function") result.diagnostics = M5_runDiagnostics();
  if (typeof M5_buildMigrationReport === "function") result.report = M5_buildMigrationReport();

  return result;
}

function M5_testHTMLDashboard() {
  const html=M5_buildInventoryDashboardHtml_();
  if(!html || html.indexOf("MelroseOS Inventory Dashboard")===-1){
    throw new Error("Dashboard HTML generation failed.");
  }
  Logger.log("Dashboard HTML generated successfully.");
  return true;
}
