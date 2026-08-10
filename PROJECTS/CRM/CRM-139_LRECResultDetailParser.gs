/**
 * MelroseOS CRM
 * File: CRM-139_LRECResultDetailParser.gs
 * Version: 1.0.0
 *
 * LREC public search result + detail-page parser.
 *
 * Flow:
 * 1. Search response returns no result -> PENDING.
 * 2. Search response returns a license/account hyperlink -> LICENSE RECORD FOUND.
 * 3. Follow hyperlink.
 * 4. Parse detail page for license status / company / broker / supervisor.
 * 5. Any returned license record exits the pending-recruit workflow.
 * 6. Unexpected response / missing detail link after apparent result -> HOLD.
 */

const MGR_LREC_139 = Object.freeze({
  VERSION: '1.0.0',
  SEARCH_URL: 'https://portal.lrec.gov/public/search'
});

function MGR_LREC_139_parseSearchResponse(html, expectation) {
  const source = String(html || '');
  const text = MGR_LREC_htmlToText_(source);

  // Explicit no-result wording wins when present.
  if (
    /\bno\s+(matching\s+)?(records?|results?|licenses?)\s+(were\s+)?found\b/i.test(text) ||
    /\bnot\s+found\b/i.test(text) ||
    /\b0\s+results?\b/i.test(text)
  ) {
    return {
      success: true,
      recordFound: false,
      noResults: true,
      ambiguous: false,
      resultCount: 0,
      searchMode: expectation && expectation.mode || '',
      parserVersion: MGR_LREC_139.VERSION
    };
  }

  const links = MGR_LREC_139_extractLicenseLinks_(source);

  if (!links.length) {
    // The search page itself can be returned after a no-result search with no
    // explicit wording. If the search form is still present and there is no
    // license/account link or result row, classify as clean no-result.
    const formStillPresent =
      /license\s*type/i.test(text) &&
      /license\s*number/i.test(text) &&
      /first\s*name/i.test(text) &&
      /last\s*name/i.test(text);

    const resultHeaderPresent =
      /search\s*results?/i.test(text);

    if (formStillPresent && !resultHeaderPresent) {
      return {
        success: true,
        recordFound: false,
        noResults: true,
        ambiguous: false,
        resultCount: 0,
        searchMode: expectation && expectation.mode || '',
        parserVersion: MGR_LREC_139.VERSION
      };
    }

    return {
      success: false,
      recordFound: false,
      noResults: false,
      ambiguous: false,
      resultCount: 0,
      searchMode: expectation && expectation.mode || '',
      error: 'LREC_SEARCH_RESPONSE_HAS_NO_LICENSE_LINK_AND_IS_NOT_CONFIRMED_NO_RESULT',
      parserVersion: MGR_LREC_139.VERSION
    };
  }

  const matches = links.filter(function(item) {
    return MGR_LREC_139_linkMatchesExpectation_(item, expectation || {});
  });

  if (!matches.length) {
    // The search returned license records, but not one we can safely associate
    // with the target recruit. Never call this Pending.
    return {
      success: false,
      recordFound: false,
      noResults: false,
      ambiguous: true,
      resultCount: links.length,
      searchMode: expectation && expectation.mode || '',
      error: 'LREC_LICENSE_RESULTS_RETURNED_BUT_TARGET_NOT_CONFIRMED',
      candidates: links.slice(0, 10),
      parserVersion: MGR_LREC_139.VERSION
    };
  }

  if (matches.length > 1) {
    return {
      success: true,
      recordFound: true,
      noResults: false,
      ambiguous: true,
      resultCount: matches.length,
      searchMode: expectation && expectation.mode || '',
      candidates: matches.slice(0, 10),
      parserVersion: MGR_LREC_139.VERSION
    };
  }

  return {
    success: true,
    recordFound: true,
    noResults: false,
    ambiguous: false,
    resultCount: 1,
    searchMode: expectation && expectation.mode || '',
    result: matches[0],
    parserVersion: MGR_LREC_139.VERSION
  };
}

