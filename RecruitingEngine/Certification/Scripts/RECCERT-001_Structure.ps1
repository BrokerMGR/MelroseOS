$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\RecruitingEngine\Certification\Core\RECCERT-000_Common.ps1'

Write-RECCertHeader 'RECCERT-001 Structure'

$Required=@(
    'AppsScript',
    'Branding',
    'Config',
    'Manifests',
    'Reports',
    'Logs',
    'Tests',
    'Certification',
    'Certification\Core',
    'Certification\Scripts',
    'Certification\Reports'
)

$Checks=@()
$Failed=0

foreach($Rel in $Required){
    $Path=Join-Path $Global:REC_ROOT $Rel
    $Pass=Test-Path -LiteralPath $Path
    if(!$Pass){$Failed++}
    $Checks += [pscustomobject]@{check=$Rel;passed=$Pass;path=$Path}
    if($Pass){Write-RECCertPass $Rel}else{Write-RECCertFail $Rel}
}

$Report=[ordered]@{
    release='MOS5-021'
    certification='RECCERT-001'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    checks=$Checks
}

$Out=Write-RECCertJson -Data $Report -FileName 'RECCERT-001-Structure.json'
if($Failed){Write-RECCertFail "Structure certification failed. Report: $Out";exit 1}
Write-RECCertPass "Structure certification passed. Report: $Out"
exit 0
