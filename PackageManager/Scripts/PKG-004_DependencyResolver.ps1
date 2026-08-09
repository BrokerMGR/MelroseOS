<#
MelroseOS Enterprise
Package Manager Module : PKG-004_DependencyResolver
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKG-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGHeader 'PKG-004 Dependency Resolver'

$Catalog=Get-Content -LiteralPath $Global:PKG_CATALOG -Raw|ConvertFrom-Json

$DependencyMap=[ordered]@{
    'lead-migration'=@()
    'crm'=@('lead-migration')
    'bcc'=@('crm')
    'education'=@()
    'intake'=@('crm')
    'verify'=@('crm')
}

$Known=@{}
foreach($pkg in @($Catalog.packages)){$Known[[string]$pkg.id]=$true}

$Rows=@()
$Failed=0

foreach($pkg in @($Catalog.packages)){
    $deps=@($DependencyMap[[string]$pkg.id])
    $missing=@()

    foreach($d in $deps){
        if(-not $Known.ContainsKey($d)){$missing+=$d}
    }

    $passed=($missing.Count-eq0)
    if(-not $passed){$Failed++}

    $Rows+=[pscustomobject]@{
        id=[string]$pkg.id
        dependencies=$deps
        missingDependencies=$missing
        passed=$passed
    }

    if($passed){Write-PKGPass "$($pkg.id): dependencies resolved"}else{Write-PKGFail "$($pkg.id): missing $($missing -join ', ')"}
}

$Report=[ordered]@{
    release='MOS5-018'
    module='PKG-004'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    packages=$Rows
}
$Path=Write-PKGJson -Data $Report -FileName 'PKG-004-Dependencies.json'

if($Failed-gt0){Write-PKGFail "Dependency resolution failed. Report: $Path";exit 1}
Write-PKGPass "Dependency resolution passed. Report: $Path"
exit 0
