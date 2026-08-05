# Production Lead Capture MVP Pass 1

## Scope
This document defines the read-only implementation plan and the first production-safe implementation pass for lead capture, intake, routing, assignment, and acknowledgment queueing while production remains paused.

## Canonical architecture
- Website public endpoint: `PROJECTS/WEBSITE/src/CIP-07_WebApp.js`
- CRM intake authority: `PROJECTS/CRM/src/CRM_LeadIntake.js`
- Routing authority: `PROJECTS/CRM/src/LI-06_IntakeRouter.js`
- Source registry: `PROJECTS/CRM/src/LI-02_SourceRegistry.js`
- Dedupe authority: `PROJECTS/CRM/src/LI-03_DedupeEngine.js`
- Queue processor: `PROJECTS/CRM/src/LI-04_QueueProcessor.js`
- Assignment authority: `PROJECTS/CRM/src/AE-01_AssignmentEngine.js`
- Eligibility: `PROJECTS/CRM/src/AE-05_EligibilityEngine.js`
- Round robin: `PROJECTS/CRM/src/AE-06_RoundRobinEngine.js`
- Safety authority: `PROJECTS/CORE/src/D3-02_GlobalSystemControls.js`
- Trigger authority: `PROJECTS/CRM/src/OP-02_TriggerManager.js`
- Notifications: `PROJECTS/CRM/src/NF-01_Core.js`, `NF-02_TemplateEngine.js`, `NF-03_NotificationBuilder.js`, `NF-04_SendEngine.js`, `CRM-07_NotificationGovernor.js`

## Production pause rules
- Do not install triggers.
- Do not enable communications.
- Do not deploy.
- Do not push.
- Do not enable lead intake.
- Do not enable routing.
- Production remains in a fail-closed paused state for all operational activation.

## Commit 1
### Files
- `PROJECTS/CORE/src/D3-02_GlobalSystemControls.js`

### Purpose
Set the single fail-closed safety authority for lead intake, routing, communications, and read-only mode. This establishes the production gate used by the intake and assignment flow.

### Functions to retain
- `MOS5D32_installGlobalSystemControls()`
- `MOS5D32_setControl(controlKey, newValue, reason)`
- `MOS5D32_getControl(controlKey)`
- the control definitions and their fail-closed defaults

### Functions to modify
- add read-only check helper functions used by intake and assignment logic
- add `MOS5D32_checkLeadIntakeGate_()`
- add `MOS5D32_checkRoutingGate_()`
- add `MOS5D32_checkCommunicationsGate_()`

### Dependencies
- Core workbook only; no trigger installation required.

### Rollback
- revert the file to the last approved-safe state
- keep all controls in fail-closed defaults

### Acceptance tests
- `LEAD_INTAKE_PAUSED` blocks lead intake
- `ROUTING_PAUSED` blocks assignment
- `COMMUNICATIONS_PAUSED` blocks outbound send queue activation
- `READ_ONLY_MODE` blocks live mutation paths

## Commit 2
### Files
- `PROJECTS/CRM/src/LI-01_Core.js`
- `PROJECTS/CRM/src/LI-02_SourceRegistry.js`
- `PROJECTS/CRM/src/LI-03_DedupeEngine.js`
- `PROJECTS/CRM/src/LI-04_QueueProcessor.js`

### Purpose
Establish the canonical intake pipeline: normalization, source validation, dedupe, and queueing without enabling live production flows.

### Functions to retain
- `LI_initializeCore()`
- `LI_receiveLead(payload)`
- `LI_normalizeLead_()`
- `LI_validateLead_()`
- `LI_rejectLead_()`
- `LI_log_()`
- `LI_initializeSourceRegistry()`
- `LI_upsertSource(source)`
- `LI_getSources()`
- `LI_getSource(sourceIdOrName)`
- `LI_applySourceDefaults(lead)`
- `LI_initializeDedupeEngine()`
- `LI_findDuplicateLead(lead)`
- `LI_checkAndLogDuplicate(lead)`
- `LI_receiveLeadWithDedupe(payload)`
- `LI_processIntakeQueue(limit)`
- `LI_processIntakeRecord_(intake)`
- `LI_upsertAELead_(lead)`
- `LI_updateIntakeStatus_(...)`

