const INTAKE_DEDUP = Object.freeze({

  VERSION: '1.0.0',

  MATCH_FIELDS: [

    'messageId',

    'threadId',

    'email',

    'phone',

    'address'

  ],

  REQUIRE_EXISTING_OWNER_LOCK: true

});

function INTAKE_findDuplicate(candidate, existing) {

  return existing.find(record =>

    record.messageId === candidate.messageId ||

    (candidate.email && record.email === candidate.email) ||

    (candidate.phone && record.phone === candidate.phone)

  ) || null;

}

function INTAKE_isDuplicate(candidate, existing) {

  return INTAKE_findDuplicate(candidate, existing) !== null;

}

function INTAKE_buildDedupResult(candidate, existing) {

  const duplicate = INTAKE_findDuplicate(candidate, existing);

  return {

    duplicate: duplicate !== null,

    existingLead: duplicate,

    preserveOwnership:

      INTAKE_DEDUP.REQUIRE_EXISTING_OWNER_LOCK

  };

}