/******************************************************************************
 * MelroseOS Enterprise
 * Lead Lifecycle Management
 * File: LC-04_FollowUpLifecycleBridge.gs
 * Version: 1.0.0
 ******************************************************************************/

function LC_syncFollowUpLifecycle(limit) {
  LC_initializeCore();

  const max = Math.max(1, Number(limit || 100));

  if (typeof NF_sheetObjects_ !== "function") {
    return {
      success: true,
      processed: 0,
      skipped: true,
      reason: "Notification module unavailable."
    };
  }

  const notifications = NF_sheetObjects_(
    NF.SHEETS.QUEUE
  )
    .filter(function(item) {
      return String(item.LeadID || "").trim() !== "";
    })
    .slice(0, max);

  const byLead = {};

  notifications.forEach(function(item) {
    const leadId = String(item.LeadID || "").trim();

    if (!byLead[leadId]) {
      byLead[leadId] = [];
    }

    byLead[leadId].push(item);
  });

  const results = [];

  Object.keys(byLead).forEach(function(leadId) {
    try {
      LC_createOrUpdateLifecycle(leadId);

      const queued = byLead[leadId]
        .filter(function(item) {
          return String(item.Status || "").toUpperCase() === "QUEUED";
        })
        .sort(function(a, b) {
          return new Date(a.ScheduledAt || 0) - new Date(b.ScheduledAt || 0);
        });

      LC_setNextFollowUp(
        leadId,
        queued.length
          ? queued[0].ScheduledAt
          : ""
      );

      results.push({
        success: true,
        leadId: leadId,
        queuedFollowUps: queued.length
      });

    } catch (error) {
      results.push({
        success: false,
        leadId: leadId,
        error: error.message || String(error)
      });
    }
  });

  return {
    success: results.every(function(r) { return r.success; }),
    processed: results.length,
    results: results
  };
}

function LC_testFollowUpLifecycleBridge() {
  LC_initializeCore();

  Logger.log(JSON.stringify({
    success: true,
    notificationModuleAvailable:
      typeof NF_sheetObjects_ === "function"
  }));

  return true;
}
