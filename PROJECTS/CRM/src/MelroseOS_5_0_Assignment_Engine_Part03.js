/**
 * MelroseOS_5_0_Assignment_Engine_Part03.gs
 * Production Routing Engine
 */

function calculateAssignmentWeight(agent){
  let score = 100;
  if(agent.capacityPct) score -= agent.capacityPct;
  if(agent.responseMinutes) score -= Math.min(agent.responseMinutes,30);
  if(agent.manualWeight) score += agent.manualWeight;
  return score;
}

function selectNextAgent(agentPool){
  if(!agentPool || !agentPool.length) return null;
  agentPool.sort(function(a,b){
    return calculateAssignmentWeight(b)-calculateAssignmentWeight(a);
  });
  return agentPool[0];
}

function applyBrokerOverrides(context){
  if(context.leadType==="RECRUITING"){
    return {override:true,agentId:"BROKER"};
  }
  return {override:false};
}

function recordAssignment(result){
  const sh=SpreadsheetApp.getActive().getSheetByName("M5_AssignmentHistory");
  sh.appendRow([
    Utilities.getUuid(),
    result.leadId,
    result.agentId,
    result.method,
    new Date(),
    "ASSIGNED"
  ]);
}

function assignM5Lead(context){
  const override=applyBrokerOverrides(context);
  if(override.override){
    const r={
      leadId:context.leadId,
      agentId:override.agentId,
      method:"BROKER_OVERRIDE"
    };
    recordAssignment(r);
    return r;
  }

  const eligible=findEligibleAgents(context.parish);
  if(!eligible.length){
    throw new Error("No eligible agents found.");
  }

  const mapped=eligible.map(function(r){
    return {
      agentId:r[0],
      capacityPct:0,
      responseMinutes:0,
      manualWeight:0
    };
  });

  const winner=selectNextAgent(mapped);

  const result={
    leadId:context.leadId,
    agentId:winner.agentId,
    method:"WEIGHTED"
  };

  recordAssignment(result);

  return result;
}

function testM5AssignmentPart03(){
  const res=assignM5Lead({
    leadId:"TEST-001",
    parish:"Jefferson",
    leadType:"BUYER"
  });
  Logger.log(res);
  return true;
}
