<#
MelroseOS Enterprise
Package Manager Module : PKG-007_PackageInstaller
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKG-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGHeader 'PKG-007 Package Installer'

$PlanPath=Join-Path $Global:PKG_REPORTS 'PKG-006-InstallPlan.json'
if(!(Test-Path -LiteralPath $PlanPath)){
    Write-PKGFail "Install plan not found: $PlanPath"
    exit 1
}

$Config=Get-PKGConfig
$ExecutionAllowed=($Config['AUTO_INSTALL'] -eq 'TRUE')
$Plan=Get-Content -LiteralPath $PlanPath -Raw|ConvertFrom-Json
$Registry=Get-PKGRegistry

$RegistryMap=@{}
foreach($p in @($Registry.packages)){$RegistryMap[[string]$p.id]=$p}

$Actions=@()
$Failed=0

foreach($plan in @($Plan.plans)){
    foreach($action in @($plan.actions)){
        $id=[string]$action.packageId
        $state=[string]$action.action
        $result='PLANNED_ONLY'
        $success=$true

        if($state -eq 'SKIP_INSTALLED'){
            $result='ALREADY_INSTALLED'
        }
        elseif($state -eq 'PLAN_INSTALL'){
            if($ExecutionAllowed){
                $pkg=$RegistryMap[$id]
                if($pkg){
                    $pkg.status='INSTALLED'
                    $pkg.installedVersion=if([string]::IsNullOrWhiteSpace([string]$pkg.availableVersion)){'1.0.0'}else{[string]$pkg.availableVersion}
                    $pkg.lastUpdated=(Get-Date).ToString('o')
                    $result='INSTALLED'
                }else{
                    $success=$false
                    $result='REGISTRY_ENTRY_MISSING'
                }
            }else{
                $result='INSTALL_BLOCKED_BY_SAFE_MODE'
            }
        }

        if(-not $success){$Failed++}

        $Actions+=[pscustomobject]@{
            packageId=$id
            requestedAction=$state
            executionAllowed=$ExecutionAllowed
            result=$result
            passed=$success
        }

        if($success){Write-PKGPass "$id : $result"}else{Write-PKGFail "$id : $result"}
    }
}

if($ExecutionAllowed){
    Save-PKGRegistry $Registry
}

$Report=[ordered]@{
    release='MOS5-018'
    module='PKG-007'
    generatedAt=(Get-Date).ToString('o')
    executionAllowed=$ExecutionAllowed
    failedCount=$Failed
    passed=($Failed-eq0)
    actions=$Actions
}
$Path=Write-PKGJson -Data $Report -FileName 'PKG-007-InstallReport.json'

if($Failed-gt0){
    Write-PKGFail "Package installation failed. Report: $Path"
    exit 1
}

Write-PKGPass "Package installer completed. Report: $Path"
exit 0
