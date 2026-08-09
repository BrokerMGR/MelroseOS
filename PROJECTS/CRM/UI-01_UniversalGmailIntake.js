/******************************************************************************
 * MelroseOS Universal Intake - Gmail Gateway
 * UI-01_UniversalGmailIntake.gs
 * Version 1.0.0
 *
 * INSTALL: CRM Apps Script project
 *
 * RULE:
 * Any UNREAD message carrying label MGR/New Leads is an intake candidate.
 * Sender, subject, forwarding status, and template are NOT eligibility gates.
 *
 * This module deliberately separates:
 * CAPTURE -> PARSE -> CLASSIFY -> DEDUPE -> ROUTE -> COMMIT -> MARK READ
 ******************************************************************************/

const UI1 = {
  VERSION: "1.0.0",
  SOURCE_LABEL: "MGR/New Leads",
  ERROR_LABEL: "MGR/Lead Intake Errors",
  REVIEW_LABEL: "MGR/Lead Intake Review",
  SOURCE_SHEET: "UI_SOURCE_EVENTS",
  REVIEW_SHEET: "UI_MANUAL_REVIEW",
  MAX_THREADS_PER_RUN: 25,
  MIN_CLASSIFICATION_CONFIDENCE: 0.60
};

function UI_installUniversalGmailIntake() {
  const ss = workbook_();

  UI_ensureSheet_(ss, UI1.SOURCE_SHEET, [
    "SourceEventID","SourceType","SourceMessageID","ThreadID","ReceivedAt",
    "ProcessedAt","Status","ParseStatus","Classification","Confidence",
    "LeadID","Email","Phone","FullName","OriginalSender","EnvelopeSender",
    "Subject","AssignmentStatus","PortalStatus","CommunicationStatus",
    "Error","RawJson","UpdatedAt"
  ]);

  UI_ensureSheet_(ss, UI1.REVIEW_SHEET, [
    "ReviewID","SourceEventID","SourceMessageID","ReceivedAt","Reason",
    "SuggestedClassification","Confidence","ExtractedName","ExtractedEmail",
    "ExtractedPhone","Subject","BodyPreview","Status","ReviewedAt","Notes"
  ]);

  GmailApp.getUserLabelByName(UI1.ERROR_LABEL) || GmailApp.createLabel(UI1.ERROR_LABEL);
  GmailApp.getUserLabelByName(UI1.REVIEW_LABEL) || GmailApp.createLabel(UI1.REVIEW_LABEL);

  const out = {
    success:true,
    version:UI1.VERSION,
    sourceLabel:UI1.SOURCE_LABEL,
    sourceRegistry:UI1.SOURCE_SHEET,
    reviewQueue:UI1.REVIEW_SHEET,
    eligibilityRule:"UNREAD_AND_HAS_MGR_NEW_LEADS_LABEL",
    markReadRule:"ONLY_AFTER_SUCCESSFUL_COMMIT"
  };
  Logger.log(JSON.stringify(out,null,2));
  return out;
}

function UI_runUniversalGmailIntake() {
  const label = GmailApp.getUserLabelByName(UI1.SOURCE_LABEL);
  if (!label) throw new Error("Required Gmail label not found: " + UI1.SOURCE_LABEL);

  const threads = label.getThreads(0, UI1.MAX_THREADS_PER_RUN);
  const stats = {threads:threads.length,candidates:0,processed:0,duplicates:0,review:0,errors:0};

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      if (!message.isUnread()) return;
      stats.candidates++;

      try {
        const result = UI_processGmailMessage_(message, thread);
        if (result.status === "PROCESSED") stats.processed++;
        else if (result.status === "DUPLICATE_SOURCE_EVENT") stats.duplicates++;
        else if (result.status === "MANUAL_REVIEW") stats.review++;
      } catch (err) {
        stats.errors++;
        UI_recordIntakeError_(message, thread, err);
        thread.addLabel(GmailApp.getUserLabelByName(UI1.ERROR_LABEL));
        // Intentionally leave unread for retry/review.
      }
    });
  });

  Logger.log(JSON.stringify(stats,null,2));
  return stats;
}

