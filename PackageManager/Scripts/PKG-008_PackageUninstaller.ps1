<#
MelroseOS Enterprise
Package Manager Module : PKG-008_PackageUninstaller
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKG-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGHeader 'PKG-008 Package Uninstaller'

$Config=Get-PKGConfig
$ExecutionAllowed=($Config['AUTO_REMOVE'] -eq 'TRUE')
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
    if([string]$p.status -eq 'INSTALLED'){$Installed[[string]$p.id]=$p}
}

$Rows=@()

foreach($p in @($Registry.packages)){
    $id=[string]$p.id
    $dependents=@()

    foreach($other in $DependencyMap.Keys){
        if(@($DependencyMap[$other]) -contains $id -and $Installed.ContainsKey($other)){
            $dependents+=$other
        }
    }

    $protected=($dependents.Count -gt 0)
    $canRemove=($Installed.ContainsKey($id) -and -not $protected)

    $Rows+=[pscustomobject]@{
        packageId=$id
        installed=$Installed.ContainsKey($id)
        dependents=$dependents
        protectedByDependency=$protected
        canRemove=$canRemove
        executionAllowed=$ExecutionAllowed
        removalExecuted=$false
    }

    if($protected){
        Write-PKGWarn "$id protected by: $($dependents -join ', ')"
    }elseif($canRemove){
        Write-PKGPass "$id eligible for uninstall"
    }else{
        Write-PKGInfo "$id not installed or not eligible"
    }
}

$Report=[ordered]@{
    release='MOS5-018'
    module='PKG-008'
    generatedAt=(Get-Date).ToString('o')
    executionAllowed=$ExecutionAllowed
    destructiveActionsEnabled=$false
    previewOnly=$true
    packages=$Rows
}
$Path=Write-PKGJson -Data $Report -FileName 'PKG-008-UninstallReport.json'
Write-PKGPass "Uninstall eligibility report ready: $Path"
exit 0
