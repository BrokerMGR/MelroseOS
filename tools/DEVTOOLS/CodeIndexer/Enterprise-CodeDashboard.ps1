$Root = $PSScriptRoot

$Csv = Join-Path $Root "reports\MelroseOS-CodeIndex.csv"

if(!(Test-Path $Csv)){
    Write-Host ""
    Write-Host "[FAIL] Run Code Indexer first."
    exit 1
}

$Functions = Import-Csv $Csv

$Projects = ($Functions.Project | Sort-Object -Unique)

$Html = @()

$Html += "<html><head>"
$Html += "<title>MelroseOS Enterprise Code Dashboard</title>"
$Html += "<style>"
$Html += "body{font-family:Segoe UI;margin:25px;}"
$Html += "table{border-collapse:collapse;width:100%;}"
$Html += "th,td{border:1px solid #ddd;padding:6px;}"
$Html += "th{background:#222;color:#fff;}"
$Html += "input{width:300px;padding:8px;margin-bottom:15px;}"
$Html += "</style>"
$Html += "</head><body>"

$Html += "<h2>MelroseOS Enterprise Code Dashboard</h2>"

$Html += "<p>"
$Html += "Projects: $($Projects.Count)"
$Html += "<br>"
$Html += "Functions: $($Functions.Count)"
$Html += "</p>"

$Html += "<input id='q' placeholder='Search...' onkeyup='f()'>"

$Html += "<table id='tbl'>"
$Html += "<tr><th>Project</th><th>Function</th><th>File</th><th>Line</th></tr>"

foreach($F in $Functions){

    $Html += "<tr>"
    $Html += "<td>$($F.Project)</td>"
    $Html += "<td>$($F.Function)</td>"
    $Html += "<td>$($F.File)</td>"
    $Html += "<td>$($F.Line)</td>"
    $Html += "</tr>"

}

$Html += "</table>"

$Html += @"
<script>
function f(){
 var q=document.getElementById('q').value.toLowerCase();
 var r=document.getElementById('tbl').rows;
 for(var i=1;i<r.length;i++){
   r[i].style.display=
     r[i].innerText.toLowerCase().indexOf(q)>=0?'':'none';
 }
}
</script>
"@

$Html += "</body></html>"

$Out = Join-Path $Root "reports\EnterpriseCodeDashboard.html"

$Html | Out-File $Out -Encoding UTF8

Start-Process $Out