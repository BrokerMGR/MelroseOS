param(
    [string]$RepositoryRoot = (Resolve-Path "$PSScriptRoot\..\..\..").Path
)

$ErrorActionPreference = "Stop"

$ReportFolder = Join-Path $RepositoryRoot "tools\MACS\reports"
$LogFolder    = Join-Path $RepositoryRoot "tools\MACS\logs"

New-Item -ItemType Directory -Force -Path $ReportFolder | Out-Null
New-Item -ItemType Directory -Force -Path $LogFolder | Out-Null

$Extensions = @("*.js","*.gs","*.html","*.json")

$Files = Get-ChildItem `
    -Path $RepositoryRoot `
    -Recurse `
    -Include $Extensions `
    -File

$Projects = Get-ChildItem `
    -Path (Join-Path $RepositoryRoot "PROJECTS") `
    -Directory

$Inventory = [ordered]@{
    ScanTime        = (Get-Date)
    Repository      = $RepositoryRoot
    ProjectCount    = $Projects.Count
    FileCount       = $Files.Count
    Projects        = @()
}

foreach($Project in $Projects){

    $ProjectFiles = $Files |
        Where-Object {
            $_.FullName.StartsWith($Project.FullName)
        }

    $Inventory.Projects += [ordered]@{
        Name       = $Project.Name
        FileCount  = $ProjectFiles.Count
        Files      = $ProjectFiles.FullName.Replace($RepositoryRoot+"\","")
    }

}

$Duplicates = $Files |
    Group-Object Name |
    Where-Object Count -gt 1 |
    Sort-Object Count -Descending

$Inventory | ConvertTo-Json -Depth 8 |
    Out-File (
        Join-Path $ReportFolder "RepositoryInventory.json"
    ) -Encoding utf8

$Duplicates |
    Select-Object Count,Name |
    Export-Csv (
        Join-Path $ReportFolder "DuplicateFiles.csv"
    ) -NoTypeInformation

Write-Host ""
Write-Host "===================================="
Write-Host " MelroseOS Repository Scanner"
Write-Host "===================================="
Write-Host ""
Write-Host "Projects :" $Projects.Count
Write-Host "Files    :" $Files.Count
Write-Host "Duplicates:" $Duplicates.Count
Write-Host ""
Write-Host "Reports written to:"
Write-Host $ReportFolder
Write-Host ""
Write-Host "[PASS]"