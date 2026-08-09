<#
MelroseOS Enterprise
Certification : CERT-012
Name          : Repository Certification
Version       : 3.0.0
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'

$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-CertHeader 'CERT-012 Repository Certification v3.0'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$Results=@()

function Add-RepoCheck {
    param([string]$Check,[bool]$Passed,[string]$Details)

    $script:Results += New-CertResult -Check $Check -Passed $Passed -Details $Details

    if($Passed){
        Write-CertPass "$Check - $Details"
    }else{
        Write-CertFail "$Check - $Details"
    }
}

function Invoke-GitQuiet {
    param([string[]]$Arguments)

    $psi=New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName='git.exe'
    $psi.Arguments=($Arguments -join ' ')
    $psi.WorkingDirectory=$Root
    $psi.UseShellExecute=$false
    $psi.RedirectStandardOutput=$true
    $psi.RedirectStandardError=$true
    $psi.CreateNoWindow=$true

    $p=New-Object System.Diagnostics.Process
    $p.StartInfo=$psi
    $null=$p.Start()

    $stdout=$p.StandardOutput.ReadToEnd()
    $stderr=$p.StandardError.ReadToEnd()
    $p.WaitForExit()

    [pscustomobject]@{
        ExitCode=$p.ExitCode
        StdOut=$stdout.Trim()
        StdErr=$stderr.Trim()
    }
}

Add-RepoCheck 'Git repository' (Test-Path -LiteralPath (Join-Path $Root '.git')) $Root
Add-RepoCheck 'MelroseOS.config' (Test-Path -LiteralPath (Join-Path $Root 'MelroseOS.config')) 'Configuration file'
Add-RepoCheck 'Build directory' (Test-Path -LiteralPath (Join-Path $Root 'Build')) 'Build'
Add-RepoCheck 'Development directory' (Test-Path -LiteralPath (Join-Path $Root 'Development')) 'Development'
Add-RepoCheck 'CoreModules directory' (Test-Path -LiteralPath (Join-Path $Root 'CoreModules')) 'CoreModules'

$gitAvailable=$false
try{
    $version=Invoke-GitQuiet @('--version')
    $gitAvailable=($version.ExitCode -eq 0)
}catch{
    $gitAvailable=$false
}

Add-RepoCheck 'Git executable' $gitAvailable $(if($gitAvailable){'Available'}else{'Unavailable'})

$branch=''
$head=''
$origin=''
$gitWarnings=@()
$allChanges=@()
$generatedChanges=@()
$sourceChanges=@()

if($gitAvailable){
    $branchResult=Invoke-GitQuiet @('branch','--show-current')
    $headResult=Invoke-GitQuiet @('rev-parse','HEAD')
    $originResult=Invoke-GitQuiet @('rev-parse','origin/main')
    $statusResult=Invoke-GitQuiet @('status','--porcelain')

    foreach($r in @($branchResult,$headResult,$originResult,$statusResult)){
        if($r.StdErr){$gitWarnings += $r.StdErr}
    }

    $branch=$branchResult.StdOut
    $head=$headResult.StdOut
    $origin=$originResult.StdOut

    if(-not [string]::IsNullOrWhiteSpace($statusResult.StdOut)){
        $allChanges=@($statusResult.StdOut -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
}

$GeneratedPrefixes=@(
    'tools/LeadMigration/Certification/Reports/',
    'tools/LeadMigration/Certification/Logs/',
    'tools/LeadMigration/Certification/Temp/',
    'tools/LeadMigration/Certification/Snapshots/',
    'tools/LeadMigration/Reports/',
    'tools/LeadMigration/Logs/',
    'tools/LeadMigration/Exports/',
    'tools/LeadMigration/Backups/'
)

foreach($line in $allChanges){
    $path=$line
    if($line.Length -gt 3){
        $path=$line.Substring(3).Trim()
    }

    $isGenerated=$false

    foreach($prefix in $GeneratedPrefixes){
        if($path.Replace('\','/').StartsWith($prefix,[System.StringComparison]::OrdinalIgnoreCase)){
            $isGenerated=$true
            break
        }
    }

    if($isGenerated){
        $generatedChanges += $line
    }else{
        $sourceChanges += $line
    }
}

Add-RepoCheck 'Branch main' ($branch -eq 'main') "Branch=$branch"
Add-RepoCheck 'Local/remote sync' ($head -and $origin -and $head -eq $origin) "HEAD=$head"

$sourceClean=($sourceChanges.Count -eq 0)
Add-RepoCheck 'Source working tree clean' $sourceClean $(if($sourceClean){'No pending source/config changes'}else{"$($sourceChanges.Count) pending source/config change(s)"})

if($generatedChanges.Count -gt 0){
    Write-CertInfo "Ignoring $($generatedChanges.Count) expected generated runtime/report change(s)."
}

if($sourceChanges.Count -gt 0){
    Write-CertWarn 'Pending source/config changes detected:'
    foreach($line in $sourceChanges){
        Write-Host "       $line"
    }
}

if($gitWarnings.Count -gt 0){
    Write-CertWarn 'Git emitted non-blocking warnings.'
    foreach($warning in $gitWarnings){
        foreach($line in @($warning -split "`r?`n")){
            if(-not [string]::IsNullOrWhiteSpace($line)){
                Write-Host "       $line"
            }
        }
    }
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count

$Report=[ordered]@{
    release='MOS5-017A'
    targetRelease='MOS5-016'
    certification='CERT-012'
    version='3.0.0'
    generatedAt=(Get-Date).ToString('o')
    branch=$branch
    localHead=$head
    remoteHead=$origin
    sourceWorkingTreeClean=$sourceClean
    sourceChanges=$sourceChanges
    ignoredGeneratedChanges=$generatedChanges
    ignoredGeneratedPrefixes=$GeneratedPrefixes
    gitWarnings=$gitWarnings
    warningsNonBlocking=$true
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Path=Write-CertJson -Data $Report -FileName 'CERT-012-Repository.json'

if($Failed-gt0){
    Write-CertFail "Repository certification failed. Report: $Path"
    exit 1
}

Write-CertPass "Repository certification passed. Report: $Path"
exit 0
