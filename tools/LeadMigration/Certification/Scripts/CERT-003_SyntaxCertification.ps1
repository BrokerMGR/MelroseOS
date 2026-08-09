<#
MelroseOS Enterprise
Certification : CERT-003
Name          : Syntax Certification
Release       : MOS5-017A
#>

$ErrorActionPreference = 'Stop'

$Common = 'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if (-not (Test-Path -LiteralPath $Common)) {
    Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-CertHeader 'CERT-003 Syntax Certification'

$Inventory = Get-CertModuleInventory
$Results = @()

foreach ($Module in $Inventory) {
    if ([string]::IsNullOrWhiteSpace([string]$Module.Path) -or -not (Test-Path -LiteralPath $Module.Path)) {
        $Results += [pscustomobject]@{
            Number = $Module.Number
            Name = $Module.Name
            Passed = $false
            Errors = @('File not found')
        }
        Write-CertFail "$($Module.Name) not found"
        continue
    }

    $Tokens = $null
    $Errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $Module.Path,
        [ref]$Tokens,
        [ref]$Errors
    ) | Out-Null

    $Messages = @($Errors | ForEach-Object { $_.Message })
    $Passed = ($Messages.Count -eq 0)

    $Results += [pscustomobject]@{
        Number = $Module.Number
        Name = $Module.Name
        Passed = $Passed
        Errors = $Messages
    }

    if ($Passed) {
        Write-CertPass $Module.Name
    } else {
        Write-CertFail $Module.Name
        foreach ($Message in $Messages) { Write-Host "       $Message" }
    }
}

$Failed = @($Results | Where-Object { -not $_.Passed }).Count

$Report = [ordered]@{
    release = 'MOS5-017A'
    targetRelease = 'MOS5-016'
    certification = 'CERT-003'
    generatedAt = (Get-Date).ToString('o')
    failedCount = $Failed
    passed = ($Failed -eq 0)
    results = $Results
}

$Path = Write-CertJson -Data $Report -FileName 'CERT-003-Syntax.json'

if ($Failed -gt 0) {
    Write-CertFail "Syntax certification failed. Report: $Path"
    exit 1
}

Write-CertPass "All module syntax passed. Report: $Path"
exit 0
