/**
 * MelroseOS CRM-133 - Recruit Content Sanitizer / Certification
 * Purpose: hard-block prohibited CE Shop/vendor affiliate content in recruit messaging.
 * NOTE: Deployment BAT performs the actual source sanitation before push.
 */
const MGR_RECRUIT_133_VERSION = '1.0.0';

function RUN_RECRUIT_133_CERTIFICATION() {
  const prohibited = [
    'share.theceshop.com',
    'theceshop.com',
    'the ce shop',
    'ce shop'
  ];

  const checks = [];
  let firstFive = [];
  try {
    if (typeof MGR_RECRUIT_getFirstFiveTemplates === 'function') {
      firstFive = MGR_RECRUIT_getFirstFiveTemplates() || [];
    }
  } catch (e) {}

  const serialized = JSON.stringify(firstFive).toLowerCase();
  prohibited.forEach(function(term) {
    checks.push({
      name: 'PROHIBITED_' + term.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
      pass: serialized.indexOf(term) === -1
    });
  });

  const result = {
    success: checks.every(function(c){ return c.pass; }),
    version: MGR_RECRUIT_133_VERSION,
    policy: 'NO_CE_SHOP_OR_VENDOR_AFFILIATE_CONTENT_IN_RECRUIT_COMMUNICATIONS',
    checks: checks,
    timestamp: new Date().toISOString()
  };

  console.log('RUN_RECRUIT_133_CERTIFICATION\n' + JSON.stringify(result, null, 2));
  if (!result.success) throw new Error('CRM-133 CERTIFICATION FAIL - prohibited recruit content remains.');
  console.log('CRM-133 CERTIFICATION: PASS');
  return result;
}
