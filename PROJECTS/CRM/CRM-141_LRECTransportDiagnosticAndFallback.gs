/**
 * MelroseOS CRM
 * File: CRM-141_LRECTransportDiagnosticAndFallback.gs
 * Version: 1.0.0
 *
 * Purpose:
 * Reproduce the LREC browser transport without weakening CRM-139's
 * strict classification rules.
 *
 * Attempts:
 * A. POST without auto-follow, inspect redirect, then GET Location.
 * B. POST with redirects enabled.
 * C. GET query-string fallback.
 * D. Explicit application/x-www-form-urlencoded POST.
 *
 * An attempt is accepted ONLY when CRM-139 confirms:
 *   - a matching license/account hyperlink, OR
 *   - explicit LREC no-result evidence.
 *
 * All other responses remain HOLD.
 */

const MGR_LREC_141 = Object.freeze({
  VERSION: '1.0.0',
  MAX_SNIPPET: 800,
  DIAGNOSTIC_PROPERTY: 'MGR_LREC_141_LAST_DIAGNOSTIC'
});

function MGR_LREC_141_transportSearch_(session, query, expectation) {
  const form = session && session.form;

  if (!form || form.success !== true) {
    return MGR_LREC_result_(false, {
      transportError: false,
      parseError: true,
      recordFound: false,
      noResults: false,
      error: 'LREC_141_FORM_SESSION_INVALID'
    });
  }

  const payload =
    MGR_LREC_141_buildPayload_(
      form,
      query || {}
    );

  const targetUrl =
    MGR_LREC_resolveUrl_(
      MGR_LREC_LIVE.SEARCH_URL,
      form.action ||
      MGR_LREC_LIVE.SEARCH_URL
    );

  const attempts = [];

  // A: browser-like POST, no auto-follow so we can preserve redirect state.
  let a =
    MGR_LREC_141_attempt_({
      label: 'POST_NO_FOLLOW',
      url: targetUrl,
      method: 'post',
      payload: payload,
      cookie: session.cookie || '',
      followRedirects: false,
      referer: MGR_LREC_LIVE.SEARCH_URL,
      expectation: expectation
    });

  attempts.push(a.summary);

  if (a.accepted) {
    a.result.transportAttempts = attempts;
    return a.result;
  }

  if (a.redirectUrl) {
    const followed =
      MGR_LREC_141_attempt_({
        label: 'POST_REDIRECT_GET',
        url: a.redirectUrl,
        method: 'get',
        cookie:
          MGR_LREC_141_mergeCookies_(
            session.cookie || '',
            a.setCookie || ''
          ),
        followRedirects: true,
        referer: targetUrl,
        expectation: expectation
      });

    attempts.push(followed.summary);

    if (followed.accepted) {
      followed.result.transportAttempts = attempts;
      return followed.result;
    }
  }

  // B: standard Apps Script form POST with redirects.
  const b =
    MGR_LREC_141_attempt_({
      label: 'POST_FOLLOW',
      url: targetUrl,
      method: 'post',
      payload: payload,
      cookie: session.cookie || '',
      followRedirects: true,
      referer: MGR_LREC_LIVE.SEARCH_URL,
      expectation: expectation
    });

  attempts.push(b.summary);

  if (b.accepted) {
    b.result.transportAttempts = attempts;
    return b.result;
  }

  // C: GET fallback using exact parsed form field names.
  const getUrl =
    MGR_LREC_141_appendQuery_(
      targetUrl,
      payload
    );

  const c =
    MGR_LREC_141_attempt_({
      label: 'GET_QUERY',
      url: getUrl,
      method: 'get',
      cookie: session.cookie || '',
      followRedirects: true,
      referer: MGR_LREC_LIVE.SEARCH_URL,
      expectation: expectation
    });

  attempts.push(c.summary);

  if (c.accepted) {
    c.result.transportAttempts = attempts;
    return c.result;
  }

  // D: explicit form-urlencoded body.
  const encoded =
    MGR_LREC_141_encodePayload_(payload);

  const d =
    MGR_LREC_141_attempt_({
      label: 'POST_FORM_URLENCODED',
      url: targetUrl,
      method: 'post',
      rawPayload: encoded,
      contentType:
        'application/x-www-form-urlencoded',
      cookie: session.cookie || '',
      followRedirects: true,
      referer: MGR_LREC_LIVE.SEARCH_URL,
      expectation: expectation
    });

  attempts.push(d.summary);

  if (d.accepted) {
    d.result.transportAttempts = attempts;
    return d.result;
  }

  return MGR_LREC_result_(false, {
    transportError: false,
    parseError: true,
    recordFound: false,
    noResults: false,
    searchMode:
      expectation && expectation.mode || '',
    error:
      'LREC_141_ALL_TRANSPORT_ATTEMPTS_UNRECOGNIZED',
    transportAttempts: attempts
  });
}

