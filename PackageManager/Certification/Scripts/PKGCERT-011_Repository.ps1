<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-011_Repository
Release: MOS5-018
Version: 1.0.2
Purpose: Certify repository state while correctly excluding generated/runtime PackageManager data.
#>

$ErrorActionPreference='Stop'

$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-PKGCertHeader 'PKGCERT-011 Repository'

$Root='D:\MelroseOS\GitHub\MelroseOS'

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

    $process=New-Object System.Diagnostics.Process
    $process.StartInfo=$psi
    $null=$process.Start()

    $stdout=$process.StandardOutput.ReadToEnd()
    $stderr=$process.StandardError.ReadToEnd()
    $process.WaitForExit()

    [pscustomobject]@{
        ExitCode=$process.ExitCode
        StdOut=$stdout.Trim()
        StdErr=$stderr.Trim()
    }
}

$BranchResult=Invoke-GitQuiet @('branch','--show-current')
$HeadResult=Invoke-GitQuiet @('rev-parse','HEAD')
$OriginResult=Invoke-GitQuiet @('rev-parse','origin/main')
$StatusResult=Invoke-GitQuiet @('status','--porcelain')

$Branch=$BranchResult.StdOut
$Head=$HeadResult.StdOut
$Origin=$OriginResult.StdOut

$AllChanges=@()
if(-not [string]::IsNullOrWhiteSpace($StatusResult.StdOut)){
    $AllChanges=@(
        $StatusResult.StdOut -split "`r?`n" |
        Where-Object{-not [string]::IsNullOrWhiteSpace($_)}
    )
}

# These paths are runtime/generated state. Certification execution itself may
# legitimately update them, so they must not make the source tree fail.
$GeneratedPrefixes=@(
    'PackageManager/Reports/',
    'PackageManager/Logs/',
    'PackageManager/Snapshots/',
    'PackageManager/Temp/',
    'PackageManager/Packages/Cache/',
    'PackageManager/Packages/Staging/',
    'PackageManager/Packages/Rollback/',
    'PackageManager/Registry/',
    'PackageManager/Certification/Reports/',
    'PackageManager/Certification/Logs/',
    'PackageManager/Certification/Temp/'
)

$SourceChanges=@()
$GeneratedChanges=@()

foreach($Line in $AllChanges){
    $Path=if($Line.Length -gt 3){$Line.Substring(3).Trim()}else{$Line}
    $Normalized=$Path.Replace('\','/')
    $IsGenerated=$false

    foreach($Prefix in $GeneratedPrefixes){
        if($Normalized.StartsWith($Prefix,[System.StringComparison]::OrdinalIgnoreCase)){
            $IsGenerated=$true
            break
        }
    }

    if($IsGenerated){
        $GeneratedChanges+=$Line
    }else{
        $SourceChanges+=$Line
    }
}

$Checks=@(
    [pscustomobject]@{
        name='Branch main'
        passed=($Branch -eq 'main')
        details="Branch=$Branch"
    },
    [pscustomobject]@{
        name='Local/remote sync'
        passed=($Head -and $Origin -and $Head -eq $Origin)
        details="HEAD=$Head"
    },
    [pscustomobject]@{
        name='Source working tree clean'
        passed=($SourceChanges.Count -eq 0)
        details=if($SourceChanges.Count -eq 0){
            'No pending source/config changes'
        }else{
            "$($SourceChanges.Count) pending source change(s): $($SourceChanges -join ' | ')"
        }
    }
)

$Failed=@($Checks|Where-Object{-not $_.passed}).Count

foreach($Check in $Checks){
    if($Check.passed){
        Write-PKGCertPass "$($Check.name) - $($Check.details)"
    }else{
        Write-PKGCertFail "$($Check.name) - $($Check.details)"
    }
}

if($GeneratedChanges.Count -gt 0){
    Write-PKGCertInfo "Ignoring $($GeneratedChanges.Count) expected generated/runtime change(s)."
    foreach($Generated in $GeneratedChanges){
        Write-PKGCertInfo "Runtime: $Generated"
    }
}

$Warnings=@(
    $BranchResult.StdErr,
    $HeadResult.StdErr,
    $OriginResult.StdErr,
    $StatusResult.StdErr
) | Where-Object{-not [string]::IsNullOrWhiteSpace($_)}

foreach($Warning in $Warnings){
    Write-PKGCertWarn $Warning
}

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-011'
    version='1.0.2'
    generatedAt=(Get-Date).ToString('o')
    branch=$Branch
    localHead=$Head
    remoteHead=$Origin
    sourceChanges=$SourceChanges
    ignoredGeneratedChanges=$GeneratedChanges
    gitWarnings=$Warnings
    failedCount=$Failed
    passed=($Failed -eq 0)
    checks=$Checks
}

$Out=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-011-Repository.json'

if($Failed -gt 0){
    Write-PKGCertFail "Repository certification failed. Report: $Out"
    exit 1
}

Write-PKGCertPass "Repository certification passed. Report: $Out"
exit 0
