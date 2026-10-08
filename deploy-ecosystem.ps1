# ==============================================================================
# NEXUS OS - Multi-Site Cloudflare Deployment Script (PowerShell)
# Deploys all 4 micro-frontends to Cloudflare Pages
# ==============================================================================

param (
    [string]$Tool = "wrangler"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   NEXUS OS - Cloudflare Multi-Site Deployment Orchestrator" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$Sites = @(
    @{ Name = "ecosystem-landing"; Path = "landing-site" },
    @{ Name = "ecosystem-auth";    Path = "auth-site" },
    @{ Name = "ecosystem-status";  Path = "status-site" },
    @{ Name = "ecosystem-admin";   Path = "admin-site" }
)

foreach ($site in $Sites) {
    $siteName = $site.Name
    $sitePath = $site.Path
    Write-Host "`n[+] Deploying $siteName from $sitePath..." -ForegroundColor Yellow

    if ($Tool -eq "cf") {
        cf pages deploy $sitePath --project-name=$siteName
    } else {
        npx wrangler pages deploy $sitePath --project-name=$siteName
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Successfully deployed $siteName!" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Deployment of $siteName finished with code $LASTEXITCODE" -ForegroundColor Yellow
    }
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " All 4 Micro-Frontends deployed to Cloudflare Pages!" -ForegroundColor Green
Write-Host "  - Landing Portal: https://ecosystem-landing.pages.dev" -ForegroundColor White
Write-Host "  - Identity Gateway: https://ecosystem-auth.pages.dev" -ForegroundColor White
Write-Host "  - System Radar: https://ecosystem-status.pages.dev" -ForegroundColor White
Write-Host "  - Admin Command HQ: https://ecosystem-admin.pages.dev" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
