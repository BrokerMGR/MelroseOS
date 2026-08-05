/******************************************************************************
 * MelroseOS Enterprise
 * Assignment Engine Migration
 * File: AE-04_LeadLock.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Maintains persistent lead-to-agent locks so repeat leads stay with the
 *   same assigned agent.
 *
 * Requires:
 *   AE-01_Core.gs
 *   AE-02_Config.gs
 *   AE-03_AgentRegistry.gs
 ******************************************************************************/

function AE_findLeadLock(email, phone) {
  if (!AE_getBooleanConfig_("LEAD_LOCK_ENABLED", true)) {
    return null;
  }

  const keys = AE_buildLeadKeys_(email, phone);

  if (!keys.length) {
    return null;
  }

  const locks = AE_sheetObjects_(AE.SHEETS.LOCKS);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    for (let j = 0; j < locks.length; j++) {
      const lock = locks[j];

      if (
        String(lock.LeadKey || "").trim() === key &&
        AE_isTrue_(lock.Active)
      ) {
        return lock;
      }
    }
  }

  return null;
}

function AE_createOrUpdateLeadLock(lead, agent) {
  if (!AE_getBooleanConfig_("LEAD_LOCK_ENABLED", true)) {
    return null;
  }

  if (!lead) {
    throw new Error("Lead record is required.");
  }

  if (!agent) {
    throw new Error("Agent record is required.");
  }

  const agentId = String(agent.AgentID || agent.agentId || "").trim();
  const agentName = String(agent.AgentName || agent.name || "").trim();
  const leadId = String(lead.LeadID || lead.leadId || "").trim();

  if (!agentId) {
    throw new Error("AgentID is required to create a lead lock.");
  }

  const keys = AE_buildLeadKeys_(
    lead.Email || lead.email,
    lead.Phone || lead.phone
  );

  if (!keys.length) {
    AE_log_(
      "LEAD_LOCK_SKIPPED",
      "No usable email or phone was available for lead lock.",
      leadId,
      agentId
    );

    return null;
  }

  const results = [];

  keys.forEach(function(key) {
    results.push(
      AE_upsertLeadLock_(key, leadId, agentId, agentName)
    );
  });

  AE_log_(
    "LEAD_LOCK_UPDATED",
    "Lead lock created or refreshed for " + keys.join(", ") + ".",
    leadId,
    agentId
  );

  return results;
}

function AE_upsertLeadLock_(leadKey, leadId, agentId, agentName) {
  const sheet = workbook_().getSheetByName(AE.SHEETS.LOCKS);

  if (!sheet) {
    throw new Error("AE_LEAD_LOCKS sheet is missing.");
  }

  const existing = AE_findLeadLockByKey_(leadKey);
  const now = timestamp_();

  if (existing) {
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0];

    const updates = {
      LeadID: leadId || existing.LeadID,
      AgentID: agentId,
      AgentName: agentName,
      LastSeenAt: now,
      Active: true
    };

    Object.keys(updates).forEach(function(header) {
      const col = headers.indexOf(header) + 1;

      if (col) {
        sheet.getRange(existing._row, col).setValue(updates[header]);
      }
    });

    return {
      lockId: existing.LockID,
      leadKey: leadKey,
      updated: true
    };
  }

  const lockId = AE_uuid_("LCK");

  sheet.appendRow([
    lockId,
    leadKey,
    leadId,
    agentId,
    agentName,
    now,
    now,
    true
  ]);

  return {
    lockId: lockId,
    leadKey: leadKey,
    updated: false
  };
}

function AE_findLeadLockByKey_(leadKey) {
  const locks = AE_sheetObjects_(AE.SHEETS.LOCKS);
  const target = String(leadKey || "").trim();

  for (let i = 0; i < locks.length; i++) {
    if (String(locks[i].LeadKey || "").trim() === target) {
      return locks[i];
    }
  }

  return null;
}

function AE_buildLeadKeys_(email, phone) {
  const priority = String(
    AE_getConfigValue(
      "LEAD_LOCK_KEY_PRIORITY",
      "EMAIL_THEN_PHONE"
    )
  ).toUpperCase();

  const emailKey = AE_normalizeEmail_(email)
    ? "EMAIL:" + AE_normalizeEmail_(email)
    : "";

  const phoneKey = AE_normalizePhone_(phone)
    ? "PHONE:" + AE_normalizePhone_(phone)
    : "";

  let keys = [];

  if (priority === "PHONE_THEN_EMAIL") {
    keys = [phoneKey, emailKey];
  } else {
    keys = [emailKey, phoneKey];
  }

  return keys.filter(function(key, index, array) {
    return key && array.indexOf(key) === index;
  });
}

