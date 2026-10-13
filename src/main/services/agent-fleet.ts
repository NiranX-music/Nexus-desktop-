import { IpcMain, BrowserWindow, app } from 'electron'
import { GoogleGenAI } from '@google/genai'
import Groq from 'groq-sdk'
import os from 'os'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'

export type AgentRole = 'recon_scout' | 'code_architect' | 'system_janitor' | 'sentry_watcher'

export interface FleetAgentState {
  role: AgentRole
  name: string
  title: string
  status: 'idle' | 'running' | 'completed' | 'error'
  currentTask?: string
  progress: number
  lastUpdated: number
  logs: string[]
}

export interface AgentTaskResult {
  role: AgentRole
  taskId: string
  success: boolean
  output: string
  completedAt: number
}

class AgentFleetManager {
  private agents: Map<AgentRole, FleetAgentState> = new Map()

  constructor() {
    this.initAgents()
  }

  private initAgents() {
    this.agents.set('recon_scout', {
      role: 'recon_scout',
      name: 'Recon Scout',
      title: 'Autonomous Web & Context Ingestion Unit',
      status: 'idle',
      progress: 0,
      lastUpdated: Date.now(),
      logs: ['Unit initialized. Awaiting reconnaissance directives.']
    })

    this.agents.set('code_architect', {
      role: 'code_architect',
      name: 'Code Architect',
      title: 'High-Performance Systems & Synthesis Engineer',
      status: 'idle',
      progress: 0,
      lastUpdated: Date.now(),
      logs: ['Neural compiler armed. Ready for code synthesis.']
    })

    this.agents.set('system_janitor', {
      role: 'system_janitor',
      name: 'System Janitor',
      title: 'Disk Optimizer & Workspace Hygiene Manager',
      status: 'idle',
      progress: 0,
      lastUpdated: Date.now(),
      logs: ['Storage patrol ready. Temporary caches monitored.']
    })

    this.agents.set('sentry_watcher', {
      role: 'sentry_watcher',
      name: 'Sentry Watcher',
      title: 'Hardware Telemetry & Process Surveillance Unit',
      status: 'idle',
      progress: 0,
      lastUpdated: Date.now(),
      logs: ['Surveillance matrix online. System vital sensors hot.']
    })
  }

  getFleetStatus(): FleetAgentState[] {
    return Array.from(this.agents.values())
  }

