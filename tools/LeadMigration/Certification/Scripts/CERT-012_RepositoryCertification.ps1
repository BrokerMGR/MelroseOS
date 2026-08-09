<#
MelroseOS Enterprise
Certification : CERT-012
Name          : Repository Certification
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-012 Repository Certification'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$Results=@()

function Add-RepoCheck {
    param([string]$Check,[bool]$Passed,[string]$Details)
    $script:Results += New-CertResult -Check $Check -Passed $Passed -Details $Details
    if($Passed){Write-CertPass "$Check - $Details"}else{Write-CertFail "$Check - $Details"}
}

Add-RepoCheck 'Git repository' (Test-Path -LiteralPath (Join-Path $Root '.git')) $Root
Add-RepoCheck 'MelroseOS.config' (Test-Path -LiteralPath (Join-Path $Root 'MelroseOS.config')) 'Configuration file'
Add-RepoCheck 'Build directory' (Test-Path -LiteralPath (Join-Path $Root 'Build')) 'Build'
Add-RepoCheck 'Development directory' (Test-Path -LiteralPath (Join-Path $Root 'Development')) 'Development'
Add-RepoCheck 'CoreModules directory' (Test-Path -LiteralPath (Join-Path $Root 'CoreModules')) 'CoreModules'

$gitAvailable=$false
try{
    $null=& git --version
    $gitAvailable=$true
}catch{}
Add-RepoCheck 'Git executable' $gitAvailable $(if($gitAvailable){'Available'}else{'Unavailable'})

$branch=''
$head=''
$origin=''
$clean=$false

if($gitAvailable){
    Push-Location $Root
    try{
        $branch=(& git branch --show-current 2>$null).Trim()
        $head=(& git rev-parse HEAD 2>$null).Trim()
        $origin=(& git rev-parse origin/main 2>$null).Trim()
        $status=@(& git status --porcelain 2>$null)
        $clean=($status.Count-eq0)
    }finally{
        Pop-Location
    }
}

Add-RepoCheck 'Branch main' ($branch -eq 'main') "Branch=$branch"
Add-RepoCheck 'Local/remote sync' ($head -and $origin -and $head -eq $origin) "HEAD=$head"
Add-RepoCheck 'Working tree clean' $clean $(if($clean){'Clean'}else{'Pending changes detected'})

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Report=[ordered]@{
    release='MOS5-017A'
    targetRelease='MOS5-016'
    certification='CERT-012'
    generatedAt=(Get-Date).ToString('o')
    branch=$branch
    localHead=$head
    remoteHead=$origin
    workingTreeClean=$clean
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}
$Path=Write-CertJson -Data $Report -FileName 'CERT-012-Repository.json'
if($Failed-gt0){Write-CertFail "Repository certification failed. Report: $Path";exit 1}
Write-CertPass "Repository certification passed. Report: $Path"
exit 0
