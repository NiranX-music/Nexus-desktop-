# Nexus Desktop - Windows Sandbox Launcher
$wsbFile = Join-Path $PSScriptRoot "NexusSandbox.wsb"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         NEXUS DESKTOP - HOST PC SHIELD LAUNCHER          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check if Windows Sandbox binary exists
$sandboxExe = "C:\Windows\System32\WindowsSandbox.exe"
if (Test-Path $sandboxExe) {
    Write-Host "[OK] Windows Sandbox is available on this system." -ForegroundColor Green
    Write-Host "Launching isolated disposable Windows VM with Nexus workspace..." -ForegroundColor Yellow
    Start-Process $sandboxExe -ArgumentList "`"$wsbFile`""
    Write-Host "[OK] Windows Sandbox started. Anything that happens inside will not affect your PC." -ForegroundColor Green
} else {
    Write-Host "[INFO] Windows Sandbox feature is not enabled yet on this Windows 11 Pro PC." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To enable Windows Sandbox (Disposable VM), run PowerShell as Administrator:" -ForegroundColor White
    Write-Host "  Enable-WindowsOptionalFeature -Online -FeatureName 'Containers-DisposableClientVM' -NoRestart" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Note: Even without the Windows Sandbox VM, Nexus Desktop's built-in" -ForegroundColor Green
    Write-Host "Nexus Sandbox Shield is ACTIVE by default inside the application:" -ForegroundColor Green
    Write-Host "  - Jails agent file writes to %APPDATA%/Nexus AI 9.1/SandboxWorkspace" -ForegroundColor White
    Write-Host "  - Blocks destructive PowerShell shell commands (registry, root deletion, formatting)" -ForegroundColor White
    Write-Host "  - Preserves host system files and directories" -ForegroundColor White
}