function MGR_LREC_141_buildPayload_(form, query) {
  const payload =
    Object.assign(
      {},
      form.hiddenFields || {}
    );

  if (
    query.licenseType &&
    form.licenseTypeField
  ) {
    payload[
      form.licenseTypeField
    ] =
      form.realEstateOptionValue;
  }

  if (
    query.licenseNumber &&
    form.licenseNumberField
  ) {
    payload[
      form.licenseNumberField
    ] =
      String(
        query.licenseNumber
      );
  }

  if (
    query.firstName &&
    form.firstNameField
  ) {
    payload[
      form.firstNameField
    ] =
      String(
        query.firstName
      );
  }

  if (
    query.lastName &&
    form.lastNameField
  ) {
    payload[
      form.lastNameField
    ] =
      String(
        query.lastName
      );
  }

  if (
    query.phone &&
    form.phoneField
  ) {
    payload[
      form.phoneField
    ] =
      String(
        query.phone
      );
  }

  if (form.submitName) {
    payload[
      form.submitName
    ] =
      form.submitValue ||
      'Search';
  }

  return payload;
}

function MGR_LREC_141_attempt_(cfg) {
  const options = {
    method:
      cfg.method || 'get',
    muteHttpExceptions: true,
    followRedirects:
      cfg.followRedirects !== false,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MelroseOS-LREC',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language':
        'en-US,en;q=0.9',
      'Referer':
        cfg.referer ||
        MGR_LREC_LIVE.SEARCH_URL
    }
  };

  if (cfg.cookie) {
    options.headers.Cookie =
      cfg.cookie;
  }

  if (
    cfg.method === 'post' &&
    cfg.rawPayload !== undefined
  ) {
    options.payload =
      cfg.rawPayload;

    if (cfg.contentType) {
      options.contentType =
        cfg.contentType;
    }
  } else if (
    cfg.method === 'post' &&
    cfg.payload
  ) {
    options.payload =
      cfg.payload;
  }

  try {
    const response =
      UrlFetchApp.fetch(
        cfg.url,
        options
      );

    const code =
      response.getResponseCode();

    const html =
      response.getContentText();

    const headers =
      response.getAllHeaders() || {};

    const location =
      headers.Location ||
      headers.location ||
      '';

    const redirectUrl =
      location
        ? MGR_LREC_resolveUrl_(
            cfg.url,
            String(location)
          )
        : '';

    const setCookie =
      MGR_LREC_cookieHeader_(
        headers
      );

    let parsed = null;
    let accepted = false;

    if (
      code >= 200 &&
      code < 400 &&
      html
    ) {
      parsed =
        MGR_LREC_139_parseSearchResponse(
          html,
          cfg.expectation || {}
        );

      accepted =
        parsed &&
        parsed.success === true &&
        (
          parsed.recordFound === true ||
          parsed.noResults === true
        );
    }

    const summary = {
      label: cfg.label || '',
      httpCode: code,
      accepted: accepted,
      redirect:
        !!redirectUrl,
      redirectUrl:
        MGR_LREC_141_safeUrl_(
          redirectUrl
        ),
      contentLength:
        String(html || '').length,
      hasLicenseLikeAccount:
        /\b[A-Z]{2,12}\.\s*\d+[A-Z0-9.\-]*/i
          .test(
            MGR_LREC_htmlToText_(
              html || ''
            )
          ),
      hasExplicitNoResult:
        MGR_LREC_141_hasExplicitNoResult_(
          html || ''
        ),
      parsedError:
        parsed &&
        parsed.error || '',
      title:
        MGR_LREC_141_title_(
          html || ''
        ),
      fingerprint:
        MGR_LREC_141_fingerprint_(
          html || ''
        )
    };

    return {
      accepted: accepted,
      result:
        accepted
          ? MGR_LREC_result_(
              true,
              parsed
            )
          : null,
      summary: summary,
      redirectUrl: redirectUrl,
      setCookie: setCookie
    };
  } catch (err) {
    return {
      accepted: false,
      result: null,
      redirectUrl: '',
      setCookie: '',
      summary: {
        label: cfg.label || '',
        httpCode: 0,
        accepted: false,
        transportError: true,
        error:
          String(
            err && err.message
              ? err.message
              : err
          )
      }
    };
  }
}

function MGR_LREC_141_hasExplicitNoResult_(html) {
  const text =
    MGR_LREC_htmlToText_(
      html || ''
    );

  return (
    /\bno\s+(matching\s+)?(records?|results?|licenses?)\s+(were\s+)?found\b/i
      .test(text) ||
    /\bnot\s+found\b/i
      .test(text) ||
    /\b0\s+results?\b/i
      .test(text)
  );
}

