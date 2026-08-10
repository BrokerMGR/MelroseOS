/**
 * MelroseOS CRM
 * File: CRM-135_FirstFiveCertificationFix.gs
 * Version: 1.0.0
 *
 * Confirms the repaired first-five content certification is available.
 */

function RUN_RECRUIT_135_CERTIFICATION() {
  const content =
    RUN_RECRUIT_FIRST_FIVE_CONTENT_CERTIFICATION();

  const result = {
    success:
      content &&
      content.success === true &&
      Array.isArray(content.prohibitedHits) &&
      content.prohibitedHits.length === 0,
    contentCertification:
      content || null,
    timestamp:
      new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_135_CERTIFICATION\n' +
    JSON.stringify(
      result,
      null,
      2
    )
  );

  if (!result.success) {
    throw new Error(
      'CRM-135 CERTIFICATION FAIL'
    );
  }

  console.log(
    'CRM-135 CERTIFICATION: PASS'
  );

  return result;
}
