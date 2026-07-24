param (
    [switch]$All = $false,
    [string]$Function = ""
)

if (-not (Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    Write-Error "Supabase CLI not found. Please install it first."
    exit 1
}

$functionsPath = Join-Path $PWD "supabase/functions"
$functions = Get-ChildItem -Path $functionsPath -Directory | Where-Object { $_.Name -notmatch "^_" }

if ($Function) {
    Write-Host "Deploying function: $Function" -ForegroundColor Cyan
    supabase functions deploy $Function
}
elseif ($All) {
    Write-Host "Deploying all $($functions.Count) functions..." -ForegroundColor Cyan
    foreach ($func in $functions) {
        Write-Host "Deploying $($func.Name)..."
        supabase functions deploy $func.Name
    }
}
else {
    Write-Host "Please specify -All or -Function <name>" -ForegroundColor Yellow
}
