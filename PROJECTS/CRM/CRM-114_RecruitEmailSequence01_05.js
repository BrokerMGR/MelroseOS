/**
 * MelroseOS CRM
 * File: CRM-114_RecruitEmailSequence01_05.gs
 * Version: 2.0.1
 *
 * First five mentorship emails.
 * Certification logic corrected to inspect outbound content only.
 */

function MGR_RECRUIT_getFirstFive_(person) {
  person = person || {};

  const firstName =
    MGR_RECRUIT_114_escape_(
      person.firstName || 'Future Agent'
    );

  const credentialNumber =
    MGR_RECRUIT_114_escape_(
      person.credentialNumber || 'Not provided'
    );

  const applicationDate =
    MGR_RECRUIT_114_escape_(
      person.applicationDate || 'Not provided'
    );

  const consult =
    'https://melrosegrouprealty.com/book-now';

  const academy =
    'https://melrosegrouprealty.com/agent-academy/';

  return [
    {
      sequence: 1,
      subject:
        firstName +
        ', your Louisiana real estate career starts with the next right step',
      html:
        '<p>Hello ' + firstName + ',</p>' +
        '<p>Congratulations on reaching this stage of the Louisiana real estate licensing process. Completing your pre-license education is a major step, but the next steps are what turn that education into an actual career.</p>' +
        '<p><strong>Your current application information:</strong></p>' +
        '<p>Credential / License Number: <strong>' +
          credentialNumber +
        '</strong><br>Application Date: <strong>' +
          applicationDate +
        '</strong></p>' +
        '<p><strong>Your immediate roadmap:</strong></p>' +
        '<p>1. Confirm that you have been authorized to test.<br>' +
        '2. Once authorized, schedule your Louisiana salesperson examination with Pearson VUE. You are responsible for making the examination reservation; do not wait for the exam to be scheduled automatically.<br>' +
        '3. Prepare for both the national and Louisiana portions of the examination.<br>' +
        '4. Keep your licensing paperwork, identification, education records, and application information organized.<br>' +
        '5. Begin thinking seriously about the brokerage and broker support you want before you become active.</p>' +
        '<p>Melrose Group Realty is actively seeking new Louisiana agents to mentor and develop. My goal with these emails is to help you understand the process, avoid preventable mistakes, and make better decisions as you move toward becoming an active real estate professional.</p>' +
        '<p>Whether you ultimately affiliate with Melrose Group Realty or another Louisiana brokerage, you should understand the process and the questions you need to ask before choosing where to build your career.</p>' +
        MGR_RECRUIT_114_buttons_(consult, academy)
    },
    {
      sequence: 2,
      subject:
        firstName +
        ', preparing for both portions of the Louisiana real estate exam',
      html:
        '<p>Hello ' + firstName + ',</p>' +
        '<p>As you prepare for the Louisiana salesperson examination, treat the national and state portions as two separate challenges. Build a study plan that gives both portions dedicated attention instead of assuming one strong area will carry the other.</p>' +
        '<p><strong>A practical broker recommendation:</strong> study in short, consistent blocks; identify weak topics early; practice calculations; review agency and contract concepts carefully; and leave time to revisit Louisiana-specific material before test day.</p>' +
        '<p>Once you are authorized to test, you schedule your exam directly through Pearson VUE. Keep your authorization information and identification requirements handy when making the reservation and when reporting for the examination.</p>' +
        '<p>Passing the exam is important, but it is not the finish line. Your brokerage choice, licensing completion steps, early education, and first several months of activity will have a major impact on how confidently you enter the business.</p>' +
        '<p>If you want help mapping out those next steps before test day, I am happy to walk through them with you.</p>' +
        MGR_RECRUIT_114_buttons_(consult, academy)
    },
    {
      sequence: 3,
      subject:
        firstName +
        ', what happens after you pass the Louisiana real estate exam?',
      html:
        '<p>Hello ' + firstName + ',</p>' +
        '<p>Many new license candidates focus so heavily on passing the exam that they do not plan for what happens immediately afterward. That is where having a clear roadmap matters.</p>' +
        '<p>After you pass the required examination portions, you still need to complete the licensing steps required for your situation. That can include sponsoring-broker paperwork, background or fingerprint-related requirements, and other LREC documentation before you are ready to practice.</p>' +
        '<p>This is also the point where brokerage selection becomes much more than a commission-split decision. You should be evaluating broker availability, contract support, training, technology, lead systems, accountability, fees, onboarding, and what happens when you encounter your first difficult transaction.</p>' +
        '<p>Melrose Group Realty is intentionally building around mentorship and accessible broker support for agents who want to learn the business correctly from the beginning.</p>' +
        '<p>If you would like to talk through what you should be looking for in your first brokerage, schedule a consultation and bring your questions.</p>' +
        MGR_RECRUIT_114_buttons_(consult, academy)
    },
    {
      sequence: 4,
      subject:
        firstName +
        ', your first 180 days as a Louisiana licensee matter',
      html:
        '<p>Hello ' + firstName + ',</p>' +
        '<p>Your education does not stop when the license is issued. Louisiana new-license education requirements continue after initial licensure, and you should build those requirements into your first-year plan instead of waiting until a deadline is close.</p>' +
        '<p>The 45-hour post-license requirement is tied to the initial license date, so your first 180 days need to be managed intentionally. Your post-license education, annual continuing-education responsibilities, required topics, association obligations, and actual sales training are related but not identical.</p>' +
        '<p>That distinction matters. New agents sometimes assume that completing one requirement automatically satisfies everything else. A good brokerage should help you track what is required, what is optional professional development, and what directly improves your ability to serve clients.</p>' +
        '<p>Melrose Group Realty is building its Agent Academy and internal systems so agents can see their responsibilities, training, and next steps in one place instead of trying to remember everything from scattered emails.</p>' +
        '<p>If you want to discuss how your first 180 days could be structured, schedule a consultation with me.</p>' +
        MGR_RECRUIT_114_buttons_(consult, academy)
    },
    {
      sequence: 5,
      subject:
        firstName +
        ', the questions you should ask before choosing a brokerage',
      html:
        '<p>Hello ' + firstName + ',</p>' +
        '<p>Before you choose a brokerage, ask questions that go much deeper than the split.</p>' +
        '<p><strong>Ask the broker:</strong><br>' +
        'Who helps me when I do not understand a contract?<br>' +
        'How quickly can I reach my broker when something goes wrong?<br>' +
        'What does onboarding actually include?<br>' +
        'How are leads handled and protected?<br>' +
        'What training exists after licensing?<br>' +
        'What technology and systems will I receive?<br>' +
        'What fees will I pay and when?<br>' +
        'How will I learn to generate business instead of waiting for business to appear?</p>' +
        '<p>Your first brokerage should help you become a capable professional, not simply add your license to a roster.</p>' +
        '<p>Melrose Group Realty is actively seeking new agents who want mentorship, accountability, technology, and accessible broker guidance while they build their Louisiana real estate careers.</p>' +
        '<p>If that is the type of environment you are looking for, this is a good time to schedule a confidential consultation so we can discuss your goals, what support you need, and whether Melrose Group Realty is the right fit.</p>' +
        MGR_RECRUIT_114_buttons_(consult, academy)
    }
  ];
}

