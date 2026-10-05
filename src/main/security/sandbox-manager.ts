import { IpcMain, BrowserWindow, app, shell } from 'electron'
import Store from 'electron-store'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'

const StoreClass = (Store as any).default || Store
const store = new StoreClass()

export interface SandboxViolation {
  id: string
  timestamp: number
  type: 'file_write' | 'file_delete' | 'file_patch' | 'shell_command' | 'app_launch'
  target: string
  reason: string
}

export interface SandboxStatus {
  enabled: boolean
  rootDir: string
  workspaceDir: string
  tempDir: string
  strictFS: boolean
  strictTerminal: boolean
  blockedCount: number
  recentViolations: SandboxViolation[]
}

export class SandboxManager {
  private blockedCount = 0
  private recentViolations: SandboxViolation[] = []
  private cachedRootDir: string | null = null

  constructor() {
    this.ensureDirs()
  }

  public getSandboxRoot(): string {
    if (this.cachedRootDir) return this.cachedRootDir

    const customPath = store.get('nexus_sandbox_root') as string | undefined
    if (customPath && customPath.trim().length > 0) {
      this.cachedRootDir = path.resolve(customPath)
      return this.cachedRootDir
    }

    try {
      const userData = app.getPath('userData')
      this.cachedRootDir = path.join(userData, 'SandboxWorkspace')
    } catch {
      this.cachedRootDir = path.join(process.cwd(), 'sandbox-workspace')
    }

    return this.cachedRootDir
  }

  public getWorkspaceDir(): string {
    return path.join(this.getSandboxRoot(), 'workspace')
  }

  public getTempDir(): string {
    return path.join(this.getSandboxRoot(), 'temp')
  }

  public ensureDirs(): void {
    try {
      const root = this.getSandboxRoot()
      const workspace = this.getWorkspaceDir()
      const temp = this.getTempDir()

      if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
      if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true })
      if (!fs.existsSync(temp)) fs.mkdirSync(temp, { recursive: true })