function MGR_LREC_139_extractLicenseLinks_(html) {
  const rows = [];
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;

  while ((tr = trRegex.exec(String(html || ''))) !== null) {
    const rowHtml = tr[1] || '';
    const rowText = MGR_LREC_htmlToText_(rowHtml);

    const aRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let a;

    while ((a = aRegex.exec(rowHtml)) !== null) {
      const attrs = a[1] || '';
      const href = MGR_LREC_attr_(attrs, 'href') || '';
      const anchorText = MGR_LREC_htmlToText_(a[2] || '');

      if (!href) continue;

      // LREC license/account links typically display an account like
      // SALE.995720225-ACT. We intentionally accept any prefix followed by
      // a period and numeric core so future license classes still work.
      const acctMatch =
        anchorText.match(/\b[A-Z]{2,12}\.\s*\d+[A-Z0-9.\-]*\b/i) ||
        rowText.match(/\b[A-Z]{2,12}\.\s*\d+[A-Z0-9.\-]*\b/i);

      if (!acctMatch) continue;

      const cells = [];
      const tdRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let td;
      while ((td = tdRegex.exec(rowHtml)) !== null) {
        cells.push(MGR_LREC_htmlToText_(td[1] || ''));
      }

      rows.push({
        account: String(acctMatch[0] || '').replace(/\s+/g, ''),
        href: href,
        absoluteUrl: MGR_LREC_resolveUrl_(MGR_LREC_139.SEARCH_URL, href),
        type: cells.length > 1 ? cells[1] : '',
        owner: cells.length > 2 ? cells[2] : '',
        rowText: rowText
      });
    }
  }

  // Some implementations may render the result as a non-table block.
  if (!rows.length) {
    const aRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let a;
    while ((a = aRegex.exec(String(html || ''))) !== null) {
      const attrs = a[1] || '';
      const href = MGR_LREC_attr_(attrs, 'href') || '';
      const anchorText = MGR_LREC_htmlToText_(a[2] || '');

      const acct =
        anchorText.match(/\b[A-Z]{2,12}\.\s*\d+[A-Z0-9.\-]*\b/i);

      if (!href || !acct) continue;

      rows.push({
        account: String(acct[0]).replace(/\s+/g, ''),
        href: href,
        absoluteUrl: MGR_LREC_resolveUrl_(MGR_LREC_139.SEARCH_URL, href),
        type: '',
        owner: '',
        rowText: anchorText
      });
    }
  }

  return MGR_LREC_139_uniqueLinks_(rows);
}

