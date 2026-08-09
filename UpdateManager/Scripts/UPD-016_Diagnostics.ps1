<#
MelroseOS Enterprise
Update Manager Module : UPD-016_Diagnostics
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-016 Diagnostics'

$RequiredPaths=@(
    $Global:UPD_MANAGER,
    (Join-Path $Global:UPD_MANAGER 'Core'),
    (Join-Path $Global:UPD_MANAGER 'Scripts'),
    (Join-Path $Global:UPD_MANAGER 'Config'),
    (Join-Path $Global:UPD_MANAGER 'Registry'),
    (Join-Path $Global:UPD_MANAGER 'Channels'),
    (Join-Path $Global:UPD_MANAGER 'Staging'),
    (Join-Path $Global:UPD_MANAGER 'Snapshots'),
    (Join-Path $Global:UPD_MANAGER 'Reports'),
    (Join-Path $Global:UPD_MANAGER 'Logs')
)

$Results=@()
$Failed=0

foreach($Path in $RequiredPaths){
    $Exists=Test-Path -LiteralPath $Path
    if(-not $Exists){$Failed++}

    $Results += [pscustomobject]@{
        check='PATH'
        target=$Path
        passed=$Exists
    }

    if($Exists){Write-UPDPass $Path}else{Write-UPDFail $Path}
}

$ExpectedScripts=@('UPD-000_Common.ps1')
for($i=1;$i -le 20;$i++){
    $ExpectedScripts += ('UPD-{0:D3}_' -f $i)
}

$CorePath=Join-Path $Global:UPD_MANAGER 'Core\UPD-000_Common.ps1'
$CoreOk=(Test-Path -LiteralPath $CorePath) -and ((Get-Item -LiteralPath $CorePath).Length -gt 500)
if(-not $CoreOk){$Failed++}

$Results += [pscustomobject]@{
    check='CORE'
    target=$CorePath
    passed=$CoreOk
}

if($CoreOk){Write-UPDPass 'UPD-000_Common.ps1'}else{Write-UPDFail 'UPD-000_Common.ps1'}

$ScriptsPath=Join-Path $Global:UPD_MANAGER 'Scripts'

for($i=1;$i -le 20;$i++){
    $Prefix='UPD-{0:D3}_' -f $i
    $File=Get-ChildItem -LiteralPath $ScriptsPath -Filter "$Prefix*.ps1" -File -ErrorAction SilentlyContinue|Select-Object -First 1
    $Passed=$false
    $Details='Missing'

    if($File){
        $Tokens=$null
        $Errors=$null
        [Management.Automation.Language.Parser]::ParseFile(
            $File.FullName,
            [ref]$Tokens,
            [ref]$Errors
        )|Out-Null

        $Passed=($File.Length -gt 500 -and $Errors.Count -eq 0)
        $Details="$($File.Length) bytes; syntax errors=$($Errors.Count)"
    }

    if(-not $Passed){$Failed++}

    $Results += [pscustomobject]@{
        check='MODULE'
        target=if($File){$File.FullName}else{"$Prefix*.ps1"}
        details=$Details
        passed=$Passed
    }

    if($Passed){
        Write-UPDPass "$($File.Name) - $Details"
    }else{
        Write-UPDFail "$Prefix - $Details"
    }
}

$Config=Get-UPDConfig
$SafeChecks=[ordered]@{
    MODE='SAFE'
    AUTO_CHECK='FALSE'
    AUTO_DOWNLOAD='FALSE'
    AUTO_INSTALL='FALSE'
    REQUIRE_CERTIFICATION='TRUE'
    REQUIRE_SNAPSHOT='TRUE'
    ALLOW_ROLLBACK='TRUE'
    DESTRUCTIVE_ACTIONS='FALSE'
}

foreach($Key in $SafeChecks.Keys){
    $Expected=[string]$SafeChecks[$Key]
    $Actual=[string]$Config[$Key]
    $Passed=($Expected -eq $Actual)
    if(-not $Passed){$Failed++}

    $Results += [pscustomobject]@{
        check='CONFIG'
        target=$Key
        expected=$Expected
        actual=$Actual
        passed=$Passed
    }

    if($Passed){Write-UPDPass "$Key=$Actual"}else{Write-UPDFail "$Key expected $Expected; found $Actual"}
}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-016'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    checks=$Results
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-016-Diagnostics.json'

if($Failed-gt0){
    Write-UPDFail "Diagnostics failed with $Failed issue(s). Report: $Path"
    exit 1
}

Write-UPDPass "Diagnostics passed. Report: $Path"
exit 0
