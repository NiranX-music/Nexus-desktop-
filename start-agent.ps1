# ===================================================
# Nexus Desktop Fast Agent - Zero-Card Edge Bridge
# ===================================================
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonExe = Join-Path $ScriptDir ".venv\Scripts\python.exe"
$AgentScript = Join-Path $ScriptDir "desktop_agent\nexus_fast_agent.py"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Nexus Desktop Fast Agent - Zero-Card Edge Bridge" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Connecting to: https://nexus-bridge-7l1.pages.dev/api" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the daemon at any time.`n" -ForegroundColor DarkGray

& $PythonExe $AgentScript
