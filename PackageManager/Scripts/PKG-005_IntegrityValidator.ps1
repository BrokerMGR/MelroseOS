<#
MelroseOS Enterprise
Package Manager Module : PKG-005_IntegrityValidator
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKG-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGHeader 'PKG-005 Integrity Validator'

$Catalog=Get-Content -LiteralPath $Global:PKG_CATALOG -Raw|ConvertFrom-Json
$Rows=@()
$Failed=0

foreach($pkg in @($Catalog.packages)){
    $source=Join-Path $Global:PKG_ROOT ([string]$pkg.source)
    $exists=Test-Path -LiteralPath $source
    $fileCount=0
    $totalBytes=0
    $hashes=@()

    if($exists){
        $files=@(Get-ChildItem -LiteralPath $source -File -Recurse -ErrorAction SilentlyContinue)
        $fileCount=$files.Count
        if($fileCount -gt 0){
            $totalBytes=($files|Measure-Object Length -Sum).Sum
            foreach($f in $files){
                try{
                    $h=Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256
                    $hashes+=[pscustomobject]@{
                        relativePath=$f.FullName.Substring($source.Length).TrimStart('\')
                        sizeBytes=$f.Length
                        sha256=$h.Hash
                    }
                }catch{
                    $hashes+=[pscustomobject]@{
                        relativePath=$f.FullName
                        sizeBytes=$f.Length
                        sha256=''
                    }
                }
            }
        }
    }

    $certRequired=([string]$pkg.id -eq 'lead-migration')
    $certified=$true
    $certReport=''

    if($certRequired){
        $certReport=Join-Path $Global:PKG_ROOT 'tools\LeadMigration\Certification\Reports\CERT-015-Final.json'
        $certified=$false
        if(Test-Path -LiteralPath $certReport){
            try{
                $cert=Get-Content -LiteralPath $certReport -Raw|ConvertFrom-Json
                $certified=([bool]$cert.passed -and [string]$cert.overallStatus -eq 'CERTIFIED')
            }catch{
                $certified=$false
            }
        }
    }

    $passed=($exists -and $fileCount -gt 0 -and $certified)
    if(-not $passed){$Failed++}

    $Rows+=[pscustomobject]@{
        id=[string]$pkg.id
        sourcePath=$source
        sourceExists=$exists
        fileCount=$fileCount
        totalBytes=[int64]$totalBytes
        certificationRequired=$certRequired
        certified=$certified
        certificationReport=$certReport
        passed=$passed
        files=$hashes
    }

    if($passed){
        Write-PKGPass "$($pkg.id): integrity verified"
    }else{
        Write-PKGFail "$($pkg.id): integrity verification failed"
    }
}

$Report=[ordered]@{
    release='MOS5-018'
    module='PKG-005'
    generatedAt=(Get-Date).ToString('o')
    packageCount=$Rows.Count
    failedCount=$Failed
    passed=($Failed-eq0)
    packages=$Rows
}
$Path=Write-PKGJson -Data $Report -FileName 'PKG-005-Integrity.json'

if($Failed-gt0){
    Write-PKGFail "Integrity validation failed. Report: $Path"
    exit 1
}

Write-PKGPass "Integrity validation passed. Report: $Path"
exit 0
