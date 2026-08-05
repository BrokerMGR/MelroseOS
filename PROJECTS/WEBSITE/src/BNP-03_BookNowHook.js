/******************************************************************************
 * MelroseOS Book Now Portal Hook
 * BNP-03_BookNowHook.gs
 * Version 1.0.0
 *
 * Call BNP_afterBookNowLeadCreated(leadId) from the EXISTING production Book
 * Now pipeline AFTER assignment/distribution succeeds.
 *
 * This avoids replacing or duplicating the current working Book Now flow.
 ******************************************************************************/

function BNP_afterBookNowLeadCreated(leadId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const prepared = BNP_prepareLeadExperience(leadId);
    const queued = BNP_queuePortalWelcomeEmail(leadId);

    CIP_RT_logSystemEvent_(leadId, "BOOK_NOW_PORTAL_EXPERIENCE_CREATED", {
      portalUrl:prepared.portalUrl,
      primaryTool:prepared.primaryTool,
      emailStatus:queued.status
    });

    return {
      success:true,
      leadId:leadId,
      portal:prepared,
      welcomeEmail:queued
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Safe manual test using an existing lead.
 * Does not create a new lead.
 */
function BNP_testExistingLeadExperience(leadId) {
  const result = BNP_prepareLeadExperience(leadId);
  Logger.log(JSON.stringify(result,null,2));
  return result;
}
