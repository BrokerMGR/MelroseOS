<#
MelroseOS Enterprise
Certification : CERT-013
Name          : Console Certification
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-013 Console Certification'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$Console=Join-Path $Root 'DeveloperConsole'

$Required=@(
    (Join-Path $Console 'Run-DeveloperConsole.bat'),
    (Join-Path $Console 'Menus\DC-01_MainMenu.bat'),
    (Join-Path $Console 'Menus\DC-02_LeadMigrationMenu.bat'),
    (Join-Path $Console 'Menus\DC-03_ValidationMenu.bat'),
    (Join-Path $Console 'Menus\DC-04_GitMenu.bat'),
    (Join-Path $Console 'Actions\DC-10_BuildMelroseOS.bat'),
    (Join-Path $Console 'Actions\DC-11_InstallModules.bat'),
    (Join-Path $Console 'LeadMigration\DC-20_RunLeadMigration.bat'),
    (Join-Path $Console 'Validation\DC-30_RunAllValidation.bat'),
    (Join-Path $Console 'Git\DC-40_GitStatus.bat')
)

$Results=@()

foreach($p in $Required){
    $exists=Test-Path -LiteralPath $p
    $size=if($exists){(Get-Item -LiteralPath $p).Length}else{0}
    $passed=$exists -and $size -gt 50

    $Results+=[pscustomobject]@{
        Path=$p
        Exists=$exists
        SizeBytes=$size
        Passed=$passed
    }

    if($passed){Write-CertPass $p}else{Write-CertFail $p}
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Report=[ordered]@{
    release='MOS5-017A'
    targetRelease='MOS5-016'
    certification='CERT-013'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}
$Path=Write-CertJson -Data $Report -FileName 'CERT-013-Console.json'

if($Failed-gt0){Write-CertFail "Console certification failed. Report: $Path";exit 1}
Write-CertPass "Console certification passed. Report: $Path"
exit 0
