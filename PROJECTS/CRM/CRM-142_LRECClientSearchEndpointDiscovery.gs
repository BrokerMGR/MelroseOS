/**
 * MelroseOS CRM
 * File: CRM-142_LRECClientSearchEndpointDiscovery.gs
 * Version: 1.0.0
 *
 * READ-ONLY diagnostic.
 * Does not release or send recruit communications.
 *
 * Purpose:
 * Inspect the live LREC Verify License Search HTML and referenced JavaScript
 * to discover the browser-side search handler / AJAX endpoint / request shape.
 */

const MGR_LREC_142 = Object.freeze({
  VERSION: '1.0.0',
  SEARCH_URL: 'https://portal.lrec.gov/public/search',
  MAX_SCRIPTS: 20,
  MAX_LOG_ITEMS: 80,
  MAX_SNIPPET: 700
});

function RUN_LREC_142_CLIENT_ENDPOINT_DISCOVERY() {
  const result = {
    success: false,
    version: MGR_LREC_142.VERSION,
    searchUrl: MGR_LREC_142.SEARCH_URL,
    page: {},
    form: {},
    inlineHandlers: [],
    inlineScriptFindings: [],
    externalScripts: [],
    endpointCandidates: [],
    timestamp: new Date().toISOString()
  };

  try {
    const pageResp = UrlFetchApp.fetch(MGR_LREC_142.SEARCH_URL, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MelroseOS-LREC142',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const code = pageResp.getResponseCode();
    const html = pageResp.getContentText() || '';

    result.page = {
      httpCode: code,
      contentLength: html.length,
      title: MGR_LREC_142_title_(html),
      scriptTagCount: (html.match(/<script\b/gi) || []).length,
      formCount: (html.match(/<form\b/gi) || []).length
    };

    result.form = MGR_LREC_142_extractForm_(html);
    result.inlineHandlers = MGR_LREC_142_extractHandlers_(html);
    result.inlineScriptFindings = MGR_LREC_142_scanInlineScripts_(html);

    const scriptUrls = MGR_LREC_142_extractScriptUrls_(html)
      .slice(0, MGR_LREC_142.MAX_SCRIPTS);

    scriptUrls.forEach(function(url) {
      result.externalScripts.push(
        MGR_LREC_142_inspectScript_(url)
      );
    });

    result.endpointCandidates =
      MGR_LREC_142_collectCandidates_(result);

    result.success =
      result.endpointCandidates.length > 0 ||
      result.inlineHandlers.length > 0 ||
      result.inlineScriptFindings.length > 0;

  } catch (err) {
    result.error = String(
      err && err.message ? err.message : err
    );
  }

  console.log(
    'RUN_LREC_142_CLIENT_ENDPOINT_DISCOVERY\n' +
    JSON.stringify(result, null, 2)
  );

  return result;
}

function MGR_LREC_142_extractForm_(html) {
  const m = /<form\b([^>]*)>([\s\S]*?)<\/form>/i.exec(html || '');
  if (!m) return { found: false };

  const attrs = m[1] || '';
  const body = m[2] || '';

  return {
    found: true,
    id: MGR_LREC_142_attr_(attrs, 'id'),
    name: MGR_LREC_142_attr_(attrs, 'name'),
    action: MGR_LREC_142_attr_(attrs, 'action'),
    method: MGR_LREC_142_attr_(attrs, 'method'),
    onsubmit: MGR_LREC_142_attr_(attrs, 'onsubmit'),
    fieldNames: MGR_LREC_142_unique_(
      Array.from(
        body.matchAll(/\bname\s*=\s*["']([^"']+)["']/gi),
        function(x) { return x[1]; }
      )
    ).slice(0, 50),
    hiddenFields: Array.from(
      body.matchAll(
        /<input\b[^>]*type\s*=\s*["']hidden["'][^>]*>/gi
      ),
      function(x) {
        const tag = x[0];
        return {
          name: MGR_LREC_142_attr_(tag, 'name'),
          value: MGR_LREC_142_attr_(tag, 'value')
        };
      }
    ).filter(function(x) { return x.name; }).slice(0, 30)
  };
}

function MGR_LREC_142_extractHandlers_(html) {
  const out = [];
  const re = /\b(onclick|onsubmit|onchange)\s*=\s*["']([^"']+)["']/gi;
  let m;

  while ((m = re.exec(html || '')) && out.length < MGR_LREC_142.MAX_LOG_ITEMS) {
    const code = String(m[2] || '');
    if (
      /search|submit|ajax|fetch|account|license|subBtn/i.test(code)
    ) {
      out.push({
        event: m[1],
        code: code.substring(0, MGR_LREC_142.MAX_SNIPPET)
      });
    }
  }

  return out;
}

function MGR_LREC_142_scanInlineScripts_(html) {
  const out = [];
  const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;

  while ((m = re.exec(html || '')) && out.length < MGR_LREC_142.MAX_LOG_ITEMS) {
    const js = String(m[1] || '');
    const findings = MGR_LREC_142_scanJsText_(js, 'INLINE');
    findings.forEach(function(x) {
      if (out.length < MGR_LREC_142.MAX_LOG_ITEMS) out.push(x);
    });
  }

  return out;
}

function MGR_LREC_142_extractScriptUrls_(html) {
  const urls = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;

  while ((m = re.exec(html || ''))) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    urls.push(MGR_LREC_142_resolveUrl_(MGR_LREC_142.SEARCH_URL, raw));
  }

  return MGR_LREC_142_unique_(urls);
}

function MGR_LREC_142_inspectScript_(url) {
  const item = {
    url: url,
    httpCode: 0,
    contentLength: 0,
    findings: []
  };

  try {
    const r = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 MelroseOS-LREC142',
        'Referer': MGR_LREC_142.SEARCH_URL,
        'Accept': '*/*'
      }
    });

    item.httpCode = r.getResponseCode();
    const js = r.getContentText() || '';
    item.contentLength = js.length;
    item.findings = MGR_LREC_142_scanJsText_(js, url)
      .slice(0, 20);

  } catch (err) {
    item.error = String(
      err && err.message ? err.message : err
    );
  }

  return item;
}

