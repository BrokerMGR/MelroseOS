/**
 * MelroseOS CRM
 * File: CRM-143_DirectLRECSearchAndDetailResolution.gs
 * Version: 1.0.2
 *
 * READ-ONLY canary + direct LREC search transport.
 * Recruit outbound remains governed by the existing hardened release gate.
 *
 * Discovered browser flow:
 *   POST /Public/_Search/
 *   GET  /Public/_ShowAccountDetails/?key=...&Source=Search
 *   GET  /Public/_ShowAccountQualifiers/?key=...
 *   GET  /Public/_ShowContactdetails/?key=...&Source=Search
 */

const MGR_LREC_143 = Object.freeze({
  VERSION: '1.0.2',
  ORIGIN: 'https://portal.lrec.gov',
  SEARCH_PAGE: 'https://portal.lrec.gov/public/search',
  SEARCH_ENDPOINT: 'https://portal.lrec.gov/Public/_Search/',
  DETAILS_ENDPOINT: 'https://portal.lrec.gov/Public/_ShowAccountDetails/',
  QUALIFIERS_ENDPOINT: 'https://portal.lrec.gov/Public/_ShowAccountQualifiers/',
  CONTACT_ENDPOINT: 'https://portal.lrec.gov/Public/_ShowContactdetails/',
  REAL_ESTATE_TYPE: '20'
});

function MGR_LREC_143_verifyRecruit(firstName, lastName, licenseNumber, phoneNumber) {
  const digits = MGR_LREC_143_digits_(licenseNumber || '');

  return MGR_LREC_143_search_({
    AccountTypeID: MGR_LREC_143.REAL_ESTATE_TYPE,
    AccountNumber: digits,
    FirstName: String(firstName || ''),
    LastName: String(lastName || ''),
    PhoneNumber: String(phoneNumber || '')
  }, {
    expectedLicenseNumber: digits,
    expectedFirstName: String(firstName || ''),
    expectedLastName: String(lastName || '')
  });
}

