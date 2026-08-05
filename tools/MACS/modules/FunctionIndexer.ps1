param(
    [string]$RepositoryRoot = (Resolve-Path "$PSScriptRoot\..\..\..").Path
)

$ReportFolder = Join-Path $RepositoryRoot "tools\MACS\reports"

$Patterns = @(
    'function\s+([A-Za-z0-9_]+)\s*\(',
    'const\s+([A-Za-z0-9_]+)\s*=\s*\('
)

$Results = @()

Get-ChildItem $RepositoryRoot -Recurse -Include *.js,*.gs |
ForEach-Object {

    $Lines = Get-Content $_.FullName

    for($i=0;$i -lt $Lines.Count;$i++){

        foreach($Pattern in $Patterns){

            if($Lines[$i] -match $Pattern){

                $Results += [PSCustomObject]@{
                    Function = $Matches[1]
                    File     = $_.FullName.Replace($RepositoryRoot+"\","")
                    Line     = $i+1
                }

            }

        }

    }

}

$Results |
Sort-Object Function |
ConvertTo-Json -Depth 5 |
Out-File (
    Join-Path $ReportFolder "FunctionIndex.json"
)

$Results |
Export-Csv (
    Join-Path $ReportFolder "FunctionIndex.csv"
) -NoTypeInformation

Write-Host ""
Write-Host "Functions Indexed:" $Results.Count
Write-Host "[PASS]"