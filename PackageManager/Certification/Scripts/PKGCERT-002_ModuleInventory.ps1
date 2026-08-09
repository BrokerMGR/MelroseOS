<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-002_ModuleInventory
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-002 Module Inventory'

$Inventory=Get-PKGCertModuleInventory
$Results=@()

foreach($Module in $Inventory){
    $Exists=(-not [string]::IsNullOrWhiteSpace([string]$Module.Path)) -and (Test-Path -LiteralPath $Module.Path)
    $Size=if($Exists){(Get-Item -LiteralPath $Module.Path).Length}else{0}
    $Passed=$Exists -and ($Size -gt 100)

    $Results += [pscustomobject]@{
        Number=$Module.Number
        Name=$Module.Name
        Path=$Module.Path
        Exists=$Exists
        SizeBytes=$Size
        Passed=$Passed
    }

    if($Passed){
        Write-PKGCertPass "$($Module.Name) ($Size bytes)"
    }else{
        Write-PKGCertFail "$($Module.Name) missing or too small"
    }
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Expected=21

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-002'
    generatedAt=(Get-Date).ToString('o')
    expectedModuleCount=$Expected
    actualModuleCount=$Results.Count
    failedCount=$Failed
    passed=($Results.Count-eq$Expected -and $Failed-eq0)
    modules=$Results
}

$Path=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-002-ModuleInventory.json'

if(-not $Report.passed){
    Write-PKGCertFail "Module inventory certification failed. Report: $Path"
    exit 1
}

Write-PKGCertPass "21/21 modules inventoried. Report: $Path"
exit 0
