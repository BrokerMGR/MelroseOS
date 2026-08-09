<#
MelroseOS Enterprise
Update Manager Module : UPD-013_RollbackManager
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-013 Rollback Manager'

$Config=Get-UPDConfig
$RollbackAllowed=([string]$Config['ALLOW_ROLLBACK'] -eq 'TRUE')
$Snapshots=Join-Path $Global:UPD_MANAGER 'Snapshots'
$Latest=Get-ChildItem -LiteralPath $Snapshots -Filter 'PreUpdate-*.json' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$Passed=$RollbackAllowed -and ($null-ne$Latest)

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-013'
    generatedAt=(Get-Date).ToString('o')
    rollbackAllowed=$RollbackAllowed
    latestSnapshot=if($Latest){$Latest.FullName}else{''}
    executionEnabled=$false
    previewOnly=$true
    passed=$Passed
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-013-Rollback.json'

if(-not $Passed){
    Write-UPDFail "Rollback readiness failed. Report: $Path"
    exit 1
}

Write-UPDPass "Rollback readiness passed. Report: $Path"
exit 0
