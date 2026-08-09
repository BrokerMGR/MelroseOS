<#
MelroseOS Enterprise
Update Manager Module : UPD-014_ReleaseNotes
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-014 Release Notes'

$Registry=Get-UPDRegistry
$Rows=@()

foreach($Update in @($Registry.updates)){
    $Rows += [pscustomobject]@{
        packageId=[string]$Update.packageId
        fromVersion=[string]$Update.fromVersion
        toVersion=[string]$Update.toVersion
        status=[string]$Update.status
        channel=[string]$Update.channel
    }
}

$NotesPath=Join-Path $Global:UPD_REPORTS 'ReleaseNotes.md'
$Lines=@(
    '# MelroseOS Update Release Notes',
    '',
    'Release: MOS5-019',
    '',
    '| Package | From | To | Status | Channel |',
    '|---|---|---|---|---|'
)

foreach($Row in $Rows){
    $Lines += "| $($Row.packageId) | $($Row.fromVersion) | $($Row.toVersion) | $($Row.status) | $($Row.channel) |"
}

$Lines|Set-Content -LiteralPath $NotesPath -Encoding UTF8

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-014'
    generatedAt=(Get-Date).ToString('o')
    updateCount=$Rows.Count
    notesPath=$NotesPath
    passed=(Test-Path -LiteralPath $NotesPath)
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-014-ReleaseNotes.json'

if(-not $Report.passed){
    Write-UPDFail "Release notes generation failed. Report: $Path"
    exit 1
}

Write-UPDPass "Release notes generated. Report: $Path"
exit 0
