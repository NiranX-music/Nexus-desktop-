; =============================================================================
; Nexus AI Agent - NSIS Windows Installer & Sovereignty-Preserving Uninstaller
; =============================================================================

!define APP_NAME "Nexus AI Agent"
!define APP_VERSION "2.2.0"
!define APP_PUBLISHER "NiranX"
!define APP_EXE "Nexus.exe"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "..\release_binaries\Nexus-Setup-${APP_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\Nexus"
RequestExecutionLevel user

; Pages
Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "..\Nexus-desktop-\dist\*.*"
  File "..\scripts\uninstall_hook.py"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Registry keys for Add/Remove Programs
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NexusAIAgent" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NexusAIAgent" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NexusAIAgent" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NexusAIAgent" "DisplayVersion" "${APP_VERSION}"

  ; Shortcuts
  CreateShortcut "$DESKTOP\Nexus AI Agent.lnk" "$INSTDIR\${APP_EXE}"
  CreateDirectory "$SMPROGRAMS\Nexus"
  CreateShortcut "$SMPROGRAMS\Nexus\Nexus AI Agent.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\Nexus\Uninstall.lnk" "$INSTDIR\uninstall.exe"
SectionEnd

; Uninstaller Section
Section "Uninstall"
  ; Step 1: Execute Python Pre-Uninstall Data Sovereignty Hook
  DetailPrint "Preserving user reasoning memories and exporting local data..."
  nsExec::ExecToLog 'python "$INSTDIR\uninstall_hook.py" --auto'

  ; Step 2: Remove Shortcuts
  Delete "$DESKTOP\Nexus AI Agent.lnk"
  RMDir /r "$SMPROGRAMS\Nexus"

  ; Step 3: Remove Installed Application Files
  RMDir /r "$INSTDIR"

  ; Step 4: Remove Registry Key
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NexusAIAgent"
SectionEnd
