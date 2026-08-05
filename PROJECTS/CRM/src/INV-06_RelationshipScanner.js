/******************************************************************************
 * MelroseOS 5 Enterprise
 * Module 0 - Inventory & Diagnostics
 * File: INV-06_RelationshipScanner.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Discovers probable parent-child relationships across workbook sheets,
 *   identifies primary-key and foreign-key candidates, detects orphan records,
 *   calculates relationship confidence, and produces a suggested migration
 *   order.
 *
 * Requires:
 *   INV-01_Core.gs
 *   INV-03_SheetScanner.gs
 *   INV-04_HeaderScanner.gs
 *   INV-05_DataProfiler.gs
 ******************************************************************************/

const M5_RELATIONSHIP_SHEET = "RELATIONSHIPS";
const M5_MIGRATION_ORDER_SHEET = "MIGRATION_ORDER";
const M5_ORPHAN_DETAIL_SHEET = "ORPHAN_RECORDS";
const M5_REL_MAX_SAMPLE_ROWS = 5000;
const M5_REL_MIN_OVERLAP = 0.20;
const M5_REL_MIN_CONFIDENCE = 45;

/**
 * Runs the complete relationship scan.
 *
 * Output sheets:
 *   RELATIONSHIPS
 *   MIGRATION_ORDER
 *   ORPHAN_RECORDS
 */
function M5_runRelationshipScanner() {
  const ss = workbook_();
  const startedAt = new Date();

  const relationshipSheet = createSheetIfMissing_(ss, M5_RELATIONSHIP_SHEET);
  const migrationSheet = createSheetIfMissing_(ss, M5_MIGRATION_ORDER_SHEET);
  const orphanSheet = createSheetIfMissing_(ss, M5_ORPHAN_DETAIL_SHEET);

  clearSheet_(relationshipSheet);
  clearSheet_(migrationSheet);
  clearSheet_(orphanSheet);

  const relationshipHeaders = [
    "RelationshipID",
    "Parent SheetID",
    "Parent Sheet",
    "Parent ColumnID",
    "Parent Column",
    "Parent Header",
    "Child SheetID",
    "Child Sheet",
    "Child ColumnID",
    "Child Column",
    "Child Header",
    "Relationship Type",
    "Parent Unique %",
    "Child Filled %",
    "Matched Child %",
    "Distinct Match %",
    "Orphan Count",
    "Orphan %",
    "Confidence",
    "Confidence Level",
    "Evidence",
    "Recommended Action",
    "Status",
    "Scanned"
  ];

  const migrationHeaders = [
    "Migration Step",
    "SheetID",
    "Sheet Name",
    "Dependency Count",
    "Depends On",
    "Dependent Sheets",
    "Cycle Detected",
    "Priority",
    "Recommended Action",
    "Scanned"
  ];

  const orphanHeaders = [
    "OrphanID",
    "RelationshipID",
    "Child SheetID",
    "Child Sheet",
    "Child ColumnID",
    "Child Column",
    "Child Header",
    "Source Row",
    "Orphan Value",
    "Parent Sheet",
    "Parent Header",
    "Severity",
    "Detected"
  ];

  setHeaders_(relationshipSheet, relationshipHeaders);
  setHeaders_(migrationSheet, migrationHeaders);
  setHeaders_(orphanSheet, orphanHeaders);

  const model = M5_buildRelationshipModel_();
  const scan = M5_discoverRelationships_(model);

  if (scan.relationshipRows.length) {
    relationshipSheet
      .getRange(2, 1, scan.relationshipRows.length, relationshipHeaders.length)
      .setValues(scan.relationshipRows);
  }

  if (scan.orphanRows.length) {
    orphanSheet
      .getRange(2, 1, scan.orphanRows.length, orphanHeaders.length)
      .setValues(scan.orphanRows);
  }

  const migrationRows = M5_buildMigrationOrderRows_(model, scan.relationships);

  if (migrationRows.length) {
    migrationSheet
      .getRange(2, 1, migrationRows.length, migrationHeaders.length)
      .setValues(migrationRows);
  }

  M5_formatRelationshipSheet_(relationshipSheet);
  M5_formatMigrationSheet_(migrationSheet);
  M5_formatOrphanSheet_(orphanSheet);

  setDocProperty_("M5_LAST_RELATIONSHIP_SCAN", startedAt.toISOString());
  setDocProperty_(
    "M5_RELATIONSHIP_COUNT",
    String(scan.relationshipRows.length)
  );
  setDocProperty_(
    "M5_ORPHAN_COUNT",
    String(scan.orphanRows.length)
  );

  const result = {
    success: true,
    sheetsScanned: model.sheets.length,
    columnsScanned: model.columns.length,
    relationshipsFound: scan.relationshipRows.length,
    orphanRecordsFound: scan.orphanRows.length,
    durationSeconds: Math.round((new Date() - startedAt) / 1000)
  };

  logMessage_(
    "RELATIONSHIP SCAN",
    "Complete. Sheets: " + result.sheetsScanned +
      ", Relationships: " + result.relationshipsFound +
      ", Orphans: " + result.orphanRecordsFound
  );

  return result;
}

