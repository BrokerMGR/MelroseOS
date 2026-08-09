<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-008_Safety
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-008 Safety'

$ConfigPath='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Config\PackageManager.config'
$Scripts='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Scripts'
$Results=@()
$Failed=0

if(!(Test-Path -LiteralPath $ConfigPath)){
    Write-PKGCertFail 'PackageManager.config not found.'
    exit 1
}

$Config=@{}
foreach($line in Get-Content -LiteralPath $ConfigPath){
    if($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)){continue}
    if($line -match '^\s*([^=]+?)\s*=(.*)$'){
        $Config[$Matches[1].Trim()]=$Matches[2].Trim()
    }
}

$RequiredSafe=[ordered]@{
    MODE='SAFE'
    AUTO_INSTALL='FALSE'
    AUTO_UPDATE='FALSE'
    AUTO_REMOVE='FALSE'
    REQUIRE_CERTIFICATION='TRUE'
    REQUIRE_SNAPSHOT='TRUE'
    ALLOW_ROLLBACK='TRUE'
    DESTRUCTIVE_ACTIONS='FALSE'
}

foreach($Key in $RequiredSafe.Keys){
    $Actual=[string]$Config[$Key]
    $Expected=[string]$RequiredSafe[$Key]
    $Passed=($Actual -eq $Expected)
    if(-not $Passed){$Failed++}

    $Results+=[pscustomobject]@{
        check=$Key
        expected=$Expected
        actual=$Actual
        passed=$Passed
    }

    if($Passed){Write-PKGCertPass "$Key=$Actual"}else{Write-PKGCertFail "$Key expected $Expected but found $Actual"}
}

$Forbidden=@(
    '(?i)Remove-Item\s+.*-Recurse.*-Force',
    '(?i)AUTO_INSTALL\s*=\s*TRUE',
    '(?i)AUTO_UPDATE\s*=\s*TRUE',
    '(?i)AUTO_REMOVE\s*=\s*TRUE',
    '(?i)DESTRUCTIVE_ACTIONS\s*=\s*TRUE'
)

foreach($File in Get-ChildItem -LiteralPath $Scripts -Filter 'PKG-*.ps1' -File){
    $Text=[IO.File]::ReadAllText($File.FullName)
    foreach($Pattern in $Forbidden){
        if($Text -match $Pattern){
            $Failed++
            $Results+=[pscustomobject]@{
                check=$File.Name
                expected='No blocked safety pattern'
                actual=$Pattern
                passed=$false
            }
            Write-PKGCertFail "$($File.Name) contains blocked pattern."
        }
    }
}

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-008'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Path=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-008-Safety.json'

if($Failed-gt0){
    Write-PKGCertFail "Safety certification failed. Report: $Path"
    exit 1
}

Write-PKGCertPass "Safety certification passed. Report: $Path"
exit 0