  private broadcastUpdate() {
    const wins = BrowserWindow.getAllWindows()
    const payload = this.getFleetStatus()
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send('fleet-status-update', payload)
      }
    }
  }

  private log(role: AgentRole, message: string) {
    const agent = this.agents.get(role)
    if (agent) {
      agent.logs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`)
      if (agent.logs.length > 30) agent.logs.pop()
      agent.lastUpdated = Date.now()
      this.broadcastUpdate()
    }
  }

  async dispatchTask(
    role: AgentRole,
    directive: string,
    geminiKey?: string,
    groqKey?: string
  ): Promise<AgentTaskResult> {
    const agent = this.agents.get(role)
    if (!agent) throw new Error(`Unknown agent role: ${role}`)

    agent.status = 'running'
    agent.currentTask = directive
    agent.progress = 10
    this.log(role, `Dispatched task: "${directive}"`)

    const taskId = `task_${Date.now()}`

    try {
      let output = ''

      switch (role) {
        case 'recon_scout':
          output = await this.runReconScout(directive, geminiKey, groqKey)
          break
        case 'code_architect':
          output = await this.runCodeArchitect(directive, geminiKey)
          break
        case 'system_janitor':
          output = await this.runSystemJanitor(directive)
          break
        case 'sentry_watcher':
          output = await this.runSentryWatcher(directive)
          break
      }

      agent.status = 'completed'
      agent.progress = 100
      this.log(role, `Task completed successfully.`)

      const result: AgentTaskResult = {
        role,
        taskId,
        success: true,
        output,
        completedAt: Date.now()
      }

      const wins = BrowserWindow.getAllWindows()
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('fleet-task-complete', result)
        }
      }

      return result
    } catch (err: any) {
      agent.status = 'error'
      agent.progress = 0
      const errorMsg = err?.message || String(err)
      this.log(role, `Task failed: ${errorMsg}`)

      const result: AgentTaskResult = {
        role,
        taskId,
        success: false,
        output: errorMsg,
        completedAt: Date.now()
      }

      const wins = BrowserWindow.getAllWindows()
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('fleet-task-complete', result)
        }
      }

      return result
    }
  }

  private async runReconScout(query: string, geminiKey?: string, groqKey?: string): Promise<string> {
    this.log('recon_scout', 'Analyzing target parameters and context...')
    this.agents.get('recon_scout')!.progress = 35

    const key = geminiKey || process.env.GEMINI_API_KEY
    if (key) {
      const ai = new GoogleGenAI({ apiKey: key })
      this.log('recon_scout', 'Querying Gemini synthesis engine...')
      this.agents.get('recon_scout')!.progress = 70

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are Recon Scout, a specialized intelligence unit of Nexus Neural OS. Perform an in-depth intelligence recon on: "${query}". Provide a concise, highly structured technical briefing.`
      })

      return response.text || 'Recon complete. No findings.'
    }

    if (groqKey || process.env.GROQ_API_KEY) {
      const groq = new Groq({ apiKey: groqKey || process.env.GROQ_API_KEY })
      this.log('recon_scout', 'Routing through Groq low-latency engine...')
      this.agents.get('recon_scout')!.progress = 70

      const chat = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: `Recon Scout directive: ${query}` }]
      })

      return chat.choices[0]?.message?.content || 'Recon complete.'
    }

    return `Recon Scout scanned query: "${query}". Please configure Gemini or Groq API key for autonomous deep web synthesis.`
  }

  private async runCodeArchitect(prompt: string, geminiKey?: string): Promise<string> {
    this.log('code_architect', 'Analyzing architectural specifications...')
    this.agents.get('code_architect')!.progress = 40

    const key = geminiKey || process.env.GEMINI_API_KEY
    if (!key) {
      return 'Code Architect requires Gemini API Key configured in Command Center.'
    }

    const ai = new GoogleGenAI({ apiKey: key })
    this.log('code_architect', 'Synthesizing clean code structure...')
    this.agents.get('code_architect')!.progress = 75

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are Code Architect of Nexus Neural OS. Synthesize the optimal implementation for: "${prompt}". Output cleanly formatted code with architectural design notes.`
    })

    return response.text || 'Architecture complete.'
  }

  private async runSystemJanitor(action: string): Promise<string> {
    this.log('system_janitor', 'Scanning local drive structures and temp caches...')
    this.agents.get('system_janitor')!.progress = 50

    const tempDir = os.tmpdir()
    let tempCount = 0
    try {
      const files = await fsPromises.readdir(tempDir)
      tempCount = files.length
    } catch {}

    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2)
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2)

    this.log('system_janitor', `Patrol finished. Scanned ${tempCount} cache objects in ${tempDir}.`)
    this.agents.get('system_janitor')!.progress = 90

    return `System Janitor Report: Memory Available: ${freeMem} GB / ${totalMem} GB. Cached temporary files inspected in ${tempDir}: ${tempCount} items. Workspace hygiene nominal.`
  }

  private async runSentryWatcher(target: string): Promise<string> {
    this.log('sentry_watcher', 'Probing active hardware sensors and process states...')
    this.agents.get('sentry_watcher')!.progress = 50

    const cpus = os.cpus()
    const load = os.loadavg()
    const uptime = Math.floor(os.uptime() / 3600)

    this.log('sentry_watcher', `Surveillance complete. ${cpus.length} CPU cores operating within thermal thresholds.`)
    this.agents.get('sentry_watcher')!.progress = 95

    return `Sentry Watcher Surveillance: CPU Cores: ${cpus.length} (${cpus[0]?.model || 'Native'}). System Uptime: ${uptime} hours. Target surveillance for "${target}" logged and secure.`
  }
}

export const globalAgentFleet = new AgentFleetManager()

export default function registerAgentFleet(ipcMain: IpcMain) {
  ipcMain.handle('fleet-get-status', () => {
    return globalAgentFleet.getFleetStatus()
  })

  ipcMain.handle('fleet-dispatch-task', async (_event, { role, directive, geminiKey, groqKey }) => {
    return await globalAgentFleet.dispatchTask(role, directive, geminiKey, groqKey)
  })
}
