<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-003_Syntax
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-003 Syntax'

$Inventory=Get-PKGCertModuleInventory
$Results=@()

foreach($Module in $Inventory){
    if([string]::IsNullOrWhiteSpace([string]$Module.Path) -or -not (Test-Path -LiteralPath $Module.Path)){
        $Results += [pscustomobject]@{
            Number=$Module.Number
            Name=$Module.Name
            Passed=$false
            Errors=@('File not found')
        }
        Write-PKGCertFail "$($Module.Name) not found"
        continue
    }

    $Tokens=$null
    $Errors=$null

    [System.Management.Automation.Language.Parser]::ParseFile(
        $Module.Path,
        [ref]$Tokens,
        [ref]$Errors
    )|Out-Null

    $Messages=@($Errors|ForEach-Object{$_.Message})
    $Passed=($Messages.Count-eq0)

    $Results += [pscustomobject]@{
        Number=$Module.Number
        Name=$Module.Name
        Passed=$Passed
        Errors=$Messages
    }

    if($Passed){
        Write-PKGCertPass $Module.Name
    }else{
        Write-PKGCertFail $Module.Name
        foreach($Message in $Messages){Write-Host "       $Message"}
    }
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-003'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Path=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-003-Syntax.json'

if($Failed-gt0){
    Write-PKGCertFail "Syntax certification failed. Report: $Path"
    exit 1
}

Write-PKGCertPass "All Package Manager module syntax passed. Report: $Path"
exit 0
