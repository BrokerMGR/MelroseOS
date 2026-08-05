param(
  [ValidateSet("CHANGED","CORE","CRM","MARKETING","WEBSITE","ANALYTICS","ARCHIVE","ALL")]
  [string]$Target = "CHANGED",
  [string]$RepositoryRoot = "D:\MelroseOS\GitHub\MelroseOS",
  [switch]$Commit,
  [switch]$PushGit
)

$ErrorActionPreference = "Stop"
$AccountAlias = "broker_core"
$ExpectedAccount = "melrosegroupbroker@gmail.com"
$Projects = @("CORE","CRM","MARKETING","WEBSITE","ANALYTICS","ARCHIVE")
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogRoot = "C:\MelroseOS\Logs"
$ReportRoot = "D:\MelroseOS_Storage\Reports"
$BackupRoot = "D:\MelroseOS_Storage\Backups\BuilderV3-$Stamp"
$LogPath = Join-Path $LogRoot "BuilderV3-Latest.log"
$ReportPath = Join-Path $ReportRoot "BuilderV3-$Stamp.json"

foreach($folder in @($LogRoot,$ReportRoot,$BackupRoot)){
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
}

function Log([string]$m){
  Write-Host $m
  Add-Content -Path $LogPath -Value $m -Encoding UTF8
}

function Require([string]$cmd){
  if(-not(Get-Command $cmd -ErrorAction SilentlyContinue)){
    throw "Required command not found: $cmd"
  }
}

function RunNative([string]$cmd,[string[]]$args){
  Log ("[RUN] $cmd " + ($args -join " "))
  $old=$ErrorActionPreference
  $ErrorActionPreference="Continue"
  try{
    $out=& $cmd @args 2>&1
    $code=$LASTEXITCODE
  } finally {
    $ErrorActionPreference=$old
  }
  foreach($line in @($out)){ Log ([string]$line) }
  return [pscustomobject]@{Code=$code;Text=((@($out)|%{[string]$_}) -join "`n")}
}

Set-Content $LogPath "" -Encoding UTF8
Log "============================================================"
Log " MELROSEOS BUILDER v3.0.0"
Log "============================================================"

foreach($cmd in @("git","node","npm","clasp")){ Require $cmd; Log "[PASS] $cmd" }

if(-not(Test-Path $RepositoryRoot)){throw "Repository not found."}
if(-not(Test-Path (Join-Path $RepositoryRoot ".git"))){throw "Git metadata missing."}

$auth=RunNative "clasp" @("-u",$AccountAlias,"show-authorized-user")
if($auth.Code -ne 0 -or $auth.Text -notmatch [regex]::Escape($ExpectedAccount)){
  throw "broker_core authorization failed."
}

Push-Location $RepositoryRoot
try{
  $branch=RunNative "git" @("branch","--show-current")
  if($branch.Text.Trim() -ne "main"){throw "Builder requires main branch."}

  $remote=RunNative "git" @("remote","get-url","origin")
  if($remote.Text -notmatch "BrokerMGR/MelroseOS"){throw "Unexpected Git origin."}

  if($Commit){
    $status=RunNative "git" @("status","--porcelain")
    if($status.Text.Trim()){
      if((RunNative "git" @("add",".")).Code -ne 0){throw "git add failed."}
      if((RunNative "git" @("commit","-m","MelroseOS build $Stamp")).Code -ne 0){throw "git commit failed."}
    } else { Log "[INFO] Nothing to commit." }
  }

  if($PushGit){
    if((RunNative "git" @("push")).Code -ne 0){throw "git push failed."}
  }
} finally { Pop-Location }

$targets=@()
if($Target -eq "ALL"){
  $targets=$Projects
}elseif($Target -eq "CHANGED"){
  Push-Location $RepositoryRoot
  try{
    $changed=@()
    $s=RunNative "git" @("status","--porcelain")
    foreach($line in ($s.Text -split "`n")){
      if($line -match "PROJECTS[\\/](CORE|CRM|MARKETING|WEBSITE|ANALYTICS|ARCHIVE)[\\/]"){
        $changed += $Matches[1].ToUpper()
      }
    }
    $d=RunNative "git" @("diff","--name-only","origin/main...HEAD")
    foreach($line in ($d.Text -split "`n")){
      if($line -match "^PROJECTS/(CORE|CRM|MARKETING|WEBSITE|ANALYTICS|ARCHIVE)/"){
        $changed += $Matches[1].ToUpper()
      }
    }
    $targets=@($changed|Select-Object -Unique)
  } finally { Pop-Location }
}else{
  $targets=@($Target)
}

$results=@()
foreach($project in $targets){
  $projectRoot=Join-Path $RepositoryRoot ("PROJECTS\"+$project)
  $claspPath=Join-Path $projectRoot ".clasp.json"
  $src=Join-Path $projectRoot "src"
  if(-not(Test-Path $claspPath)){throw "$project .clasp.json missing."}
  if(-not(Test-Path $src)){throw "$project src missing."}

  $backup=Join-Path $BackupRoot $project
  New-Item -ItemType Directory -Path $backup -Force|Out-Null
  Copy-Item (Join-Path $src "*") $backup -Recurse -Force
  Log "[BACKUP] $project"

  $push=RunNative "clasp" @("-u",$AccountAlias,"-P",$claspPath,"push","--force")
  if($push.Code -ne 0){throw "$project clasp push failed."}
  $results += [pscustomobject]@{Project=$project;Status="PASS";Backup=$backup}
}

$report=[pscustomobject]@{
  BuilderVersion="3.0.0"
  Success=$true
  Target=$Target
  Projects=$results
  AutomaticWebAppDeployment=$false
  BackupRoot=$BackupRoot
  LogPath=$LogPath
  CompletedAt=(Get-Date).ToString("s")
}
$report|ConvertTo-Json -Depth 8|Set-Content $ReportPath -Encoding UTF8
Log "[SUCCESS] Builder v3 completed."
Log "[NOTICE] Web App deployment remains manual."