function RUN_LREC_143_DIRECT_CANARY_CERTIFICATION() {
  const positive = MGR_LREC_143_search_({
    AccountTypeID: MGR_LREC_143.REAL_ESTATE_TYPE,
    AccountNumber: '995720225',
    FirstName: 'Clarissa',
    LastName: 'Brown'
  }, {
    expectedLicenseNumber: '995720225',
    expectedFirstName: 'Clarissa',
    expectedLastName: 'Brown'
  });

  const negative = MGR_LREC_143_search_({
    AccountTypeID: MGR_LREC_143.REAL_ESTATE_TYPE,
    FirstName: 'Zzzmelroseosnorecord',
    LastName: 'Zzzvalidation'
  }, {
    expectedFirstName: 'Zzzmelroseosnorecord',
    expectedLastName: 'Zzzvalidation'
  });

  const result = {
    success:
      positive.success === true &&
      positive.recordFound === true &&
      negative.success === true &&
      negative.noResults === true,
    version: MGR_LREC_143.VERSION,
    positiveControl: positive,
    negativeControl: negative,
    recruitOutboundReleaseAllowed: false,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_LREC_143_DIRECT_CANARY_CERTIFICATION\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

function MGR_LREC_143_search_(fields, expected) {
  const session = MGR_LREC_143_openSession_();

  if (!session.success) {
    return MGR_LREC_143_result_(false, {
      recordFound: false,
      noResults: false,
      error: session.error || 'LREC_143_SESSION_FAILED'
    });
  }

  const payload = {
    AccountTypeID: String(fields.AccountTypeID || MGR_LREC_143.REAL_ESTATE_TYPE),
    AccountNumber: String(fields.AccountNumber || ''),
    CompanyName: String(fields.CompanyName || ''),
    FirstName: String(fields.FirstName || ''),
    LastName: String(fields.LastName || ''),
    PhoneNumber: String(fields.PhoneNumber || ''),
    useSoundex: String(fields.useSoundex || 'false'),
    streetAddress: String(fields.streetAddress || ''),
    PostalCode: String(fields.PostalCode || ''),
    City: String(fields.City || ''),
    StateCode: String(fields.StateCode || ''),
    subBtn: 'Search'
  };

  const response = MGR_LREC_143_fetch_(MGR_LREC_143.SEARCH_ENDPOINT, {
    method: 'post',
    payload: payload,
    cookie: session.cookie,
    referer: MGR_LREC_143.SEARCH_PAGE
  });

  if (!response.success) {
    return MGR_LREC_143_result_(false, {
      recordFound: false,
      noResults: false,
      transportError: true,
      httpCode: response.httpCode || 0,
      error: response.error || 'LREC_143_SEARCH_TRANSPORT_FAILED'
    });
  }

  const html = response.body || '';
  const text = MGR_LREC_143_text_(html);
  const explicitNoResult = MGR_LREC_143_isExplicitNoResult_(text);
  const rows = MGR_LREC_143_extractResultRows_(html);

  if (explicitNoResult && rows.length === 0) {
    return MGR_LREC_143_result_(true, {
      recordFound: false,
      noResults: true,
      classification: 'PENDING_RECRUIT',
      httpCode: response.httpCode,
      resultCount: 0,
      evidence: 'EXPLICIT_LREC_NO_RESULT'
    });
  }

  if (rows.length === 0) {
    return MGR_LREC_143_result_(false, {
      recordFound: false,
      noResults: false,
      parseError: true,
      httpCode: response.httpCode,
      resultCount: 0,
      error: 'LREC_143_NO_RESULT_ROW_AND_NO_EXPLICIT_NO_RESULT',
      responseFingerprint: MGR_LREC_143_fingerprint_(html)
    });
  }

  const match = MGR_LREC_143_chooseMatch_(rows, expected || {});

  if (!match.success) {
    return MGR_LREC_143_result_(false, {
      recordFound: false,
      noResults: false,
      ambiguous: match.ambiguous === true,
      resultCount: rows.length,
      error: match.error || 'LREC_143_RESULT_NOT_CONFIDENTLY_MATCHED',
      candidates: rows.slice(0, 10)
    });
  }

  const details = MGR_LREC_143_fetchDetails_(match.row.key, session.cookie);

  if (!details.success) {
    return MGR_LREC_143_result_(false, {
      recordFound: true,
      noResults: false,
      resultCount: rows.length,
      accountKey: match.row.key,
      searchRow: match.row,
      error: details.error || 'LREC_143_DETAIL_RESOLUTION_FAILED'
    });
  }

  return MGR_LREC_143_result_(true, {
    recordFound: true,
    noResults: false,
    classification: 'LICENSED_EXISTING_AGENT',
    resultCount: rows.length,
    accountKey: match.row.key,
    licenseNumber: match.row.licenseNumber || '',
    ownerName: match.row.name || '',
    searchRow: match.row,
    details: details
  });
}

function MGR_LREC_143_openSession_() {
  return MGR_LREC_143_fetch_(MGR_LREC_143.SEARCH_PAGE, {
    method: 'get',
    referer: MGR_LREC_143.SEARCH_PAGE
  });
}

function MGR_LREC_143_fetch_(url, cfg) {
  cfg = cfg || {};

  const options = {
    method: cfg.method || 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MelroseOS-LREC143',
      'Accept': 'text/html, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': cfg.referer || MGR_LREC_143.SEARCH_PAGE,
      'X-Requested-With': 'XMLHttpRequest'
    }
  };

  if (cfg.cookie) options.headers.Cookie = cfg.cookie;
  if (cfg.payload) options.payload = cfg.payload;

  try {
    const r = UrlFetchApp.fetch(url, options);
    const code = r.getResponseCode();
    const headers = r.getAllHeaders() || {};
    const body = r.getContentText() || '';

    return {
      success: code >= 200 && code < 400,
      httpCode: code,
      body: body,
      cookie: MGR_LREC_143_cookieHeader_(headers),
      contentLength: body.length
    };
  } catch (err) {
    return {
      success: false,
      httpCode: 0,
      body: '',
      cookie: '',
      error: String(err && err.message ? err.message : err)
    };
  }
}

function MGR_LREC_143_extractResultRows_(html) {
  const rows = [];
  const source = String(html || '');

  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;

  while ((tr = trRe.exec(source))) {
    const rowHtml = tr[1] || '';
    const links = Array.from(
      rowHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)
    );

    let key = '';
    let href = '';
    let licenseNumber = '';

    links.forEach(function(a) {
      const attrs = a[1] || '';
      const label = MGR_LREC_143_text_(a[2] || '');
      const h = MGR_LREC_143_attr_(attrs, 'href');
      const onclick = MGR_LREC_143_attr_(attrs, 'onclick');

      const keyMatch =
        /ShowAccountDetails\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i.exec(onclick) ||
        /[?&]key=([^&"'#]+)/i.exec(h);

      if (keyMatch && !key) {
        key = decodeURIComponent(keyMatch[1]);
        href = h || '';
      }

      if (
        !licenseNumber &&
        /(?:[A-Z]{1,12}\.)?\s*\d{5,}/i.test(label)
      ) {
        licenseNumber = label.replace(/\s+/g, ' ').trim();
      }
    });

    if (!key) {
      const onclickMatch =
        /ShowAccountDetails\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i.exec(rowHtml);

      if (onclickMatch) key = onclickMatch[1];
    }

    if (!key) continue;

    const cells = Array.from(
      rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi),
      function(x) {
        return MGR_LREC_143_text_(x[1] || '');
      }
    );

    const rowText = MGR_LREC_143_text_(rowHtml);

    rows.push({
      key: key,
      href: href,
      licenseNumber: licenseNumber || MGR_LREC_143_findLicense_(rowText),
      name: MGR_LREC_143_findName_(cells, rowText),
      cells: cells,
      text: rowText.substring(0, 500)
    });
  }

  return rows;
}

function MGR_LREC_143_chooseMatch_(rows, expected) {
  const expectedDigits = MGR_LREC_143_digits_(expected.expectedLicenseNumber || '');
  const first = String(expected.expectedFirstName || '').trim().toLowerCase();
  const last = String(expected.expectedLastName || '').trim().toLowerCase();

  if (expectedDigits) {
    const byLicense = rows.filter(function(row) {
      return MGR_LREC_143_digits_(row.licenseNumber || row.text || '')
        .indexOf(expectedDigits) >= 0;
    });

    if (byLicense.length === 1) {
      return { success: true, row: byLicense[0] };
    }

    if (byLicense.length > 1) {
      return { success: false, ambiguous: true, error: 'MULTIPLE_LICENSE_MATCHES' };
    }
  }

  if (first && last) {
    const byName = rows.filter(function(row) {
      const t = String(row.name || row.text || '').toLowerCase();
      return t.indexOf(first) >= 0 && t.indexOf(last) >= 0;
    });

    if (byName.length === 1) {
      return { success: true, row: byName[0] };
    }

    if (byName.length > 1) {
      return { success: false, ambiguous: true, error: 'MULTIPLE_NAME_MATCHES' };
    }
  }

  if (rows.length === 1) {
    return { success: true, row: rows[0] };
  }

  return { success: false, ambiguous: rows.length > 1, error: 'NO_UNIQUE_MATCH' };
}

function MGR_LREC_143_fetchDetails_(key, cookie) {
  const normalizedKey = MGR_LREC_143_normalizeAccountKey_(key);
  const encoded = encodeURIComponent(normalizedKey);

  const account = MGR_LREC_143_fetch_(
    MGR_LREC_143.DETAILS_ENDPOINT + '?key=' + encoded + '&Source=Search',
    { method: 'get', cookie: cookie, referer: MGR_LREC_143.SEARCH_PAGE }
  );

  const qualifiers = MGR_LREC_143_fetch_(
    MGR_LREC_143.QUALIFIERS_ENDPOINT + '?key=' + encoded,
    { method: 'get', cookie: cookie, referer: MGR_LREC_143.SEARCH_PAGE }
  );

  if (!account.success) {
    return {
      success: false,
      error: 'ACCOUNT_DETAILS_FETCH_FAILED',
      accountHttpCode: account.httpCode
    };
  }

  const accountText = MGR_LREC_143_text_(account.body);
  const qualifierText = qualifiers.success
    ? MGR_LREC_143_text_(qualifiers.body)
    : '';

  const parsed = MGR_LREC_143_parseAccountDetails_(accountText);

  if (!parsed.licenseStatus) {
    return {
      success: false,
      error: 'LREC_143_STATUS_NOT_PARSED',
      accountHttpCode: account.httpCode,
      accountDetails: accountText.substring(0, 1800)
    };
  }

  return {
    success: true,
    accountHttpCode: account.httpCode,
    qualifiersHttpCode: qualifiers.httpCode,
    contactEndpointCalled: false,
    contactEndpointReason: 'DISABLED_NOT_REQUIRED_FOR_ROUTING',
    licenseStatus: parsed.licenseStatus,
    companyName: parsed.companyName,
    supervisorName: parsed.companyName,
    contactName: parsed.contactName,
    accountType: parsed.accountType,
    licenseNumber: parsed.licenseNumber,
    firstIssuedDate: parsed.firstIssuedDate,
    expirationDate: parsed.expirationDate,
    accountDetails: accountText.substring(0, 1800),
    qualifiers: qualifierText.substring(0, 1200)
  };
}

function MGR_LREC_143_parseAccountDetails_(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();

  function between(label, nextLabels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const next = (nextLabels || []).map(function(x) {
      return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|');

    const re = new RegExp(
      escaped + '\\s+(.+?)' + (next ? '(?=\\s+(?:' + next + ')\\b)' : '$'),
      'i'
    );
    const m = re.exec(t);
    return m ? String(m[1] || '').trim() : '';
  }

  return {
    contactName: between('Contact Name', ['License Account Type']),
    accountType: between('License Account Type', ['Status']),
    licenseStatus: between('Status', ['License #']),
    licenseNumber: between('License #', ['First Issued Date']),
    firstIssuedDate: between('First Issued Date', ['Expiration Date']),
    expirationDate: between('Expiration Date', ['Education', 'Current Supervisor']),
    companyName: between('Current Supervisor', ['View Prior Supervisor History'])
  };
}


function MGR_LREC_143_normalizeAccountKey_(key) {
  let value = String(key || '').trim();

  // LREC result HTML can return this encrypted key already URL-encoded.
  // Decode once here; the detail URL builder encodes it exactly once.
  try {
    if (/%[0-9A-F]{2}/i.test(value)) {
      value = decodeURIComponent(value);
    }
  } catch (err) {
    value = String(key || '').trim();
  }

  return value;
}

function MGR_LREC_143_isExplicitNoResult_(text) {
  const t = String(text || '');
  return (
    /\bno\s+(matching\s+)?(records?|results?|licenses?|accounts?)\s+(were\s+)?found\b/i.test(t) ||
    /\bno\s+(records?|results?|licenses?|accounts?)\s+found\b/i.test(t) ||
    /\b0\s+results?\b/i.test(t) ||
    /\bnot\s+found\b/i.test(t)
  );
}

function MGR_LREC_143_extractLabeledValue_(text, labels) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(label + '\\s*:?\\s*([^|]{1,160}?)(?=\\s{2,}|$)', 'i');
    const m = re.exec(t);
    if (m) return String(m[1] || '').trim();
  }

  return '';
}

function MGR_LREC_143_findLicense_(text) {
  const m = /\b(?:[A-Z]{1,12}\.)?\s*\d{5,}\b/i.exec(String(text || ''));
  return m ? m[0].replace(/\s+/g, '') : '';
}

function MGR_LREC_143_findName_(cells, rowText) {
  const c = cells || [];
  for (let i = 0; i < c.length; i++) {
    if (
      /[A-Za-z]/.test(c[i]) &&
      !/license|status|real estate|broker|salesperson/i.test(c[i]) &&
      !/\d{5,}/.test(c[i])
    ) {
      return c[i];
    }
  }
  return String(rowText || '').substring(0, 180);
}

function MGR_LREC_143_cookieHeader_(headers) {
  const raw = headers['Set-Cookie'] || headers['set-cookie'] || '';
  const values = Array.isArray(raw) ? raw : [raw];

  return values
    .map(function(v) {
      return String(v || '').split(';')[0].trim();
    })
    .filter(Boolean)
    .join('; ');
}

function MGR_LREC_143_attr_(text, name) {
  const re = new RegExp(
    '\\b' + name + '\\s*=\\s*["\\\']([^"\\\']*)["\\\']',
    'i'
  );
  const m = re.exec(String(text || ''));
  return m ? m[1] : '';
}

function MGR_LREC_143_text_(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function MGR_LREC_143_digits_(value) {
  return String(value || '').replace(/\D/g, '');
}

function MGR_LREC_143_fingerprint_(html) {
  return MGR_LREC_143_text_(html)
    .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]')
    .substring(0, 1000);
}

function MGR_LREC_143_result_(success, extra) {
  return Object.assign({
    success: success === true,
    source: 'LREC_PUBLIC_PORTAL_DIRECT_SEARCH',
    verifierVersion: MGR_LREC_143.VERSION,
    checkedAt: new Date().toISOString()
  }, extra || {});
}
