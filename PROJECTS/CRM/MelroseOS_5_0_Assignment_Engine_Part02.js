/**
 * MelroseOS_5_0_Assignment_Engine_Part02.gs
 * Territory + Lead Lock + Capacity
 */

function getTerritoryAgents(parish){
  const sh=SpreadsheetApp.getActive().getSheetByName("M5_Territories");
  if(!sh) return [];
  const data=sh.getDataRange().getValues();
  return data.slice(1).filter(r=>String(r[1]).toLowerCase()==String(parish).toLowerCase());
}

function findLeadLock(email,phone){
  const sh=SpreadsheetApp.getActive().getSheetByName("M5_LeadLocks");
  if(!sh) return null;
  const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][1]==email || vals[i][2]==phone) return vals[i];
  }
  return null;
}

function createLeadLock(leadId,email,phone,agentId){
  const sh=SpreadsheetApp.getActive().getSheetByName("M5_LeadLocks");
  sh.appendRow([leadId,email,phone,agentId,new Date(),"ACTIVE"]);
}

function releaseLeadLock(leadId){
  const sh=SpreadsheetApp.getActive().getSheetByName("M5_LeadLocks");
  const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]==leadId){
      sh.getRange(i+1,6).setValue("RELEASED");
      return true;
    }
  }
  return false;
}

function getAgentCapacity(agentId){
  const sh=SpreadsheetApp.getActive().getSheetByName("M5_AgentCapacity");
  const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]==agentId){
      return {current:vals[i][1],max:vals[i][2]};
    }
  }
  return null;
}

function isAgentEligible(agentId){
  const sh=SpreadsheetApp.getActive().getSheetByName("M5_AgentAvailability");
  const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]==agentId){
      return vals[i][1]=="AVAILABLE";
    }
  }
  return false;
}

function findEligibleAgents(parish){
  const terr=getTerritoryAgents(parish);
  return terr.filter(r=>isAgentEligible(r[0]));
}

function testM5AssignmentPart02(){
  Logger.log(findEligibleAgents("Jefferson"));
  return true;
}
