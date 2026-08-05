
function CIP_queueCommunication(leadId,type,templateKey,subject,when,reason){
  CIP_initializePlatform();
  const at=CIP_nextAllowedCommunicationTime_(when?new Date(when):new Date()),id=CIP_uuid_("COMM");
  CIP_websiteWorkbook_().getSheetByName(CIP.SHEETS.COMM_QUEUE).appendRow([id,leadId,type||"NURTURE",templateKey||"",subject||"",at,"QUEUED",reason||"",new Date(),""]);
  return{success:true,queueId:id,scheduledAt:at};
}
function CIP_nextAllowedCommunicationTime_(d){
  let c=new Date(d);
  const parts=Utilities.formatDate(c,CIP.TIMEZONE,"HH:mm").split(":"),m=Number(parts[0])*60+Number(parts[1]),start=540,end=1110;
  if(m>=start&&m<=end)return c;
  const day=Utilities.formatDate(c,CIP.TIMEZONE,"yyyy-MM-dd");
  if(m<start)return new Date(day+"T09:00:00-05:00");
  c=new Date(c.getTime()+86400000);
  return new Date(Utilities.formatDate(c,CIP.TIMEZONE,"yyyy-MM-dd")+"T09:00:00-05:00");
}
function CIP_getCommunicationFoundationStatus(){
  const ss=CIP_websiteWorkbook_();
  return{version:CIP.VERSION,timezone:CIP.TIMEZONE,windowStart:CIP.WINDOW_START,windowEnd:CIP.WINDOW_END,sevenDaysPerWeek:true,queued:Math.max(0,ss.getSheetByName(CIP.SHEETS.COMM_QUEUE).getLastRow()-1),holidayRules:Math.max(0,ss.getSheetByName(CIP.SHEETS.HOLIDAYS).getLastRow()-1),sendingEnabled:false,note:"Foundation ready. Existing CRM notification engine will be connected in the next release."};
}
