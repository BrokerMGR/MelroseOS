<#
MelroseOS Enterprise
Module : LM-013_AttachmentProcessor
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$InputPath=Join-Path $Reports 'AttachmentDiscovery.json'
$Output=Join-Path $Reports 'AttachmentProcessing.json'

function Get-MOSAttachmentDisposition {
 param($Attachment)

 $mime=([string]$Attachment.MimeType).ToLowerInvariant()
 $name=([string]$Attachment.FileName).ToLowerInvariant()

 if($mime -match '^image/'){return 'IMAGE'}
 if($mime -match 'pdf'){return 'PDF'}
 if($mime -match 'spreadsheet|excel|csv' -or $name -match '\.(xlsx|xls|csv)$'){return 'DATA'}
 if($mime -match 'word|document' -or $name -match '\.(docx|doc)$'){return 'DOCUMENT'}
 return 'OTHER'
}

function Invoke-MOSAttachmentProcessor {
 Write-MOSHeader 'LM-013 Attachment Processor'
 if(!(Test-Path $InputPath)){Write-MOSError 'AttachmentDiscovery.json not found.';exit 1}

 $data=Get-Content $InputPath -Raw|ConvertFrom-Json
 $rows=@()

 foreach($a in @($data.attachments)){
  $kind=Get-MOSAttachmentDisposition $a

  $rows+=[pscustomobject]@{
   MessageId=[string]$a.MessageId
   ThreadId=[string]$a.ThreadId
   AttachmentId=[string]$a.AttachmentId
   FileName=[string]$a.FileName
   MimeType=[string]$a.MimeType
   Size=[int64]$a.Size
   AttachmentType=$kind
   ExtractionEligible=($kind -in @('PDF','DOCUMENT','DATA'))
   ProcessingState='PREVIEW_ONLY'
   Downloaded=$false
   ContentExtracted=$false
   RequiresBrokerReview=($kind -eq 'OTHER')
  }
 }

 [ordered]@{
  release='MOS5-016';module='LM-013';generatedAt=(Get-Date).ToString('o')
  attachmentCount=$rows.Count
  records=$rows
  previewOnly=$true
  attachmentDownloadsEnabled=$false
  contentExtractionEnabled=$false
  crmWritesEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  nextModule='LM-014_LabelManager'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-013 Attachment Processor Ready'
}
Invoke-MOSAttachmentProcessor
exit 0
