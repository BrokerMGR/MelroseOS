const INTAKE_CRM_MATCHER = Object.freeze({

  VERSION: '1.0.0',

  MATCH_EMAIL: true,

  MATCH_PHONE: true,

  MATCH_ADDRESS: true,

  PRESERVE_EXISTING_OWNER: true,

  PRESERVE_MANUAL_ASSIGNMENT: true

});

function INTAKE_matchExistingCRMLead(candidate, existingLeads) {

  const leads = Array.isArray(existingLeads)
    ? existingLeads
    : [];

  return leads.find(function(existing) {

    if (
      INTAKE_CRM_MATCHER.MATCH_EMAIL &&
      candidate.email &&
      existing.email &&
      String(candidate.email).toLowerCase() ===
        String(existing.email).toLowerCase()
    ) {
      return true;
    }

    if (
      INTAKE_CRM_MATCHER.MATCH_PHONE &&
      candidate.phone &&
      existing.phone &&
      String(candidate.phone).replace(/\D/g, '') ===
        String(existing.phone).replace(/\D/g, '')
    ) {
      return true;
    }

    if (
      INTAKE_CRM_MATCHER.MATCH_ADDRESS &&
      candidate.address &&
      existing.address &&
      String(candidate.address).toLowerCase() ===
        String(existing.address).toLowerCase()
    ) {
      return true;
    }

    return false;

  }) || null;

}

function INTAKE_buildCRMMatchResult(candidate, existingLeads) {

  const match =
    INTAKE_matchExistingCRMLead(
      candidate,
      existingLeads
    );

  return {

    matched:
      match !== null,

    existingLead:
      match,

    preserveOwnership:
      match !== null &&
      INTAKE_CRM_MATCHER.PRESERVE_EXISTING_OWNER,

    preserveManualAssignment:
      match !== null &&
      INTAKE_CRM_MATCHER.PRESERVE_MANUAL_ASSIGNMENT,

    checkedAt:
      new Date().toISOString()

  };

}