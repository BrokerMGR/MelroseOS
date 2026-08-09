/******************************************************************************
 * MelroseOS CRM Universal Intake Reconciliation
 * CRM-03_Reconciliation.gs
 * Version 2.0.2
 ******************************************************************************/

function UIX_reconcileProcessingRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const intakeSheet = ss.getSheetByName(UIX.INTAKE_SHEET);

  if (!intakeSheet) {
    throw new Error("Missing sheet: " + UIX.INTAKE_SHEET);
  }

  const stats = {
    success: true,
    version: "2.0.2",
    candidates: 0,
    completed: 0,
    pendingAssignment: 0,
    pendingDistribution: 0,
    errors: 0
  };

  const rows = UIX_objects_(intakeSheet).filter(function(row) {
    const processing = String(row.ProcessingStatus || "").toUpperCase();
    const queue = String(row.QueueStatus || "").toUpperCase();
    const intake = String(row.IntakeStatus || "").toUpperCase();

    return (
      processing === "PROCESSING" ||
      queue === "PROCESSING" ||
      intake === "PROCESSING"
    );
  });

  rows.forEach(function(intake) {
    stats.candidates++;

    try {
      const leadId = String(intake.LeadID || "").trim();

      if (!leadId) {
        throw new Error("Processing intake row has no LeadID.");
      }

      const verification = UIX_verifyLeadState_(leadId);

      if (!verification.assigned) {
        UIX_updateRow_(intakeSheet, intake.__rowNumber, {
          ProcessingStatus: "PENDING_ASSIGNMENT",
          QueueStatus: "PENDING_ASSIGNMENT",
          IntakeStatus: "PENDING_ASSIGNMENT",
          AcknowledgementStatus: "PENDING",
          Error: "Lead exists but assignment is not complete.",
          UpdatedAt: new Date()
        });

        UIX_updateSourceEvent_(intake.SourceEventID, {
          Status: "CRM_PROCESSING",
          LeadID: leadId,
          AssignmentStatus: "PENDING",
          AgentSheetStatus: "PENDING",
          CommunicationStatus: "BLOCKED_PENDING_CRM_ACK",
          Error: "Lead exists but assignment is not complete.",
          UpdatedAt: new Date()
        });

        stats.pendingAssignment++;
        return;
      }

      if (!verification.distributed) {
        UIX_updateRow_(intakeSheet, intake.__rowNumber, {
          ProcessingStatus: "PENDING_DISTRIBUTION",
          QueueStatus: "PENDING_DISTRIBUTION",
          IntakeStatus: "PENDING_DISTRIBUTION",
          AcknowledgementStatus: "PENDING",
          Error: "Lead is assigned but agent-sheet distribution is not verified.",
          UpdatedAt: new Date()
        });

        UIX_updateSourceEvent_(intake.SourceEventID, {
          Status: "CRM_PROCESSING",
          LeadID: leadId,
          AssignmentStatus: "ASSIGNED",
          AgentSheetStatus: "PENDING",
          CommunicationStatus: "BLOCKED_PENDING_CRM_ACK",
          Error: "Lead is assigned but agent-sheet distribution is not verified.",
          UpdatedAt: new Date()
        });

        stats.pendingDistribution++;
        return;
      }

      UIX_updateRow_(intakeSheet, intake.__rowNumber, {
        ProcessingStatus: "COMPLETED",
        QueueStatus: "COMPLETED",
        IntakeStatus: "COMPLETED",
        AcknowledgementStatus: "ACKNOWLEDGED",
        ProcessedAt: new Date(),
        Error: "",
        UpdatedAt: new Date()
      });

      UIX_updateSourceEvent_(intake.SourceEventID, {
        Status: "CRM_ACKNOWLEDGED",
        LeadID: leadId,
        AssignmentStatus: "ASSIGNED",
        AgentSheetStatus: "VERIFIED",
        CommunicationStatus: "GOVERNOR_REQUIRED",
        ProcessedAt: new Date(),
        Error: "",
        UpdatedAt: new Date()
      });

      stats.completed++;
    } catch (error) {
      stats.errors++;

      UIX_updateRow_(intakeSheet, intake.__rowNumber, {
        ProcessingStatus: "ERROR",
        QueueStatus: "ERROR",
        IntakeStatus: "ERROR",
        Error: String(error && error.stack ? error.stack : error),
        UpdatedAt: new Date()
      });
    }
  });

  Logger.log(JSON.stringify(stats, null, 2));
  return stats;
}
