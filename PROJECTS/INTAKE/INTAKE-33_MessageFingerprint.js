const INTAKE_FINGERPRINT = Object.freeze({

  VERSION: '1.0.0',

  FIELDS: [

    'MESSAGE_ID',

    'THREAD_ID',

    'FROM',

    'TO',

    'SUBJECT',

    'DATE',

    'EMAIL',

    'PHONE'

  ]

});

function INTAKE_createFingerprint(message) {

  return {

    messageId: message.messageId || '',

    threadId: message.threadId || '',

    email: message.email || '',

    phone: message.phone || '',

    created: new Date().toISOString()

  };

}

function INTAKE_compareFingerprints(a, b) {

  return (

    a.messageId === b.messageId ||

    (a.email && a.email === b.email) ||

    (a.phone && a.phone === b.phone)

  );

}