/**
 * Builds an in-memory model of all eligible sheets and columns.
 */
function M5_buildRelationshipModel_() {
  const ss = workbook_();
  const excludedSheets = M5_getRelationshipExcludedSheets_();
  const sheets = [];
  const columns = [];

  ss.getSheets().forEach(function(sheet, sheetIndex) {
    if (excludedSheets.indexOf(sheet.getName()) !== -1) return;

    const lastColumn = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();

    if (lastColumn < 1) return;

    const sheetNumber = sheetIndex + 1;
    const sheetId = buildSheetID_(sheetNumber);
    const rowCount = Math.max(lastRow - 1, 0);
    const sampleRowCount = Math.min(rowCount, M5_REL_MAX_SAMPLE_ROWS);
    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0];

    let rawValues = [];
    let displayValues = [];

    if (sampleRowCount > 0) {
      const range = sheet.getRange(2, 1, sampleRowCount, lastColumn);
      rawValues = range.getValues();
      displayValues = range.getDisplayValues();
    }

    const sheetModel = {
      sheetId: sheetId,
      sheetNumber: sheetNumber,
      sheetName: sheet.getName(),
      rowCount: rowCount,
      sampledRows: sampleRowCount,
      columnCount: lastColumn,
      columns: []
    };

    headers.forEach(function(header, columnIndex) {
      const columnNumber = columnIndex + 1;
      const normalizedHeader = normalizeHeader_(header);
      const values = displayValues.map(function(row) {
        return row[columnIndex];
      });

      const rawColumnValues = rawValues.map(function(row) {
        return row[columnIndex];
      });

      const stats = M5_relationshipColumnStats_(
        values,
        rawColumnValues,
        normalizedHeader
      );

      const columnModel = {
        sheetId: sheetId,
        sheetNumber: sheetNumber,
        sheetName: sheet.getName(),
        rowCount: rowCount,
        sampledRows: sampleRowCount,
        columnId: buildColumnID_(sheetNumber, columnNumber),
        columnNumber: columnNumber,
        columnLetter: columnLetter_(columnNumber),
        header: safe_(header),
        normalizedHeader: normalizedHeader,
        canonicalName: M5_canonicalRelationshipName_(normalizedHeader),
        values: values,
        rawValues: rawColumnValues,
        valueSet: stats.valueSet,
        normalizedValues: stats.normalizedValues,
        nonblank: stats.nonblank,
        blank: stats.blank,
        distinct: stats.distinct,
        duplicateCount: stats.duplicateCount,
        uniquePercent: stats.uniquePercent,
        fillPercent: stats.fillPercent,
        probablePrimaryKey: stats.probablePrimaryKey,
        probableForeignKey: stats.probableForeignKey,
        identifierLike: stats.identifierLike,
        type: stats.type
      };

      sheetModel.columns.push(columnModel);
      columns.push(columnModel);
    });

    sheets.push(sheetModel);
  });

  return {
    workbookName: ss.getName(),
    sheets: sheets,
    columns: columns
  };
}

