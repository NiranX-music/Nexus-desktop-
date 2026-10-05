# Windows Sandbox Bootstrap Script for Nexus Desktop
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   NEXUS DESKTOP - ISOLATED DISPOSABLE SANDBOX VM        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Host PC is 100% protected. All operations in this VM are disposable." -ForegroundColor Green
Write-Host ""

# Ensure Sandbox Workspace exists in Sandbox VM
$SandboxWorkspace = "C:\SandboxWorkspace"
if (!(Test-Path $SandboxWorkspace)) {
    New-Item -ItemType Directory -Path $SandboxWorkspace -Force | Out-Null
}

Write-Host "[1/3] Checking Node.js environment in Sandbox VM..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "Installing Node.js runtime inside sandbox via winget..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

Write-Host "[2/3] Setting up Isolated Workspace Directory at: $SandboxWorkspace" -ForegroundColor Green
Set-Location $SandboxWorkspace

Write-Host "[3/3] Sandbox VM is ready. Any scripts or agent tests executed here will vanish when closed." -ForegroundColor Green
Write-Host "Opening isolated PowerShell console in $SandboxWorkspace..." -ForegroundColor Cyan

Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location C:\SandboxWorkspace; Write-Host '--- NEXUS ISOLATED SANDBOX SHELL ---' -ForegroundColor Cyan"
