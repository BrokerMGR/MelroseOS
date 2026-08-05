$root="D:\MelroseOS\GitHub\MelroseOS"
$ErrorActionPreference="Stop"
foreach($p in @(
  (Join-Path $root ".git"),
  (Join-Path $root "PROJECTS"),
  (Join-Path $root "tools\BUILD.ps1"),
  (Join-Path $root "tools\BUILD.bat"),
  (Join-Path $root "tools\BUILD_COMMIT_PUSH.bat")
)){
  if(-not(Test-Path $p)){throw "Missing: $p"}
  Write-Host "[PASS] $p"
}
foreach($cmd in @("git","node","npm","clasp","code")){
  if(-not(Get-Command $cmd -ErrorAction SilentlyContinue)){throw "Missing command: $cmd"}
  Write-Host "[PASS] $cmd"
}
Write-Host "[PASS] Builder v3 verified."
