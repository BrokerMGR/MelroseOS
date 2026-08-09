<#
MelroseOS Enterprise
Enterprise Auditor
Module : EA-001_EnterpriseAudit
Release: MOS5-020
Version: 1.0.1
#>

$ErrorActionPreference='Stop'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$AuditRoot=Join-Path $Root 'EnterpriseAuditor'
$Reports=Join-Path $AuditRoot 'Reports'
$Logs=Join-Path $AuditRoot 'Logs'

foreach($Path in @($AuditRoot,$Reports,$Logs)){
    if(!(Test-Path -LiteralPath $Path)){
        New-Item -ItemType Directory -Force -Path $Path|Out-Null
    }
}

function Write-Section([string]$Title){
    Write-Host ''
    Write-Host '=========================================================='
    Write-Host " $Title"
    Write-Host '=========================================================='
    Write-Host ''
}

function Write-Pass([string]$Text){Write-Host "[PASS] $Text" -ForegroundColor Green}
function Write-Fail([string]$Text){Write-Host "[FAIL] $Text" -ForegroundColor Red}
function Write-Warn([string]$Text){Write-Host "[WARN] $Text" -ForegroundColor Yellow}
function Write-Info([string]$Text){Write-Host "[INFO] $Text"}

function Invoke-GitAudit {
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

$Checks=@()
$Failures=0
$Warnings=0

function Add-Check {
    param(
        [string]$Area,
        [string]$Check,
        [string]$Status,
        [string]$Details
    )

    $script:Checks += [pscustomobject]@{
        area=$Area
        check=$Check
        status=$Status
        details=$Details
    }

    if($Status -eq 'WARN'){$script:Warnings++}
    if($Status -eq 'FAIL'){$script:Failures++}
}

Write-Section 'MELROSEOS ENTERPRISE AUDITOR'

# --------------------------------------------------------------------
# Repository
# --------------------------------------------------------------------
Write-Section 'REPOSITORY'

$RepoExists=Test-Path -LiteralPath (Join-Path $Root '.git')

if($RepoExists){
    Write-Pass $Root
    Add-Check 'Repository' 'Git repository exists' 'PASS' $Root
}else{
    Write-Fail $Root
    Add-Check 'Repository' 'Git repository exists' 'FAIL' $Root
}

if($RepoExists){
    $BranchResult=Invoke-GitAudit @('branch','--show-current')
    $LocalResult=Invoke-GitAudit @('rev-parse','HEAD')
    $RemoteResult=Invoke-GitAudit @('rev-parse','origin/main')
    $StatusResult=Invoke-GitAudit @('status','--porcelain=v1','--untracked-files=all')

    $Branch=$BranchResult.StdOut
    $Local=$LocalResult.StdOut
    $Remote=$RemoteResult.StdOut

    if($Branch -eq 'main'){
        Write-Pass 'Branch main'
        Add-Check 'Repository' 'Branch main' 'PASS' $Branch
    }else{
        Write-Fail "Branch=$Branch"
        Add-Check 'Repository' 'Branch main' 'FAIL' $Branch
    }

    if($Local -and $Remote -and $Local -eq $Remote){
        Write-Pass 'Local/remote sync'
        Add-Check 'Repository' 'Local/remote sync' 'PASS' $Local
    }else{
        Write-Fail 'Local/remote mismatch'
        Add-Check 'Repository' 'Local/remote sync' 'FAIL' "Local=$Local Remote=$Remote"
    }

    $GitWarnings=@(
        $BranchResult.StdErr,
        $LocalResult.StdErr,
        $RemoteResult.StdErr,
        $StatusResult.StdErr
    )|Where-Object{-not [string]::IsNullOrWhiteSpace($_)}

    foreach($GitWarning in $GitWarnings){
        Write-Warn $GitWarning
    }

    $StatusLines=@()
    if(-not [string]::IsNullOrWhiteSpace($StatusResult.StdOut)){
        $StatusLines=@(
            $StatusResult.StdOut -split "`r?`n" |
            Where-Object{-not [string]::IsNullOrWhiteSpace($_)}
        )
    }

    $SourceChanges=@()
    $RuntimeChanges=@()

    foreach($Line in $StatusLines){
        $Norm=([string]$Line).Replace('\','/')

        $Runtime=(
            $Norm.Contains('/Reports/') -or
            $Norm.Contains('/Logs/') -or
            $Norm.Contains('/Snapshots/') -or
            $Norm.Contains('/Temp/') -or
            $Norm.Contains('PackageManager/Registry/packages.json') -or
            $Norm.Contains('UpdateManager/Registry/updates.json') -or
            $Norm.Contains('UpdateManager/Registry/update-history.json')
        )

        if($Runtime){
            $RuntimeChanges += $Line
        }else{
            $SourceChanges += $Line
        }
    }

    if($SourceChanges.Count -eq 0){
        Write-Pass 'Source working tree clean'
        Add-Check 'Repository' 'Source working tree clean' 'PASS' 'No pending source/config changes'
    }else{
        Write-Fail "$($SourceChanges.Count) source change(s)"
        Add-Check 'Repository' 'Source working tree clean' 'FAIL' ($SourceChanges -join ' | ')
    }

    if($RuntimeChanges.Count -gt 0){
        Write-Info "$($RuntimeChanges.Count) runtime/generated change(s) ignored"
        Add-Check 'Repository' 'Runtime/generated changes' 'WARN' ($RuntimeChanges -join ' | ')
    }
}

# --------------------------------------------------------------------
# Subsystems
# --------------------------------------------------------------------
Write-Section 'SUBSYSTEM INVENTORY'

$Subsystems=@(
    [pscustomobject]@{
        name='Lead Migration'
        path='tools\LeadMigration'
        cert='tools\LeadMigration\Certification\Reports\CERT-015-Final.json'
    },
    [pscustomobject]@{
        name='Developer Console'
        path='DeveloperConsole'
        cert=''
    },
    [pscustomobject]@{
        name='Package Manager'
        path='PackageManager'
        cert='PackageManager\Certification\Reports\PKGCERT-012-Final.json'
    },
    [pscustomobject]@{
        name='Update Manager'
        path='UpdateManager'
        cert=''
    }
)

foreach($Subsystem in $Subsystems){
    $Full=Join-Path $Root $Subsystem.path

    if(Test-Path -LiteralPath $Full){
        Write-Pass "$($Subsystem.name) structure"
        Add-Check $Subsystem.name 'Structure exists' 'PASS' $Full
    }else{
        Write-Fail "$($Subsystem.name) structure missing"
        Add-Check $Subsystem.name 'Structure exists' 'FAIL' $Full
        continue
    }

    if(-not [string]::IsNullOrWhiteSpace($Subsystem.cert)){
        $CertPath=Join-Path $Root $Subsystem.cert

        if(Test-Path -LiteralPath $CertPath){
            try{
                $Cert=Get-Content -LiteralPath $CertPath -Raw|ConvertFrom-Json
                $Certified=[bool]$Cert.passed

                if($Cert.PSObject.Properties.Name -contains 'overallStatus'){
                    $Certified=$Certified -and ([string]$Cert.overallStatus -eq 'CERTIFIED')
                }

                if($Certified){
                    Write-Pass "$($Subsystem.name) certification"
                    Add-Check $Subsystem.name 'Certification' 'PASS' $CertPath
                }else{
                    Write-Fail "$($Subsystem.name) certification report is not passing"
                    Add-Check $Subsystem.name 'Certification' 'FAIL' $CertPath
                }
            }catch{
                Write-Fail "$($Subsystem.name) certification JSON invalid"
                Add-Check $Subsystem.name 'Certification' 'FAIL' $_.Exception.Message
            }
        }else{
            Write-Warn "$($Subsystem.name) certification report missing"
            Add-Check $Subsystem.name 'Certification' 'WARN' $CertPath
        }
    }else{
        Write-Warn "$($Subsystem.name) certification not registered"
        Add-Check $Subsystem.name 'Certification' 'WARN' 'No final certification report registered'
    }
}

# --------------------------------------------------------------------
# PowerShell source
# --------------------------------------------------------------------
Write-Section 'POWERSHELL SOURCE HEALTH'

$PSFiles=@(
    Get-ChildItem -LiteralPath $Root -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object{
        $_.FullName -notmatch '\\Archive\\' -and
        $_.FullName -notmatch '\\Reports\\' -and
        $_.FullName -notmatch '\\Logs\\' -and
        $_.FullName -notmatch '\\Snapshots\\' -and
        $_.FullName -notmatch '\\Temp\\'
    }
)

$SyntaxFailures=@()
$PlaceholderFiles=@()

foreach($File in $PSFiles){
    $Tokens=$null
    $Errors=$null

    [System.Management.Automation.Language.Parser]::ParseFile(
        $File.FullName,
        [ref]$Tokens,
        [ref]$Errors
    )|Out-Null

    if($Errors.Count -gt 0){
        $SyntaxFailures += [pscustomobject]@{
            file=$File.FullName
            errors=@($Errors|ForEach-Object{$_.Message})
        }
    }

    $Text=[IO.File]::ReadAllText($File.FullName)

    $LooksPlaceholder=(
        $File.Length -lt 250 -or
        $Text -match '(?i)\bplaceholder\b' -or
        $Text -match '(?i)not yet installed' -or
        $Text -match '(?i)ready to install'
    )

    if($LooksPlaceholder){
        $PlaceholderFiles += $File.FullName
    }
}

if($SyntaxFailures.Count -eq 0){
    Write-Pass "$($PSFiles.Count) PowerShell source files syntax-clean"
    Add-Check 'Source' 'PowerShell syntax' 'PASS' "$($PSFiles.Count) files checked"
}else{
    Write-Fail "$($SyntaxFailures.Count) PowerShell syntax failure(s)"
    Add-Check 'Source' 'PowerShell syntax' 'FAIL' (($SyntaxFailures|ForEach-Object{$_.file}) -join ' | ')
}

if($PlaceholderFiles.Count -eq 0){
    Write-Pass 'No likely PowerShell placeholders detected'
    Add-Check 'Source' 'Placeholder detection' 'PASS' "$($PSFiles.Count) files checked"
}else{
    Write-Warn "$($PlaceholderFiles.Count) likely placeholder(s) detected"
    foreach($File in $PlaceholderFiles){
        Write-Warn $File
    }
    Add-Check 'Source' 'Placeholder detection' 'WARN' ($PlaceholderFiles -join ' | ')
}

# --------------------------------------------------------------------
# Update Manager
# --------------------------------------------------------------------
Write-Section 'MOS5-019 UPDATE MANAGER'

$UpdScripts=Join-Path $Root 'UpdateManager\Scripts'
$UpdCore=Join-Path $Root 'UpdateManager\Core\UPD-000_Common.ps1'

$Expected=21
$Found=0
$Missing=@()
$Small=@()

if(Test-Path -LiteralPath $UpdCore){
    $Found++
    if((Get-Item -LiteralPath $UpdCore).Length -lt 500){
        $Small += $UpdCore
    }
}else{
    $Missing += $UpdCore
}

for($i=1;$i -le 20;$i++){
    $Prefix='UPD-{0:D3}_' -f $i
    $File=Get-ChildItem -LiteralPath $UpdScripts -Filter "$Prefix*.ps1" -File -ErrorAction SilentlyContinue|Select-Object -First 1

    if($File){
        $Found++
        if($File.Length -lt 500){
            $Small += $File.FullName
        }
    }else{
        $Missing += "$Prefix*.ps1"
    }
}

if($Found -eq $Expected -and $Missing.Count -eq 0){
    Write-Pass "UPD-000 through UPD-020 present ($Found/$Expected)"
    Add-Check 'Update Manager' 'Module inventory' 'PASS' "$Found/$Expected"
}else{
    Write-Fail "Update Manager modules found $Found/$Expected"
    Add-Check 'Update Manager' 'Module inventory' 'FAIL' ($Missing -join ' | ')
}

if($Small.Count -eq 0){
    Write-Pass 'Update Manager module size gate'
    Add-Check 'Update Manager' 'Module size gate' 'PASS' 'No modules under 500 bytes'
}else{
    Write-Fail "$($Small.Count) undersized Update Manager module(s)"
    Add-Check 'Update Manager' 'Module size gate' 'FAIL' ($Small -join ' | ')
}

$UpdConfig=Join-Path $Root 'UpdateManager\Config\UpdateManager.config'

if(Test-Path -LiteralPath $UpdConfig){
    $ConfigText=Get-Content -LiteralPath $UpdConfig -Raw

    $SafetyPass=(
        $ConfigText -match '(?m)^MODE=SAFE\s*$' -and
        $ConfigText -match '(?m)^AUTO_DOWNLOAD=FALSE\s*$' -and
        $ConfigText -match '(?m)^AUTO_INSTALL=FALSE\s*$' -and
        $ConfigText -match '(?m)^DESTRUCTIVE_ACTIONS=FALSE\s*$'
    )

    if($SafetyPass){
        Write-Pass 'Update Manager safe-mode configuration'
        Add-Check 'Update Manager' 'Safe-mode configuration' 'PASS' $UpdConfig
    }else{
        Write-Fail 'Update Manager safe-mode configuration'
        Add-Check 'Update Manager' 'Safe-mode configuration' 'FAIL' $UpdConfig
    }
}else{
    Write-Fail 'UpdateManager.config missing'
    Add-Check 'Update Manager' 'Safe-mode configuration' 'FAIL' $UpdConfig
}

# --------------------------------------------------------------------
# Final
# --------------------------------------------------------------------
Write-Section 'FINAL ENTERPRISE AUDIT'

$Total=$Checks.Count
$PassCount=@($Checks|Where-Object{$_.status -eq 'PASS'}).Count
$WarnCount=@($Checks|Where-Object{$_.status -eq 'WARN'}).Count
$FailCount=@($Checks|Where-Object{$_.status -eq 'FAIL'}).Count

$Score=if($Total -gt 0){
    [math]::Round((($PassCount + ($WarnCount*0.5)) / $Total)*100,1)
}else{
    0
}

$Overall=if($FailCount -eq 0){
    if($WarnCount -eq 0){'HEALTHY'}else{'HEALTHY_WITH_WARNINGS'}
}else{
    'NEEDS_ATTENTION'
}

$Report=[ordered]@{
    release='MOS5-020'
    module='EA-001'
    version='1.0.1'
    generatedAt=(Get-Date).ToString('o')
    repository=$Root
    overallStatus=$Overall
    readinessScore=$Score
    totalChecks=$Total
    passCount=$PassCount
    warningCount=$WarnCount
    failureCount=$FailCount
    powershellFileCount=$PSFiles.Count
    syntaxFailureCount=$SyntaxFailures.Count
    placeholderCount=$PlaceholderFiles.Count
    updateManagerModulesFound=$Found
    updateManagerModulesExpected=$Expected
    checks=$Checks
    syntaxFailures=$SyntaxFailures
    placeholderFiles=$PlaceholderFiles
}

$JsonPath=Join-Path $Reports 'EnterpriseAudit.json'
$Report|ConvertTo-Json -Depth 50|Set-Content -LiteralPath $JsonPath -Encoding UTF8

$TextPath=Join-Path $Reports 'EnterpriseAudit.txt'
@(
    'MelroseOS Enterprise Audit',
    "Generated: $(Get-Date)",
    "Overall Status: $Overall",
    "Readiness Score: $Score%",
    "PASS: $PassCount",
    "WARN: $WarnCount",
    "FAIL: $FailCount",
    "PowerShell Files: $($PSFiles.Count)",
    "Syntax Failures: $($SyntaxFailures.Count)",
    "Likely Placeholders: $($PlaceholderFiles.Count)",
    "Update Manager Modules: $Found/$Expected",
    '',
    "JSON Report: $JsonPath"
)|Set-Content -LiteralPath $TextPath -Encoding UTF8

Write-Host "Status           : $Overall"
Write-Host "Readiness Score  : $Score%"
Write-Host "PASS             : $PassCount"
Write-Host "WARN             : $WarnCount"
Write-Host "FAIL             : $FailCount"
Write-Host "PowerShell Files : $($PSFiles.Count)"
Write-Host "Syntax Failures  : $($SyntaxFailures.Count)"
Write-Host "Placeholders     : $($PlaceholderFiles.Count)"
Write-Host "UPD Modules      : $Found/$Expected"
Write-Host ''
Write-Host "Report: $JsonPath"
Write-Host ''

if($FailCount -gt 0){
    Write-Fail 'Enterprise audit completed with failures.'
    exit 1
}

Write-Pass 'Enterprise audit completed.'
exit 0
