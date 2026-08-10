/**
 * MOS5 CRM-122 - Recruit Eligibility / Stop Gate
 * Final outbound worker must call this gate before enqueueing each message.
 */
function MGR_RECRUIT_canCommunicate(record) {
  record = record || {};
  const reasons = [];
  const email = String(record.email || record.Email || '').trim().toLowerCase();
  if (!email) reasons.push('MISSING_EMAIL');

  const truthy = v => ['true','yes','1','y'].includes(String(v || '').trim().toLowerCase());
  if (truthy(record.unsubscribed || record.Unsubscribed)) reasons.push('UNSUBSCRIBED');
  if (truthy(record.doNotContact || record.DoNotContact || record.DNC)) reasons.push('DO_NOT_CONTACT');
  if (truthy(record.replied || record.Replied)) reasons.push('REPLIED');

  const status = String(record.status || record.Status || record.affiliationStatus || '').toUpperCase();
  if (status === 'ACTIVE' || status === 'AFFILIATED') reasons.push('ACTIVE_BROKERAGE');

  return { success: reasons.length === 0, eligible: reasons.length === 0, reasons, email };
}

function MGR_RECRUIT_assertProductionGate(record) {
  const r = MGR_RECRUIT_canCommunicate(record);
  if (!r.eligible) throw new Error('RECRUIT_COMMUNICATION_BLOCK: ' + r.reasons.join(','));
  return r;
}
