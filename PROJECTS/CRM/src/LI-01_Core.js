/******************************************************************************
 * MelroseOS Enterprise
 * Lead Intake Migration
 * File: LI-01_Core.gs
 * Version: 1.0.0
 *
 * Purpose:
 *   Normalizes incoming Buyer, Seller, Renter, and Recruiting leads into
 *   MelroseOS before Assignment Engine routing.
 *
 * Requires:
 *   INV-01_Core.gs
 *   AE-01_Core.gs through AE-10_Installer.gs
 ******************************************************************************/

const LI={
  VERSION:"1.0.0",
  SHEETS:{
    INTAKE:"LI_INTAKE",
    REJECTED:"LI_REJECTED",
    AUDIT:"LI_AUDIT_LOG"
  }
};

function LI_initializeCore(){
  const ss=workbook_();

  Object.keys(LI.SHEETS).forEach(function(key){
    createSheetIfMissing_(ss,LI.SHEETS[key]);
  });

  LI_setupHeaders_();

  LI_log_("CORE_INITIALIZED","","Lead Intake core initialized.");

  return {
    success:true,
    version:LI.VERSION
  };
}

function LI_setupHeaders_(){
  const ss=workbook_();

  LI_setHeadersIfEmpty_(
    ss.getSheetByName(LI.SHEETS.INTAKE),
    [
      "IntakeID",
      "LeadID",
      "ReceivedAt",
      "FirstName",
      "LastName",
      "Email",
      "Phone",
      "LeadType",
      "Parish",
      "City",
      "Source",
      "SourceRecordID",
      "Status",
      "ValidationStatus",
      "ValidationMessage",
      "AssignedAgentID",
      "ProcessedAt",
      "UpdatedAt"
    ]
  );

  LI_setHeadersIfEmpty_(
    ss.getSheetByName(LI.SHEETS.REJECTED),
    [
      "RejectID",
      "IntakeID",
      "LeadID",
      "FirstName",
      "LastName",
      "Email",
      "Phone",
      "LeadType",
      "Parish",
      "Source",
      "Reason",
      "RejectedAt"
    ]
  );

  LI_setHeadersIfEmpty_(
    ss.getSheetByName(LI.SHEETS.AUDIT),
    [
      "AuditID",
      "EventType",
      "IntakeID",
      "LeadID",
      "Details",
      "CreatedAt"
    ]
  );
}

function LI_checkIntakeGuard_(){
  if(typeof MOS5D32_checkLeadIntakeGate_ === "function"){
    return MOS5D32_checkLeadIntakeGate_();
  }

  return {
    success:true,
    gate:"LEAD_INTAKE",
    status:"OPEN",
    checkedAt:timestamp_()
  };
}

function LI_setHeadersIfEmpty_(sheet,headers){
  if(!sheet)throw new Error("Required Lead Intake sheet is missing.");

  if(sheet.getLastRow()===0){
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    autoResize_(sheet);
    return;
  }

  const width=Math.max(sheet.getLastColumn(),headers.length);
  const existing=sheet.getRange(1,1,1,width).getDisplayValues()[0];
  const hasHeaders=existing.some(function(v){
    return String(v||"").trim()!=="";
  });

  if(!hasHeaders){
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    autoResize_(sheet);
  }
}

function LI_receiveLead(payload){
  LI_initializeCore();
  LI_checkIntakeGuard_();

  if(!payload)throw new Error("Lead payload is required.");

  const lead=LI_normalizeLead_(payload);
  const validation=LI_validateLead_(lead);

  lead.IntakeID=LI_uuid_("INT");
  lead.LeadID=lead.LeadID||LI_uuid_("LEAD");
  lead.ReceivedAt=timestamp_();

  const sheet=workbook_().getSheetByName(LI.SHEETS.INTAKE);

  sheet.appendRow([
    lead.IntakeID,
    lead.LeadID,
    lead.ReceivedAt,
    lead.FirstName,
    lead.LastName,
    lead.Email,
    lead.Phone,
    lead.LeadType,
    lead.Parish,
    lead.City,
    lead.Source,
    lead.SourceRecordID,
    validation.valid?"NEW":"REJECTED",
    validation.valid?"VALID":"INVALID",
    validation.message,
    "",
    "",
    timestamp_()
  ]);

  if(!validation.valid){
    LI_rejectLead_(lead,validation.message);

    LI_log_(
      "LEAD_REJECTED",
      lead.IntakeID,
      validation.message,
      lead.LeadID
    );

    return {
      success:false,
      intakeId:lead.IntakeID,
      leadId:lead.LeadID,
      status:"REJECTED",
      reason:validation.message
    };
  }

  LI_log_(
    "LEAD_RECEIVED",
    lead.IntakeID,
    "Lead accepted into intake queue.",
    lead.LeadID
  );

  return {
    success:true,
    intakeId:lead.IntakeID,
    leadId:lead.LeadID,
    status:"NEW"
  };
}

