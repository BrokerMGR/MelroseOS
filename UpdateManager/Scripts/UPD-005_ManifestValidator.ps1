<#
MelroseOS Enterprise
Update Manager Module : UPD-005_ManifestValidator
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-005 Manifest Validator'

$PackageCatalog='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Manifests\PackageCatalog.json'
$Results=@()
$Failed=0

if(!(Test-Path -LiteralPath $PackageCatalog)){
    Write-UPDFail "Package catalog not found: $PackageCatalog"
    exit 1
}

try{
    $Catalog=Get-Content -LiteralPath $PackageCatalog -Raw|ConvertFrom-Json
}catch{
    Write-UPDFail 'PackageCatalog.json is invalid JSON.'
    exit 1
}

foreach($Package in @($Catalog.packages)){
    $Id=[string]$Package.id
    $Name=[string]$Package.name
    $Source=[string]$Package.source
    $SourcePath=Join-Path $Global:UPD_ROOT $Source

    $Passed=(
        -not [string]::IsNullOrWhiteSpace($Id) -and
        -not [string]::IsNullOrWhiteSpace($Name) -and
        -not [string]::IsNullOrWhiteSpace($Source) -and
        (Test-Path -LiteralPath $SourcePath)
    )

    if(-not $Passed){$Failed++}

    $Results += [pscustomobject]@{
        id=$Id
        name=$Name
        source=$Source
        sourcePath=$SourcePath
        sourceExists=(Test-Path -LiteralPath $SourcePath)
        passed=$Passed
    }

    if($Passed){
        Write-UPDPass "$Id manifest valid"
    }else{
        Write-UPDFail "$Id manifest invalid"
    }
}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-005'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    packages=$Results
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-005-ManifestValidation.json'

if($Failed-gt0){
    Write-UPDFail "Manifest validation failed. Report: $Path"
    exit 1
}

Write-UPDPass "Manifest validation passed. Report: $Path"
exit 0
