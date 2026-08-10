/**
 * MelroseOS CRM
 * File: CRM-130_LiveLRECVerifier.gs
 * Version: 1.0.0
 *
 * Live fail-closed verifier against the official LREC public Verify License Search.
 * Official source: https://portal.lrec.gov/public/search
 *
 * Design:
 * - Fetches the public search form live.
 * - Dynamically discovers the form action + License Number input name.
 * - Preserves hidden form tokens and session cookie when submitting.
 * - Searches by recruit credential/license number.
 * - Parses status/company only when the response is sufficiently clear.
 * - Returns success=false if the portal changes or parsing is ambiguous.
 */

const MGR_LREC_LIVE = Object.freeze({
  VERSION: '1.0.0',
  SEARCH_URL: 'https://portal.lrec.gov/public/search',
  SOURCE: 'LREC_PUBLIC_PORTAL'
});

function MGR_RECRUIT_LREC_lookup(recruit) {
  const r = recruit || {};
  const licenseNumber = String(
    r.licenseNumber ||
    r.credentialNumber ||
    r.CredentialNumber ||
    ''
  ).trim();

  if (!licenseNumber) {
    return MGR_LREC_result_(false, {
      licenseNumber: '',
      error: 'MISSING_LICENSE_NUMBER'
    });
  }

  try {
    const landing = UrlFetchApp.fetch(
      MGR_LREC_LIVE.SEARCH_URL,
      {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 MelroseOS-LREC-Verifier'
        }
      }
    );

    const landingCode = landing.getResponseCode();
    const landingHtml = landing.getContentText();

    if (landingCode < 200 || landingCode >= 400 || !landingHtml) {
      return MGR_LREC_result_(false, {
        licenseNumber: licenseNumber,
        error: 'LREC_SEARCH_PAGE_UNAVAILABLE_HTTP_' + landingCode
      });
    }

    const form = MGR_LREC_parseSearchForm_(landingHtml);

    if (!form.success) {
      return MGR_LREC_result_(false, {
        licenseNumber: licenseNumber,
        error: form.error || 'LREC_SEARCH_FORM_UNPARSEABLE'
      });
    }

    const payload = Object.assign({}, form.hiddenFields);
    payload[form.licenseNumberField] = licenseNumber;

    // Some portals use a submit button name/value. Preserve it when confidently found.
    if (form.submitName) {
      payload[form.submitName] = form.submitValue || 'Search';
    }

    const cookie = MGR_LREC_cookieHeader_(landing.getAllHeaders());

    const options = {
      method: form.method || 'post',
      muteHttpExceptions: true,
      followRedirects: true,
      payload: payload,
      headers: {
        'User-Agent': 'Mozilla/5.0 MelroseOS-LREC-Verifier',
        'Referer': MGR_LREC_LIVE.SEARCH_URL
      }
    };

    if (cookie) {
      options.headers.Cookie = cookie;
    }

    const resultUrl = MGR_LREC_resolveUrl_(
      MGR_LREC_LIVE.SEARCH_URL,
      form.action || MGR_LREC_LIVE.SEARCH_URL
    );

    const response = UrlFetchApp.fetch(resultUrl, options);
    const code = response.getResponseCode();
    const html = response.getContentText();

    if (code < 200 || code >= 400 || !html) {
      return MGR_LREC_result_(false, {
        licenseNumber: licenseNumber,
        error: 'LREC_SEARCH_RESULT_UNAVAILABLE_HTTP_' + code
      });
    }

    return MGR_LREC_parseResult_(html, licenseNumber);
  } catch (err) {
    return MGR_LREC_result_(false, {
      licenseNumber: licenseNumber,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function MGR_LREC_parseSearchForm_(html) {
  const forms = [];
  const formRegex = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m;

  while ((m = formRegex.exec(html)) !== null) {
    const attrs = m[1] || '';
    const body = m[2] || '';

    if (
      /license\s*number/i.test(body) ||
      /license/i.test(attrs + ' ' + body)
    ) {
      forms.push({
        attrs: attrs,
        body: body
      });
    }
  }

  if (!forms.length) {
    return {
      success: false,
      error: 'SEARCH_FORM_NOT_FOUND'
    };
  }

  const f = forms[0];

  const action = MGR_LREC_attr_(f.attrs, 'action') || '';
  const method = (
    MGR_LREC_attr_(f.attrs, 'method') || 'post'
  ).toLowerCase();

  const hiddenFields = {};
  const inputRegex = /<input\b([^>]*)>/gi;
  let input;

  let licenseNumberField = '';
  let submitName = '';
  let submitValue = '';

  const labelFor = MGR_LREC_findLabelFor_(
    f.body,
    /license\s*number/i
  );

  while ((input = inputRegex.exec(f.body)) !== null) {
    const attrs = input[1] || '';
    const type = (
      MGR_LREC_attr_(attrs, 'type') || 'text'
    ).toLowerCase();

    const name = MGR_LREC_attr_(attrs, 'name') || '';
    const id = MGR_LREC_attr_(attrs, 'id') || '';
    const value = MGR_LREC_attr_(attrs, 'value') || '';

    if (type === 'hidden' && name) {
      hiddenFields[name] = value;
    }

    if (
      !licenseNumberField &&
      name &&
      (
        (labelFor && id === labelFor) ||
        /license.*number/i.test(name) ||
        /license.*number/i.test(id)
      )
    ) {
      licenseNumberField = name;
    }

    if (
      !submitName &&
      (type === 'submit' || type === 'button') &&
      name
    ) {
      submitName = name;
      submitValue = value;
    }
  }

  if (!licenseNumberField) {
    return {
      success: false,
      error: 'LICENSE_NUMBER_FIELD_NOT_FOUND'
    };
  }

  return {
    success: true,
    action: action,
    method: method === 'get' ? 'get' : 'post',
    hiddenFields: hiddenFields,
    licenseNumberField: licenseNumberField,
    submitName: submitName,
    submitValue: submitValue
  };
}

function MGR_LREC_parseResult_(html, licenseNumber) {
  const text = MGR_LREC_htmlToText_(html);
  const normalizedLicense = String(licenseNumber).replace(/\s+/g, '');

  const found =
    text.replace(/\s+/g, '').indexOf(normalizedLicense) >= 0;

  if (!found) {
    return MGR_LREC_result_(false, {
      licenseNumber: licenseNumber,
      error: 'LICENSE_NOT_FOUND_OR_RESULT_UNPARSEABLE'
    });
  }

  const status =
    MGR_LREC_extractLabelValue_(
      text,
      ['License Status', 'Status']
    );

  const company =
    MGR_LREC_extractLabelValue_(
      text,
      ['Company Name', 'Company', 'Brokerage']
    );

  const broker =
    MGR_LREC_extractLabelValue_(
      text,
      ['Sponsoring Broker', 'Broker']
    );

  if (!status) {
    return MGR_LREC_result_(false, {
      licenseNumber: licenseNumber,
      error: 'LICENSE_STATUS_UNPARSEABLE'
    });
  }

  // Normalize only recognized status words. Anything else fails closed.
  const canonicalStatus = MGR_LREC_normalizeStatus_(status);

  if (!canonicalStatus) {
    return MGR_LREC_result_(false, {
      licenseNumber: licenseNumber,
      rawLicenseStatus: status,
      error: 'LICENSE_STATUS_AMBIGUOUS'
    });
  }

  return MGR_LREC_result_(true, {
    licenseNumber: licenseNumber,
    licenseStatus: canonicalStatus,
    companyName: company,
    sponsoringBroker: broker
  });
}

function MGR_LREC_normalizeStatus_(value) {
  const v = String(value || '').trim().toUpperCase();

  if (/\bPENDING\b/.test(v)) return 'Pending';
  if (/\bACTIVE\b/.test(v) && !/\bINACTIVE\b/.test(v)) return 'Active';
  if (/\bINACTIVE\b/.test(v)) return 'Inactive';

  return '';
}

function MGR_LREC_extractLabelValue_(text, labels) {
  const lines = String(text || '')
    .split(/\n+/)
    .map(function(x) { return x.trim(); })
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];

    for (let j = 0; j < labels.length; j++) {
      const label = labels[j];

      if (
        current.toLowerCase() === label.toLowerCase() &&
        i + 1 < lines.length
      ) {
        return lines[i + 1].trim();
      }

      const prefix = label.toLowerCase() + ':';

      if (current.toLowerCase().indexOf(prefix) === 0) {
        return current.substring(prefix.length).trim();
      }
    }
  }

  return '';
}

function MGR_LREC_htmlToText_(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|td|th|section|article|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function MGR_LREC_findLabelFor_(html, pattern) {
  const labelRegex = /<label\b([^>]*)>([\s\S]*?)<\/label>/gi;
  let m;

  while ((m = labelRegex.exec(html)) !== null) {
    const attrs = m[1] || '';
    const text = MGR_LREC_htmlToText_(m[2] || '');

    if (pattern.test(text)) {
      return MGR_LREC_attr_(attrs, 'for') || '';
    }
  }

  return '';
}

function MGR_LREC_attr_(attrs, name) {
  const re = new RegExp(
    '\\b' + name + '\\s*=\\s*(["\'])(.*?)\\1',
    'i'
  );

  const m = re.exec(String(attrs || ''));

  if (m) return m[2];

  const bare = new RegExp(
    '\\b' + name + '\\s*=\\s*([^\\s>]+)',
    'i'
  ).exec(String(attrs || ''));

  return bare ? bare[1] : '';
}

function MGR_LREC_cookieHeader_(headers) {
  const h = headers || {};
  let raw =
    h['Set-Cookie'] ||
    h['set-cookie'] ||
    '';

  if (Array.isArray(raw)) {
    raw = raw.join(', ');
  }

  if (!raw) return '';

  return String(raw)
    .split(/,(?=[^;,]+?=)/)
    .map(function(cookie) {
      return cookie.split(';')[0].trim();
    })
    .filter(Boolean)
    .join('; ');
}

function MGR_LREC_resolveUrl_(base, action) {
  const a = String(action || '').trim();

  if (!a) return base;
  if (/^https?:\/\//i.test(a)) return a;

  const m = /^(https?:\/\/[^\/]+)/i.exec(base);
  const origin = m ? m[1] : '';

  if (a.charAt(0) === '/') {
    return origin + a;
  }

  return base.replace(/\/[^\/]*$/, '/') + a;
}

function MGR_LREC_result_(success, fields) {
  return Object.assign(
    {
      success: success === true,
      checkedAt: new Date().toISOString(),
      source: MGR_LREC_LIVE.SOURCE,
      verifierVersion: MGR_LREC_LIVE.VERSION
    },
    fields || {}
  );
}

/**
 * Connectivity-only diagnostic.
 * This does not certify a recruit's status; it confirms that the official
 * public LREC Verify License Search can be fetched and parsed enough to locate
 * the License Number search field.
 */
function RUN_LREC_LIVE_VERIFIER_DIAGNOSTICS() {
  const result = {
    success: false,
    source: MGR_LREC_LIVE.SEARCH_URL,
    httpCode: 0,
    searchFormParsed: false,
    licenseNumberFieldFound: false,
    error: '',
    timestamp: new Date().toISOString()
  };

  try {
    const response = UrlFetchApp.fetch(
      MGR_LREC_LIVE.SEARCH_URL,
      {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 MelroseOS-LREC-Verifier'
        }
      }
    );

    result.httpCode = response.getResponseCode();

    const form = MGR_LREC_parseSearchForm_(
      response.getContentText()
    );

    result.searchFormParsed = form.success === true;
    result.licenseNumberFieldFound =
      !!form.licenseNumberField;

    result.success =
      result.httpCode >= 200 &&
      result.httpCode < 400 &&
      result.searchFormParsed &&
      result.licenseNumberFieldFound;

    if (!result.success) {
      result.error =
        form.error ||
        'LREC_LIVE_DIAGNOSTIC_FAILED';
    }
  } catch (err) {
    result.error = String(
      err && err.message ? err.message : err
    );
  }

  console.log(
    'RUN_LREC_LIVE_VERIFIER_DIAGNOSTICS\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
