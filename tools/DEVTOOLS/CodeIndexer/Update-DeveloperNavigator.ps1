$Root = $PSScriptRoot

$Csv = Join-Path $Root "reports\MelroseOS-CodeIndex.csv"

if (!(Test-Path $Csv)) {
    Write-Host ""
    Write-Host "Code index not found."
    Write-Host "Run Code Indexer first."
    exit
}

$Functions = Import-Csv $Csv

$Json = @{}

foreach ($F in $Functions) {

    if (!$Json.ContainsKey($F.Function)) {

        $Json[$F.Function] = @()

    }

    $Json[$F.Function] += [ordered]@{

        Project = $F.Project

        File    = $F.File

        Line    = $F.Line

        Path    = $F.Path

    }

}

$Out = Join-Path $Root "reports\DeveloperNavigatorIndex.json"

$Json |
ConvertTo-Json -Depth 10 |
Out-File $Out

Write-Host ""
Write-Host "Developer Navigator updated."
Write-Host $Out