function UI_processGmailMessage_(message, thread) {
  const messageId = String(message.getId());
  const prior = UI_findSourceEventByMessageId_(messageId);

  if (prior && String(prior.Status) === "PROCESSED") {
    // Already committed previously. Safe to mark this source message read.
    message.markRead();
    return {success:true,status:"DUPLICATE_SOURCE_EVENT",leadId:prior.LeadID || ""};
  }

  const envelope = UI_buildEnvelope_(message, thread);
  const parsed = UI_parseUniversalLead_(envelope);
  const classified = UI_classifyLead_(parsed, envelope);
  const identity = UI_resolveIdentity_(parsed);

  const sourceEventId = prior ? prior.SourceEventID : UI_uuid_("SRC");
  UI_upsertSourceEvent_(sourceEventId, {
    SourceType:"GMAIL_LABEL",
    SourceMessageID:messageId,
    ThreadID:String(thread.getId()),
    ReceivedAt:message.getDate(),
    Status:"CAPTURED",
    ParseStatus:parsed.parseStatus,
    Classification:classified.leadType,
    Confidence:classified.confidence,
    LeadID:identity.leadId || "",
    Email:parsed.email || "",
    Phone:parsed.phone || "",
    FullName:parsed.fullName || "",
    OriginalSender:parsed.originalSender || "",
    EnvelopeSender:message.getFrom() || "",
    Subject:message.getSubject() || "",
    RawJson:JSON.stringify({parsed:parsed,classified:classified}),
    UpdatedAt:new Date()
  });

  if (classified.confidence < UI1.MIN_CLASSIFICATION_CONFIDENCE ||
      classified.leadType === "UNKNOWN" ||
      (!parsed.email && !parsed.phone)) {
    UI_queueManualReview_(sourceEventId, message, parsed, classified);
    UI_updateSourceEvent_(sourceEventId, {
      Status:"MANUAL_REVIEW",
      ProcessedAt:new Date(),
      Error:"Insufficient identity and/or classification confidence."
    });
    thread.addLabel(GmailApp.getUserLabelByName(UI1.REVIEW_LABEL));
    // Captured safely, but keep unread so a human sees unresolved intake.
    return {success:true,status:"MANUAL_REVIEW",sourceEventId:sourceEventId};
  }

  const normalizedLead = UI_buildNormalizedLead_(sourceEventId, parsed, classified, identity, envelope);

  // Universal router. This adapter uses existing MelroseOS functions when present.
  const routed = UI_routeIntoMelroseOS_(normalizedLead);

  if (!routed || !routed.success || !routed.leadId) {
    throw new Error("Universal routing did not return a committed LeadID.");
  }

  UI_updateSourceEvent_(sourceEventId, {
    Status:"PROCESSED",
    ParseStatus:"PARSED",
    LeadID:routed.leadId,
    AssignmentStatus:routed.assignmentStatus || "ROUTED",
    PortalStatus:routed.portalStatus || "PENDING",
    CommunicationStatus:"GOVERNOR_REQUIRED",
    ProcessedAt:new Date(),
    Error:"",
    UpdatedAt:new Date()
  });

  // Mark read ONLY after successful CRM commit/routing.
  message.markRead();
  thread.removeLabel(GmailApp.getUserLabelByName(UI1.ERROR_LABEL));

  return {success:true,status:"PROCESSED",leadId:routed.leadId,sourceEventId:sourceEventId};
}

function UI_buildEnvelope_(message, thread) {
  return {
    messageId:String(message.getId()),
    threadId:String(thread.getId()),
    from:message.getFrom() || "",
    to:message.getTo() || "",
    cc:message.getCc() || "",
    subject:message.getSubject() || "",
    plainBody:message.getPlainBody() || "",
    htmlBody:message.getBody() || "",
    date:message.getDate()
  };
}

/**
 * Layout-independent parser.
 * The label is the intake authority; patterns only extract data.
 * Forwarded-message headers are searched before falling back to envelope sender.
 */
