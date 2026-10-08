@echo off
title Nexus Desktop Fast Agent Daemon
echo ===================================================
echo   Nexus Desktop Fast Agent - Zero-Card Edge Bridge
echo ===================================================
echo Connecting to: https://nexus-bridge-7l1.pages.dev/api
echo.
"%~dp0.venv\Scripts\python.exe" "%~dp0desktop_agent\nexus_fast_agent.py"
pause
