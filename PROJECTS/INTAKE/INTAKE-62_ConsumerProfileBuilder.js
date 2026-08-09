const INTAKE_CONSUMER_PROFILE = Object.freeze({

  VERSION: '1.0.0'

});

function INTAKE_buildConsumerProfile(parsed) {

  const lead = INTAKE_buildLeadModel(parsed);

  const name = INTAKE_extractName(parsed.normalized);

  const contacts = INTAKE_extractContacts(parsed.normalized);

  const addresses = INTAKE_extractAddresses(parsed.normalized);

  lead.firstName = name.firstName;
  lead.lastName = name.lastName;

  if (!lead.email && contacts.emails.length) {
    lead.email = contacts.emails[0];
  }

  if (!lead.phone && contacts.phones.length) {
    lead.phone = contacts.phones[0];
  }

  lead.city = addresses.city;
  lead.parish = addresses.parish;
  lead.state = addresses.state;
  lead.zip = addresses.zip;

  return lead;

}

function INTAKE_profileCompleteness(profile) {

  let score = 0;

  if (profile.firstName) score += 15;
  if (profile.lastName) score += 15;
  if (profile.email) score += 20;
  if (profile.phone) score += 20;
  if (profile.city) score += 10;
  if (profile.parish) score += 10;
  if (profile.leadType !== 'UNKNOWN') score += 10;

  return Math.min(score,100);

}