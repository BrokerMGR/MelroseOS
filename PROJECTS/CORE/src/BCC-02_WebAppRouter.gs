function doGet(e) {
  const app = String(
    e && e.parameter && e.parameter.app
      ? e.parameter.app
      : ''
  ).trim().toLowerCase();

  if (app === 'bcc' || app === 'broker') {
    return MOS5BCC_renderWebApp_(e);
  }

  if (typeof MOS5BCC_legacyDoGet_ === 'function') {
    return MOS5BCC_legacyDoGet_(e);
  }

  return HtmlService
    .createHtmlOutput(
      '<!DOCTYPE html><html><head><base target="_top"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{font-family:Arial,sans-serif;background:#f4f6f9;color:#172033;' +
      'padding:40px}.card{max-width:720px;margin:auto;background:white;padding:30px;' +
      'border-radius:14px;box-shadow:0 12px 30px rgba(16,35,63,.08)}' +
      'a{display:inline-block;margin-top:16px;background:#10233f;color:white;' +
      'padding:11px 16px;border-radius:8px;text-decoration:none}</style></head>' +
      '<body><div class="card"><h2>MelroseOS</h2>' +
      '<p>No legacy web route was found in the synchronized Core source.</p>' +
      '<p>The Broker Command Center is available through the broker route.</p>' +
      '<a href="?app=bcc">Open Broker Command Center</a></div></body></html>'
    )
    .setTitle('MelroseOS');
}

function MOS5BCC_renderWebApp_(e) {
  MOS5BCC_assertCore_();
  MOS5BCC_assertBroker_();

  return HtmlService
    .createTemplateFromFile(MOS5BCC_CONFIG.htmlFile)
    .evaluate()
    .setTitle('MelroseOS Broker Command Center')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function MOS5BCC_getWebAppRouteInfo() {
  MOS5BCC_assertCore_();

  return {
    success: true,
    routeParameter: 'app=bcc',
    alternateRouteParameter: 'app=broker',
    deploymentRequired: true,
    expectedAccess: 'Broker-only',
    legacyRouteAvailable:
      typeof MOS5BCC_legacyDoGet_ === 'function',
    completedAt: new Date().toISOString()
  };
}