function AE_resolveLockedAgent(email, phone) {
  const lock = AE_findLeadLock(email, phone);

  if (!lock) {
    return null;
  }

  const agent = AE_getAgent(lock.AgentID);

  if (!agent) {
    AE_log_(
      "INVALID_LEAD_LOCK",
      "Lead lock references missing agent " + lock.AgentID + ".",
      lock.LeadID,
      lock.AgentID
    );

    return null;
  }

  if (!AE_isTrue_(agent.Active)) {
    AE_log_(
      "INACTIVE_LOCKED_AGENT",
      "Lead lock references an inactive agent.",
      lock.LeadID,
      lock.AgentID
    );

    return null;
  }

  return {
    lock: lock,
    agent: agent
  };
}

function AE_deactivateLeadLock(email, phone) {
  const keys = AE_buildLeadKeys_(email, phone);
  let updated = 0;

  keys.forEach(function(key) {
    const lock = AE_findLeadLockByKey_(key);

    if (!lock) return;

    const sheet = workbook_().getSheetByName(AE.SHEETS.LOCKS);
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0];

    const activeCol = headers.indexOf("Active") + 1;
    const lastSeenCol = headers.indexOf("LastSeenAt") + 1;

    if (activeCol) {
      sheet.getRange(lock._row, activeCol).setValue(false);
    }

    if (lastSeenCol) {
      sheet.getRange(lock._row, lastSeenCol).setValue(timestamp_());
    }

    updated++;
  });

  return updated;
}

function AE_reassignLeadLock(email, phone, newAgentId) {
  const agent = AE_getAgent(newAgentId);

  if (!agent) {
    throw new Error("New agent not found: " + newAgentId);
  }

  const keys = AE_buildLeadKeys_(email, phone);

  if (!keys.length) {
    throw new Error("Email or phone is required to reassign a lead lock.");
  }

  let updated = 0;

  keys.forEach(function(key) {
    const existing = AE_findLeadLockByKey_(key);

    if (existing) {
      AE_upsertLeadLock_(
        key,
        existing.LeadID,
        agent.AgentID,
        agent.AgentName
      );
      updated++;
    }
  });

  AE_log_(
    "LEAD_LOCK_REASSIGNED",
    "Lead lock reassigned to " + agent.AgentName + ".",
    "",
    agent.AgentID
  );

  return updated;
}

function AE_getLeadLockSummary() {
  const locks = AE_sheetObjects_(AE.SHEETS.LOCKS);

  const active = locks.filter(function(lock) {
    return AE_isTrue_(lock.Active);
  });

  const uniqueAgents = {};

  active.forEach(function(lock) {
    const agentId = String(lock.AgentID || "").trim();

    if (agentId) {
      uniqueAgents[agentId] = true;
    }
  });

  return {
    totalLocks: locks.length,
    activeLocks: active.length,
    inactiveLocks: locks.length - active.length,
    agentsWithLocks: Object.keys(uniqueAgents).length
  };
}

function AE_testLeadLock() {
  AE_initializeConfig();

  AE_upsertAgent({
    AgentID: "AGT-LOCK-TEST",
    AgentName: "Lead Lock Test Agent",
    Email: "lead-lock-test@example.com",
    Active: true,
    AcceptingLeads: true,
    Parishes: "ALL",
    LeadTypes: "ALL",
    Priority: 999,
    DailyCap: 999
  });

  const agent = AE_getAgent("AGT-LOCK-TEST");

  AE_createOrUpdateLeadLock(
    {
      LeadID: "LEAD-LOCK-TEST",
      Email: "lead-lock-person@example.com",
      Phone: "(985) 555-0101"
    },
    agent
  );

  const result = AE_resolveLockedAgent(
    "lead-lock-person@example.com",
    "(985) 555-0101"
  );

  if (!result || result.agent.AgentID !== "AGT-LOCK-TEST") {
    throw new Error("Lead Lock self-test failed.");
  }

  Logger.log(JSON.stringify(AE_getLeadLockSummary()));

  return true;
}