function MGR_LREC_139_uniqueLinks_(rows) {
  const seen = {};
  return (rows || []).filter(function(r) {
    const k = String(r.absoluteUrl || r.href || r.account || '');
    if (!k || seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

function MGR_LREC_139_linkMatchesExpectation_(row, expectation) {
  const mode = String(expectation.mode || '');

  if (mode === 'LICENSE_NUMBER') {
    const expected = MGR_LREC_digits_(
      expectation.expectedLicenseNumber || ''
    );
    const actual = MGR_LREC_digits_(row.account || '');
    return !!expected && actual.indexOf(expected) >= 0;
  }

  const first = MGR_LREC_139_normalizeName_(expectation.firstName);
  const last = MGR_LREC_139_normalizeName_(expectation.lastName);
  const owner = MGR_LREC_139_normalizeName_(
    row.owner || row.rowText
  );

  if (!first || !last) return false;

  return owner.indexOf(first) >= 0 &&
         owner.indexOf(last) >= 0;
}

function MGR_LREC_139_fetchAndParseDetail_(searchResult, cookie) {
  const item = searchResult && searchResult.result;

  if (!item || !item.absoluteUrl) {
    return {
      success: false,
      recordFound: true,
      noResults: false,
      parseError: true,
      error: 'LREC_LICENSE_RECORD_LINK_MISSING'
    };
  }

  try {
    const options = {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 MelroseOS-LREC-Verifier',
        'Referer': MGR_LREC_139.SEARCH_URL
      }
    };

    if (cookie) options.headers.Cookie = cookie;

    const response =
      UrlFetchApp.fetch(item.absoluteUrl, options);

    const code = response.getResponseCode();
    const html = response.getContentText();

    if (code < 200 || code >= 400 || !html) {
      return {
        success: false,
        recordFound: true,
        noResults: false,
        transportError: true,
        error: 'LREC_DETAIL_PAGE_UNAVAILABLE_HTTP_' + code,
        licenseNumber: item.account,
        detailUrl: item.absoluteUrl
      };
    }

    const detail =
      MGR_LREC_139_parseDetailPage_(html);

    detail.licenseNumber =
      detail.licenseNumber || item.account;

    detail.ownerName =
      detail.ownerName || item.owner || '';

    detail.licenseType =
      detail.licenseType || item.type || '';

    detail.detailUrl = item.absoluteUrl;
    detail.recordFound = true;
    detail.noResults = false;
    detail.searchResult = item;

    return detail;
  } catch (err) {
    return {
      success: false,
      recordFound: true,
      noResults: false,
      transportError: true,
      error: String(err && err.message ? err.message : err),
      licenseNumber: item.account,
      detailUrl: item.absoluteUrl
    };
  }
}

function MGR_LREC_139_parseDetailPage_(html) {
  const text = MGR_LREC_htmlToText_(html);

  const account =
    MGR_LREC_139_extractAny_(
      text,
      [
        'License Number',
        'Account',
        'Credential Number'
      ]
    ) ||
    (
      text.match(/\b[A-Z]{2,12}\.\s*\d+[A-Z0-9.\-]*\b/i) || []
    )[0] ||
    '';

  const status =
    MGR_LREC_139_extractAny_(
      text,
      [
        'License Status',
        'Status',
        'Credential Status'
      ]
    ) ||
    MGR_LREC_139_statusFromAccount_(account);

  const owner =
    MGR_LREC_139_extractAny_(
      text,
      [
        'Owner',
        'Licensee',
        'Name'
      ]
    );

  const type =
    MGR_LREC_139_extractAny_(
      text,
      [
        'License Type',
        'Credential Type',
        'Type'
      ]
    );

  const company =
    MGR_LREC_139_extractAny_(
      text,
      [
        'Company Name',
        'Company',
        'Brokerage',
        'Business Name'
      ]
    );

  const broker =
    MGR_LREC_139_extractAny_(
      text,
      [
        'Sponsoring Broker',
        'Broker',
        'Responsible Broker'
      ]
    );

  const supervisor =
    MGR_LREC_139_extractAny_(
      text,
      [
        'Supervisor Name',
        'Supervisor'
      ]
    );

  // A detail page reached through an actual license hyperlink is itself
  // sufficient to classify as an existing license record. Status/brokerage
  // enriches the migration but is not required to stop pending communications.
  return {
    success: true,
    parseError: false,
    transportError: false,
    recordFound: true,
    noResults: false,
    licenseNumber: String(account || '').replace(/\s+/g, ''),
    licenseStatus: status || 'License Record Found',
    ownerName: owner || '',
    licenseType: type || '',
    companyName: company || '',
    sponsoringBroker: broker || '',
    supervisorName: supervisor || '',
    classification: 'EXISTING_AGENT_PENDING_WORKFLOW',
    parserVersion: MGR_LREC_139.VERSION
  };
}

function MGR_LREC_139_extractAny_(text, labels) {
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

function MGR_LREC_139_statusFromAccount_(account) {
  const a = String(account || '').toUpperCase();

  if (/-ACT\b/.test(a)) return 'Active';

  if (
    /-INA\b/.test(a) ||
    /-INACT\b/.test(a) ||
    /-INACTIVE\b/.test(a)
  ) return 'Inactive';

  return '';
}

function MGR_LREC_139_normalizeName_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function RUN_LREC_139_CERTIFICATION() {
  const sampleFound =
    '<table><tr><th>Account</th><th>Type</th><th>Owner</th></tr>' +
    '<tr><td><a href="/public/license/123">SALE.995720225-ACT</a></td>' +
    '<td>Salesperson</td><td>Clarissa Jessica Brown</td></tr></table>';

  const found = MGR_LREC_139_parseSearchResponse(
    sampleFound,
    {
      mode: 'NAME',
      firstName: 'Clarissa',
      lastName: 'Brown'
    }
  );

  const sampleNone =
    '<html><body><h2>Verify License Search</h2>' +
    '<div>No records found</div></body></html>';

  const none = MGR_LREC_139_parseSearchResponse(
    sampleNone,
    {mode:'NAME',firstName:'No',lastName:'Match'}
  );

  const result = {
    success:
      found.success === true &&
      found.recordFound === true &&
      found.result &&
      /995720225/.test(found.result.account) &&
      none.success === true &&
      none.noResults === true,

    foundCase: found,
    noResultCase: none,
    timestamp: new Date().toISOString()
  };

  console.log(
    'RUN_LREC_139_CERTIFICATION\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}
