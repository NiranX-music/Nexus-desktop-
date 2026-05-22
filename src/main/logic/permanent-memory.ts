import fs from 'fs'
import path from 'path'
import { IpcMain, App } from 'electron'

export default function registerPermanentMemory({ ipcMain, app }: { ipcMain: IpcMain; app: App }) {
  const MEMORY_DIR = path.resolve(app.getPath('userData'), 'Memory')
  const FILE_PATH = path.join(MEMORY_DIR, 'saved-user-memory.json')
  const NOTES_DIR = path.resolve(app.getPath('userData'), 'Notes')

  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true })
  if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true })

  const writeMemoryNote = (fact: string, timestamp: string) => {
    const stamp = timestamp.replace(/[:.]/g, '-')
    const filePath = path.join(NOTES_DIR, `user_memory_${stamp}.md`)
    const content = [
      '# User Memory',
      '',
      fact,
      '',
      `Saved: ${new Date(timestamp).toLocaleString()}`
    ].join('\n')

    fs.writeFileSync(filePath, content, 'utf-8')
  }

  ipcMain.handle('save-core-memory', async (_event, fact: string) => {
    try {
      let memoryBank: { fact: string; timestamp: string }[] = []

      if (fs.existsSync(FILE_PATH)) {
        const data = fs.readFileSync(FILE_PATH, 'utf-8')
        memoryBank = data ? JSON.parse(data) : []
      }

      const timestamp = new Date().toISOString()
      memoryBank.push({
        fact: fact,
        timestamp
      })

      fs.writeFileSync(FILE_PATH, JSON.stringify(memoryBank, null, 2))
      writeMemoryNote(fact, timestamp)
      return true
    } catch (err) {
      return false
    }
  })

  ipcMain.handle('search-core-memory', async () => {
    try {
      if (fs.existsSync(FILE_PATH)) {
        const data = fs.readFileSync(FILE_PATH, 'utf-8')
        return data ? JSON.parse(data) : []
      }
      return []
    } catch (err) {
      return []
    }
  })
}
