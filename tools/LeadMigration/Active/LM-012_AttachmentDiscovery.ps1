<#
MelroseOS Enterprise
Module : LM-012_AttachmentDiscovery
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$InventoryInput=Join-Path $Reports 'MessageInventory.json'
$Output=Join-Path $Reports 'AttachmentDiscovery.json'

function Get-MOSAttachmentCandidates{
 param($Message)

 $rows=@()

 foreach($a in @($Message.Attachments)){
  $rows+=[pscustomobject]@{
   MessageId=[string]$Message.MessageId
   ThreadId=[string]$Message.ThreadId
   AttachmentId=[string]$a.AttachmentId
   FileName=[string]$a.FileName
   MimeType=[string]$a.MimeType
   Size=[int64]$a.Size
   Downloaded=$false
   ScanStatus='NOT_SCANNED'
   RequiresBrokerReview=$false
  }
 }

 $rows
}

function Invoke-MOSAttachmentDiscovery{
 Write-MOSHeader 'LM-012 Attachment Discovery'
 if(!(Test-Path $InventoryInput)){Write-MOSError 'MessageInventory.json not found.';exit 1}

 $data=Get-Content $InventoryInput -Raw|ConvertFrom-Json
 $rows=@()

 foreach($box in @($data.mailboxes)){
  foreach($message in @($box.Messages)){
   $rows+=Get-MOSAttachmentCandidates $message
  }
 }

 [ordered]@{
  release='MOS5-016';module='LM-012';generatedAt=(Get-Date).ToString('o')
  attachmentCount=$rows.Count
  attachments=$rows
  previewOnly=$true
  attachmentDownloadsEnabled=$false
  crmWritesEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  nextModule='LM-013_AttachmentProcessor'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-012 Attachment Discovery Ready'
}
Invoke-MOSAttachmentDiscovery
exit 0