/**
 * Calculates statistics needed for relationship discovery.
 */
function M5_relationshipColumnStats_(values, rawValues, normalizedHeader) {
  const normalizedValues = [];
  const frequency = {};
  let nonblank = 0;
  let blank = 0;

  values.forEach(function(value) {
    const normalized = M5_normalizeRelationshipValue_(value);

    if (!normalized) {
      blank++;
      normalizedValues.push("");
      return;
    }

    nonblank++;
    normalizedValues.push(normalized);
    frequency[normalized] = (frequency[normalized] || 0) + 1;
  });

  const distinct = Object.keys(frequency).length;
  let duplicateCount = 0;

  Object.keys(frequency).forEach(function(key) {
    if (frequency[key] > 1) {
      duplicateCount += frequency[key] - 1;
    }
  });

  const total = values.length;
  const uniquePercent = nonblank
    ? Math.round((distinct / nonblank) * 10000) / 100
    : 0;
  const fillPercent = total
    ? Math.round((nonblank / total) * 10000) / 100
    : 0;

  const identifierLike = M5_isIdentifierHeader_(normalizedHeader);
  const probablePrimaryKey =
    identifierLike &&
    nonblank >= 2 &&
    uniquePercent >= 95;

  const probableForeignKey =
    identifierLike ||
    M5_isForeignKeyHeader_(normalizedHeader);

  return {
    valueSet: frequency,
    normalizedValues: normalizedValues,
    nonblank: nonblank,
    blank: blank,
    distinct: distinct,
    duplicateCount: duplicateCount,
    uniquePercent: uniquePercent,
    fillPercent: fillPercent,
    probablePrimaryKey: probablePrimaryKey,
    probableForeignKey: probableForeignKey,
    identifierLike: identifierLike,
    type: M5_detectRelationshipColumnType_(
      values,
      rawValues,
      normalizedHeader
    )
  };
}

/**
 * Discovers probable parent-child relationships.
 */
