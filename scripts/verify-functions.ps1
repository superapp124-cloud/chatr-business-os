param (
    [switch]$Report = $false
)

$functionsPath = Join-Path $PWD "supabase/functions"
$functions = Get-ChildItem -Path $functionsPath -Directory | Where-Object { $_.Name -notmatch "^_" }
$results = @()

Write-Host "Verifying $($functions.Count) Edge Functions..." -ForegroundColor Cyan

foreach ($func in $functions) {
    $indexPath = Join-Path $func.FullName "index.ts"
    $hasIndex = Test-Path $indexPath
    
    $status = if ($hasIndex) { "OK" } else { "Missing index.ts" }
    
    $results += [PSCustomObject]@{
        FunctionName = $func.Name
        Status       = $status
        Runtime      = "Deno"
        AuthMode     = "JWT"
    }
}

if ($Report) {
    $reportPath = Join-Path $PWD "edge_functions_inventory.csv"
    $results | Export-Csv -Path $reportPath -NoTypeInformation
    Write-Host "Report generated at $reportPath" -ForegroundColor Green
} else {
    $results | Format-Table
}
