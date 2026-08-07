param(
    [Parameter(Mandatory=$true)]
    [string]$Function
)

$Index = Join-Path $PSScriptRoot "reports\MelroseOS-CodeIndex.csv"

if (!(Test-Path $Index)) {
    Write-Host ""
    Write-Host "Code index not found."
    Write-Host "Run-CodeIndexer.bat first."
    exit
}

$Results = Import-Csv $Index |
Where-Object {
    $_.Function -like "*$Function*" -or
    $_.File -like "*$Function*"
}

if ($Results.Count -eq 0) {

    Write-Host ""
    Write-Host "[NOT FOUND]"

    exit

}

$Results |
Sort-Object Project,Function |
Format-Table Project,Function,File,Line -AutoSize