function M5_discoverRelationships_(model) {
  const relationshipRows = [];
  const orphanRows = [];
  const relationships = [];
  const seen = {};

  const parentCandidates = model.columns.filter(function(column) {
    return (
      column.nonblank >= 2 &&
      (
        column.probablePrimaryKey ||
        column.uniquePercent >= 98 ||
        M5_isNaturalKeyHeader_(column.normalizedHeader)
      )
    );
  });

  const childCandidates = model.columns.filter(function(column) {
    return (
      column.nonblank >= 1 &&
      (
        column.probableForeignKey ||
        column.identifierLike ||
        M5_isNaturalKeyHeader_(column.normalizedHeader)
      )
    );
  });

  parentCandidates.forEach(function(parent) {
    childCandidates.forEach(function(child) {
      if (parent.sheetId === child.sheetId &&
          parent.columnId === child.columnId) {
        return;
      }

      const evaluation = M5_evaluateRelationship_(parent, child);

      if (!evaluation.accepted) return;

      const pairKey = [
        parent.sheetId,
        parent.columnId,
        child.sheetId,
        child.columnId
      ].join("|");

      if (seen[pairKey]) return;
      seen[pairKey] = true;

      const relationshipId =
        "REL-" + Utilities.getUuid().substring(0, 8).toUpperCase();

      const relationshipType =
        parent.sheetId === child.sheetId
          ? "SELF_REFERENCE"
          : evaluation.relationshipType;

      const status =
        evaluation.orphanCount > 0
          ? "REVIEW_ORPHANS"
          : evaluation.confidence >= 80
            ? "READY"
            : "REVIEW";

      const relationship = {
        relationshipId: relationshipId,
        parentSheetId: parent.sheetId,
        parentSheet: parent.sheetName,
        parentColumnId: parent.columnId,
        parentColumn: parent.columnNumber,
        parentHeader: parent.header,
        childSheetId: child.sheetId,
        childSheet: child.sheetName,
        childColumnId: child.columnId,
        childColumn: child.columnNumber,
        childHeader: child.header,
        relationshipType: relationshipType,
        parentUniquePercent: parent.uniquePercent,
        childFillPercent: child.fillPercent,
        matchedChildPercent: evaluation.matchedChildPercent,
        distinctMatchPercent: evaluation.distinctMatchPercent,
        orphanCount: evaluation.orphanCount,
        orphanPercent: evaluation.orphanPercent,
        confidence: evaluation.confidence,
        confidenceLevel: M5_confidenceLevel_(evaluation.confidence),
        evidence: evaluation.evidence.join("; "),
        recommendedAction: M5_relationshipRecommendation_(
          evaluation,
          parent,
          child
        ),
        status: status
      };

      relationships.push(relationship);

      relationshipRows.push([
        relationship.relationshipId,
        relationship.parentSheetId,
        relationship.parentSheet,
        relationship.parentColumnId,
        relationship.parentColumn,
        relationship.parentHeader,
        relationship.childSheetId,
        relationship.childSheet,
        relationship.childColumnId,
        relationship.childColumn,
        relationship.childHeader,
        relationship.relationshipType,
        relationship.parentUniquePercent,
        relationship.childFillPercent,
        relationship.matchedChildPercent,
        relationship.distinctMatchPercent,
        relationship.orphanCount,
        relationship.orphanPercent,
        relationship.confidence,
        relationship.confidenceLevel,
        relationship.evidence,
        relationship.recommendedAction,
        relationship.status,
        timestamp_()
      ]);

      if (evaluation.orphanDetails.length) {
        evaluation.orphanDetails.forEach(function(orphan) {
          orphanRows.push([
            "ORP-" + Utilities.getUuid().substring(0, 8).toUpperCase(),
            relationshipId,
            child.sheetId,
            child.sheetName,
            child.columnId,
            child.columnNumber,
            child.header,
            orphan.sourceRow,
            orphan.value,
            parent.sheetName,
            parent.header,
            evaluation.orphanPercent >= 20 ? "HIGH" : "MEDIUM",
            timestamp_()
          ]);
        });
      }
    });
  });

  return {
    relationshipRows: relationshipRows,
    orphanRows: orphanRows,
    relationships: relationships
  };
}

/**
 * Scores one possible relationship.
 */
