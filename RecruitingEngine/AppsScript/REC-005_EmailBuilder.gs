/**
 * MelroseOS Recruiting Automation Platform
 * Module: REC-005_EmailBuilder
 * Release: MOS5-021
 * Version: 1.0.0
 *
 * Builds branded pre-license recruiting email content.
 * No production sending occurs in this module.
 */

const REC_BRAND = Object.freeze({
  navy: '#0B1F3A',
  gold: '#C7A45A',
  white: '#FFFFFF',
  light: '#F6F7F9',
  website: 'https://melrosegrouprealty.com',
  officePhone: '(985) 250-0071',
  location: 'Mandeville, LA'
});

function REC_getPreLicenseSubject(recruit) {
  const first = recruit && recruit.firstName ? recruit.firstName + ', ' : '';
  return first + 'your real estate journey is getting started';
}

function REC_getPreLicenseBodyCopy(recruit) {
  const firstName = recruit && recruit.firstName ? recruit.firstName : 'there';

  return {
    greeting: 'Hi ' + firstName + ',',
    headline: 'Congratulations on getting started on your journey toward becoming a licensed real estate professional.',
    body:
      'As you work toward your Louisiana real estate license, this is a great time to begin thinking about the kind of brokerage support, training, systems, and mentorship you want around you once you are ready to take the next step.',
    support:
      'Melrose Group Realty is building a modern brokerage environment designed to help agents grow with practical education, accessible broker support, lead-generation systems, and tools that make the business easier to understand and operate.',
    close:
      'There is no pressure to make a decision today. If you would like to learn more, we would be glad to have an introductory conversation by Zoom or phone.'
  };
}

function REC_buildComplianceFooter(unsubscribeUrl) {
  const url = unsubscribeUrl || '#';

  return (
    '<div style="font-size:12px;line-height:1.6;color:#606770;text-align:center;padding:20px 24px 8px;">' +
      '<div>Melrose Group Realty</div>' +
      '<div>Licensed in Louisiana &bull; (985) 250-0071 &bull; Mandeville, LA</div>' +
      '<div style="margin-top:8px;">You are receiving this email because your information was identified in connection with your real estate licensing journey.</div>' +
      '<div style="margin-top:8px;"><a href="' + url + '" style="color:#606770;text-decoration:underline;">Unsubscribe from recruiting emails</a></div>' +
    '</div>'
  );
}

function REC_buildPreLicenseEmail(recruit, options) {
  options = options || {};

  const copy = REC_getPreLicenseBodyCopy(recruit);
  const logoCid = options.logoCid || 'mgrLogo';
  const cardCid = options.businessCardCid || 'brokerCard';
  const consultationUrl = options.consultationUrl || '#';
  const academyUrl = options.academyUrl || '#';
  const unsubscribeUrl = options.unsubscribeUrl || '#';

  const html = [
    '<div style="margin:0;padding:0;background:', REC_BRAND.light, ';font-family:Arial,Helvetica,sans-serif;">',
      '<div style="max-width:680px;margin:0 auto;padding:24px 12px;">',
        '<div style="background:', REC_BRAND.white, ';border-radius:18px;overflow:hidden;border:1px solid #e7e8ea;">',
          '<div style="background:', REC_BRAND.white, ';padding:26px;text-align:center;">',
            '<img src="cid:', logoCid, '" alt="Melrose Group Realty" style="max-width:290px;width:72%;height:auto;">',
          '</div>',
          '<div style="height:5px;background:', REC_BRAND.gold, ';"></div>',
          '<div style="padding:32px 34px;color:#202124;font-size:16px;line-height:1.7;">',
            '<p style="margin-top:0;">', copy.greeting, '</p>',
            '<h1 style="font-size:25px;line-height:1.3;color:', REC_BRAND.navy, ';font-weight:700;margin:18px 0;">',
              copy.headline,
            '</h1>',
            '<p>', copy.body, '</p>',
            '<div style="background:#F8F5EE;border-left:4px solid ', REC_BRAND.gold, ';padding:18px 20px;margin:24px 0;border-radius:8px;">',
              '<strong style="color:', REC_BRAND.navy, ';">What you can start thinking about now</strong>',
              '<div style="margin-top:10px;">Broker support &bull; Training &bull; Lead generation &bull; Systems &bull; Long-term growth</div>',
            '</div>',
            '<p>', copy.support, '</p>',
            '<p>', copy.close, '</p>',
            '<div style="text-align:center;margin:30px 0 18px;">',
              '<a href="', consultationUrl, '" style="display:inline-block;background:', REC_BRAND.gold, ';color:', REC_BRAND.navy, ';font-weight:700;text-decoration:none;padding:14px 22px;border-radius:8px;margin:4px;">Schedule a Conversation</a>',
              '<a href="', academyUrl, '" style="display:inline-block;background:', REC_BRAND.navy, ';color:#fff;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:8px;margin:4px;">Explore Agent Academy</a>',
            '</div>',
          '</div>',
          '<div style="padding:10px 28px 28px;text-align:center;background:#fff;">',
            '<img src="cid:', cardCid, '" alt="Ulysses A. Barnes, Jr. - Broker, Melrose Group Realty" style="max-width:520px;width:100%;height:auto;border-radius:10px;">',
          '</div>',
          REC_buildComplianceFooter(unsubscribeUrl),
        '</div>',
      '</div>',
    '</div>'
  ].join('');

  const plainText = [
    copy.greeting,
    '',
    copy.headline,
    '',
    copy.body,
    '',
    copy.support,
    '',
    copy.close,
    '',
    'Melrose Group Realty',
    'Licensed in Louisiana • (985) 250-0071 • Mandeville, LA',
    REC_BRAND.website,
    '',
    'Unsubscribe: ' + unsubscribeUrl
  ].join('\n');

  return {
    subject: REC_getPreLicenseSubject(recruit),
    html: html,
    plainText: plainText,
    inlineImageKeys: {
      logo: logoCid,
      businessCard: cardCid
    }
  };
}
