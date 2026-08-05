/******************************************************************************
 * MelroseOS
 * File: BCC-01_LegacyRouteBridge.gs
 * Version: 1.0.1
 *
 * Safe compatibility route for legacy Broker Command Center requests.
 ******************************************************************************/

const MOS5_BCC_LEGACY_BRIDGE_VERSION = "1.0.1";

/**
 * Legacy doGet compatibility handler.
 *
 * @param {Object=} e
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function MOS5BCC_legacyDoGet_(e) {
  try {
    return HtmlService
      .createTemplateFromFile("BCC-01_CommandCenter")
      .evaluate()
      .setTitle("MelroseOS Broker Command Center")
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.ALLOWALL
      );
  } catch (error) {
    return HtmlService
      .createHtmlOutput(
        "<!doctype html>" +
        "<html>" +
        "<head><base target=\"_top\"></head>" +
        "<body style=\"font-family:Arial,sans-serif;padding:24px\">" +
        "<h2>MelroseOS Broker Command Center</h2>" +
        "<p>The command-center template could not be loaded.</p>" +
        "<p>No production operation was performed.</p>" +
        "<pre>" +
        MOS5BCC_escapeHtml_(error && error.message) +
        "</pre>" +
        "</body>" +
        "</html>"
      )
      .setTitle("MelroseOS Broker Command Center");
  }
}

/**
 * Escapes diagnostic text before displaying it in HTML.
 *
 * @param {*} value
 * @return {string}
 */
function MOS5BCC_escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Read-only bridge diagnostics.
 *
 * @return {Object}
 */
function MOS5BCC_runLegacyRouteBridgeDiagnostics() {
  const result = {
    release: "MOS5-BCC-LEGACY-ROUTE-BRIDGE",
    version: MOS5_BCC_LEGACY_BRIDGE_VERSION,
    legacyHandlerAvailable:
      typeof MOS5BCC_legacyDoGet_ === "function",
    templateName: "BCC-01_CommandCenter",
    productionChanged: false,
    completedAt: new Date().toISOString()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}