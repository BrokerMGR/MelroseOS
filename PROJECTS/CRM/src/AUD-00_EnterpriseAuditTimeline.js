/******************************************************************************
 * MelroseOS Enterprise
 * File: AUD-00_EnterpriseAuditTimeline.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Append-only enterprise audit timeline for lifecycle and system events.
 ******************************************************************************/

const MOS5_AUDIT_VERSION = "1.0.0";

const MOS5_AUDIT = Object.freeze({
  SHEET: "SYS_AUDIT_TIMELINE",

  HEADERS: Object.freeze([
    "AuditID",
    "SequenceNumber",
    "EventID",
    "EventType",
    "AggregateType",
    "AggregateID",
    "CorrelationID",
    "CausationID",
    "ExecutionID",
    "ActorType",
    "ActorID",
    "ActorEmail",
    "Source",
    "Summary",
    "PayloadJSON",
    "MetadataJSON",
    "PreviousHash",
    "RecordHash",
    "OccurredAt",
    "RecordedAt"
  ]),

  LOCK_TIMEOUT_MS: 10000
});

/**
 * Records one immutable audit entry.
 *
 * @param {Object} event
 * @param {Object=} options
 * @return {Object}
 */
function MOS5AUD_recordEvent(event, options) {
  const input = event || {};
  const settings = options || {};

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(MOS5_AUDIT.LOCK_TIMEOUT_MS)) {
    throw new Error(
      "Audit timeline is busy. The event was not recorded."
    );
  }

  try {
    const sheet = MOS5AUD_ensureSheet_();
    const previous = MOS5AUD_getLastRecord_(sheet);
    const sequenceNumber = previous
      ? Number(previous.SequenceNumber || 0) + 1
      : 1;

    const metadata = MOS5AUD_buildMetadata_(
      input,
      settings
    );

    const occurredAt = MOS5AUD_date_(
      input.occurredAt ||
      input.timestamp ||
      input.createdAt ||
      new Date()
    );

    const recordedAt = new Date();

    const record = {
      AuditID: MOS5AUD_id_("AUD"),
      SequenceNumber: sequenceNumber,

      EventID: String(
        input.eventId ||
        input.EventID ||
        settings.eventId ||
        ""
      ).trim(),

      EventType: String(
        input.eventType ||
        input.EventType ||
        settings.eventType ||
        "AUDIT_EVENT"
      )
        .trim()
        .toUpperCase(),

      AggregateType: String(
        input.aggregateType ||
        input.AggregateType ||
        settings.aggregateType ||
        ""
      )
        .trim()
        .toUpperCase(),

      AggregateID: String(
        input.aggregateId ||
        input.AggregateID ||
        input.LeadID ||
        input.leadId ||
        input.IntakeID ||
        input.intakeId ||
        settings.aggregateId ||
        ""
      ).trim(),

      CorrelationID: String(
        input.correlationId ||
        metadata.correlationId ||
        settings.correlationId ||
        ""
      ).trim(),

      CausationID: String(
        input.causationId ||
        metadata.causationId ||
        settings.causationId ||
        ""
      ).trim(),

      ExecutionID: String(
        input.executionId ||
        input.ExecutionID ||
        metadata.executionId ||
        settings.executionId ||
        ""
      ).trim(),

      ActorType: String(
        settings.actorType ||
        metadata.actorType ||
        "SYSTEM"
      )
        .trim()
        .toUpperCase(),

      ActorID: String(
        settings.actorId ||
        metadata.actorId ||
        ""
      ).trim(),

      ActorEmail: String(
        settings.actorEmail ||
        metadata.actorEmail ||
        MOS5AUD_currentUser_()
      )
        .trim()
        .toLowerCase(),

      Source: String(
        settings.source ||
        metadata.source ||
        input.source ||
        "MELROSEOS"
      )
        .trim()
        .toUpperCase(),

      Summary: String(
        settings.summary ||
        input.summary ||
        input.message ||
        input.reason ||
        input.EventType ||
        input.eventType ||
        "MelroseOS audit event"
      ).trim(),

      PayloadJSON: MOS5AUD_safeJson_(
        input.payload !== undefined
          ? input.payload
          : input
      ),

      MetadataJSON: MOS5AUD_safeJson_(
        metadata
      ),

      PreviousHash: previous
        ? String(previous.RecordHash || "")
        : "GENESIS",

      RecordHash: "",

      OccurredAt: occurredAt,
      RecordedAt: recordedAt
    };

    record.RecordHash =
      MOS5AUD_hashRecord_(record);

    MOS5AUD_appendObjectRow_(
      sheet,
      record
    );

    return {
      success: true,
      status: "RECORDED",
      auditId: record.AuditID,
      sequenceNumber:
        record.SequenceNumber,
      eventId: record.EventID,
      eventType: record.EventType,
      aggregateType:
        record.AggregateType,
      aggregateId:
        record.AggregateID,
      recordHash:
        record.RecordHash,
      recordedAt:
        recordedAt.toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Event Bus subscriber entry point.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5AUD_handleEnterpriseEvent(event) {
  return MOS5AUD_recordEvent(
    event || {},
    {
      source: "ENTERPRISE_EVENT_BUS",
      actorType: "AUTOMATION",
      summary:
        String(
          event &&
          event.eventType ||
          "ENTERPRISE_EVENT"
        )
    }
  );
}

/**
 * Records lifecycle events through the audit timeline.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5AUD_handleLeadLifecycleEvent_(event) {
  return MOS5AUD_handleEnterpriseEvent(
    event
  );
}

/**
 * Records notification lifecycle events.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5AUD_handleNotificationEvent_(event) {
  return MOS5AUD_handleEnterpriseEvent(
    event
  );
}

/**
 * Records follow-up lifecycle events.
 *
 * @param {Object} event
 * @return {Object}
 */
function MOS5AUD_handleFollowupEvent_(event) {
  return MOS5AUD_handleEnterpriseEvent(
    event
  );
}

/**
 * Retrieves the ordered timeline for one aggregate.
 *
 * @param {string} aggregateId
 * @param {number=} limit
 * @return {Object}
 */
function MOS5AUD_getTimeline(
  aggregateId,
  limit
) {
  const target = String(
    aggregateId || ""
  ).trim();

  if (!target) {
    throw new Error(
      "aggregateId is required."
    );
  }

  const max = Math.max(
    1,
    Math.min(
      Number(limit || 250),
      2000
    )
  );

  const records =
    MOS5AUD_sheetObjects_(
      MOS5AUD_ensureSheet_()
    )
      .filter(function(record) {
        return String(
          record.AggregateID || ""
        ).trim() === target;
      })
      .sort(function(a, b) {
        return (
          Number(
            a.SequenceNumber || 0
          ) -
          Number(
            b.SequenceNumber || 0
          )
        );
      })
      .slice(-max)
      .map(MOS5AUD_publicRecord_);

  return {
    success: true,
    aggregateId: target,
    count: records.length,
    records: records,
    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Retrieves timeline entries by event type.
 *
 * @param {string} eventType
 * @param {number=} limit
 * @return {Object}
 */
function MOS5AUD_getEventsByType(
  eventType,
  limit
) {
  const target = String(
    eventType || ""
  )
    .trim()
    .toUpperCase();

  if (!target) {
    throw new Error(
      "eventType is required."
    );
  }

  const max = Math.max(
    1,
    Math.min(
      Number(limit || 250),
      2000
    )
  );

  const records =
    MOS5AUD_sheetObjects_(
      MOS5AUD_ensureSheet_()
    )
      .filter(function(record) {
        return String(
          record.EventType || ""
        )
          .trim()
          .toUpperCase() === target;
      })
      .sort(function(a, b) {
        return (
          Number(
            a.SequenceNumber || 0
          ) -
          Number(
            b.SequenceNumber || 0
          )
        );
      })
      .slice(-max)
      .map(MOS5AUD_publicRecord_);

  return {
    success: true,
    eventType: target,
    count: records.length,
    records: records,
    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Retrieves recent audit entries.
 *
 * @param {number=} limit
 * @return {Object}
 */
function MOS5AUD_getRecentEvents(limit) {
  const max = Math.max(
    1,
    Math.min(
      Number(limit || 100),
      2000
    )
  );

  const records =
    MOS5AUD_sheetObjects_(
      MOS5AUD_ensureSheet_()
    )
      .sort(function(a, b) {
        return (
          Number(
            a.SequenceNumber || 0
          ) -
          Number(
            b.SequenceNumber || 0
          )
        );
      })
      .slice(-max)
      .map(MOS5AUD_publicRecord_);

  return {
    success: true,
    count: records.length,
    records: records,
    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Verifies the append-only hash chain.
 *
 * @return {Object}
 */
function MOS5AUD_verifyIntegrity() {
  const records =
    MOS5AUD_sheetObjects_(
      MOS5AUD_ensureSheet_()
    )
      .sort(function(a, b) {
        return (
          Number(
            a.SequenceNumber || 0
          ) -
          Number(
            b.SequenceNumber || 0
          )
        );
      });

  const failures = [];
  let expectedPreviousHash =
    "GENESIS";

  records.forEach(function(record) {
    const storedPreviousHash =
      String(
        record.PreviousHash || ""
      );

    const storedHash =
      String(
        record.RecordHash || ""
      );

    const expectedHash =
      MOS5AUD_hashRecord_(record);

    if (
      storedPreviousHash !==
      expectedPreviousHash
    ) {
      failures.push({
        auditId:
          record.AuditID,
        sequenceNumber:
          record.SequenceNumber,
        issue:
          "PREVIOUS_HASH_MISMATCH",
        expected:
          expectedPreviousHash,
        actual:
          storedPreviousHash
      });
    }

    if (
      storedHash !== expectedHash
    ) {
      failures.push({
        auditId:
          record.AuditID,
        sequenceNumber:
          record.SequenceNumber,
        issue:
          "RECORD_HASH_MISMATCH",
        expected:
          expectedHash,
        actual:
          storedHash
      });
    }

    expectedPreviousHash =
      storedHash;
  });

  return {
    success:
      failures.length === 0,
    status:
      failures.length === 0
        ? "PASS"
        : "FAIL",
    recordsChecked:
      records.length,
    failures:
      failures,
    verifiedAt:
      new Date().toISOString()
  };
}

/**
 * Returns audit timeline status.
 *
 * @return {Object}
 */
function MOS5AUD_getStatus() {
  const sheet =
    MOS5AUD_ensureSheet_();

  const records =
    MOS5AUD_sheetObjects_(sheet);

  const lastRecord =
    records.length
      ? records[records.length - 1]
      : null;

  return {
    release:
      "MOS5-ENTERPRISE-AUDIT-TIMELINE",
    version:
      MOS5_AUDIT_VERSION,
    sheet:
      MOS5_AUDIT.SHEET,
    totalRecords:
      records.length,
    latestSequence:
      lastRecord
        ? Number(
            lastRecord.SequenceNumber ||
            0
          )
        : 0,
    latestAuditId:
      lastRecord
        ? String(
            lastRecord.AuditID || ""
          )
        : "",
    latestRecordHash:
      lastRecord
        ? String(
            lastRecord.RecordHash || ""
          )
        : "",
    generatedAt:
      new Date().toISOString()
  };
}

/**
 * Read-only diagnostics.
 *
 * @return {Object}
 */
function MOS5AUD_runDiagnostics() {
  const sheet =
    MOS5AUD_ensureSheet_();

  const tests = [];

  function add(
    code,
    passed,
    details
  ) {
    tests.push({
      code: code,
      status:
        passed ? "PASS" : "FAIL",
      details: details
    });
  }

  add(
    "AUDIT_SHEET",
    Boolean(sheet),
    "SYS_AUDIT_TIMELINE exists."
  );

  add(
    "HEADERS_PRESENT",
    sheet.getLastColumn() >=
      MOS5_AUDIT.HEADERS.length,
    "Required audit headers exist."
  );

  add(
    "RECORD_FUNCTION",
    typeof MOS5AUD_recordEvent ===
      "function",
    "Audit record function exists."
  );

  add(
    "TIMELINE_FUNCTION",
    typeof MOS5AUD_getTimeline ===
      "function",
    "Timeline retrieval exists."
  );

  add(
    "INTEGRITY_FUNCTION",
    typeof MOS5AUD_verifyIntegrity ===
      "function",
    "Hash-chain verification exists."
  );

  const failed =
    tests.filter(function(test) {
      return test.status === "FAIL";
    }).length;

  return {
    release:
      "MOS5-ENTERPRISE-AUDIT-TIMELINE",
    version:
      MOS5_AUDIT_VERSION,
    overallStatus:
      failed ? "FAIL" : "PASS",
    passed:
      tests.length - failed,
    failed: failed,
    tests: tests,
    status:
      MOS5AUD_getStatus(),
    productionChanged:
      false,
    completedAt:
      new Date().toISOString()
  };
}

function MOS5AUD_ensureSheet_() {
  const ss =
    typeof workbook_ === "function"
      ? workbook_()
      : SpreadsheetApp
          .getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      MOS5_AUDIT.SHEET
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        MOS5_AUDIT.SHEET
      );
  }

  MOS5AUD_ensureHeaders_(
    sheet,
    MOS5_AUDIT.HEADERS
  );

  return sheet;
}

function MOS5AUD_ensureHeaders_(
  sheet,
  headers
) {
  if (
    sheet.getLastRow() === 0 ||
    sheet.getLastColumn() === 0
  ) {
    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([headers]);

    sheet.setFrozenRows(1);
    return;
  }

  const existing =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0]
      .map(function(value) {
        return String(
          value || ""
        ).trim();
      });

  const missing =
    headers.filter(function(header) {
      return (
        existing.indexOf(
          header
        ) === -1
      );
    });

  if (missing.length) {
    sheet
      .getRange(
        1,
        existing.length + 1,
        1,
        missing.length
      )
      .setValues([missing]);
  }

  sheet.setFrozenRows(1);
}

function MOS5AUD_sheetObjects_(sheet) {
  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return [];
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0]
      .map(function(value) {
        return String(
          value || ""
        ).trim();
      });

  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        headers.length
      )
      .getValues();

  return values.map(
    function(row, index) {
      const record = {
        _row: index + 2
      };

      headers.forEach(
        function(header, column) {
          record[header] =
            row[column];
        }
      );

      return record;
    }
  );
}

function MOS5AUD_getLastRecord_(sheet) {
  const records =
    MOS5AUD_sheetObjects_(sheet);

  return records.length
    ? records[records.length - 1]
    : null;
}

function MOS5AUD_appendObjectRow_(
  sheet,
  payload
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  sheet.appendRow(
    headers.map(function(header) {
      return (
        payload[header] !==
        undefined
          ? payload[header]
          : ""
      );
    })
  );

  return sheet.getLastRow();
}

function MOS5AUD_buildMetadata_(
  event,
  settings
) {
  const eventMetadata =
    event &&
    event.metadata &&
    typeof event.metadata ===
      "object"
      ? event.metadata
      : {};

  return Object.assign(
    {},
    eventMetadata,
    settings.metadata || {},
    {
      correlationId:
        settings.correlationId ||
        event.correlationId ||
        eventMetadata.correlationId ||
        "",

      causationId:
        settings.causationId ||
        event.causationId ||
        eventMetadata.causationId ||
        "",

      executionId:
        settings.executionId ||
        event.executionId ||
        eventMetadata.executionId ||
        "",

      actorType:
        settings.actorType ||
        eventMetadata.actorType ||
        "SYSTEM",

      actorId:
        settings.actorId ||
        eventMetadata.actorId ||
        "",

      actorEmail:
        settings.actorEmail ||
        eventMetadata.actorEmail ||
        "",

      source:
        settings.source ||
        eventMetadata.source ||
        event.source ||
        "MELROSEOS",

      auditVersion:
        MOS5_AUDIT_VERSION
    }
  );
}

function MOS5AUD_hashRecord_(record) {
  const canonical = [
    String(
      record.SequenceNumber || ""
    ),
    String(
      record.EventID || ""
    ),
    String(
      record.EventType || ""
    ),
    String(
      record.AggregateType || ""
    ),
    String(
      record.AggregateID || ""
    ),
    String(
      record.CorrelationID || ""
    ),
    String(
      record.CausationID || ""
    ),
    String(
      record.ExecutionID || ""
    ),
    String(
      record.ActorType || ""
    ),
    String(
      record.ActorID || ""
    ),
    String(
      record.ActorEmail || ""
    ),
    String(
      record.Source || ""
    ),
    String(
      record.Summary || ""
    ),
    String(
      record.PayloadJSON || ""
    ),
    String(
      record.MetadataJSON || ""
    ),
    String(
      record.PreviousHash || ""
    ),
    MOS5AUD_dateIso_(
      record.OccurredAt
    ),
    MOS5AUD_dateIso_(
      record.RecordedAt
    )
  ].join("|");

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      canonical,
      Utilities.Charset.UTF_8
    );

  return digest
    .map(function(byte) {
      const normalized =
        byte < 0
          ? byte + 256
          : byte;

      return normalized
        .toString(16)
        .padStart(2, "0");
    })
    .join("")
    .toUpperCase();
}

function MOS5AUD_publicRecord_(record) {
  return {
    auditId:
      String(record.AuditID || ""),
    sequenceNumber:
      Number(
        record.SequenceNumber || 0
      ),
    eventId:
      String(record.EventID || ""),
    eventType:
      String(record.EventType || ""),
    aggregateType:
      String(
        record.AggregateType || ""
      ),
    aggregateId:
      String(
        record.AggregateID || ""
      ),
    correlationId:
      String(
        record.CorrelationID || ""
      ),
    causationId:
      String(
        record.CausationID || ""
      ),
    executionId:
      String(
        record.ExecutionID || ""
      ),
    actorType:
      String(record.ActorType || ""),
    actorId:
      String(record.ActorID || ""),
    actorEmail:
      String(
        record.ActorEmail || ""
      ),
    source:
      String(record.Source || ""),
    summary:
      String(record.Summary || ""),
    payload:
      MOS5AUD_parseJson_(
        record.PayloadJSON,
        {}
      ),
    metadata:
      MOS5AUD_parseJson_(
        record.MetadataJSON,
        {}
      ),
    previousHash:
      String(
        record.PreviousHash || ""
      ),
    recordHash:
      String(
        record.RecordHash || ""
      ),
    occurredAt:
      MOS5AUD_dateIso_(
        record.OccurredAt
      ),
    recordedAt:
      MOS5AUD_dateIso_(
        record.RecordedAt
      )
  };
}

function MOS5AUD_safeJson_(value) {
  try {
    return JSON.stringify(
      value === undefined
        ? null
        : value
    );
  } catch (error) {
    return JSON.stringify({
      serializationError:
        String(
          error &&
          error.message
            ? error.message
            : error
        )
    });
  }
}

function MOS5AUD_parseJson_(
  value,
  fallback
) {
  if (
    value &&
    typeof value === "object"
  ) {
    return value;
  }

  try {
    return JSON.parse(
      String(value || "")
    );
  } catch (error) {
    return fallback;
  }
}

function MOS5AUD_date_(value) {
  if (value instanceof Date) {
    return value;
  }

  const parsed =
    new Date(value);

  return Number.isFinite(
    parsed.getTime()
  )
    ? parsed
    : new Date();
}

function MOS5AUD_dateIso_(value) {
  if (!value) {
    return "";
  }

  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isFinite(
    parsed.getTime()
  )
    ? parsed.toISOString()
    : "";
}

function MOS5AUD_currentUser_() {
  try {
    return String(
      Session
        .getEffectiveUser()
        .getEmail() ||
      ""
    )
      .trim()
      .toLowerCase();
  } catch (error) {
    return "";
  }
}

function MOS5AUD_id_(prefix) {
  return (
    String(prefix || "AUD")
      .trim()
      .toUpperCase() +
    "-" +
    Utilities
      .getUuid()
      .replace(/-/g, "")
      .substring(0, 20)
      .toUpperCase()
  );
}