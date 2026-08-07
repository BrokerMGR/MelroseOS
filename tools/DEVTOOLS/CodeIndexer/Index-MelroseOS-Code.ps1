$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path

$Output = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Output)) {
    New-Item $Output -ItemType Directory | Out-Null
}

$Index = @()

Get-ChildItem "$Repo\PROJECTS" -Recurse -Include *.gs,*.js | ForEach-Object {

    $Project = Split-Path (Split-Path $_.DirectoryName -Parent) -Leaf

    $File = $_.FullName

    $Functions = Select-String `
        -Path $File `
        -Pattern '^\s*function\s+([A-Za-z0-9_]+)\s*\('

    foreach($F in $Functions){

        $Index += [pscustomobject]@{

            Project = $Project

            File = $_.Name

            Function = $F.Matches.Groups[1].Value

            Line = $F.LineNumber

            Path = $File

        }

    }

}

$Csv = Join-Path $Output "MelroseOS-CodeIndex.csv"

$Json = Join-Path $Output "MelroseOS-CodeIndex.json"

$Index |
Sort-Object Project,Function |
Export-Csv $Csv -NoTypeInformation

$Index |
ConvertTo-Json -Depth 5 |
Out-File $Json

Write-Host ""
Write-Host "Indexed $($Index.Count) functions."
Write-Host ""
Write-Host $Csv
Write-Host $Json