npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Set-Location android
.\gradlew installDebug
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Set-Location ..
