const INTAKE_GMAIL_ACCOUNTS = Object.freeze([

  {
    id: 'BROKER',
    email: 'melrosegroupbroker@gmail.com',
    priority: 1,
    enabled: true
  },

  {
    id: 'BROKERAGE',
    email: 'melrosegrouprealty@gmail.com',
    priority: 2,
    enabled: true
  },

  {
    id: 'LEAD_DISTRIBUTION',
    email: 'agentleadcentral@gmail.com',
    priority: 3,
    enabled: true
  },

  {
    id: 'STAFF',
    email: 'melrosegroupstaff@gmail.com',
    priority: 4,
    enabled: true
  },

  {
    id: 'LEADS_VAULT',
    email: 'melrosegroupleads@gmail.com',
    priority: 5,
    enabled: true
  }

]);

function INTAKE_getAccounts() {

  return JSON.parse(JSON.stringify(INTAKE_GMAIL_ACCOUNTS));

}

function INTAKE_getEnabledAccounts() {

  return INTAKE_GMAIL_ACCOUNTS.filter(a => a.enabled);

}

function INTAKE_getAccount(email) {

  return INTAKE_GMAIL_ACCOUNTS.find(a =>

    a.email.toLowerCase() === String(email).toLowerCase()

  ) || null;

}