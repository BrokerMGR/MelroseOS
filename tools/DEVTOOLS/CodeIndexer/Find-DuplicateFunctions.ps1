$Index = Join-Path $PSScriptRoot "reports\MelroseOS-CodeIndex.csv"

if (!(Test-Path $Index)) {
    Write-Host ""
    Write-Host "[FAIL] Code index not found."
    Write-Host "Run Run-CodeIndexer.bat first."
    exit 1
}

$Functions = Import-Csv $Index

$Duplicates =
    $Functions |
    Group-Object Function |
    Where-Object {
        $_.Count -gt 1
    } |
    Sort-Object Count -Descending

Write-Host ""
Write-Host "MelroseOS Duplicate Function Report"
Write-Host "==================================="
Write-Host ""

if ($Duplicates.Count -eq 0) {
    Write-Host "[PASS] No duplicate function declarations found."
    exit 0
}

foreach ($Group in $Duplicates) {

    Write-Host ""
    Write-Host "Function: $($Group.Name)"
    Write-Host "Count   : $($Group.Count)"
    Write-Host "-----------------------------------"

    $Group.Group |
        Select-Object Project,File,Line,Path |
        Format-Table -AutoSize
}

$Output =
    Join-Path `
        $PSScriptRoot `
        "reports\DuplicateFunctions.json"

$Duplicates |
    ForEach-Object {

        [pscustomobject]@{

            Function = $_.Name

            Count = $_.Count

            Locations = $_.Group

        }

    } |
    ConvertTo-Json -Depth 10 |
    Out-File $Output

Write-Host ""
Write-Host "Report:"
Write-Host $Output