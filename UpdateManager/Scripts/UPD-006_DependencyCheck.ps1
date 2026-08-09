<#
MelroseOS Enterprise
Update Manager Module : UPD-006_DependencyCheck
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-006 Dependency Check'

$PackageCatalog='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Manifests\PackageCatalog.json'
if(!(Test-Path -LiteralPath $PackageCatalog)){
    Write-UPDFail 'PackageCatalog.json not found.'
    exit 1
}

$Catalog=Get-Content -LiteralPath $PackageCatalog -Raw|ConvertFrom-Json

$DependencyMap=[ordered]@{
    'lead-migration'=@()
    'crm'=@('lead-migration')
    'bcc'=@('crm')
    'education'=@()
    'intake'=@('crm')
    'verify'=@('crm')
}

$Known=@{}
foreach($Package in @($Catalog.packages)){
    $Known[[string]$Package.id]=$true
}

$Results=@()
$Failed=0

foreach($Package in @($Catalog.packages)){
    $Id=[string]$Package.id
    $Dependencies=@($DependencyMap[$Id])
    $Missing=@()

    foreach($Dependency in $Dependencies){
        if(-not $Known.ContainsKey([string]$Dependency)){
            $Missing += [string]$Dependency
        }
    }

    $Passed=($Missing.Count-eq0)
    if(-not $Passed){$Failed++}

    $Results += [pscustomobject]@{
        packageId=$Id
        dependencies=$Dependencies
        missingDependencies=$Missing
        passed=$Passed
    }

    if($Passed){
        Write-UPDPass "$Id dependencies resolved"
    }else{
        Write-UPDFail "$Id missing dependencies: $($Missing -join ', ')"
    }
}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-006'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    packages=$Results
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-006-DependencyCheck.json'

if($Failed-gt0){
    Write-UPDFail "Dependency check failed. Report: $Path"
    exit 1
}

Write-UPDPass "Dependency check passed. Report: $Path"
exit 0