function UI_parseUniversalLead_(e) {
  const text = UI_normalizeText_(
    [e.subject,e.plainBody,UI_stripHtml_(e.htmlBody)].join("\n")
  );

  const emails = UI_extractEmails_(text);
  const phones = UI_extractPhones_(text);

  const envelopeEmail = UI_extractEmails_(e.from)[0] || "";
  const forwardedEmail = UI_extractForwardedEmail_(text);

  let email = forwardedEmail || "";
  if (!email) {
    email = emails.find(function(x) {
      return String(x).toLowerCase() !== String(envelopeEmail).toLowerCase();
    }) || emails[0] || envelopeEmail;
  }

  const fullName = UI_extractName_(text, e.from);
  const address = UI_extractAddress_(text);
  const originalSender = UI_extractOriginalSender_(text);

  return {
    parseStatus:(email || phones.length || fullName) ? "PARSED" : "PARTIAL",
    fullName:fullName,
    email:UI_normalizeEmail_(email),
    phone:UI_normalizePhone_(phones[0] || ""),
    originalSender:originalSender,
    propertyAddress:address,
    parish:UI_extractField_(text,["Parish"]),
    cityOrArea:UI_extractField_(text,["City","Area","Location","Preferred Area"]),
    timeline:UI_extractField_(text,["Timeline","Time Frame","Move Date"]),
    budget:UI_extractField_(text,["Budget","Price Range","Rent Budget","Purchase Price"]),
    bedrooms:UI_extractField_(text,["Bedrooms","Beds"]),
    bathrooms:UI_extractField_(text,["Bathrooms","Baths"]),
    financingStatus:UI_extractField_(text,["Financing Status","Pre-Approval","Preapproved"]),
    notes:text.substring(0,12000),
    rawText:text
  };
}

function UI_classifyLead_(p, e) {
  const t = String(p.rawText || "").toLowerCase();
  const scores = {BUYER:0,SELLER:0,RENTER:0,RECRUIT:0};

  UI_scoreWords_(t,scores,"BUYER",[
    "buy a home","buying","buyer","purchase a home","pre-approved","preapproved",
    "mortgage","looking for a home","bedroom","price range","house hunting"
  ]);
  UI_scoreWords_(t,scores,"SELLER",[
    "sell my home","selling","seller","home value","property value","listing",
    "list my home","cma","what is my home worth","sell property"
  ]);
  UI_scoreWords_(t,scores,"RENTER",[
    "rent","rental","renter","lease","apartment","monthly rent","rent budget"
  ]);
  UI_scoreWords_(t,scores,"RECRUIT",[
    "real estate license","licensed agent","new agent","realtor","broker sponsorship",
    "broker sponsor","passed my exam","real estate exam","join the team",
    "join your brokerage","agent academy","commission split","brokerage"
  ]);

  if (scores.BUYER > 0 && scores.SELLER > 0) {
    const combo = Math.min(0.99,0.65 + ((scores.BUYER + scores.SELLER) * 0.03));
    return {leadType:"BUYER_SELLER",confidence:combo,scores:scores};
  }

  const ordered = Object.keys(scores).sort(function(a,b){return scores[b]-scores[a];});
  const top = ordered[0];
  const topScore = scores[top];

  if (!topScore) return {leadType:"UNKNOWN",confidence:0.20,scores:scores};

  const second = scores[ordered[1]];
  const confidence = Math.min(0.98,0.55 + topScore*0.05 + Math.max(0,topScore-second)*0.03);
  return {leadType:top,confidence:confidence,scores:scores};
}

function UI_resolveIdentity_(p) {
  const ss = workbook_();
  const sh = ss.getSheetByName("AE_LEADS");
  if (!sh) return {leadId:"",matchType:"NONE"};

  const rows = UI_objects_(sh);
  const email = UI_normalizeEmail_(p.email);
  const phone = UI_normalizePhone_(p.phone);

  const hit = rows.find(function(r) {
    return (email && UI_normalizeEmail_(r.Email) === email) ||
           (phone && UI_normalizePhone_(r.Phone) === phone);
  });

  return hit
    ? {leadId:String(hit.LeadID || ""),matchType:"EXISTING_CONTACT"}
    : {leadId:"",matchType:"NEW_CONTACT"};
}

function UI_buildNormalizedLead_(sourceEventId,p,c,i,e) {
  const parts = String(p.fullName || "").trim().split(/\s+/);
  return {
    SourceEventID:sourceEventId,
    SourceType:"GMAIL_LABEL",
    SourceMessageID:e.messageId,
    ExistingLeadID:i.leadId || "",
    IdentityMatchType:i.matchType,
    LeadType:c.leadType,
    FullName:p.fullName || "",
    FirstName:parts[0] || "",
    LastName:parts.length > 1 ? parts.slice(1).join(" ") : "",
    Email:p.email || "",
    Phone:p.phone || "",
    Parish:p.parish || "",
    CityOrArea:p.cityOrArea || "",
    Timeline:p.timeline || "",
    PriceRangeOrRentBudget:p.budget || "",
    Bedrooms:p.bedrooms || "",
    Bathrooms:p.bathrooms || "",
    FinancingStatus:p.financingStatus || "",
    PropertyToSellAddress:p.propertyAddress || "",
    Source:"GMAIL_MGR_NEW_LEADS",
    SourceCampaign:"GMAIL_MGR_NEW_LEADS",
    NotesFromLead:p.notes || "",
    ClassificationConfidence:c.confidence,
    CommunicationMode:i.leadId ? "CURRENT_STATE_ONLY" : "NEW_CONTACT",
    HistoricalBackfill:false
  };
}

