/**
 * MelroseOS Website
 * File: WEB-24_UnsubscribeEndpointRunner.gs
 * Release: MOS5-WEB-24
 * Version: 1.0.0
 *
 * Purpose:
 * Provide obvious runner functions that print the WEBSITE unsubscribe
 * web-app endpoint directly into the Apps Script execution log.
 */

/**
 * Run this from the WEBSITE Apps Script function picker.
 *
 * @return {Object}
 */
function RUN_WEBSITE_UNSUBSCRIBE_ENDPOINT() {
  const result =
    MGR_WEB_getEmailUnsubscribeEndpoint();

  console.log(
    'RUN_WEBSITE_UNSUBSCRIBE_ENDPOINT\n' +
    JSON.stringify(result, null, 2)
  );

  if (
    result &&
    result.success === true &&
    result.url
  ) {
    console.log(
      'UNSUBSCRIBE WEB APP URL:\n' +
      result.url
    );
  } else {
    console.error(
      'NO WEBSITE WEB APP URL DETECTED.\n' +
      'The WEBSITE Apps Script project may not currently have an active web-app deployment.'
    );
  }

  return result;
}

/**
 * Optional diagnostics runner.
 *
 * @return {Object}
 */
function RUN_WEBSITE_UNSUBSCRIBE_DIAGNOSTICS() {
  const result =
    MGR_WEB_emailUnsubscribeDiagnostics();

  console.log(
    'RUN_WEBSITE_UNSUBSCRIBE_DIAGNOSTICS\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