function LI_normalizeLead_(payload){
  return {
    LeadID:String(payload.LeadID||payload.leadId||"").trim(),
    FirstName:String(payload.FirstName||payload.firstName||payload.first_name||"").trim(),
    LastName:String(payload.LastName||payload.lastName||payload.last_name||"").trim(),
    Email:AE_normalizeEmail_(payload.Email||payload.email||""),
    Phone:AE_normalizePhone_(payload.Phone||payload.phone||""),
    LeadType:LI_normalizeLeadType_(payload.LeadType||payload.leadType||payload.type||""),
    Parish:String(payload.Parish||payload.parish||"").trim().toUpperCase(),
    City:String(payload.City||payload.city||"").trim(),
    Source:String(payload.Source||payload.source||"UNKNOWN").trim(),
    SourceRecordID:String(payload.SourceRecordID||payload.sourceRecordId||"").trim()
  };
}

function LI_normalizeLeadType_(value){
  const type=String(value||"").trim().toUpperCase();

  const aliases={
    BUY:"BUYER",
    BUYER:"BUYER",
    BUYERS:"BUYER",
    SELL:"SELLER",
    SELLER:"SELLER",
    SELLERS:"SELLER",
    RENT:"RENTER",
    RENTAL:"RENTER",
    RENTER:"RENTER",
    RENTERS:"RENTER",
    RECRUIT:"RECRUITING",
    RECRUITING:"RECRUITING",
    AGENT:"RECRUITING",
    JOIN:"RECRUITING"
  };

  return aliases[type]||type;
}

function LI_validateLead_(lead){
  const errors=[];
  const allowed=["BUYER","SELLER","RENTER","RECRUITING"];

  if(!lead.FirstName){
    errors.push("First name is required.");
  }

  if(!lead.Email&&!lead.Phone){
    errors.push("Email or phone is required.");
  }

  if(!lead.LeadType){
    errors.push("Lead type is required.");
  }else if(allowed.indexOf(lead.LeadType)===-1){
    errors.push("Unsupported lead type: "+lead.LeadType+".");
  }

  if(lead.LeadType!=="RECRUITING"&&!lead.Parish){
    errors.push("Parish is required for Buyer, Seller, and Renter leads.");
  }

  return {
    valid:errors.length===0,
    message:errors.join(" ")
  };
}

function LI_rejectLead_(lead,reason){
  const sheet=workbook_().getSheetByName(LI.SHEETS.REJECTED);

  sheet.appendRow([
    LI_uuid_("REJ"),
    lead.IntakeID,
    lead.LeadID,
    lead.FirstName,
    lead.LastName,
    lead.Email,
    lead.Phone,
    lead.LeadType,
    lead.Parish,
    lead.Source,
    reason,
    timestamp_()
  ]);
}

function LI_log_(eventType,intakeId,details,leadId){
  const sheet=workbook_().getSheetByName(LI.SHEETS.AUDIT);
  if(!sheet)return;

  sheet.appendRow([
    LI_uuid_("AUD"),
    String(eventType||""),
    String(intakeId||""),
    String(leadId||""),
    String(details||""),
    timestamp_()
  ]);
}

function LI_uuid_(prefix){
  return String(prefix||"LI")+"-"+
    Utilities.getUuid().substring(0,8).toUpperCase();
}

function LI_getIntakeSummary(){
  const intake=LI_sheetObjects_(LI.SHEETS.INTAKE);
  const rejected=LI_sheetObjects_(LI.SHEETS.REJECTED);

  return {
    total:intake.length,
    new:intake.filter(function(r){
      return String(r.Status||"").toUpperCase()==="NEW";
    }).length,
    processed:intake.filter(function(r){
      return String(r.Status||"").toUpperCase()==="PROCESSED";
    }).length,
    rejected:rejected.length
  };
}

function LI_sheetObjects_(sheetName){
  const sheet=workbook_().getSheetByName(sheetName);

  if(!sheet||sheet.getLastRow()<2)return [];

  const values=sheet.getDataRange().getValues();
  const headers=values.shift().map(function(h){
    return String(h||"").trim();
  });

  return values.filter(function(row){
    return row.some(function(v){
      return String(v||"").trim()!=="";
    });
  }).map(function(row,index){
    const obj={_row:index+2};
    headers.forEach(function(h,i){
      obj[h]=row[i];
    });
    return obj;
  });
}

function LI_testCore(){
  LI_initializeCore();

  const result=LI_receiveLead({
    FirstName:"Lead",
    LastName:"Intake Test",
    Email:"lead-intake-test@example.com",
    Phone:"(985) 555-0144",
    LeadType:"BUYER",
    Parish:"ST. TAMMANY",
    City:"Mandeville",
    Source:"SELF_TEST"
  });

  if(!result.success){
    throw new Error("Lead Intake core self-test failed.");
  }

  Logger.log(JSON.stringify(result));
  Logger.log(JSON.stringify(LI_getIntakeSummary()));

  return true;
}