      const readmePath = path.join(root, 'SANDBOX_README.txt')
      if (!fs.existsSync(readmePath)) {
        fs.writeFileSync(
          readmePath,
          '=== NEXUS NEURAL OS - ISOLATED SANDBOX ENVIRONMENT ===\n\n' +
            'This folder acts as a secure containment zone for Nexus Desktop agent operations.\n' +
            'Files created, patched, and modified by autonomous agents are jailed here\n' +
            'to ensure zero unintended changes or deletions occur on your host PC system files.\n',
          'utf-8'
        )
      }
    } catch (err) {
      console.error('[SandboxManager] Failed to initialize directories:', err)
    }
  }

  public isEnabled(): boolean {
    const val = store.get('nexus_sandbox_enabled')
    if (val === undefined || val === null) {
      // Enabled by default for complete host protection
      store.set('nexus_sandbox_enabled', true)
      return true
    }
    return Boolean(val)
  }

  public setEnabled(enabled: boolean): void {
    store.set('nexus_sandbox_enabled', enabled)
    this.broadcastStatus()
  }

  public isStrictTerminal(): boolean {
    const val = store.get('nexus_sandbox_strict_terminal')
    return val === undefined ? true : Boolean(val)
  }

  public isPathWithinSandbox(targetPath: string): boolean {
    const normalizedTarget = path.resolve(targetPath).toLowerCase()
    const normalizedRoot = path.resolve(this.getSandboxRoot()).toLowerCase()

    return (
      normalizedTarget === normalizedRoot ||
      normalizedTarget.startsWith(normalizedRoot + path.sep)
    )
  }

  public resolveWritePath(fileName: string): {
    allowed: boolean
    targetPath: string
    error?: string
  } {
    this.ensureDirs()
    const isAbsolute = path.isAbsolute(fileName) || fileName.includes(':')

    if (!this.isEnabled()) {
      // Legacy behavior when sandbox is turned off
      const targetPath = isAbsolute
        ? path.resolve(fileName)
        : path.join(app.getPath('desktop'), fileName)
      return { allowed: true, targetPath }
    }

    // When sandbox is ACTIVE:
    if (!isAbsolute) {
      // Confine relative file writes inside Sandbox Workspace
      const safeTarget = path.join(this.getWorkspaceDir(), fileName)
      return { allowed: true, targetPath: safeTarget }
    }

    const resolved = path.resolve(fileName)
    if (this.isPathWithinSandbox(resolved)) {
      return { allowed: true, targetPath: resolved }
    }

    // Out-of-bounds write attempt blocked
    const reason = `Write attempt to "${resolved}" is outside the sandbox environment.`
    this.recordViolation('file_write', resolved, reason)
    return {
      allowed: false,
      targetPath: resolved,
      error: `[NEXUS SANDBOX BLOCKED]: ${reason} Your host PC files remain untouched.`
    }
  }

  public validateFileMutation(
    filePath: string,
    operationType: 'file_delete' | 'file_patch' | 'file_write'
  ): {
    allowed: boolean
    resolvedPath: string
    error?: string
  } {
    this.ensureDirs()
    const resolved = path.resolve(filePath)

    if (!this.isEnabled()) {
      return { allowed: true, resolvedPath: resolved }
    }

    if (this.isPathWithinSandbox(resolved)) {
      return { allowed: true, resolvedPath: resolved }
    }

    const reason = `${operationType.replace('_', ' ')} on "${resolved}" blocked: target is outside sandbox containment.`
    this.recordViolation(operationType, resolved, reason)
    return {
      allowed: false,
      resolvedPath: resolved,
      error: `[NEXUS SANDBOX BLOCKED]: ${reason} Operation prevented to safeguard your host system.`
    }
  }

  public validateCommand(
    command: string,
    requestedCwd?: string
  ): {
    allowed: boolean
    safeCwd: string
    reason?: string
  } {
    this.ensureDirs()
    const defaultSandboxCwd = this.getWorkspaceDir()

    if (!this.isEnabled()) {
      return {
        allowed: true,
        safeCwd: requestedCwd ? path.resolve(requestedCwd) : defaultSandboxCwd
      }
    }

    // 1. Determine CWD safely
    let safeCwd = defaultSandboxCwd
    if (requestedCwd) {
      const normalizedCwd = path.resolve(requestedCwd)
      if (this.isPathWithinSandbox(normalizedCwd)) {
        safeCwd = normalizedCwd
      } else {
        // Enforce sandbox cwd
        safeCwd = defaultSandboxCwd
      }
    }

    // 2. Shell Command Firewall: Block destructive system modifications
    const normalizedCmd = command.trim()

    // Destructive disk / formatting
    if (/\b(format|diskpart|mountvol)\b/i.test(normalizedCmd)) {
      const reason = 'High-risk disk partition/formatting command blocked.'
      this.recordViolation('shell_command', command, reason)
      return { allowed: false, safeCwd, reason }
    }

    // System restart/shutdown
    if (/\b(shutdown|Stop-Computer|Restart-Computer)\b/i.test(normalizedCmd)) {
      const reason = 'System shutdown/reboot command blocked in sandbox mode.'
      this.recordViolation('shell_command', command, reason)
      return { allowed: false, safeCwd, reason }
    }

    // Registry tampering
    if (
      /\b(reg\s+(delete|add|copy|restore|import)|Set-ItemProperty.*HKLM|Remove-Item.*HKLM)/i.test(
        normalizedCmd
      )
    ) {
      const reason = 'Windows Registry modification command blocked.'
      this.recordViolation('shell_command', command, reason)
      return { allowed: false, safeCwd, reason }
    }

    // Destructive file deletion commands targeting host root or system folders
    if (
      /\b(rmdir|rm|del|erase|Remove-Item)\b.*(\/s|\/q|-r|-recurse|-force).*(c:[\\\/]?($|\s)|[\\\/]windows|[\\\/]system32|[\\\/]programdata|[\\\/]users[\\\/][^\\\/]+[\\\/](desktop|documents|appdata))/i.test(
        normalizedCmd
      )
    ) {
      const reason = 'Recursive deletion targeting host system or user directory blocked.'
      this.recordViolation('shell_command', command, reason)
      return { allowed: false, safeCwd, reason }
    }

    // Killing protected OS processes
    if (
      /\btaskkill\b.*(\/f|\/im\s+(explorer\.exe|svchost\.exe|csrss\.exe|winlogon\.exe|lsass\.exe|dwm\.exe))/i.test(
        normalizedCmd
      )
    ) {
      const reason = 'Attempt to kill essential host Windows processes blocked.'
      this.recordViolation('shell_command', command, reason)
      return { allowed: false, safeCwd, reason }
    }

    // Altering Defender / Firewall
    if (/\b(Set-MpPreference|netsh\s+advfirewall)\b/i.test(normalizedCmd)) {
      const reason = 'Security policy / firewall tampering command blocked.'
      this.recordViolation('shell_command', command, reason)
      return { allowed: false, safeCwd, reason }
    }

    return { allowed: true, safeCwd }
  }

  public recordViolation(
    type: SandboxViolation['type'],
    target: string,
    reason: string
  ): void {
    this.blockedCount++
    const violation: SandboxViolation = {
      id: `viol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type,
      target,
      reason
    }

    this.recentViolations.unshift(violation)
    if (this.recentViolations.length > 50) this.recentViolations.pop()

    console.warn(`[NEXUS SANDBOX SHIELD VIOLATION BLOCKED] [${type}] ${reason} -> Target: ${target}`)

    // Broadcast live warning event to renderer
    const wins = BrowserWindow.getAllWindows()
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send('sandbox:violation-alert', violation)
      }
    }
  }

  public getStatus(): SandboxStatus {
    return {
      enabled: this.isEnabled(),
      rootDir: this.getSandboxRoot(),
      workspaceDir: this.getWorkspaceDir(),
      tempDir: this.getTempDir(),
      strictFS: true,
      strictTerminal: this.isStrictTerminal(),
      blockedCount: this.blockedCount,
      recentViolations: this.recentViolations
    }
  }

  public broadcastStatus(): void {
    const status = this.getStatus()
    const wins = BrowserWindow.getAllWindows()
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send('sandbox:status-update', status)
      }
    }
  }

  public async openSandboxFolder(): Promise<string> {
    this.ensureDirs()
    const folder = this.getSandboxRoot()
    await shell.openPath(folder)
    return folder
  }

  public async clearTemp(): Promise<boolean> {
    try {
      const temp = this.getTempDir()
      if (fs.existsSync(temp)) {
        await fsPromises.rm(temp, { recursive: true, force: true })
        await fsPromises.mkdir(temp, { recursive: true })
      }
      return true
    } catch {
      return false
    }
  }
}

export const globalSandboxManager = new SandboxManager()

export default function registerSandboxManager(ipcMain: IpcMain): void {
  ipcMain.handle('sandbox:get-status', () => {
    return globalSandboxManager.getStatus()
  })

  ipcMain.handle('sandbox:set-enabled', (_event, enabled: boolean) => {
    globalSandboxManager.setEnabled(Boolean(enabled))
    return globalSandboxManager.getStatus()
  })

  ipcMain.handle('sandbox:open-folder', async () => {
    return await globalSandboxManager.openSandboxFolder()
  })

  ipcMain.handle('sandbox:clear-temp', async () => {
    return await globalSandboxManager.clearTemp()
  })
}