function MGR_LREC_141_appendQuery_(url, payload) {
  const query =
    MGR_LREC_141_encodePayload_(
      payload
    );

  if (!query) return url;

  return (
    url +
    (
      url.indexOf('?') >= 0
        ? '&'
        : '?'
    ) +
    query
  );
}

function MGR_LREC_141_encodePayload_(payload) {
  return Object.keys(
    payload || {}
  )
    .map(function(key) {
      return (
        encodeURIComponent(key) +
        '=' +
        encodeURIComponent(
          String(
            payload[key] ===
              undefined ||
            payload[key] ===
              null
              ? ''
              : payload[key]
          )
        )
      );
    })
    .join('&');
}

function MGR_LREC_141_mergeCookies_(a, b) {
  const parts =
    String(a || '')
      .split(';')
      .concat(
        String(b || '')
          .split(';')
      )
      .map(function(x) {
        return x.trim();
      })
      .filter(Boolean);

  const map = {};

  parts.forEach(function(x) {
    const eq =
      x.indexOf('=');

    if (eq <= 0) return;

    map[
      x.substring(0, eq)
    ] = x.substring(eq + 1);
  });

  return Object.keys(map)
    .map(function(k) {
      return k + '=' + map[k];
    })
    .join('; ');
}

function MGR_LREC_141_title_(html) {
  const m =
    /<title\b[^>]*>([\s\S]*?)<\/title>/i
      .exec(
        String(html || '')
      );

  return m
    ? MGR_LREC_htmlToText_(
        m[1] || ''
      )
    : '';
}

function MGR_LREC_141_fingerprint_(html) {
  const text =
    MGR_LREC_htmlToText_(
      html || ''
    )
      .replace(
        /\b[\w.%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi,
        '[EMAIL]'
      )
      .replace(
        /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        '[PHONE]'
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  return text.substring(
    0,
    MGR_LREC_141.MAX_SNIPPET
  );
}

function MGR_LREC_141_safeUrl_(url) {
  return String(url || '')
    .replace(
      /([?&](?:first|last|name|phone|license)[^=]*=)[^&]*/gi,
      '$1[REDACTED]'
    );
}

function RUN_LREC_141_TRANSPORT_DIAGNOSTIC() {
  const session =
    MGR_LREC_openSearchSession_();

  const result = {
    success: false,
    version:
      MGR_LREC_141.VERSION,
    sessionReady:
      !!(
        session &&
        session.success
      ),
    form: {},
    positive: null,
    negative: null,
    timestamp:
      new Date().toISOString()
  };

  if (!session.success) {
    result.error =
      session.error ||
      'SEARCH_SESSION_FAILED';

    console.log(
      'RUN_LREC_141_TRANSPORT_DIAGNOSTIC\n' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;
  }

  result.form = {
    action:
      session.form.action || '',
    method:
      session.form.method || '',
    licenseTypeField:
      session.form.licenseTypeField || '',
    realEstateOptionValue:
      session.form.realEstateOptionValue || '',
    licenseNumberField:
      session.form.licenseNumberField || '',
    firstNameField:
      session.form.firstNameField || '',
    lastNameField:
      session.form.lastNameField || '',
    phoneField:
      session.form.phoneField || '',
    submitName:
      session.form.submitName || '',
    submitValue:
      session.form.submitValue || ''
  };

  const positive =
    MGR_LREC_141_transportSearch_(
      session,
      {
        licenseType:
          'REAL_ESTATE',
        licenseNumber:
          '995720225'
      },
      {
        mode:
          'LICENSE_NUMBER',
        expectedLicenseNumber:
          '995720225',
        firstName:
          'Clarissa',
        lastName:
          'Brown'
      }
    );

  const negative =
    MGR_LREC_141_transportSearch_(
      session,
      {
        licenseType:
          'REAL_ESTATE',
        firstName:
          'Zzzmelroseosnorecord',
        lastName:
          'Zzzvalidation'
      },
      {
        mode:
          'NAME',
        firstName:
          'Zzzmelroseosnorecord',
        lastName:
          'Zzzvalidation'
      }
    );

  result.positive = {
    success:
      positive.success === true,
    recordFound:
      positive.recordFound === true,
    noResults:
      positive.noResults === true,
    error:
      positive.error || '',
    attempts:
      positive.transportAttempts || []
  };

  result.negative = {
    success:
      negative.success === true,
    recordFound:
      negative.recordFound === true,
    noResults:
      negative.noResults === true,
    error:
      negative.error || '',
    attempts:
      negative.transportAttempts || []
  };

  result.success =
    result.positive.recordFound === true &&
    result.negative.noResults === true;

  PropertiesService
    .getScriptProperties()
    .setProperty(
      MGR_LREC_141.DIAGNOSTIC_PROPERTY,
      JSON.stringify(result)
    );

  console.log(
    'RUN_LREC_141_TRANSPORT_DIAGNOSTIC\n' +
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
