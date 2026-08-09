<#
MelroseOS Enterprise
Certification : CERT-007
Name          : Function Certification
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-007 Function Certification'

$Inventory=Get-CertModuleInventory
$Results=@()

foreach($m in $Inventory){
    if([string]::IsNullOrWhiteSpace([string]$m.Path) -or -not (Test-Path -LiteralPath $m.Path)){
        $Results+=[pscustomobject]@{Module=$m.Name;FunctionCount=0;Passed=$false;Functions=@();Details='File missing'}
        Write-CertFail "$($m.Name) missing"
        continue
    }

    $tokens=$null
    $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($m.Path,[ref]$tokens,[ref]$errors)
    $funcs=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst]},$true) | ForEach-Object {$_.Name} | Sort-Object -Unique)
    $passed=($errors.Count-eq0 -and ($m.Number-eq0 -or $funcs.Count-gt0))

    $Results+=[pscustomobject]@{
        Module=$m.Name
        FunctionCount=$funcs.Count
        Functions=$funcs
        Passed=$passed
        Details=if($passed){'Functions discovered'}else{'No function definitions or syntax errors'}
    }

    if($passed){Write-CertPass "$($m.Name): $($funcs.Count) function(s)"}else{Write-CertFail "$($m.Name): no certifiable functions"}
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Report=[ordered]@{
 release='MOS5-017A';targetRelease='MOS5-016';certification='CERT-007'
 generatedAt=(Get-Date).ToString('o');failedCount=$Failed;passed=($Failed-eq0);results=$Results
}
$Path=Write-CertJson -Data $Report -FileName 'CERT-007-Functions.json'
if($Failed-gt0){Write-CertFail "Function certification failed. Report: $Path";exit 1}
Write-CertPass "Function certification passed. Report: $Path"
exit 0
