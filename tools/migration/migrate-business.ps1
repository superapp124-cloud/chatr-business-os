$map = @{
    "Team.tsx"             = "collaboration/TeamPage.tsx"
    "TeamInbox.tsx"        = "collaboration/TeamInboxPage.tsx"
    "Inbox.tsx"            = "collaboration/InboxPage.tsx"
    "Groups.tsx"           = "collaboration/GroupsPage.tsx"

    "Marketplace.tsx"      = "marketplace/MarketplacePage.tsx"
    "AppStore.tsx"         = "marketplace/AppStorePage.tsx"
    "Catalog.tsx"          = "marketplace/CatalogPage.tsx"

    "Automations.tsx"      = "automation/AutomationsPage.tsx"
    "AIRoles.tsx"          = "automation/AIRolesPage.tsx"

    "DeveloperHub.tsx"     = "developer/DeveloperHubPage.tsx"
    "Integrations.tsx"     = "integrations/IntegrationsPage.tsx"

    "Settings.tsx"         = "settings/SettingsPage.tsx"

    "PhoneSystem.tsx"      = "operations/PhoneSystemPage.tsx"
    "ComplianceReport.tsx" = "operations/ComplianceReportPage.tsx"
    "WorkHub.tsx"          = "operations/WorkHubPage.tsx"
    "Broadcasts.tsx"       = "operations/BroadcastsPage.tsx"

    "Onboarding.tsx"       = "onboarding/OnboardingPage.tsx"
}

foreach ($item in $map.GetEnumerator()) {

    $source = "src\pages\business\$($item.Key)"
    $target = "src\business\$($item.Value)"

    if (!(Test-Path $source)) {
        Write-Host "SKIPPED: $($item.Key)"
        continue
    }

    $folder = Split-Path $target

    if (!(Test-Path $folder)) {
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
    }

    Move-Item $source $target

    $wrapper = "export { default } from `"@/business/$($item.Value.Replace('\','/').Replace('.tsx',''))`";"
    Set-Content -Path $source -Value $wrapper

    Write-Host "DONE: $($item.Key)"
}

Write-Host ""
Write-Host "Business migration completed."