### Functions to modify
- enforce the safety gate prior to queue acceptance
- require source registry to validate known sources
- block exact email/phone duplicates before queue processing
- keep processing in queued / shadow-safe state

### Dependencies
- `PROJECTS/CORE/src/D3-02_GlobalSystemControls.js`
- `PROJECTS/CRM/src/AE-01_AssignmentEngine.js` only for assignment integration, not production activation

### Rollback
- disable queue processing path and revert to `REJECTED` or `NEW` states only
- keep intake records but suspend live routing

### Acceptance tests
- valid buyer lead enters queue
- seller lead enters queue
- duplicate email is blocked
- duplicate phone is blocked
- unknown source is rejected
- malformed payload is rejected

## Commit 3
### Files
- `PROJECTS/CRM/src/AE-01_AssignmentEngine.js`
- `PROJECTS/CRM/src/AE-05_EligibilityEngine.js`
- `PROJECTS/CRM/src/AE-06_RoundRobinEngine.js`

### Purpose
Provide production-safe assignment authority without activating legacy assignment paths or trigger-managed automation.

### Functions to retain
- `AE_runAssignmentEngine()`
- `AE_assignLead_()`
- `AE_isAssignmentCandidate_()`
- `AE_hasManualAssignment_()`
- `AE_findPriorAssignment_()`
- `AE_isAgentEligible_()`
- `AE_findBrokerAgent_()`
- `AE_selectRoundRobinAgent_()`
- `AE_applyAssignment_()`
- `AE_evaluateEligibility(lead)`
- `AE_selectAgentForLead(lead)`

### Functions to modify
- enforce routing gate
- keep broker-only recruiting path explicit
- ensure no assignment occurs while routing is paused
- ensure no live assignment occurs while production remains paused

### Dependencies
- `PROJECTS/CRM/src/LI-04_QueueProcessor.js`
- `PROJECTS/CORE/src/D3-02_GlobalSystemControls.js`

### Rollback
- leave lead in `UNASSIGNED` or queue for broker review
- stop active assignment calls

### Acceptance tests
- recruiting lead is broker-only
- buyer/seller/renter assign correctly when active agents exist
- no eligible agent triggers broker fallback
- routing paused blocks assignment

## Commit 4
### Files
- `PROJECTS/CRM/src/CRM_LeadIntake.js`
- `PROJECTS/WEBSITE/src/CIP-07_WebApp.js`

### Purpose
Wire the public website endpoint to the CRM intake authority while keeping the system in a paused, fail-safe state.

### Functions to retain
- `submitM5Lead(payload)`
- `validateM5LeadPayload(payload)`
- `doGet(e)`
- `CIP_getPortalData(token)`

### Functions to modify
- add a public intake submission bridge from the website to CRM
- add canonical payload transformation before `submitM5Lead()`
- ensure the public endpoint remains blocked when safety gates are closed

### Dependencies
- `PROJECTS/CRM/src/LI-06_IntakeRouter.js`
- `PROJECTS/CRM/src/CRM_LeadIntake.js`
- `PROJECTS/CORE/src/D3-02_GlobalSystemControls.js`

### Rollback
- revert the public endpoint to a non-submitting read-only page
- leave the CRM intake authority available but not invoked by the public path

### Acceptance tests
- valid lead reaches CRM intake queue
- malformed payload is rejected
- paused intake blocks public submissions
- audit record is created

## Required diagnostics after each commit
After each commit:
1. run a JavaScript syntax/intelligence pass using the available tooling in the repository environment
2. verify there are no immediate parse errors or unresolved references for the modified files
3. record the result
4. stop, summarize the changes, and wait for approval before continuing

## Required stop conditions
- stop after every commit
- summarize the exact files changed and the verification result
- do not continue to the next commit until approval is given

## Important exclusions
- do not touch `PROJECTS/CORE/src/BCC-02_WebAppRouter.gs`
- do not use `AE-07` as production authority
- do not install triggers
- do not enable communications
- do not deploy or push
- do not activate lead intake or routing
