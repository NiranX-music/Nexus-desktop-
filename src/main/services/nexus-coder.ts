import fs from 'fs'
import path from 'path'
import { IpcMain, App } from 'electron'
import { exec } from 'child_process'
import { GoogleGenAI } from '@google/genai'
import { globalSandboxManager } from '../security/sandbox-manager'

export default function registerNexusCoder({ ipcMain, app }: { ipcMain: IpcMain; app: App }) {
  const getProjectsDir = () => {
    if (globalSandboxManager.isEnabled()) {
      return globalSandboxManager.getWorkspaceDir()
    }
    const dir = path.resolve(app.getPath('userData'), 'Projects')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  ipcMain.handle('start-live-coding', async (event, { prompt, filename, geminiKey }) => {
    try {
      const projectsDir = getProjectsDir()
      const cleanFileName = path.basename(filename || 'untitled.js')
      const filePath = path.join(projectsDir, cleanFileName)

      fs.writeFileSync(filePath, '// Boss, connection established. Waiting for AI stream...\n')

      if (!geminiKey || geminiKey.trim() === '') {
        throw new Error('Missing Gemini API Key. Please configure it in the Command Center Vault.')
      }

      const ai = new GoogleGenAI({ apiKey: geminiKey })

      const response = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `You are an elite developer. Write the code for: "${prompt}". Output ONLY the raw code for the file ${filename}. Do NOT wrap it in markdown blockquotes.`
      })

      let fullCode = ''
      for await (const chunk of response) {
        if (chunk.text) {
          fullCode += chunk.text
          event.sender.send('live-code-chunk', chunk.text)
        }
      }

      fs.writeFileSync(filePath, fullCode)
      return { success: true, filePath }
    } catch (err) {
      event.sender.send('live-code-chunk', `\n\n❌ [SYSTEM FAILURE]: ${String(err)}`)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('open-in-vscode', async (_event, filePath) => {
    try {
      exec(`code "${filePath}"`)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
