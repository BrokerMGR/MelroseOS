/******************************************************************************
 * MelroseOS Recruit Broker Routing Lock
 * RBR-02_AssignmentEngineHook.gs
 * Version 1.0.0
 *
 * USE THIS HOOK INSIDE YOUR ASSIGNMENT ENGINE BEFORE ROUND ROBIN.
 ******************************************************************************/

/**
 * Example integration point:
 *
 * const recruitOverride = RBR_assignmentHook_(lead);
 * if (recruitOverride.handled) {
 *   return recruitOverride.assignment;
 * }
 *
 * // continue normal eligibility/round-robin logic...
 */
function RBR_assignmentHook_(lead) {
  const result =
    RBR_applyRecruitRoutingOverride(
      lead
    );

  if (!result.handled) {
    return {
      handled: false
    };
  }

  return {
    handled: true,
    assignment: {
      AgentID:
        result.assignedAgentID,
      AgentName:
        result.assignedAgentName,
      AgentEmail:
        result.assignedAgentEmail,
      AssignmentReason:
        result.assignmentReason
    }
  };
}