function MGR_LREC_142_scanJsText_(js, source) {
  const out = [];
  const text = String(js || '');

  const patterns = [
    {
      kind: 'JQUERY_AJAX',
      re: /\$\.ajax\s*\(\s*\{[\s\S]{0,1800}?\}\s*\)/gi
    },
    {
      kind: 'JQUERY_GET_POST',
      re: /\$\.(?:get|post)\s*\([\s\S]{0,900}?\)/gi
    },
    {
      kind: 'FETCH',
      re: /\bfetch\s*\([\s\S]{0,1000}?\)/gi
    },
    {
      kind: 'XHR',
      re: /\.open\s*\(\s*["'](?:GET|POST)["']\s*,[\s\S]{0,500}?\)/gi
    },
    {
      kind: 'URL_LITERAL',
      re: /["']([^"']*(?:search|license|account|verify|public)[^"']*)["']/gi
    },
    {
      kind: 'SEARCH_HANDLER',
      re: /(?:subBtn|AccountTypeID|AccountNumber|FirstName|LastName|PhoneNumber)[\s\S]{0,700}/gi
    }
  ];

  patterns.forEach(function(p) {
    let m;
    while ((m = p.re.exec(text)) && out.length < MGR_LREC_142.MAX_LOG_ITEMS) {
      const raw = String(m[0] || '');
      out.push({
        kind: p.kind,
        source: source,
        snippet: MGR_LREC_142_cleanSnippet_(raw)
      });
    }
  });

  return out;
}

function MGR_LREC_142_collectCandidates_(result) {
  const candidates = [];

  function addFrom(item) {
    const s = String(
      item && (item.snippet || item.code) || ''
    );

    const re = /(?:url\s*[:=]\s*)?["']([^"']+)["']/gi;
    let m;

    while ((m = re.exec(s))) {
      const raw = String(m[1] || '').trim();

      if (
        raw &&
        /search|license|account|verify|public/i.test(raw) &&
        !/^javascript:/i.test(raw)
      ) {
        candidates.push({
          raw: raw,
          resolvedUrl:
            MGR_LREC_142_resolveUrl_(
              MGR_LREC_142.SEARCH_URL,
              raw
            ),
          source: item.source || item.event || ''
        });
      }
    }
  }

  (result.inlineHandlers || []).forEach(addFrom);
  (result.inlineScriptFindings || []).forEach(addFrom);

  (result.externalScripts || []).forEach(function(script) {
    (script.findings || []).forEach(addFrom);
  });

  const seen = {};
  return candidates.filter(function(x) {
    const key = x.resolvedUrl || x.raw;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).slice(0, 50);
}

function MGR_LREC_142_attr_(text, name) {
  const re = new RegExp(
    '\\b' + name + '\\s*=\\s*["\\\']([^"\\\']*)["\\\']',
    'i'
  );
  const m = re.exec(String(text || ''));
  return m ? m[1] : '';
}

function MGR_LREC_142_cleanSnippet_(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(
      /\b[\w.%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi,
      '[EMAIL]'
    )
    .replace(
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      '[PHONE]'
    )
    .substring(0, MGR_LREC_142.MAX_SNIPPET);
}

function MGR_LREC_142_title_(html) {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html || '');
  return m
    ? String(m[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    : '';
}

function MGR_LREC_142_unique_(arr) {
  const seen = {};
  return (arr || []).filter(function(x) {
    const k = String(x || '');
    if (!k || seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

function MGR_LREC_142_resolveUrl_(base, relative) {
  const r = String(relative || '').trim();
  if (!r) return '';
  if (/^https?:\/\//i.test(r)) return r;

  const b = String(base || '');
  const origin = (b.match(/^(https?:\/\/[^\/]+)/i) || [])[1] || '';

  if (r.indexOf('//') === 0) {
    return 'https:' + r;
  }

  if (r.charAt(0) === '/') {
    return origin + r;
  }

  const cleanBase = b.replace(/[?#].*$/, '');
  const dir = cleanBase.substring(0, cleanBase.lastIndexOf('/') + 1);
  return dir + r;
}
