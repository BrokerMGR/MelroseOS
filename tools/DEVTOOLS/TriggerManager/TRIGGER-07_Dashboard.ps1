$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

$HealthFile      = Join-Path $Reports "TriggerHealth.csv"
$InventoryFile   = Join-Path $Reports "TriggerInventory.csv"
$InstallerFile   = Join-Path $Reports "TriggerInstaller.csv"
$RepairFile      = Join-Path $Reports "TriggerRepairReport.csv"

$Health     = if(Test-Path $HealthFile){Import-Csv $HealthFile}else{@()}
$Inventory  = if(Test-Path $InventoryFile){Import-Csv $InventoryFile}else{@()}
$Installer  = if(Test-Path $InstallerFile){Import-Csv $InstallerFile}else{@()}
$Repair     = if(Test-Path $RepairFile){Import-Csv $RepairFile}else{@()}

$Html = @"
<html>
<head>
<title>MelroseOS Trigger Manager</title>
<style>
body{font-family:Segoe UI;margin:20px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ccc;padding:6px}
th{background:#1f1f1f;color:white}
</style>
</head>
<body>

<h2>MelroseOS Enterprise Trigger Manager</h2>

<p>
Projects: $($Health.Count)<br>
Healthy: $(@($Health|?{$_.Status -eq 'PASS'}).Count)<br>
Installer Ready: $($Installer.Count)<br>
Repair Reports: $($Repair.Count)
</p>

<table>

<tr>

<th>Project</th>

<th>Status</th>

<th>Triggers</th>

<th>Installer</th>

<th>Repair</th>

</tr>
"@

foreach($H in $Health){

    $Inv =
        $Inventory |
        Where-Object {
            $_.Project -eq $H.Project
        } |
        Select-Object -First 1

    $Inst =
        $Installer |
        Where-Object {
            $_.Project -eq $H.Project
        } |
        Select-Object -First 1

    $Rep =
        $Repair |
        Where-Object {
            $_.Project -eq $H.Project
        } |
        Select-Object -First 1

    $Html += @"

<tr>

<td>$($H.Project)</td>

<td>$($H.Status)</td>

<td>$($Inv.TriggerCount)</td>

<td>$($Inst.InstallStatus)</td>

<td>$($Rep.Status)</td>

</tr>

"@

}

$Html += @"

</table>

</body>

</html>

"@

$Out =
Join-Path `
$Reports `
"TriggerDashboard.html"

$Html |
Set-Content `
-LiteralPath $Out `
-Encoding UTF8

Start-Process $Out

Write-Host ""
Write-Host "[PASS]"