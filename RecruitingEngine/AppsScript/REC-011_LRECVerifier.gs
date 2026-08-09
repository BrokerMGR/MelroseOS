/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-011_LRECVerifier
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Conservative public-record verifier for the Louisiana Real Estate Commission.
 *
 * Safety principles:
 * - Uses the public Verify License Search only.
 * - License number is preferred; exact first/last name is fallback.
 * - Never marks a recruit ACTIVE unless the response contains a confident match.
 * - Ambiguous/unparseable responses become REVIEW_REQUIRED, not ACTIVE.
 * - Read-only against LREC.
 * - Rate-limited and cache-assisted.
 */

const REC_LREC = Object.freeze({
  publicSearchUrl: 'https://portal.lrec.gov/public/search',
  minDelayMs: 2500,
  cacheSeconds: 21600, // 6 hours
  userAgent: 'MelroseOS/5 RecruitingVerification (+https://melrosegrouprealty.com)'
});

function REC_buildLRECLookupUrl_(recruit) {
  const license = REC_normalizeText(recruit.licenseNumber);
  const first = REC_normalizeText(recruit.firstName);
  const last = REC_normalizeText(recruit.lastName);

  // Public search supports these fields visibly. Query-string submission is
  // attempted conservatively; if the portal changes behavior, the result is
  // classified REVIEW_REQUIRED rather than making a status assumption.
  const parts = [];

  if (license) {
    parts.push('LicenseNumber=' + encodeURIComponent(license));
  } else {
    if (first) parts.push('FirstName=' + encodeURIComponent(first));
    if (last) parts.push('LastName=' + encodeURIComponent(last));
  }

  return REC_LREC.publicSearchUrl + (parts.length ? '?' + parts.join('&') : '');
}

function REC_normalizeHtmlText_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function REC_extractLRECStatus_(text) {
  const t = String(text || '');

  if (/\bInactive\b/i.test(t)) return 'INACTIVE';
  if (/\bActive\b/i.test(t)) return 'ACTIVE';
  if (/\bExpired\b/i.test(t)) return 'EXPIRED';
  if (/\bSuspended\b/i.test(t)) return 'SUSPENDED';
  if (/\bRevoked\b/i.test(t)) return 'REVOKED';

  return 'UNKNOWN';
}

function REC_extractSponsoringBroker_(text) {
  const t = String(text || '');

  const patterns = [
    /Sponsoring\s+Broker\s*[:\-]\s*([^|]{2,120})/i,
    /Supervising\s+Broker\s*[:\-]\s*([^|]{2,120})/i,
    /Company\s+Name\s*[:\-]\s*([^|]{2,120})/i,
    /Brokerage\s*[:\-]\s*([^|]{2,120})/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const m = t.match(patterns[i]);
    if (m && m[1]) {
      return REC_normalizeText(
        m[1]
          .replace(/\bLicense\b.*$/i, '')
          .replace(/\bPhone\b.*$/i, '')
          .replace(/\bAddress\b.*$/i, '')
      ).substring(0, 120);
    }
  }

  return '';
}

function REC_isConfidentLRECMatch_(recruit, text) {
  const t = String(text || '').toLowerCase();
  const license = REC_normalizeText(recruit.licenseNumber).toLowerCase();
  const first = REC_normalizeText(recruit.firstName).toLowerCase();
  const last = REC_normalizeText(recruit.lastName).toLowerCase();

  if (license && t.indexOf(license) !== -1) return true;

  if (first && last &&
      t.indexOf(first) !== -1 &&
      t.indexOf(last) !== -1) {
    return true;
  }

  return false;
}

function REC_fetchLRECRecord_(recruit) {
  const url = REC_buildLRECLookupUrl_(recruit);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'LREC:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      url,
      Utilities.Charset.UTF_8
    )
  ).substring(0, 80);

  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  Utilities.sleep(REC_LREC.minDelayMs);

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    followRedirects: true,
    muteHttpExceptions: true,
    headers: {
      'User-Agent': REC_LREC.userAgent,
      'Accept': 'text/html,application/xhtml+xml'
    }
  });

  const result = {
    url: url,
    responseCode: response.getResponseCode(),
    html: response.getContentText()
  };

  cache.put(cacheKey, JSON.stringify(result), REC_LREC.cacheSeconds);
  return result;
}

