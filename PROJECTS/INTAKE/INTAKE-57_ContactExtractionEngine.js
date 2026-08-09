const INTAKE_CONTACT_EXTRACTION = Object.freeze({

  VERSION: '1.0.0',

  EMAIL_REGEX: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,

  PHONE_REGEX: /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g

});

function INTAKE_extractContacts(message) {

  const text = [

    message.from || '',

    message.subject || '',

    message.body || ''

  ].join('\n');

  return {

    emails:

      [...new Set(text.match(INTAKE_CONTACT_EXTRACTION.EMAIL_REGEX) || [])],

    phones:

      [...new Set(text.match(INTAKE_CONTACT_EXTRACTION.PHONE_REGEX) || [])],

    extractedAt:

      new Date().toISOString()

  };

}

function INTAKE_hasContactInformation(message) {

  const contacts = INTAKE_extractContacts(message);

  return contacts.emails.length > 0 ||

         contacts.phones.length > 0;

}