
function CIP_initializePlatform(){
  const ss=CIP_websiteWorkbook_();
  CIP_sheet_(ss,CIP.SHEETS.REGISTRY,["PortalID","LeadID","PortalToken","PortalStatus","LeadType","AssignedAgentID","AssignedAgentName","AssignedAgentEmail","IntentScore","IntentLevel","NextBestAction","LastPortalActivity","CreatedAt","UpdatedAt"]);
  CIP_sheet_(ss,CIP.SHEETS.PROFILES,["LeadID","LeadType","FirstName","LastName","FullName","Email","Phone","PreferredContactMethod","Parish","CityOrArea","Timeline","PriceRangeOrRentBudget","Bedrooms","Bathrooms","FinancingStatus","PropertyToSellAddress","ReasonForMoveOrSell","NotesFromLead","SourceCampaign","AssignedAgentID","AssignedAgentName","AssignedAgentEmail","Status","RawJson","UpdatedAt"]);
  CIP_sheet_(ss,CIP.SHEETS.VENDORS,["VendorID","Active","Priority","VendorCategory","CompanyName","ContactName","Title","Phone","Email","WebsiteURL","PhotoURL","BusinessCardURL","LogoURL","ServiceAreas","Parishes","LeadTypes","Featured","Disclaimer","UpdatedAt"]);
  CIP_sheet_(ss,CIP.SHEETS.ACTIVITY,["ActivityID","LeadID","PortalToken","ActivityType","ActivityValue","PageSection","MetadataJson","CreatedAt"]);
  CIP_sheet_(ss,CIP.SHEETS.ASSUMPTIONS,["Key","Value","Label","Description","UpdatedAt"]);
  CIP_sheet_(ss,CIP.SHEETS.INTENT_RULES,["ActivityType","Points","Active","Description"]);
  CIP_sheet_(ss,CIP.SHEETS.COMM_SETTINGS,["Key","Value","Description","UpdatedAt"]);
  CIP_sheet_(ss,CIP.SHEETS.COMM_QUEUE,["QueueID","LeadID","CommunicationType","TemplateKey","Subject","ScheduledAt","Status","Reason","CreatedAt","SentAt"]);
  CIP_sheet_(ss,CIP.SHEETS.HOLIDAYS,["HolidayID","Active","HolidayName","HolidayDate","Audience","TemplateKey","SendWindowStart","SendWindowEnd","UpdatedAt"]);
  CIP_seed_();
  return{success:true,version:CIP.VERSION};
}
function CIP_sheet_(ss,n,h){
  let s=ss.getSheetByName(n);if(!s)s=ss.insertSheet(n);
  if(s.getLastRow()===0){s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);s.autoResizeColumns(1,h.length);}
  return s;
}
function CIP_seed_(){
  const ss=CIP_websiteWorkbook_();
  const a=ss.getSheetByName(CIP.SHEETS.ASSUMPTIONS);
  if(a.getLastRow()===1)a.getRange(2,1,7,5).setValues([
    ["PlanningInterestRate",6.5,"Planning Interest Rate (%)","Editable planning benchmark. Not a loan quote.",new Date()],
    ["PropertyTaxAnnualPercent",1.5,"Estimated Annual Property Tax (%)","Editable planning assumption.",new Date()],
    ["HomeInsuranceAnnualPercent",1.0,"Estimated Annual Homeowners Insurance (%)","Editable planning assumption.",new Date()],
    ["FloodInsuranceAnnual",0,"Estimated Annual Flood Insurance ($)","Property-specific quotes vary.",new Date()],
    ["PMIAnnualPercent",0.7,"Estimated Annual PMI (%)","Planning assumption.",new Date()],
    ["ClosingCostPercent",3.0,"Estimated Buyer Closing Costs (%)","Planning estimate only.",new Date()],
    ["RentAnnualIncreasePercent",3.0,"Estimated Annual Rent Increase (%)","Editable planning assumption.",new Date()]
  ]);
  const r=ss.getSheetByName(CIP.SHEETS.INTENT_RULES);
  if(r.getLastRow()===1)r.getRange(2,1,10,4).setValues([
    ["DASHBOARD_OPEN",5,true,"Client opened dashboard."],
    ["RETURN_VISIT",5,true,"Client returned to dashboard."],
    ["CALCULATOR_USED",10,true,"Client used a calculator."],
    ["CRITERIA_UPDATED",15,true,"Client updated criteria."],
    ["PROPERTY_RESEARCH",15,true,"Client researched a property."],
    ["VENDOR_CLICK",10,true,"Client clicked a preferred professional."],
    ["CONTACT_AGENT",25,true,"Client requested contact."],
    ["CONSULTATION_CLICK",30,true,"Client clicked consultation scheduling."],
    ["VALUATION_REQUESTED",30,true,"Seller requested professional valuation."],
    ["ACADEMY_OPENED",15,true,"Recruit opened Agent Academy."]
  ]);
  const c=ss.getSheetByName(CIP.SHEETS.COMM_SETTINGS);
  if(c.getLastRow()===1)c.getRange(2,1,7,4).setValues([
    ["Timezone",CIP.TIMEZONE,"Communication timezone.",new Date()],
    ["WindowStart",CIP.WINDOW_START,"Earliest nurture send time.",new Date()],
    ["WindowEnd",CIP.WINDOW_END,"Latest nurture send time.",new Date()],
    ["SundayEnabled","TRUE","Allow nurture Sunday.",new Date()],
    ["SaturdayEnabled","TRUE","Allow nurture Saturday.",new Date()],
    ["PauseOnReply","TRUE","Pause automation after reply.",new Date()],
    ["PauseOnAppointment","TRUE","Pause prospecting after appointment.",new Date()]
  ]);
}
