<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-010_Reports
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-010 Reports'

$PkgReports='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Reports'
$Required=@(
 'PKG-001-Registry.json',
 'PKG-002-Manifests.json',
 'PKG-003-Discovery.json',
 'PKG-004-Dependencies.json',
 'PKG-005-Integrity.json',
 'PKG-006-InstallPlan.json',
 'PKG-007-InstallReport.json',
 'PKG-008-UninstallReport.json',
 'PKG-009-UpdatePlan.json',
 'PKG-010-UpdateReport.json',
 'PKG-011-Rollback.json',
 'PKG-012-Versions.json',
 'PKG-013-Snapshot.json',
 'PKG-014-Restore.json',
 'PKG-015-PackageReport.json',
 'PKG-016-Diagnostics.json',
 'PKG-017-CertificationGate.json',
 'PKG-018-Release.json',
 'PKG-019-Cache.json',
 'PKG-020-PackageManager.json'
)

$Results=@()
$Failed=0

foreach($Name in $Required){
    $Path=Join-Path $PkgReports $Name
    $Exists=Test-Path -LiteralPath $Path
    $Valid=$false
    $Details='Missing'

    if($Exists){
        try{
            $Raw=Get-Content -LiteralPath $Path -Raw
            if([string]::IsNullOrWhiteSpace($Raw)){throw 'Empty file'}
            $null=$Raw|ConvertFrom-Json
            $Valid=$true
            $Details='Valid JSON'
        }catch{
            $Details=$_.Exception.Message
        }
    }

    $Passed=$Exists -and $Valid
    if(-not $Passed){$Failed++}

    $Results+=[pscustomobject]@{
        file=$Name
        path=$Path
        exists=$Exists
        validJson=$Valid
        passed=$Passed
        details=$Details
    }

    if($Passed){Write-PKGCertPass $Name}else{Write-PKGCertFail "$Name - $Details"}
}

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-010'
    generatedAt=(Get-Date).ToString('o')
    requiredReportCount=$Required.Count
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Out=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-010-Reports.json'
if($Failed-gt0){Write-PKGCertFail "Report certification failed. Report: $Out";exit 1}
Write-PKGCertPass "Report certification passed. Report: $Out"
exit 0
