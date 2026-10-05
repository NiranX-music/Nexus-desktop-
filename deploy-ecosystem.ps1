# ==============================================================================
# NEXUS OS — Multi-Site Cloudflare Deployment Script (PowerShell)
# Deploys all 4 micro-frontends to Cloudflare Pages
# ==============================================================================

param (
    [string]$Tool = "wrangler" # "wrangler" or "cf"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   NEXUS OS — Cloudflare Multi-Site Deployment Orchestrator" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$Sites = @(
    @{ Name = "ecosystem-landing"; Path = "./landing-site"; Domain = "nexus.io" },
    @{ Name = "ecosystem-auth";    Path = "./auth-site";    Domain = "auth.nexus.io" },
    @{ Name = "ecosystem-status";  Path = "./status-site";  Domain = "status.nexus.io" },
    @{ Name = "ecosystem-admin";   Path = "./admin-site";   Domain = "admin.nexus.io" }
)

foreach ($site in $Sites) {
    Write-Host "`n[+] Deploying $($site.Name) from $($site.Path)..." -ForegroundColor Yellow
    
    if ($Tool -eq "cf") {
        Write-Host "Executing: cf pages deploy $($site.Path) --project-name=$($site.Name)" -ForegroundColor DarkGray
        cf pages deploy $site.Path --project-name=$site.Name
    } else {
        Write-Host "Executing: npx wrangler pages deploy $($site.Path) --project-name=$($site.Name)" -ForegroundColor DarkGray
        npx wrangler pages deploy $site.Path --project-name=$site.Name
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[✔] Successfully deployed $($site.Name)!" -ForegroundColor Green
    } else {
        Write-Host "[!] Deployment of $($site.Name) completed with exit code $LASTEXITCODE" -ForegroundColor Yellow
    }
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " All 4 Micro-Frontends deployed to Cloudflare Pages!" -ForegroundColor Green
Write-Host "  - Landing Portal: https://ecosystem-landing.pages.dev" -ForegroundColor White
Write-Host "  - Identity Gateway: https://ecosystem-auth.pages.dev" -ForegroundColor White
Write-Host "  - System Radar: https://ecosystem-status.pages.dev" -ForegroundColor White
Write-Host "  - Admin Command HQ: https://ecosystem-admin.pages.dev" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