function M5_evaluateRelationship_(parent, child) {
  const evidence = [];
  let score = 0;

  const parentName = parent.canonicalName;
  const childName = child.canonicalName;

  const exactHeaderMatch =
    parent.normalizedHeader &&
    parent.normalizedHeader === child.normalizedHeader;

  const canonicalMatch =
    parentName &&
    childName &&
    parentName === childName;

  const childLooksForeign =
    M5_isForeignKeyHeader_(child.normalizedHeader);

  const parentLooksPrimary =
    parent.probablePrimaryKey ||
    parent.uniquePercent >= 98;

  if (exactHeaderMatch) {
    score += 25;
    evidence.push("exact header match");
  } else if (canonicalMatch) {
    score += 22;
    evidence.push("canonical key-name match");
  } else {
    const similarity = M5_nameSimilarity_(parentName, childName);

    if (similarity >= 0.80) {
      score += 15;
      evidence.push("strong key-name similarity");
    } else if (similarity >= 0.60) {
      score += 8;
      evidence.push("moderate key-name similarity");
    }
  }

  if (parentLooksPrimary) {
    score += 15;
    evidence.push("parent values are highly unique");
  }

  if (childLooksForeign) {
    score += 10;
    evidence.push("child header resembles a foreign key");
  }

  if (parent.type === child.type) {
    score += 5;
    evidence.push("compatible data types");
  }

  const overlap = M5_calculateRelationshipOverlap_(parent, child);

  if (overlap.matchedChildPercent >= 95) {
    score += 35;
    evidence.push("nearly all child values match parent");
  } else if (overlap.matchedChildPercent >= 80) {
    score += 30;
    evidence.push("strong child-to-parent value overlap");
  } else if (overlap.matchedChildPercent >= 60) {
    score += 22;
    evidence.push("good child-to-parent value overlap");
  } else if (overlap.matchedChildPercent >= 40) {
    score += 14;
    evidence.push("moderate child-to-parent value overlap");
  } else if (overlap.matchedChildPercent >= 20) {
    score += 7;
    evidence.push("limited child-to-parent value overlap");
  }

  if (overlap.distinctMatchPercent >= 80) {
    score += 10;
    evidence.push("most distinct child keys exist in parent");
  } else if (overlap.distinctMatchPercent >= 50) {
    score += 5;
    evidence.push("many distinct child keys exist in parent");
  }

  if (parent.sheetId === child.sheetId) {
    score -= 12;
    evidence.push("same-sheet relationship requires review");
  }

  if (parent.columnId !== child.columnId &&
      parent.sheetId === child.sheetId &&
      !canonicalMatch) {
    score -= 10;
  }

  if (parent.nonblank < 2 || child.nonblank < 1) {
    score -= 25;
  }

  if (overlap.matchedChildPercent < M5_REL_MIN_OVERLAP * 100) {
    score -= 20;
  }

  if (!canonicalMatch &&
      !exactHeaderMatch &&
      overlap.matchedChildPercent < 60) {
    score -= 15;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const accepted =
    score >= M5_REL_MIN_CONFIDENCE &&
    overlap.matchedChildPercent >= M5_REL_MIN_OVERLAP * 100;

  return {
    accepted: accepted,
    confidence: score,
    matchedChildPercent: overlap.matchedChildPercent,
    distinctMatchPercent: overlap.distinctMatchPercent,
    orphanCount: overlap.orphanCount,
    orphanPercent: overlap.orphanPercent,
    orphanDetails: overlap.orphanDetails,
    matchedCount: overlap.matchedCount,
    evidence: evidence,
    relationshipType: M5_classifyRelationshipType_(parent, child)
  };
}

/**
 * Calculates overlap and orphan records.
 */
function M5_calculateRelationshipOverlap_(parent, child) {
  const parentSet = parent.valueSet;
  const childFrequency = {};
  let matchedCount = 0;
  let childNonblank = 0;
  let orphanCount = 0;
  const orphanDetails = [];

  child.normalizedValues.forEach(function(value, index) {
    if (!value) return;

    childNonblank++;
    childFrequency[value] = (childFrequency[value] || 0) + 1;

    if (parentSet[value]) {
      matchedCount++;
    } else {
      orphanCount++;

      if (orphanDetails.length < 100) {
        orphanDetails.push({
          sourceRow: index + 2,
          value: child.values[index]
        });
      }
    }
  });

  const distinctChildValues = Object.keys(childFrequency);
  let distinctMatched = 0;

  distinctChildValues.forEach(function(value) {
    if (parentSet[value]) distinctMatched++;
  });

  return {
    matchedCount: matchedCount,
    orphanCount: orphanCount,
    matchedChildPercent: childNonblank
      ? Math.round((matchedCount / childNonblank) * 10000) / 100
      : 0,
    orphanPercent: childNonblank
      ? Math.round((orphanCount / childNonblank) * 10000) / 100
      : 0,
    distinctMatchPercent: distinctChildValues.length
      ? Math.round(
          (distinctMatched / distinctChildValues.length) * 10000
        ) / 100
      : 0,
    orphanDetails: orphanDetails
  };
}

/**
 * Builds a topological migration order from accepted relationships.
 */
function M5_buildMigrationOrderRows_(model, relationships) {
  const nodes = {};
  const dependencies = {};
  const dependents = {};

  model.sheets.forEach(function(sheet) {
    nodes[sheet.sheetId] = sheet;
    dependencies[sheet.sheetId] = {};
    dependents[sheet.sheetId] = {};
  });

  relationships.forEach(function(rel) {
    if (rel.parentSheetId === rel.childSheetId) return;
    if (rel.confidence < M5_REL_MIN_CONFIDENCE) return;

    dependencies[rel.childSheetId][rel.parentSheetId] = true;
    dependents[rel.parentSheetId][rel.childSheetId] = true;
  });

  const indegree = {};
  Object.keys(nodes).forEach(function(sheetId) {
    indegree[sheetId] = Object.keys(dependencies[sheetId]).length;
  });

  const queue = Object.keys(nodes)
    .filter(function(sheetId) {
      return indegree[sheetId] === 0;
    })
    .sort(function(a, b) {
      return nodes[a].sheetName.localeCompare(nodes[b].sheetName);
    });

  const ordered = [];

  while (queue.length) {
    const sheetId = queue.shift();
    ordered.push(sheetId);

    Object.keys(dependents[sheetId]).forEach(function(childId) {
      indegree[childId]--;

      if (indegree[childId] === 0) {
        queue.push(childId);
        queue.sort(function(a, b) {
          return nodes[a].sheetName.localeCompare(nodes[b].sheetName);
        });
      }
    });
  }

  const cycleNodes = Object.keys(nodes).filter(function(sheetId) {
    return ordered.indexOf(sheetId) === -1;
  });

  cycleNodes.sort(function(a, b) {
    return nodes[a].sheetName.localeCompare(nodes[b].sheetName);
  });

  Array.prototype.push.apply(ordered, cycleNodes);

  return ordered.map(function(sheetId, index) {
    const dependencyNames = Object.keys(dependencies[sheetId])
      .map(function(id) {
        return nodes[id] ? nodes[id].sheetName : id;
      })
      .sort();

    const dependentNames = Object.keys(dependents[sheetId])
      .map(function(id) {
        return nodes[id] ? nodes[id].sheetName : id;
      })
      .sort();

    const cycleDetected = cycleNodes.indexOf(sheetId) !== -1;
    const priority = cycleDetected
      ? "REVIEW"
      : dependencyNames.length === 0
        ? "FOUNDATION"
        : dependencyNames.length <= 2
          ? "STANDARD"
          : "DEPENDENT";

    let recommendedAction = "Migrate after all listed dependencies.";

    if (cycleDetected) {
      recommendedAction =
        "Resolve circular references or migrate in a controlled transaction.";
    } else if (dependencyNames.length === 0) {
      recommendedAction =
        "Migrate first; this sheet is a parent or standalone table.";
    }

    return [
      index + 1,
      sheetId,
      nodes[sheetId].sheetName,
      dependencyNames.length,
      dependencyNames.join(", "),
      dependentNames.join(", "),
      cycleDetected,
      priority,
      recommendedAction,
      timestamp_()
    ];
  });
}

/**
 * Relationship classification.
 */
function M5_classifyRelationshipType_(parent, child) {
  if (parent.sheetId === child.sheetId) {
    return "SELF_REFERENCE";
  }

  if (parent.uniquePercent >= 95 && child.uniquePercent < 95) {
    return "ONE_TO_MANY";
  }

  if (parent.uniquePercent >= 95 && child.uniquePercent >= 95) {
    return "ONE_TO_ONE";
  }

  return "POSSIBLE_LOOKUP";
}

function M5_relationshipRecommendation_(evaluation, parent, child) {
  if (evaluation.orphanCount > 0) {
    return (
      "Resolve " + evaluation.orphanCount +
      " orphan value(s) in " + child.sheetName +
      " before enforcing this relationship."
    );
  }

  if (evaluation.confidence >= 85) {
    return "Approve as a migration relationship and enforce referential integrity.";
  }

  if (evaluation.confidence >= 70) {
    return "Review samples, then approve if the business meaning is correct.";
  }

  return "Manually validate before using this relationship in migration.";
}

function M5_confidenceLevel_(confidence) {
  if (confidence >= 85) return "VERY HIGH";
  if (confidence >= 70) return "HIGH";
  if (confidence >= 55) return "MEDIUM";
  return "LOW";
}

/**
 * Header classification helpers.
 */
function M5_isIdentifierHeader_(header) {
  const compact = String(header || "").replace(/_/g, "");

  if (!compact) return false;

  if (compact === "id") return true;
  if (/id$/.test(compact)) return true;

  return [
    "credentialnumber",
    "mlsnumber",
    "email",
    "emailaddress",
    "phone",
    "phonenumber",
    "token",
    "uuid",
    "key"
  ].indexOf(compact) !== -1;
}

function M5_isForeignKeyHeader_(header) {
  const compact = String(header || "").replace(/_/g, "");

  return [
    "leadid",
    "agentid",
    "contactid",
    "listingid",
    "propertyid",
    "assignmentid",
    "appointmentid",
    "campaignid",
    "messageid",
    "threadid",
    "parentid",
    "userid",
    "ownerid",
    "brokerid",
    "vendorid",
    "taskid",
    "eventid"
  ].indexOf(compact) !== -1;
}

function M5_isNaturalKeyHeader_(header) {
  const compact = String(header || "").replace(/_/g, "");

  return [
    "email",
    "emailaddress",
    "credentialnumber",
    "mlsnumber",
    "phone",
    "phonenumber",
    "token",
    "uuid"
  ].indexOf(compact) !== -1;
}

/**
 * Converts related header names into a comparable canonical key.
 *
 * Examples:
 *   Lead ID     -> lead
 *   lead_id     -> lead
 *   AssignedAgentID -> agent
 *   Agent Email -> agentemail
 */
function M5_canonicalRelationshipName_(header) {
  let compact = String(header || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  compact = compact
    .replace(/^assigned/, "")
    .replace(/^primary/, "")
    .replace(/^parent/, "")
    .replace(/^related/, "")
    .replace(/^source/, "")
    .replace(/^target/, "")
    .replace(/identifier$/, "")
    .replace(/uuid$/, "")
    .replace(/guid$/, "")
    .replace(/key$/, "")
    .replace(/id$/, "");

  return compact;
}

/**
 * Simple normalized name similarity.
 */
function M5_nameSimilarity_(a, b) {
  a = String(a || "");
  b = String(b || "");

  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }

  const distance = M5_levenshtein_(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function M5_levenshtein_(a, b) {
  const matrix = [];
  let i;
  let j;

  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalizes cell values for matching.
 */
function M5_normalizeRelationshipValue_(value) {
  if (value === null || value === undefined) return "";

  let text = String(value).trim();
  if (!text) return "";

  if (isValidM5Email_(text)) {
    return text.toLowerCase();
  }

  if (M5_looksLikePhone_(text)) {
    return text.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  }

  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function M5_looksLikePhone_(value) {
  const text = String(value || "");
  const digits = text.replace(/\D/g, "");

  return (
    (digits.length === 10 || digits.length === 11) &&
    /^[\d\s()+\-./]+$/.test(text)
  );
}

function M5_detectRelationshipColumnType_(
  displayValues,
  rawValues,
  normalizedHeader
) {
  if (isM5EmailHeader_(normalizedHeader)) return "EMAIL";
  if (isM5PhoneHeader_(normalizedHeader)) return "PHONE";
  if (isM5UrlHeader_(normalizedHeader)) return "URL";
  if (isM5DateHeader_(normalizedHeader)) return "DATE";

  let textCount = 0;
  let numberCount = 0;
  let dateCount = 0;
  let booleanCount = 0;

  rawValues.forEach(function(value, index) {
    const displayValue = String(displayValues[index] || "").trim();
    if (!displayValue) return;

    if (value instanceof Date && !isNaN(value.getTime())) {
      dateCount++;
    } else if (typeof value === "boolean") {
      booleanCount++;
    } else if (typeof value === "number" && isFinite(value)) {
      numberCount++;
    } else {
      textCount++;
    }
  });

  const candidates = [
    ["TEXT", textCount],
    ["NUMBER", numberCount],
    ["DATE", dateCount],
    ["BOOLEAN", booleanCount]
  ];

  candidates.sort(function(a, b) {
    return b[1] - a[1];
  });

  return candidates[0][1] > 0 ? candidates[0][0] : "UNKNOWN";
}

/**
 * Excludes generated inventory sheets from discovery.
 */
function M5_getRelationshipExcludedSheets_() {
  const excluded = [];

  if (typeof M5 !== "undefined") {
    [
      M5.INVENTORY_SHEET,
      M5.SCHEMA_SHEET,
      M5.SCRIPT_SHEET,
      M5.DIAGNOSTIC_SHEET,
      M5.REPORT_SHEET
    ].forEach(function(name) {
      if (name) excluded.push(name);
    });
  }

  [
    "DATA_PROFILE",
    "DATA_QUALITY_ISSUES",
    M5_RELATIONSHIP_SHEET,
    M5_MIGRATION_ORDER_SHEET,
    M5_ORPHAN_DETAIL_SHEET
  ].forEach(function(name) {
    if (excluded.indexOf(name) === -1) excluded.push(name);
  });

  return excluded;
}

/**
 * Formatting.
 */
function M5_formatRelationshipSheet_(sheet) {
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() > 1) {
    if (!sheet.getFilter()) {
      sheet.getDataRange().createFilter();
    }

    sheet
      .getRange(2, 13, sheet.getLastRow() - 1, 7)
      .setNumberFormat("0.00");
  }

  autoResize_(sheet);
}

function M5_formatMigrationSheet_(sheet) {
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() > 1 && !sheet.getFilter()) {
    sheet.getDataRange().createFilter();
  }

  autoResize_(sheet);
}

function M5_formatOrphanSheet_(sheet) {
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() > 1 && !sheet.getFilter()) {
    sheet.getDataRange().createFilter();
  }

  autoResize_(sheet);
}

/**
 * Returns a relationship scan summary without modifying sheets.
 */
function M5_getRelationshipSummary() {
  const ss = workbook_();
  const relationshipSheet = ss.getSheetByName(M5_RELATIONSHIP_SHEET);
  const migrationSheet = ss.getSheetByName(M5_MIGRATION_ORDER_SHEET);
  const orphanSheet = ss.getSheetByName(M5_ORPHAN_DETAIL_SHEET);

  return {
    lastRun: getDocProperty_("M5_LAST_RELATIONSHIP_SCAN") || "",
    relationshipsFound: relationshipSheet
      ? Math.max(relationshipSheet.getLastRow() - 1, 0)
      : 0,
    migrationSteps: migrationSheet
      ? Math.max(migrationSheet.getLastRow() - 1, 0)
      : 0,
    orphanRecordsFound: orphanSheet
      ? Math.max(orphanSheet.getLastRow() - 1, 0)
      : 0
  };
}

/**
 * Deletes and rebuilds only relationship output sheets.
 */
function M5_resetRelationshipScanner() {
  const ss = workbook_();

  [
    M5_RELATIONSHIP_SHEET,
    M5_MIGRATION_ORDER_SHEET,
    M5_ORPHAN_DETAIL_SHEET
  ].forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);

    if (sheet) {
      ss.deleteSheet(sheet);
    }
  });

  setDocProperty_("M5_LAST_RELATIONSHIP_SCAN", "");
  setDocProperty_("M5_RELATIONSHIP_COUNT", "0");
  setDocProperty_("M5_ORPHAN_COUNT", "0");

  return M5_runRelationshipScanner();
}

/**
 * Self-test.
 */
function M5_testRelationshipScanner() {
  const result = M5_runRelationshipScanner();

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(M5_getRelationshipSummary()));

  if (!result.success) {
    throw new Error("Relationship scanner did not complete successfully.");
  }

  return true;
}
