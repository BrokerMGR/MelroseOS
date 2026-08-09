<#
MelroseOS Enterprise
Package Manager Module : PKG-006_InstallPlanner
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKG-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGHeader 'PKG-006 Install Planner'

$Catalog=Get-Content -LiteralPath $Global:PKG_CATALOG -Raw|ConvertFrom-Json
$Registry=Get-PKGRegistry

$DependencyMap=[ordered]@{
    'lead-migration'=@()
    'crm'=@('lead-migration')
    'bcc'=@('crm')
    'education'=@()
    'intake'=@('crm')
    'verify'=@('crm')
}

$Installed=@{}
foreach($p in @($Registry.packages)){
    if([string]$p.status -eq 'INSTALLED'){
        $Installed[[string]$p.id]=$true
    }
}

$CatalogMap=@{}
foreach($p in @($Catalog.packages)){
    $CatalogMap[[string]$p.id]=$p
}

function Resolve-PKGInstallOrder {
    param(
        [string]$PackageId,
        [System.Collections.ArrayList]$Order,
        [hashtable]$Visited,
        [hashtable]$Stack
    )

    if($Visited.ContainsKey($PackageId)){return}

    if($Stack.ContainsKey($PackageId)){
        throw "Circular package dependency detected at $PackageId"
    }

    if(-not $CatalogMap.ContainsKey($PackageId)){
        throw "Package not found in catalog: $PackageId"
    }

    $Stack[$PackageId]=$true

    foreach($dep in @($DependencyMap[$PackageId])){
        Resolve-PKGInstallOrder -PackageId $dep -Order $Order -Visited $Visited -Stack $Stack
    }

    $Stack.Remove($PackageId)
    $Visited[$PackageId]=$true
    [void]$Order.Add($PackageId)
}

$Plans=@()
$Failed=0

foreach($pkg in @($Catalog.packages)){
    $order=[System.Collections.ArrayList]::new()
    $visited=@{}
    $stack=@{}
    $errorText=''

    try{
        Resolve-PKGInstallOrder -PackageId ([string]$pkg.id) -Order $order -Visited $visited -Stack $stack
    }catch{
        $errorText=$_.Exception.Message
    }

    $actions=@()
    foreach($id in @($order)){
        $item=$CatalogMap[$id]
        $source=Join-Path $Global:PKG_ROOT ([string]$item.source)
        $actions+=[pscustomobject]@{
            packageId=$id
            action=if($Installed.ContainsKey($id)){'SKIP_INSTALLED'}else{'PLAN_INSTALL'}
            sourcePath=$source
            sourceExists=(Test-Path -LiteralPath $source)
        }
    }

    $passed=[string]::IsNullOrWhiteSpace($errorText) -and (@($actions|Where-Object{-not $_.sourceExists}).Count-eq0)
    if(-not $passed){$Failed++}

    $Plans+=[pscustomobject]@{
        packageId=[string]$pkg.id
        dependencies=@($DependencyMap[[string]$pkg.id])
        installOrder=@($order)
        actions=$actions
        passed=$passed
        error=$errorText
    }

    if($passed){
        Write-PKGPass "$($pkg.id): install plan ready"
    }else{
        Write-PKGFail "$($pkg.id): install planning failed $errorText"
    }
}

$Report=[ordered]@{
    release='MOS5-018'
    module='PKG-006'
    generatedAt=(Get-Date).ToString('o')
    executionEnabled=$false
    previewOnly=$true
    failedCount=$Failed
    passed=($Failed-eq0)
    plans=$Plans
}
$Path=Write-PKGJson -Data $Report -FileName 'PKG-006-InstallPlan.json'

if($Failed-gt0){
    Write-PKGFail "Install planning failed. Report: $Path"
    exit 1
}

Write-PKGPass "Install planning passed. Report: $Path"
exit 0
