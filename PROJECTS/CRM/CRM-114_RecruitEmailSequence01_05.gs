const MGR_RECRUIT_SEQ_VERSION = '1.0.0';
const MGR_RECRUIT_CESHOP_URL = 'https://share.theceshop.com/by/ulyssesMGR';

function MGR_RECRUIT_email_(n, lead) {
  lead = lead || {};
  const first = MGR_RECRUIT_escape_(lead.firstName || 'there');
  const credential = MGR_RECRUIT_escape_(lead.credentialNumber || '[Credential Number]');
  const appDate = MGR_RECRUIT_escape_(lead.applicationDate || '[Application Date]');
  const messages = [
    {
      subject: 'Your Louisiana real estate next steps - ' + first,
      html: '<h2>Your application is moving forward. Here is what comes next.</h2>' +
      '<p>Hi ' + first + ',</p>' +
      '<p>You have already completed an important milestone: the 90-hour Louisiana salesperson pre-license education. Now the process becomes much more practical.</p>' +
      '<div style="background:#f4f7fa;border-left:4px solid #c7a35a;padding:16px;margin:18px 0;"><strong>Your LREC information</strong><br>Credential / License Number: <strong>' + credential + '</strong><br>Application Date: <strong>' + appDate + '</strong></div>' +
      '<h3>Your immediate checklist</h3><ol><li>Watch for Pearson VUE communication and schedule your Louisiana salesperson examination.</li><li>Begin the background-check and fingerprinting process through IdentoGO.</li><li>Prepare for and pass both the National and Louisiana State portions.</li><li>After passing both portions, complete Initial Real Estate License Application - Part B.</li><li>Complete the required E&amp;O insurance step.</li><li>Select a sponsoring broker if you plan to practice in active status.</li></ol>' +
      '<h3>Do not walk into the exam guessing</h3><p>Melrose Group Realty recommends The CE Shop Exam Prep as one preparation option. Its free initial assessment can help identify areas that need more study and support a customized study approach for the National and State portions.</p>' +
      '<p><strong>Current referral offer: 35% off your first order.</strong></p><p><a href="' + MGR_RECRUIT_CESHOP_URL + '" style="display:inline-block;background:#c7a35a;color:#10243d;padding:12px 18px;text-decoration:none;font-weight:bold;border-radius:6px;">View The CE Shop Offer</a></p>' +
      '<p style="font-size:12px;color:#666;">Referral disclosure: I may receive a referral reward if you make a qualifying purchase through this link.</p>' +
      '<h3>Melrose Group Realty is actively looking for new agents to mentor.</h3><p>We are actively seeking new Louisiana agents who want coaching, structure, practical guidance and a brokerage that wants to help them build a real business. You do not have to know everything on day one. That is exactly why mentorship matters.</p>'
    },
    {
      subject: 'Before exam day: fingerprints, background check and preparation',
      html: '<h2>Handle the administrative steps while you prepare for the exam.</h2><p>Hi ' + first + ',</p><p>One of the easiest mistakes at this stage is focusing only on the exam and allowing the other licensing steps to sit untouched.</p><h3>Focus on three tracks at the same time</h3><ol><li><strong>Exam scheduling:</strong> follow the Pearson VUE instructions you receive after LREC processes your application.</li><li><strong>Fingerprinting/background check:</strong> begin the IdentoGO process rather than waiting until after the exam.</li><li><strong>Exam preparation:</strong> build a study plan for both the National and Louisiana State portions.</li></ol><p>Your credential number is <strong>' + credential + '</strong>. Keep your LREC and Pearson VUE records organized.</p><h3>Why brokerage conversations should start now</h3><p>Compensation matters, but so do broker availability, training, transaction support, technology, lead opportunities, compliance systems and expectations for new agents.</p><p><strong>Melrose Group Realty is actively seeking new agents to mentor and develop in the Louisiana market.</strong> Our goal is not simply to add names to a roster. We want agents who are ready to learn how to build sustainable careers.</p>'
    },
    {
      subject: 'What happens after you pass both portions of the Louisiana exam?',
      html: '<h2>Passing the exam is a milestone - not the final licensing step.</h2><p>Hi ' + first + ',</p><p>After you pass both the National and Louisiana State portions, the next major LREC step is completing Initial Real Estate License Application - Part B and handling the required E&amp;O insurance documentation/payment.</p><h3>Think ahead</h3><ul><li>Complete Part B promptly after passing both exam portions.</li><li>Determine how you will satisfy the E&amp;O requirement.</li><li>Decide whether you are going active with a sponsoring broker or requesting inactive status.</li><li>If going active, understand the brokerage onboarding process before you affiliate.</li></ul><p>LREC allows an applicant who does not plan to practice immediately or does not yet have a sponsoring broker to request issuance in inactive status.</p><h3>We are recruiting - and mentorship is the point.</h3><p><strong>Melrose Group Realty is actively seeking new Louisiana agents who want hands-on mentorship, accessible broker support and a system designed to help them move from newly licensed to productive.</strong></p><p>Ask every brokerage you interview: <strong>What happens after I sign?</strong></p>'
    },
    {
      subject: 'The 45-hour Louisiana post-license requirement: plan for it now',
      html: '<h2>Your education does not stop when the license is issued.</h2><p>Hi ' + first + ',</p><p>Louisiana initial salesperson licensees have a one-time <strong>45-hour post-license education requirement</strong> that must be completed within <strong>180 days of the initial license date</strong>. The post-license course includes an examination on the course content.</p><h3>How it interacts with annual CE</h3><p>Active Louisiana licensees generally complete 12 hours of approved CE each year, including the LREC mandatory course topic. Louisiana law allows post-license education, in the year completed, to satisfy <strong>eight hours of the 12-hour annual CE requirement</strong>. It does <strong>not</strong> satisfy the four-hour LREC mandatory topic.</p><p>In practical terms: the post-license requirement can cover eight CE hours for that year, but the applicable LREC mandatory course still has to be completed.</p><h3>Build the habit now</h3><p>At Melrose Group Realty, we want agents to understand deadlines before they become emergencies. <strong>We are actively recruiting new agents who want this type of ongoing mentorship and accountability.</strong></p>'
    },
    {
      subject: 'License vs. REALTOR membership: know the difference from day one',
      html: '<h2>Getting licensed and becoming a REALTOR are related - but they are not the same thing.</h2><p>Hi ' + first + ',</p><p>Your Louisiana real estate license is issued and regulated by LREC. REALTOR membership is association membership and carries additional professional obligations and benefits. Local board/association onboarding, MLS access and related requirements depend on where and how you practice.</p><h3>Two items to understand early</h3><p><strong>Code of Ethics:</strong> new REALTOR members must complete qualifying new-member ethics orientation/training of at least 2 hours and 30 minutes.</p><p><strong>Fair Housing / Anti-Bias:</strong> NAR requires qualifying training upon becoming a member and every three years thereafter on the ethics-training cycle.</p><p>Your local association can explain its orientation, MLS onboarding, dues and scheduling. Do not assume every board operates identically.</p><h3>The bigger picture</h3><p>There is a lot to absorb between passing an exam and building a career. <strong>Melrose Group Realty is actively seeking new Louisiana agents to mentor, coach and build up in the market.</strong> We want agents to understand not just how to get licensed, but how to operate professionally once active.</p>'
    }
  ];
  return messages[n - 1];
}