/**
 * Adapter to current MelroseOS.
 * It intentionally does not send email directly.
 */
function UI_routeIntoMelroseOS_(lead) {
  let leadId = lead.ExistingLeadID || "";

  // Preferred: existing universal/production intake functions if available.
  if (!leadId && typeof LI_intakeLead === "function") {
    const r = LI_intakeLead(lead);
    leadId = (r && (r.leadId || r.LeadID)) || "";
  } else if (!leadId && typeof LI_routeLead === "function") {
    const r = LI_routeLead(lead);
    leadId = (r && (r.leadId || r.LeadID)) || "";
  } else if (!leadId && typeof CRM_createLead === "function") {
    const r = CRM_createLead(lead);
    leadId = (r && (r.leadId || r.LeadID)) || "";
  }

  // Safe fallback: append normalized record to LI_INTAKE if existing intake
  // function names differ. Existing production queue can consume it.
  if (!leadId) {
    leadId = lead.ExistingLeadID || UI_uuid_("L");
    UI_appendToLIIntake_(leadId,lead);
  }

  // Recruit broker lock.
  if (String(lead.LeadType).toUpperCase() === "RECRUIT" &&
      typeof RBR_enforceRecruitAssignmentForLeadId === "function") {
    try { RBR_enforceRecruitAssignmentForLeadId(leadId); } catch(e) {}
  }

  return {
    success:true,
    leadId:leadId,
    assignmentStatus:"ROUTED",
    portalStatus:"PENDING"
  };
}

function UI_appendToLIIntake_(leadId,lead) {
  const sh = workbook_().getSheetByName("LI_INTAKE");
  if (!sh) throw new Error("No compatible intake function found and LI_INTAKE is missing.");

  const headers = UI_headers_(sh);
  const payload = Object.assign({},lead,{
    LeadID:leadId,
    CreatedAt:new Date(),
    Status:"NEW",
    UpdatedAt:new Date()
  });

  sh.appendRow(headers.map(function(h){
    return payload[h] !== undefined ? payload[h] : "";
  }));
}

function UI_scoreWords_(text,scores,key,words) {
  words.forEach(function(w){
    if (text.indexOf(w) !== -1) scores[key]++;
  });
}

function UI_extractEmails_(text) {
  const m = String(text||"").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || [];
  return Array.from(new Set(m.map(UI_normalizeEmail_)));
}

function UI_extractPhones_(text) {
  return String(text||"").match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) || [];
}

function UI_extractForwardedEmail_(text) {
  const patterns = [
    /(?:^|\n)\s*From:\s*[^\n<]*<([^>\s]+@[^>\s]+)>/im,
    /(?:^|\n)\s*From:\s*([^\s<]+@[^\s>]+)/im,
    /Begin forwarded message[\s\S]{0,1200}?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i
  ];
  for (let i=0;i<patterns.length;i++) {
    const m = String(text||"").match(patterns[i]);
    if (m && m[1]) return UI_normalizeEmail_(m[1]);
  }
  return "";
}

function UI_extractOriginalSender_(text) {
  const m = String(text||"").match(/(?:^|\n)\s*From:\s*([^\n]+)/im);
  return m ? String(m[1]).trim().substring(0,250) : "";
}

function UI_extractName_(text, from) {
  const explicit = UI_extractField_(text,["Lead Name","Full Name","Name","Contact Name"]);
  if (explicit) return explicit;
  const fwd = String(text||"").match(/(?:^|\n)\s*From:\s*([^<\n]+)\s*</im);
  if (fwd && fwd[1]) return fwd[1].trim();
  return "";
}

function UI_extractAddress_(text) {
  return UI_extractField_(text,[
    "Property Address","Address","Home Address","Property","Listing Address"
  ]);
}