function MGR_RECRUIT_114_buttons_(consult, academy) {
  return (
    '<p><a href="' + consult + '">Schedule a Consultation</a></p>' +
    '<p><a href="' + academy + '">Explore the Agent Academy</a></p>'
  );
}

function MGR_RECRUIT_114_escape_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function RUN_RECRUIT_FIRST_FIVE_CONTENT_CERTIFICATION() {
  const sample = MGR_RECRUIT_getFirstFive_({
    firstName: 'Test',
    credentialNumber: 'TEST-123',
    applicationDate: '08/09/2026'
  });

  const blob = sample
    .map(function(m) {
      return [
        String(m.subject || ''),
        String(m.html || '')
      ].join(' ');
    })
    .join(' ')
    .toLowerCase();

  const prohibited = [
    'share.theceshop.com',
    'theceshop.com',
    'the ce shop',
    '35% off',
    'exam prep discount'
  ];

  const hits = prohibited.filter(function(term) {
    return !!term && blob.indexOf(term) >= 0;
  });

  const uniqueSubjects =
    sample.length === 5 &&
    new Set(
      sample.map(function(m) {
        return String(m.subject || '');
      })
    ).size === 5;

  const result = {
    success:
      sample.length === 5 &&
      uniqueSubjects &&
      hits.length === 0 &&
      blob.indexOf('pearson vue') >= 0 &&
      blob.indexOf('test-123') >= 0 &&
      blob.indexOf('08/09/2026') >= 0,

    messageCount: sample.length,
    uniqueSubjects: uniqueSubjects,
    prohibitedHits: hits,

    containsPearsonVueSchedulingGuidance:
      blob.indexOf('pearson vue') >= 0,

    containsCredentialNumber:
      blob.indexOf('test-123') >= 0,

    containsApplicationDate:
      blob.indexOf('08/09/2026') >= 0,

    timestamp:
      new Date().toISOString()
  };

  console.log(
    'RUN_RECRUIT_FIRST_FIVE_CONTENT_CERTIFICATION\n' +
    JSON.stringify(
      result,
      null,
      2
    )
  );

  if (!result.success) {
    console.error(
      'FIRST FIVE CONTENT CERTIFICATION: FAIL'
    );
  } else {
    console.log(
      'FIRST FIVE CONTENT CERTIFICATION: PASS'
    );
  }

  return result;
}