function MGR_RECRUIT_getFirstFive_(lead) {
  return [1,2,3,4,5].map(function(n) { return MGR_RECRUIT_email_(n, lead); });
}

function MGR_RECRUIT_escape_(value) {
  return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function MGR_RECRUIT_previewFirstFive() {
  return MGR_RECRUIT_getFirstFive_({
    firstName:'Test Recruit',
    credentialNumber:'[Credential Number from roster]',
    applicationDate:'[Application Date from roster]'
  });
}

function MGR_RECRUIT_sendFirstFiveTestsToBroker() {
  const recipient = 'melrosegroupbroker@gmail.com';
  const lead = {firstName:'Ulysses', credentialNumber:'[TEST - Credential Number]', applicationDate:'[TEST - Application Date]'};
  const messages = MGR_RECRUIT_getFirstFive_(lead);
  messages.forEach(function(message, i) {
    if (
      typeof MGRCORE === 'undefined' ||
      typeof MGRCORE.MGR_CORE_sendCompliantEmail !== 'function'
    ) {
      throw new Error(
        'MGRCORE public email bridge is required for compliant email delivery.'
      );
    }

    MGRCORE.MGRCORE.MGRCORE.MGR_CORE_sendCompliantEmail({
      to:recipient,
      subject:'[RECRUIT TEST ' + (i+1) + '/5] ' + message.subject,
      htmlBody:message.html,
      message:{campaign:'RECRUIT_MENTORSHIP',sequence:i+1,test:true}
    });
  });
  return {success:true,recipient:recipient,count:5,version:MGR_RECRUIT_SEQ_VERSION,timestamp:new Date().toISOString()};
}