function UI_extractField_(text,labels) {
  for (let i=0;i<labels.length;i++) {
    const re = new RegExp("(?:^|\\n)\\s*" + labels[i].replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "\\s*[:\\-]\\s*([^\\n]+)","i");
    const m = String(text||"").match(re);
    if (m && m[1]) return m[1].trim().substring(0,500);
  }
  return "";
}

function UI_normalizeText_(text) {
  return String(text||"")
    .replace(/\r/g,"\n")
    .replace(/\u00a0/g," ")
    .replace(/[ \t]+/g," ")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function UI_stripHtml_(html) {
  return String(html||"")
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/p>/gi,"\n")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">");
}

function UI_normalizeEmail_(v) {
  return String(v||"").trim().toLowerCase();
}

function UI_normalizePhone_(v) {
  const d = String(v||"").replace(/\D/g,"");
  return d.length === 11 && d[0] === "1" ? d.substring(1) : d;
}

function UI_findSourceEventByMessageId_(messageId) {
  const sh = workbook_().getSheetByName(UI1.SOURCE_SHEET);
  return UI_objects_(sh).find(function(r){
    return String(r.SourceMessageID||"") === String(messageId||"");
  }) || null;
}

function UI_upsertSourceEvent_(id,values) {
  const sh = workbook_().getSheetByName(UI1.SOURCE_SHEET);
  const prior = UI_objects_(sh).find(function(r){return String(r.SourceEventID||"")===String(id);});
  if (prior) return UI_writeRow_(sh,prior._row,values);
  const headers = UI_headers_(sh);
  const payload = Object.assign({SourceEventID:id},values);
  sh.appendRow(headers.map(function(h){return payload[h]!==undefined?payload[h]:"";}));
}

function UI_updateSourceEvent_(id,values) {
  const sh = workbook_().getSheetByName(UI1.SOURCE_SHEET);
  const row = UI_objects_(sh).find(function(r){return String(r.SourceEventID||"")===String(id);});
  if (!row) throw new Error("Source event not found: " + id);
  UI_writeRow_(sh,row._row,values);
}

function UI_queueManualReview_(sourceEventId,message,p,c) {
  const sh = workbook_().getSheetByName(UI1.REVIEW_SHEET);
  sh.appendRow([
    UI_uuid_("REV"),sourceEventId,String(message.getId()),message.getDate(),
    "LOW_CONFIDENCE_OR_MISSING_IDENTITY",c.leadType,c.confidence,
    p.fullName,p.email,p.phone,message.getSubject(),
    String(p.rawText||"").substring(0,1000),"OPEN","",""
  ]);
}

function UI_recordIntakeError_(message,thread,err) {
  const id = UI_findSourceEventByMessageId_(message.getId());
  const sourceEventId = id ? id.SourceEventID : UI_uuid_("SRC");
  UI_upsertSourceEvent_(sourceEventId,{
    SourceType:"GMAIL_LABEL",
    SourceMessageID:String(message.getId()),
    ThreadID:String(thread.getId()),
    ReceivedAt:message.getDate(),
    Status:"ERROR",
    ParseStatus:"ERROR",
    EnvelopeSender:message.getFrom(),
    Subject:message.getSubject(),
    Error:String(err && err.stack ? err.stack : err),
    UpdatedAt:new Date()
  });
}

function UI_ensureSheet_(ss,name,headers) {
  let sh=ss.getSheetByName(name);
  if(!sh) sh=ss.insertSheet(name);
  if(sh.getLastRow()===0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}

function UI_headers_(sh) {
  return sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(String);
}

function UI_objects_(sh) {
  if(!sh || sh.getLastRow()<2) return [];
  const v=sh.getDataRange().getValues(), h=v.shift().map(String);
  return v.map(function(r,i){
    const o={_row:i+2}; h.forEach(function(k,j){o[k]=r[j];}); return o;
  }).filter(function(o){return h.some(function(k){return String(o[k]||"").trim()!=="";});});
}

function UI_writeRow_(sh,row,values) {
  const h=UI_headers_(sh);
  Object.keys(values).forEach(function(k){
    const c=h.indexOf(k)+1; if(c>0) sh.getRange(row,c).setValue(values[k]);
  });
}

function UI_uuid_(prefix) {
  return String(prefix||"ID") + "_" + Utilities.getUuid().replace(/-/g,"").substring(0,20).toUpperCase();
}