function REC_verifyRecruitWithLREC(recruit) {
  if (!recruit) throw new Error('Recruit is required.');

  if (!recruit.licenseNumber &&
      !(recruit.firstName && recruit.lastName)) {
    return {
      status: 'REVIEW_REQUIRED',
      sponsoringBroker: '',
      confidence: 'NONE',
      reason: 'Insufficient identifying information.',
      lookupUrl: REC_LREC.publicSearchUrl
    };
  }

  try {
    const fetched = REC_fetchLRECRecord_(recruit);

    if (fetched.responseCode < 200 || fetched.responseCode >= 400) {
      return {
        status: 'REVIEW_REQUIRED',
        sponsoringBroker: '',
        confidence: 'NONE',
        reason: 'LREC public search returned HTTP ' + fetched.responseCode,
        lookupUrl: fetched.url
      };
    }

    const text = REC_normalizeHtmlText_(fetched.html);
    const confident = REC_isConfidentLRECMatch_(recruit, text);

    if (!confident) {
      return {
        status: 'NOT_CONFIRMED',
        sponsoringBroker: '',
        confidence: 'LOW',
        reason: 'No confident public-record match.',
        lookupUrl: fetched.url
      };
    }

    const status = REC_extractLRECStatus_(text);
    const broker = REC_extractSponsoringBroker_(text);

    if (status === 'UNKNOWN') {
      return {
        status: 'REVIEW_REQUIRED',
        sponsoringBroker: broker,
        confidence: 'MEDIUM',
        reason: 'Identity matched but license status could not be parsed confidently.',
        lookupUrl: fetched.url
      };
    }

    return {
      status: status,
      sponsoringBroker: broker,
      confidence: recruit.licenseNumber ? 'HIGH' : 'MEDIUM',
      reason: 'Public LREC record matched.',
      lookupUrl: fetched.url
    };
  } catch (err) {
    return {
      status: 'REVIEW_REQUIRED',
      sponsoringBroker: '',
      confidence: 'NONE',
      reason: 'LREC lookup error: ' + err.message,
      lookupUrl: REC_buildLRECLookupUrl_(recruit)
    };
  }
}

function REC_getLRECVerificationCandidates(limit) {
  REC_installSystemColumns();

  const recruits = REC_readRecruitRows(limit || 5000);
  const now = REC_now();

  return recruits.filter(function(recruit) {
    if (!recruit.isContactable) return false;
    if (recruit.replyDetected || recruit.unsubscribed || recruit.doNotContact) {
      return false;
    }

    const status = String(recruit.lrecStatus || '').toUpperCase();
    if (status === 'ACTIVE') return false;

    if (!recruit.lrecLastChecked) return true;

    const last = new Date(recruit.lrecLastChecked);
    if (isNaN(last.getTime())) return true;

    // Recheck no more than once every 24 hours.
    return (now.getTime() - last.getTime()) >= (24 * 60 * 60 * 1000);
  });
}

function REC_runLRECVerificationPreview(maxCount) {
  REC_assertSafeMode();

  const cap = Math.max(1, Math.min(Number(maxCount || 5), 10));
  const candidates = REC_getLRECVerificationCandidates(5000).slice(0, cap);
  const results = [];

  candidates.forEach(function(recruit) {
    const verification = REC_verifyRecruitWithLREC(recruit);

    results.push({
      recruitId: recruit.recruitId,
      rowNumber: recruit.rowNumber,
      fullName: recruit.fullName,
      licenseNumber: recruit.licenseNumber,
      verification: verification
    });
  });

  REC_log('PASS', 'REC-011_LRECVerifier', 'LREC verification preview complete.', {
    checked: results.length
  });

  return REC_result(true, {
    checkedCount: results.length,
    results: results
  });
}
