/**
 * MelroseOS CRM
 * File: CRM-130_LiveLRECVerifier.gs
 * Version: 1.3.0
 *
 * CRM-139-aware live LREC verifier.
 *
 * Search order:
 * 1. License Type = Real Estate + numeric credential/license number.
 * 2. If clean no-result, First Name + Last Name.
 * 3. If name search returns multiple candidate records and phone is present,
 *    use phone-assisted follow-up search.
 *
 * Any returned LREC license hyperlink = existing license record.
 * Clean no-result across applicable searches = Pending.
 * Any ambiguity/error = HOLD.
 */

const MGR_LREC_LIVE = Object.freeze({
  VERSION: '1.3.0',
  SEARCH_URL: 'https://portal.lrec.gov/public/search',
  SOURCE: 'LREC_PUBLIC_PORTAL'
});

function MGR_RECRUIT_LREC_lookup(recruit) {
  const r = recruit || {};

  const firstName = String(
    r.firstName || r.FirstName || r['First Name'] || ''
  ).trim();

  const lastName = String(
    r.lastName || r.LastName || r['Last Name'] || ''
  ).trim();

  const phone = MGR_LREC_digits_(
    r.phone || r.Phone || r['Phone Number'] || ''
  );

  const rawCredential = String(
    r.licenseNumber ||
    r.credentialNumber ||
    r.CredentialNumber ||
    r['Credential Number'] ||
    ''
  ).trim();

  const numericCredential =
    MGR_LREC_digits_(rawCredential);

  if (!numericCredential && (!firstName || !lastName)) {
    return MGR_LREC_result_(false, {
      transportError: false,
      parseError: true,
      recordFound: false,
      noResults: false,
      error: 'MISSING_LREC_SEARCH_IDENTIFIERS'
    });
  }

  const session = MGR_LREC_openSearchSession_();
  if (!session.success) return session;

  const attempts = [];

  if (numericCredential) {
    const byLicense =
      MGR_LREC_submitSearch_(
        session,
        {
          licenseType: 'REAL_ESTATE',
          licenseNumber: numericCredential
        },
        {
          mode: 'LICENSE_NUMBER',
          expectedLicenseNumber: numericCredential,
          firstName: firstName,
          lastName: lastName,
          phone: phone
        }
      );

    attempts.push(byLicense);

    if (!byLicense.success) {
      return MGR_LREC_finishLookup_(byLicense, attempts);
    }

    if (byLicense.recordFound === true &&
        byLicense.ambiguous !== true) {
      const detail =
        MGR_LREC_139_fetchAndParseDetail_(
          byLicense,
          session.cookie
        );
      detail.searchAttempts = attempts;
      return MGR_LREC_result_(detail.success === true, detail);
    }
  }

  if (firstName && lastName) {
    const byName =
      MGR_LREC_submitSearch_(
        session,
        {
          licenseType: 'REAL_ESTATE',
          firstName: firstName,
          lastName: lastName
        },
        {
          mode: 'NAME',
          firstName: firstName,
          lastName: lastName,
          phone: phone
        }
      );

    attempts.push(byName);

    if (!byName.success) {
      return MGR_LREC_finishLookup_(byName, attempts);
    }

    if (byName.recordFound === true &&
        byName.ambiguous !== true) {
      const detail =
        MGR_LREC_139_fetchAndParseDetail_(
          byName,
          session.cookie
        );
      detail.searchAttempts = attempts;
      return MGR_LREC_result_(detail.success === true, detail);
    }

    if (byName.ambiguous === true) {
      if (!phone) {
        return MGR_LREC_result_(false, {
          transportError: false,
          parseError: true,
          recordFound: false,
          noResults: false,
          ambiguous: true,
          error: 'LREC_NAME_SEARCH_AMBIGUOUS_NO_PHONE',
          searchAttempts: attempts
        });
      }

      const byNamePhone =
        MGR_LREC_submitSearch_(
          session,
          {
            licenseType: 'REAL_ESTATE',
            firstName: firstName,
            lastName: lastName,
            phone: phone
          },
          {
            mode: 'NAME',
            firstName: firstName,
            lastName: lastName,
            phone: phone
          }
        );

      attempts.push(byNamePhone);

      if (!byNamePhone.success) {
        return MGR_LREC_finishLookup_(byNamePhone, attempts);
      }

      if (
        byNamePhone.recordFound === true &&
        byNamePhone.ambiguous !== true
      ) {
        const detail =
          MGR_LREC_139_fetchAndParseDetail_(
            byNamePhone,
            session.cookie
          );
        detail.searchAttempts = attempts;
        return MGR_LREC_result_(detail.success === true, detail);
      }

      return MGR_LREC_result_(false, {
        transportError: false,
        parseError: true,
        recordFound: false,
        noResults: false,
        ambiguous: true,
        error: 'LREC_NAME_SEARCH_UNRESOLVED',
        searchAttempts: attempts
      });
    }
  }

  const allCleanNoResult =
    attempts.length > 0 &&
    attempts.every(function(a) {
      return a.success === true &&
             a.recordFound === false &&
             a.noResults === true;
    });

  if (allCleanNoResult) {
    return MGR_LREC_result_(true, {
      transportError: false,
      parseError: false,
      recordFound: false,
      noResults: true,
      licenseNumber: numericCredential,
      licenseStatus: 'Pending',
      classification: 'PENDING_RECRUIT',
      searchAttempts: attempts
    });
  }

  return MGR_LREC_result_(false, {
    transportError: false,
    parseError: true,
    recordFound: false,
    noResults: false,
    error: 'LREC_SEARCH_DID_NOT_REACH_SAFE_CLASSIFICATION',
    searchAttempts: attempts
  });
}

