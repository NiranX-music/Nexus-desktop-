import { app, dialog, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import Store from 'electron-store'

const StoreClass = (Store as any).default || Store
const store = new StoreClass()

export default function registerBackupManager() {
  const userDataPath = app.getPath('userData')
  const NOTES_DIR = path.resolve(userDataPath, 'Notes')
  const MEMORY_DIR = path.resolve(userDataPath, 'Memory')
  const MEMORY_FILE = path.join(MEMORY_DIR, 'saved-user-memory.json')
  const WORKFLOWS_FILE = path.join(userDataPath, 'nexus_workflows.json')
  const VAULT_FILE = path.join(userDataPath, 'nexus_secure_vault.json')

  ipcMain.handle('nexus:export-backup', async (_, payload: { clientData?: any; saveDialog?: boolean } = {}) => {
    try {
      const zip = new JSZip()
      const manifest = {
        app: 'Nexus AI',
        version: '2.2.0',
        timestamp: new Date().toISOString(),
        operator: payload.clientData?.operator || {
          name: payload.clientData?.nexus_user_name || 'Nexus Operator',
          email: payload.clientData?.operator_email || 'operator@nexus.local'
        },
        stats: {
          notesCount: 0,
          memoriesCount: 0,
          workflowsCount: 0,
          hasVault: false
        }
      }

      // 1. Gather Markdown Notes
      if (fs.existsSync(NOTES_DIR)) {
        const notesFolder = zip.folder('notes')
        const files = fs.readdirSync(NOTES_DIR)
        for (const file of files) {
          if (file.endsWith('.md')) {
            const content = fs.readFileSync(path.join(NOTES_DIR, file), 'utf-8')
            notesFolder?.file(file, content)
            manifest.stats.notesCount++
          }
        }
      }

      // 2. Gather Core Memory
      if (fs.existsSync(MEMORY_FILE)) {
        const memoryContent = fs.readFileSync(MEMORY_FILE, 'utf-8')
        zip.folder('memory')?.file('saved-user-memory.json', memoryContent)
        try {
          const parsed = JSON.parse(memoryContent)
          manifest.stats.memoriesCount = Array.isArray(parsed) ? parsed.length : 0
        } catch {
          manifest.stats.memoriesCount = 0
        }
      }

      // 3. Gather Workflows
      if (fs.existsSync(WORKFLOWS_FILE)) {
        const wfContent = fs.readFileSync(WORKFLOWS_FILE, 'utf-8')
        zip.file('nexus_workflows.json', wfContent)
        try {
          const parsed = JSON.parse(wfContent)
          manifest.stats.workflowsCount = Array.isArray(parsed) ? parsed.length : 0
        } catch {
          manifest.stats.workflowsCount = 0
        }
      }

      // 4. Gather Secure Vault
      if (fs.existsSync(VAULT_FILE)) {
        const vaultContent = fs.readFileSync(VAULT_FILE, 'utf-8')
        zip.file('nexus_secure_vault.json', vaultContent)
        manifest.stats.hasVault = true
      }

      // 5. Gather Electron Store entries (accounts, security vault pin hash, biometric faces, personality)
      const storeDump: Record<string, any> = {
        nexus_vault_hash: store.get('nexus_vault_hash') || null,
        nexus_vault_faces: store.get('nexus_vault_faces') || [],
        nexus_personality: store.get('nexus_personality') || '',
        nexus_email_auth_users: store.get('nexus_email_auth_users') || []
      }
      zip.file('electron_store.json', JSON.stringify(storeDump, null, 2))

      // 6. Gather Client Settings
      if (payload.clientData) {
        zip.file('client_settings.json', JSON.stringify(payload.clientData, null, 2))
      }

      // 7. Write Manifest
      zip.file('nexus-manifest.json', JSON.stringify(manifest, null, 2))

      // Generate Node Buffer
      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
      const defaultFilename = `nexus-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`

      if (payload.saveDialog) {
        const { filePath } = await dialog.showSaveDialog({
          title: 'Export Nexus Backup Archive (.zip)',
          defaultPath: defaultFilename,
          filters: [{ name: 'Nexus Backup (*.zip)', extensions: ['zip'] }]
        })

        if (!filePath) {
          return { success: false, canceled: true }
        }

        fs.writeFileSync(filePath, buffer)
        return {
          success: true,
          filePath,
          filename: path.basename(filePath),
          manifest
        }
      }

      return {
        success: true,
        base64: buffer.toString('base64'),
        filename: defaultFilename,
        manifest
      }
    } catch (err: any) {
      console.error('[BackupManager] Export error:', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('nexus:import-backup', async (_, payload: { base64?: string; fromDialog?: boolean } = {}) => {
    try {
      let buffer: Buffer | null = null

      if (payload.fromDialog) {
        const { filePaths } = await dialog.showOpenDialog({
          title: 'Import Nexus Backup Archive (.zip)',
          properties: ['openFile'],
          filters: [{ name: 'Nexus Backup (*.zip)', extensions: ['zip'] }]
        })

        if (!filePaths || filePaths.length === 0) {
          return { success: false, canceled: true }
        }

        buffer = fs.readFileSync(filePaths[0])
      } else if (payload.base64) {
        buffer = Buffer.from(payload.base64, 'base64')
      }

      if (!buffer) {
        return { success: false, error: 'No backup file selected or provided.' }
      }

      const zip = await JSZip.loadAsync(buffer)

      // Manifest
      let manifest: any = null
      const manifestFile = zip.file('nexus-manifest.json')
      if (manifestFile) {
        try {
          manifest = JSON.parse(await manifestFile.async('string'))
        } catch {}
      }

      let restoredNotesCount = 0
      let restoredMemoriesCount = 0
      let restoredWorkflowsCount = 0
      let clientSettings: any = null

      // 1. Restore Notes
      if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true })
      const noteFiles = zip.folder('notes')?.file(/.*\.md$/) || []
      for (const noteEntry of noteFiles) {
        const content = await noteEntry.async('string')
        const noteName = path.basename(noteEntry.name)
        fs.writeFileSync(path.join(NOTES_DIR, noteName), content, 'utf-8')
        restoredNotesCount++
      }

      // 2. Restore Core Memory
      const memoryEntry = zip.file('memory/saved-user-memory.json')
      if (memoryEntry) {
        if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true })
        const content = await memoryEntry.async('string')
        fs.writeFileSync(MEMORY_FILE, content, 'utf-8')
        try {
          const parsed = JSON.parse(content)
          restoredMemoriesCount = Array.isArray(parsed) ? parsed.length : 1
        } catch {
          restoredMemoriesCount = 1
        }
      }

      // 3. Restore Workflows
      const wfEntry = zip.file('nexus_workflows.json')
      if (wfEntry) {
        const content = await wfEntry.async('string')
        fs.writeFileSync(WORKFLOWS_FILE, content, 'utf-8')
        try {
          const parsed = JSON.parse(content)
          restoredWorkflowsCount = Array.isArray(parsed) ? parsed.length : 1
        } catch {
          restoredWorkflowsCount = 1
        }
      }

      // 4. Restore Vault
      const vaultEntry = zip.file('nexus_secure_vault.json')
      if (vaultEntry) {
        const content = await vaultEntry.async('string')
        fs.writeFileSync(VAULT_FILE, content, 'utf-8')
      }

      // 5. Restore Electron Store
      const storeEntry = zip.file('electron_store.json')
      if (storeEntry) {
        try {
          const storeData = JSON.parse(await storeEntry.async('string'))
          if (storeData.nexus_vault_hash) store.set('nexus_vault_hash', storeData.nexus_vault_hash)
          if (storeData.nexus_vault_faces && Array.isArray(storeData.nexus_vault_faces)) {
            store.set('nexus_vault_faces', storeData.nexus_vault_faces)
          }
          if (storeData.nexus_personality) store.set('nexus_personality', storeData.nexus_personality)
          if (storeData.nexus_email_auth_users && Array.isArray(storeData.nexus_email_auth_users)) {
            const existingUsers = (store.get('nexus_email_auth_users') as any[]) || []
            const backupUsers = storeData.nexus_email_auth_users as any[]
            const merged = [...existingUsers]
            for (const bUser of backupUsers) {
              if (!merged.some((u) => u.email === bUser.email)) {
                merged.push(bUser)
              }
            }
            store.set('nexus_email_auth_users', merged)
          }
        } catch (e) {
          console.warn('[BackupManager] Error restoring store:', e)
        }
      }

      // 6. Restore Client Settings
      const clientEntry = zip.file('client_settings.json')
      if (clientEntry) {
        try {
          clientSettings = JSON.parse(await clientEntry.async('string'))
        } catch {}
      }

      return {
        success: true,
        manifest,
        clientSettings,
        stats: {
          notesCount: restoredNotesCount,
          memoriesCount: restoredMemoriesCount,
          workflowsCount: restoredWorkflowsCount
        }
      }
    } catch (err: any) {
      console.error('[BackupManager] Import error:', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('nexus:get-system-stats', async () => {
    let notesCount = 0
    let memoriesCount = 0
    let workflowsCount = 0

    if (fs.existsSync(NOTES_DIR)) {
      try {
        notesCount = fs.readdirSync(NOTES_DIR).filter((f) => f.endsWith('.md')).length
      } catch {}
    }
    if (fs.existsSync(MEMORY_FILE)) {
      try {
        const mems = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'))
        memoriesCount = Array.isArray(mems) ? mems.length : 0
      } catch {}
    }
    if (fs.existsSync(WORKFLOWS_FILE)) {
      try {
        const wfs = JSON.parse(fs.readFileSync(WORKFLOWS_FILE, 'utf-8'))
        workflowsCount = Array.isArray(wfs) ? wfs.length : 0
      } catch {}
    }

    const hasVault = fs.existsSync(VAULT_FILE)
    const hasPin = Boolean(store.get('nexus_vault_hash'))
    const faces = (store.get('nexus_vault_faces') as any[]) || []

    return {
      notesCount,
      memoriesCount,
      workflowsCount,
      hasVault,
      hasPin,
      faceCount: faces.length
    }
  })
}
