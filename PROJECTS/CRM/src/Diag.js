  /**
 * MOS5-M1-A4 — Candidate Trigger Runtime Diagnostic
 * READ ONLY.
 * Candidate Script ID: 1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd
 *
 * Deploy ONLY into this candidate project temporarily.
 * Run: MOS5P_M1A4_runtimeTriggerInventory
 *
 * This function does not create, delete, disable, or modify triggers.
 */
function MOS5P_M1A4_runtimeTriggerInventory() {
  const triggers = ScriptApp.getProjectTriggers();

  const rows = triggers.map(function(t) {
    return {
      handlerFunction: t.getHandlerFunction(),
      eventType: String(t.getEventType()),
      triggerSource: String(t.getTriggerSource()),
      triggerSourceId:
        typeof t.getTriggerSourceId === 'function'
          ? String(t.getTriggerSourceId() || '')
          : ''
    };
  });

  const r = {
    success: true,
    release: 'MOS5-M1-A4',
    mode: 'READ_ONLY_RUNTIME_TRIGGER_CHECK',
    candidateScriptId: '1WlbanBGbO_Z_p3DvwLhBWzmLJ0F4FODIvx4AtvOoiQItZilRHW_2m_Rd',
    triggerCount: rows.length,
    rows: rows,
    safety: {
      triggerMutationPerformed: false,
      triggerDeleted: false,
      emailSent: false,
      gmailMutationPerformed: false
    },
    result: 'PASS'
  };

  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