function MGR_LREC_openSearchSession_() {
  try {
    const landing =
      UrlFetchApp.fetch(
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

    const code = landing.getResponseCode();
    const html = landing.getContentText();

    if (code < 200 || code >= 400 || !html) {
      return MGR_LREC_result_(false, {
        transportError: true,
        parseError: false,
        error:
          'LREC_SEARCH_PAGE_UNAVAILABLE_HTTP_' + code
      });
    }

    const form = MGR_LREC_parseSearchForm_(html);

    if (!form.success) {
      return MGR_LREC_result_(false, {
        transportError: false,
        parseError: true,
        error:
          form.error ||
          'LREC_SEARCH_FORM_UNPARSEABLE'
      });
    }

    return {
      success: true,
      form: form,
      cookie:
        MGR_LREC_cookieHeader_(
          landing.getAllHeaders()
        )
    };
  } catch (err) {
    return MGR_LREC_result_(false, {
      transportError: true,
      parseError: false,
      error:
        String(
          err && err.message
            ? err.message
            : err
        )
    });
  }
}

function MGR_LREC_submitSearch_(session, query, expectation) {
  const form = session.form;
  const payload =
    Object.assign({}, form.hiddenFields);

  if (query.licenseType &&
      form.licenseTypeField) {
    payload[form.licenseTypeField] =
      form.realEstateOptionValue;
  }

  if (query.licenseNumber &&
      form.licenseNumberField) {
    payload[form.licenseNumberField] =
      query.licenseNumber;
  }

  if (query.firstName &&
      form.firstNameField) {
    payload[form.firstNameField] =
      query.firstName;
  }

  if (query.lastName &&
      form.lastNameField) {
    payload[form.lastNameField] =
      query.lastName;
  }

  if (query.phone &&
      form.phoneField) {
    payload[form.phoneField] =
      query.phone;
  }

  if (form.submitName) {
    payload[form.submitName] =
      form.submitValue || 'Search';
  }

  try {
    const options = {
      method: form.method || 'post',
      muteHttpExceptions: true,
      followRedirects: true,
      payload: payload,
      headers: {
        'User-Agent':
          'Mozilla/5.0 MelroseOS-LREC-Verifier',
        'Referer':
          MGR_LREC_LIVE.SEARCH_URL
      }
    };

    if (session.cookie) {
      options.headers.Cookie = session.cookie;
    }

    const resultUrl =
      MGR_LREC_resolveUrl_(
        MGR_LREC_LIVE.SEARCH_URL,
        form.action ||
        MGR_LREC_LIVE.SEARCH_URL
      );

    const response =
      UrlFetchApp.fetch(
        resultUrl,
        options
      );

    const code =
      response.getResponseCode();

    const html =
      response.getContentText();

    if (code < 200 ||
        code >= 400 ||
        !html) {
      return MGR_LREC_result_(false, {
        transportError: true,
        parseError: false,
        recordFound: false,
        noResults: false,
        searchMode:
          expectation.mode,
        error:
          'LREC_SEARCH_RESULT_UNAVAILABLE_HTTP_' +
          code
      });
    }

    const parsed =
      MGR_LREC_139_parseSearchResponse(
        html,
        expectation
      );

    return MGR_LREC_result_(
      parsed.success === true,
      parsed
    );
  } catch (err) {
    return MGR_LREC_result_(false, {
      transportError: true,
      parseError: false,
      recordFound: false,
      noResults: false,
      searchMode:
        expectation.mode,
      error:
        String(
          err && err.message
            ? err.message
            : err
        )
    });
  }
}

function MGR_LREC_parseSearchForm_(html) {
  const forms = [];
  const formRegex =
    /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;

  let m;

  while ((m = formRegex.exec(html)) !== null) {
    const attrs = m[1] || '';
    const body = m[2] || '';

    if (
      /license\s*type/i.test(body) &&
      /license\s*number/i.test(body) &&
      /first\s*name/i.test(body) &&
      /last\s*name/i.test(body)
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

  const result = {
    success: true,
    action:
      MGR_LREC_attr_(f.attrs, 'action') || '',
    method:
      (
        MGR_LREC_attr_(f.attrs, 'method') ||
        'post'
      ).toLowerCase() === 'get'
        ? 'get'
        : 'post',
    hiddenFields: {},
    licenseTypeField: '',
    realEstateOptionValue: '',
    licenseNumberField: '',
    firstNameField: '',
    lastNameField: '',
    phoneField: '',
    submitName: '',
    submitValue: ''
  };

  const labelMap =
    MGR_LREC_labelMap_(f.body);

  const inputRegex =
    /<input\b([^>]*)>/gi;

  let input;

  while (
    (input =
      inputRegex.exec(f.body)) !== null
  ) {
    const attrs = input[1] || '';

    const type =
      (
        MGR_LREC_attr_(attrs, 'type') ||
        'text'
      ).toLowerCase();

    const name =
      MGR_LREC_attr_(attrs, 'name') || '';

    const id =
      MGR_LREC_attr_(attrs, 'id') || '';

    const value =
      MGR_LREC_attr_(attrs, 'value') || '';

    const label =
      String(labelMap[id] || '')
        .toLowerCase();

    if (type === 'hidden' && name) {
      result.hiddenFields[name] = value;
    }

    if (
      name &&
      (
        /license\s*number/i.test(label) ||
        /license.*number/i.test(name) ||
        /license.*number/i.test(id)
      )
    ) {
      result.licenseNumberField = name;
    }

    if (
      name &&
      (
        /first\s*name/i.test(label) ||
        /first.*name/i.test(name) ||
        /first.*name/i.test(id)
      )
    ) {
      result.firstNameField = name;
    }

    if (
      name &&
      (
        /last\s*name/i.test(label) ||
        /last.*name/i.test(name) ||
        /last.*name/i.test(id)
      )
    ) {
      result.lastNameField = name;
    }

    if (
      name &&
      (
        /phone\s*number/i.test(label) ||
        /phone/i.test(name) ||
        /phone/i.test(id)
      )
    ) {
      result.phoneField = name;
    }

    if (
      !result.submitName &&
      (type === 'submit' ||
       type === 'button') &&
      name
    ) {
      result.submitName = name;
      result.submitValue = value;
    }
  }

  const selectRegex =
    /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;

  let select;

  while (
    (select =
      selectRegex.exec(f.body)) !== null
  ) {
    const attrs =
      select[1] || '';

    const body =
      select[2] || '';

    const name =
      MGR_LREC_attr_(attrs, 'name') || '';

    const id =
      MGR_LREC_attr_(attrs, 'id') || '';

    const label =
      String(labelMap[id] || '')
        .toLowerCase();

    if (
      name &&
      (
        /license\s*type/i.test(label) ||
        /license.*type/i.test(name) ||
        /license.*type/i.test(id)
      )
    ) {
      result.licenseTypeField = name;

      const optionRegex =
        /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;

      let option;

      while (
        (option =
          optionRegex.exec(body)) !== null
      ) {
        const optionAttrs =
          option[1] || '';

        const optionText =
          MGR_LREC_htmlToText_(
            option[2] || ''
          );

        if (/real\s*estate/i.test(optionText)) {
          result.realEstateOptionValue =
            MGR_LREC_attr_(
              optionAttrs,
              'value'
            ) ||
            optionText;
          break;
        }
      }
    }
  }

  if (
    !result.licenseTypeField ||
    !result.realEstateOptionValue ||
    !result.licenseNumberField ||
    !result.firstNameField ||
    !result.lastNameField
  ) {
    return {
      success: false,
      error:
        'LREC_REQUIRED_SEARCH_FIELDS_NOT_FOUND',
      detected: result
    };
  }

  return result;
}

function MGR_LREC_labelMap_(html) {
  const map = {};
  const re =
    /<label\b([^>]*)>([\s\S]*?)<\/label>/gi;

  let m;

  while ((m = re.exec(html)) !== null) {
    const id =
      MGR_LREC_attr_(
        m[1] || '',
        'for'
      );

    if (id) {
      map[id] =
        MGR_LREC_htmlToText_(
          m[2] || ''
        );
    }
  }

  return map;
}

function MGR_LREC_finishLookup_(result, attempts) {
  const out =
    Object.assign({}, result || {});

  out.searchAttempts = attempts;
  return out;
}

function MGR_LREC_digits_(value) {
  return String(value || '')
    .replace(/\D/g, '');
}

function MGR_LREC_htmlToText_(html) {
  return String(html || '')
    .replace(
      /<script\b[\s\S]*?<\/script>/gi,
      ' '
    )
    .replace(
      /<style\b[\s\S]*?<\/style>/gi,
      ' '
    )
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<\/(div|p|li|tr|td|th|section|article|h[1-6])>/gi,
      '\n'
    )
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

function MGR_LREC_attr_(attrs, name) {
  const re =
    new RegExp(
      '\\b' +
      name +
      '\\s*=\\s*(["\\\'])(.*?)\\1',
      'i'
    );

  const m =
    re.exec(String(attrs || ''));

  if (m) return m[2];

  const bare =
    new RegExp(
      '\\b' +
      name +
      '\\s*=\\s*([^\\s>]+)',
      'i'
    ).exec(
      String(attrs || '')
    );

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
      return cookie
        .split(';')[0]
        .trim();
    })
    .filter(Boolean)
    .join('; ');
}

function MGR_LREC_resolveUrl_(base, action) {
  const a =
    String(action || '').trim();

  if (!a) return base;

  if (/^https?:\/\//i.test(a)) {
    return a;
  }

  const m =
    /^(https?:\/\/[^\/]+)/i
      .exec(base);

  const origin =
    m ? m[1] : '';

  if (a.charAt(0) === '/') {
    return origin + a;
  }

  return (
    base.replace(
      /\/[^\/]*$/,
      '/'
    ) + a
  );
}

function MGR_LREC_result_(success, fields) {
  return Object.assign(
    {
      success:
        success === true,
      checkedAt:
        new Date().toISOString(),
      source:
        MGR_LREC_LIVE.SOURCE,
      verifierVersion:
        MGR_LREC_LIVE.VERSION
    },
    fields || {}
  );
}

function RUN_LREC_LIVE_VERIFIER_DIAGNOSTICS() {
  const session =
    MGR_LREC_openSearchSession_();

  const result = {
    success:
      session.success === true &&
      typeof MGR_LREC_139_parseSearchResponse ===
        'function' &&
      typeof MGR_LREC_139_fetchAndParseDetail_ ===
        'function',

    source:
      MGR_LREC_LIVE.SEARCH_URL,

    verifierVersion:
      MGR_LREC_LIVE.VERSION,

    resultParserVersion:
      typeof MGR_LREC_139 !==
      'undefined'
        ? MGR_LREC_139.VERSION
        : '',

    licenseTypeFieldFound:
      !!(
        session.form &&
        session.form.licenseTypeField
      ),

    realEstateOptionFound:
      !!(
        session.form &&
        session.form.realEstateOptionValue
      ),

    licenseNumberFieldFound:
      !!(
        session.form &&
        session.form.licenseNumberField
      ),

    firstNameFieldFound:
      !!(
        session.form &&
        session.form.firstNameField
      ),

    lastNameFieldFound:
      !!(
        session.form &&
        session.form.lastNameField
      ),

    phoneFieldFound:
      !!(
        session.form &&
        session.form.phoneField
      ),

    resultLinkParserPresent:
      typeof MGR_LREC_139_parseSearchResponse ===
      'function',

    detailPageParserPresent:
      typeof MGR_LREC_139_fetchAndParseDetail_ ===
      'function',

    businessRule:
      'ANY LICENSE HYPERLINK=EXISTING; FOLLOW DETAIL PAGE; CLEAN NO RESULT=PENDING; ERROR=HOLD',

    error:
      session.error || '',

    timestamp:
      new Date().toISOString()
  };

  console.log(
    'RUN_LREC_LIVE_VERIFIER_DIAGNOSTICS\n' +
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
