import { IpcMain, BrowserWindow, screen, shell, app, safeStorage } from 'electron'
import { mouse, keyboard, Point, Button, Key } from '@nut-tree-fork/nut-js'
import screenshot from 'screenshot-desktop'
import { GoogleGenAI } from '@google/genai'
import path from 'path'
import fs from 'fs'

keyboard.config.autoDelayMs = 25
mouse.config.autoDelayMs = 15

export type SkyvernTaskMode = 'desktop' | 'browser'
export type SkyvernActionType =
  | 'CLICK'
  | 'DOUBLE_CLICK'
  | 'RIGHT_CLICK'
  | 'TYPE'
  | 'PRESS'
  | 'SCROLL'
  | 'WAIT'
  | 'NAVIGATE'
  | 'COMPLETE'
  | 'FAIL'

export interface SkyvernStep {
  stepIndex: number
  action: SkyvernActionType
  thought: string
  coordinate?: { x: number; y: number } // 0 - 1000 normalized
  pixelCoordinate?: { x: number; y: number }
  text?: string
  key?: string
  direction?: 'up' | 'down'
  amount?: number
  url?: string
  screenshotDataUrl?: string
  success: boolean
  error?: string
  timestamp: number
}

export type SkyvernTaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface SkyvernTaskState {
  taskId: string
  goal: string
  mode: SkyvernTaskMode
  status: SkyvernTaskStatus
  currentStep: number
  maxSteps: number
  steps: SkyvernStep[]
  finalResult?: string
  startedAt: number
  completedAt?: number
  lastScreenshot?: string
}

export interface SkyvernConfig {
  skyvernApiUrl: string
  geminiModel: string
  maxSteps: number
  stepDelayMs: number
  smoothMouse: boolean
}

const DEFAULT_CONFIG: SkyvernConfig = {
  skyvernApiUrl: 'http://localhost:8000',
  geminiModel: 'gemini-3.8-flash',
  maxSteps: 15,
  stepDelayMs: 900,
  smoothMouse: true
}

const KEY_MAP: Record<string, Key> = {
  enter: Key.Enter,
  return: Key.Enter,
  space: Key.Space,
  tab: Key.Tab,
  escape: Key.Escape,
  esc: Key.Escape,
  backspace: Key.Backspace,
  delete: Key.Delete,
  up: Key.Up,
  down: Key.Down,
  left: Key.Left,
  right: Key.Right,
  home: Key.Home,
  end: Key.End,
  pageup: Key.PageUp,
  pagedown: Key.PageDown
}

function generateHumanPath(start: Point, end: Point, steps = 20): Point[] {
  const pathArray: Point[] = []
  const directionX = end.x > start.x ? 1 : -1
  const directionY = end.y > start.y ? 1 : -1
  const deviation = Math.random() * 50 + 15

  const controlPoint = new Point(
    start.x + (Math.abs(end.x - start.x) / 2) * directionX + (Math.random() < 0.5 ? -deviation : deviation),
    start.y + (Math.abs(end.y - start.y) / 2) * directionY + (Math.random() < 0.5 ? -deviation : deviation)
  )

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round((1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * controlPoint.x + t * t * end.x)
    const y = Math.round((1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * controlPoint.y + t * t * end.y)
    pathArray.push(new Point(x, y))
  }
  return pathArray
}

export class SkyvernScreenAgent {
  private currentTask: SkyvernTaskState | null = null
  private abortRequested = false
  private config: SkyvernConfig = { ...DEFAULT_CONFIG }
  private configPath: string

  constructor(userDataPath: string) {
    this.configPath = path.join(userDataPath, 'skyvern_config.json')
    this.loadConfig()
  }

  private loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8')
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG }
    }
  }

  public saveConfig(newConfig: Partial<SkyvernConfig>) {
    this.config = { ...this.config, ...newConfig }
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8')
    } catch {}
    return this.config
  }

  public getConfig(): SkyvernConfig {
    return { ...this.config }
  }

  public getStatus(): SkyvernTaskState | { status: 'idle' } {
    return this.currentTask || { status: 'idle' }
  }

  public stopTask(): boolean {
    if (this.currentTask && this.currentTask.status === 'running') {
      this.abortRequested = true
      this.currentTask.status = 'cancelled'
      this.currentTask.completedAt = Date.now()
      this.broadcast('skyvern:task-update', this.currentTask)
      return true
    }
    return false
  }

  private broadcast(channel: string, data: any) {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }

  private getGeminiApiKey(): string {
    // 1. Check secure storage vault
    try {
      const vaultPath = path.join(app.getPath('userData'), 'nexus_secure_vault.json')
      if (fs.existsSync(vaultPath)) {
        const data = JSON.parse(fs.readFileSync(vaultPath, 'utf8'))
        if (data.gemini) {
          if (safeStorage.isEncryptionAvailable()) {
            return safeStorage.decryptString(Buffer.from(data.gemini, 'base64')).trim()
          }
          return Buffer.from(data.gemini, 'base64').toString('utf8').trim()
        }
      }
    } catch {}

    // 2. Check environment variables
    const envKey = process.env.NEXUS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''
    return envKey.trim()
  }

  private translateCoordinates(
    inputX: number,
    inputY: number
  ): { screenX: number; screenY: number; width: number; height: number } {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height, x: originX, y: originY } = primaryDisplay.bounds

    let targetX = inputX
    let targetY = inputY

    // If normalized 0 - 1000
    if (inputX >= 0 && inputX <= 1000 && inputY >= 0 && inputY <= 1000) {
      targetX = originX + Math.round((inputX / 1000) * width)
      targetY = originY + Math.round((inputY / 1000) * height)
    }

    targetX = Math.max(originX, Math.min(originX + width - 1, targetX))
    targetY = Math.max(originY, Math.min(originY + height - 1, targetY))

    return { screenX: targetX, screenY: targetY, width, height }
  }

  public async captureScreen(): Promise<{ buffer: Buffer; base64: string; dataUrl: string }> {
    const buffer = await screenshot({ format: 'png' })
    const base64 = buffer.toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`
    return { buffer, base64, dataUrl }
  }

  private buildVisionPrompt(goal: string, stepIndex: number, maxSteps: number, history: SkyvernStep[]): string {
    const historySummary = history.map((s) => {
      const coord = s.coordinate ? ` at (${s.coordinate.x}, ${s.coordinate.y})` : ''
      const extra = s.text ? ` text="${s.text}"` : s.key ? ` key="${s.key}"` : ''
      return `Step ${s.stepIndex}: [${s.action}${coord}${extra}] Result: ${s.success ? 'Success' : 'Failed'}. Thought: ${s.thought}`
    }).join('\n')

    return `You are Nexus Skyvern Vision Agent, an autonomous screen-use AI that executes browser and desktop tasks by analyzing screen visuals and performing precise GUI actions (clicks, typing, keyboard, scrolling).

OPERATOR GOAL: "${goal}"
CURRENT STEP: ${stepIndex} / ${maxSteps}

ACTION HISTORY SO FAR:
${historySummary || 'No previous steps taken. This is Step 1.'}

INSTRUCTIONS:
1. Carefully inspect the provided screenshot. Identify buttons, text input fields, links, search bars, tabs, or elements relevant to completing the goal.
2. Determine if the goal is ALREADY ACHIEVED. If yes, choose action "COMPLETE" with a clear result summary.
3. If not completed, decide the SINGLE NEXT ACTION needed:
   - "CLICK": Click on an element. Specify coordinate { x: 0-1000, y: 0-1000 } representing the center of the target element.
   - "DOUBLE_CLICK": Double click at coordinate.
   - "RIGHT_CLICK": Right click at coordinate.
   - "TYPE": Focus and type text. Provide coordinate of the input box and the "text" to type.
   - "PRESS": Press a special keyboard key like "Enter", "Tab", "Escape", "Backspace".
   - "SCROLL": Scroll "down" or "up" by an amount (e.g. 400).
   - "WAIT": Wait 1-2 seconds for content or navigation to load.
   - "NAVIGATE": Open a target web URL if a URL needs to be visited.
   - "COMPLETE": The operator's goal is finished.
   - "FAIL": If an insurmountable roadblock occurs.

COORDINATE SYSTEM:
- Normalized 0 to 1000 scale.
- (0, 0) is top-left corner of the screen.
- (1000, 1000) is bottom-right corner of the screen.
- Center of screen is (500, 500).

OUTPUT FORMAT: Return PURE JSON ONLY (no markdown code blocks, no other text):
{
  "thought": "1 sentence describing what is visible and why this action is chosen",
  "action": "CLICK" | "DOUBLE_CLICK" | "RIGHT_CLICK" | "TYPE" | "PRESS" | "SCROLL" | "WAIT" | "NAVIGATE" | "COMPLETE" | "FAIL",
  "coordinate": { "x": number, "y": number },
  "text": "text to type if action is TYPE",
  "key": "Enter | Tab | Escape | Backspace if action is PRESS",
  "direction": "down | up if action is SCROLL",
  "amount": 300,
  "url": "https://... if action is NAVIGATE",
  "result": "summary of findings or completion status if action is COMPLETE"
}`
  }

  private async reasonWithVision(
    apiKey: string,
    screenshotBase64: string,
    prompt: string
  ): Promise<any> {
    const ai = new GoogleGenAI({ apiKey })
    const modelName = this.config.geminiModel || 'gemini-3.8-flash'

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: screenshotBase64
              }
            }
          ]
        }
      ]
    })

    const rawText = response.text || ''
    const cleanJson = rawText
      .replace(/^```(?:json)?/im, '')
      .replace(/```$/im, '')
      .trim()

    try {
      return JSON.parse(cleanJson)
    } catch {
      const match = cleanJson.match(/\{[\s\S]*\}/)
      if (match) {
        return JSON.parse(match[0])
      }
      throw new Error(`Failed to parse Vision LLM response: ${rawText.slice(0, 200)}`)
    }
  }

  public async executeAction(action: SkyvernActionType, payload: any): Promise<{ success: boolean; detail: string; pixelCoord?: { x: number; y: number } }> {
    try {
      if (action === 'CLICK' || action === 'DOUBLE_CLICK' || action === 'RIGHT_CLICK') {
        const coord = payload.coordinate || { x: 500, y: 500 }
        const { screenX, screenY } = this.translateCoordinates(coord.x, coord.y)
        const targetPoint = new Point(screenX, screenY)

        if (this.config.smoothMouse) {
          const currentPos = await mouse.getPosition()
          const pathPoints = generateHumanPath(currentPos, targetPoint, 15)
          await mouse.move(pathPoints)
        } else {
          await mouse.setPosition(targetPoint)
        }

        if (action === 'RIGHT_CLICK') {
          await mouse.click(Button.RIGHT)
        } else if (action === 'DOUBLE_CLICK') {
          await mouse.doubleClick(Button.LEFT)
        } else {
          await mouse.click(Button.LEFT)
        }

        return {
          success: true,
          detail: `Clicked at physical screen (${screenX}, ${screenY}) [norm: ${coord.x}, ${coord.y}]`,
          pixelCoord: { x: screenX, y: screenY }
        }
      }

      if (action === 'TYPE') {
        const text = String(payload.text || '')
        let pixelCoord: { x: number; y: number } | undefined

        // If target coordinate given, click it first to focus
        if (payload.coordinate) {
          const { screenX, screenY } = this.translateCoordinates(payload.coordinate.x, payload.coordinate.y)
          pixelCoord = { x: screenX, y: screenY }
          await mouse.setPosition(new Point(screenX, screenY))
          await mouse.click(Button.LEFT)
          await new Promise((r) => setTimeout(r, 200))
        }

        // Type characters
        if (text) {
          await keyboard.type(text)
        }

        return {
          success: true,
          detail: `Typed "${text}" into focused field`,
          pixelCoord
        }
      }

      if (action === 'PRESS') {
        const keyName = String(payload.key || 'enter').toLowerCase().trim()
        const nutKey = KEY_MAP[keyName] || Key.Enter
        await keyboard.pressKey(nutKey)
        await keyboard.releaseKey(nutKey)
        return { success: true, detail: `Pressed key [${keyName}]` }
      }

      if (action === 'SCROLL') {
        const amount = payload.amount || 400
        const dir = payload.direction === 'up' ? 'up' : 'down'
        if (dir === 'up') {
          await mouse.scrollUp(amount)
        } else {
          await mouse.scrollDown(amount)
        }
        return { success: true, detail: `Scrolled ${dir} by ${amount}px` }
      }

      if (action === 'NAVIGATE') {
        const url = payload.url || 'https://google.com'
        shell.openExternal(url)
        return { success: true, detail: `Navigated to ${url}` }
      }

      if (action === 'WAIT') {
        const ms = payload.ms || 1500
        await new Promise((r) => setTimeout(r, ms))
        return { success: true, detail: `Waited ${ms}ms for UI to settle` }
      }

      if (action === 'COMPLETE') {
        return { success: true, detail: payload.result || 'Task goal verified complete.' }
      }

      if (action === 'FAIL') {
        return { success: false, detail: payload.result || 'Goal cannot be completed.' }
      }

      return { success: false, detail: `Unknown action ${action}` }
    } catch (err: any) {
      return { success: false, detail: `Action execution error: ${err?.message || String(err)}` }
    }
  }

  public async startTask(
    goal: string,
    options: {
      mode?: SkyvernTaskMode
      startUrl?: string
      maxSteps?: number
    } = {}
  ): Promise<SkyvernTaskState> {
    const taskId = `screen-${Date.now()}`
    const mode = options.mode || 'desktop'
    const maxSteps = options.maxSteps || this.config.maxSteps || 15
    this.abortRequested = false

    const apiKey = this.getGeminiApiKey()
    if (!apiKey) {
      const failedState: SkyvernTaskState = {
        taskId,
        goal,
        mode,
        status: 'failed',
        currentStep: 0,
        maxSteps,
        steps: [],
        finalResult: 'Missing Gemini API Key. Please add your key in the Vault or environment.',
        startedAt: Date.now(),
        completedAt: Date.now()
      }
      this.currentTask = failedState
      this.broadcast('skyvern:task-update', failedState)
      return failedState
    }

    this.currentTask = {
      taskId,
      goal,
      mode,
      status: 'running',
      currentStep: 0,
      maxSteps,
      steps: [],
      startedAt: Date.now()
    }
    this.broadcast('skyvern:task-update', this.currentTask)

    // Optional initial navigation
    if (options.startUrl) {
      shell.openExternal(options.startUrl)
      await new Promise((r) => setTimeout(r, 2000))
    }

    // Run autonomous loop in background
    this.runAutonomousLoop(apiKey).catch((err) => {
      if (this.currentTask) {
        this.currentTask.status = 'failed'
        this.currentTask.finalResult = `Autonomous loop crash: ${err.message}`
        this.currentTask.completedAt = Date.now()
        this.broadcast('skyvern:task-update', this.currentTask)
      }
    })

    return this.currentTask
  }

  private async runAutonomousLoop(apiKey: string) {
    if (!this.currentTask) return

    for (let step = 1; step <= this.currentTask.maxSteps; step++) {
      if (this.abortRequested || this.currentTask.status !== 'running') {
        break
      }

      this.currentTask.currentStep = step

      // 1. Capture screen
      let capture
      try {
        capture = await this.captureScreen()
        this.currentTask.lastScreenshot = capture.dataUrl
      } catch (err: any) {
        const stepRecord: SkyvernStep = {
          stepIndex: step,
          action: 'FAIL',
          thought: 'Screen capture failed.',
          success: false,
          error: err.message,
          timestamp: Date.now()
        }
        this.currentTask.steps.push(stepRecord)
        this.currentTask.status = 'failed'
        this.currentTask.finalResult = `Screen capture failed: ${err.message}`
        this.broadcast('skyvern:step-update', stepRecord)
        this.broadcast('skyvern:task-update', this.currentTask)
        break
      }

      // 2. Reason via Vision LLM
      const prompt = this.buildVisionPrompt(
        this.currentTask.goal,
        step,
        this.currentTask.maxSteps,
        this.currentTask.steps
      )

      let decision: any
      try {
        decision = await this.reasonWithVision(apiKey, capture.base64, prompt)
      } catch (err: any) {
        const stepRecord: SkyvernStep = {
          stepIndex: step,
          action: 'FAIL',
          thought: `Vision analysis error: ${err.message}`,
          screenshotDataUrl: capture.dataUrl,
          success: false,
          error: err.message,
          timestamp: Date.now()
        }
        this.currentTask.steps.push(stepRecord)
        this.currentTask.status = 'failed'
        this.currentTask.finalResult = `Vision reasoning failed: ${err.message}`
        this.broadcast('skyvern:step-update', stepRecord)
        this.broadcast('skyvern:task-update', this.currentTask)
        break
      }

      const action: SkyvernActionType = (decision.action || 'WAIT').toUpperCase() as SkyvernActionType
      const thought: string = decision.thought || `Executing ${action}`

      // Check if complete
      if (action === 'COMPLETE') {
        const stepRecord: SkyvernStep = {
          stepIndex: step,
          action: 'COMPLETE',
          thought,
          screenshotDataUrl: capture.dataUrl,
          success: true,
          timestamp: Date.now()
        }
        this.currentTask.steps.push(stepRecord)
        this.currentTask.status = 'completed'
        this.currentTask.finalResult = decision.result || thought || 'Task finished successfully.'
        this.currentTask.completedAt = Date.now()
        this.broadcast('skyvern:step-update', stepRecord)
        this.broadcast('skyvern:task-update', this.currentTask)
        break
      }

      if (action === 'FAIL') {
        const stepRecord: SkyvernStep = {
          stepIndex: step,
          action: 'FAIL',
          thought,
          screenshotDataUrl: capture.dataUrl,
          success: false,
          error: decision.result || 'Agent declared failure.',
          timestamp: Date.now()
        }
        this.currentTask.steps.push(stepRecord)
        this.currentTask.status = 'failed'
        this.currentTask.finalResult = decision.result || 'Agent could not fulfill request.'
        this.currentTask.completedAt = Date.now()
        this.broadcast('skyvern:step-update', stepRecord)
        this.broadcast('skyvern:task-update', this.currentTask)
        break
      }

      // 3. Execute action
      const execResult = await this.executeAction(action, decision)

      const stepRecord: SkyvernStep = {
        stepIndex: step,
        action,
        thought,
        coordinate: decision.coordinate,
        pixelCoordinate: execResult.pixelCoord,
        text: decision.text,
        key: decision.key,
        direction: decision.direction,
        amount: decision.amount,
        url: decision.url,
        screenshotDataUrl: capture.dataUrl,
        success: execResult.success,
        error: execResult.success ? undefined : execResult.detail,
        timestamp: Date.now()
      }

      this.currentTask.steps.push(stepRecord)
      this.broadcast('skyvern:step-update', stepRecord)
      this.broadcast('skyvern:task-update', this.currentTask)

      // 4. Settle delay before next screen inspection
      await new Promise((r) => setTimeout(r, this.config.stepDelayMs || 900))
    }

    if (this.currentTask && this.currentTask.status === 'running') {
      this.currentTask.status = 'completed'
      this.currentTask.finalResult = `Reached maximum step limit (${this.currentTask.maxSteps}). Workflow finished.`
      this.currentTask.completedAt = Date.now()
      this.broadcast('skyvern:task-update', this.currentTask)
    }
  }

  public async executeVisualClick(description: string): Promise<{ success: boolean; message: string; clickedAt?: { x: number; y: number } }> {
    const apiKey = this.getGeminiApiKey()
    if (!apiKey) {
      return { success: false, message: 'Missing Gemini API Key.' }
    }

    try {
      const capture = await this.captureScreen()
      const prompt = `You are a visual grounding agent. The operator wants to click: "${description}".
Examine the screenshot and locate the exact element described.
Return STRICT JSON:
{
  "found": true,
  "coordinate": { "x": number, "y": number }, // 0 to 1000 normalized
  "reason": "1-sentence explanation"
}
If the element cannot be found, return {"found": false, "reason": "not visible"}.`

      const ai = new GoogleGenAI({ apiKey })
      const response = await ai.models.generateContent({
        model: this.config.geminiModel || 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/png', data: capture.base64 } }
            ]
          }
        ]
      })

      const cleanJson = (response.text || '').replace(/^```(?:json)?/im, '').replace(/```$/im, '').trim()
      const data = JSON.parse(cleanJson)

      if (!data.found || !data.coordinate) {
        return { success: false, message: `Could not visually locate "${description}": ${data.reason || 'not visible'}` }
      }

      const { screenX, screenY } = this.translateCoordinates(data.coordinate.x, data.coordinate.y)
      const currentPos = await mouse.getPosition()
      const pathPoints = generateHumanPath(currentPos, new Point(screenX, screenY), 15)
      await mouse.move(pathPoints)
      await mouse.click(Button.LEFT)

      return {
        success: true,
        message: `Clicked "${description}" at screen coordinates (${screenX}, ${screenY}) [${data.reason}]`,
        clickedAt: { x: screenX, y: screenY }
      }
    } catch (err: any) {
      return { success: false, message: `Visual click failed: ${err.message || String(err)}` }
    }
  }

  // Connect to an external Skyvern server REST API if available
  public async executeSkyvernApiTask(payload: {
    url: string
    navigation_goal: string
    data_extraction_goal?: string
  }): Promise<any> {
    const baseUrl = this.config.skyvernApiUrl.replace(/\/+$/, '')
    const targetUrl = `${baseUrl}/api/v1/tasks`

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      throw new Error(`Skyvern API returned ${res.status}: ${await res.text()}`)
    }

    return await res.json()
  }
}

let globalSkyvernAgent: SkyvernScreenAgent | null = null

export function getGlobalSkyvernAgent(): SkyvernScreenAgent | null {
  return globalSkyvernAgent
}

export default function registerSkyvernAgent(ipcMain: IpcMain, appInstance: Electron.App) {
  if (!globalSkyvernAgent) {
    globalSkyvernAgent = new SkyvernScreenAgent(appInstance.getPath('userData'))
  }

  const handleStartTask = async (_event: any, payload: { goal: string; mode?: SkyvernTaskMode; startUrl?: string; maxSteps?: number }) => {
    return await globalSkyvernAgent!.startTask(payload.goal, {
      mode: payload.mode,
      startUrl: payload.startUrl,
      maxSteps: payload.maxSteps
    })
  }

  const handleStopTask = async () => globalSkyvernAgent!.stopTask()
  const handleGetStatus = async () => globalSkyvernAgent!.getStatus()
  const handleVisualClick = async (_event: any, description: string) => globalSkyvernAgent!.executeVisualClick(description)
  const handleGetConfig = async () => globalSkyvernAgent!.getConfig()
  const handleSaveConfig = async (_event: any, config: Partial<SkyvernConfig>) => globalSkyvernAgent!.saveConfig(config)
  const handleCaptureScreen = async () => {
    const capture = await globalSkyvernAgent!.captureScreen()
    return { dataUrl: capture.dataUrl }
  }

  // Primary screen channels
  ipcMain.handle('screen:start-task', handleStartTask)
  ipcMain.handle('screen:stop-task', handleStopTask)
  ipcMain.handle('screen:get-status', handleGetStatus)
  ipcMain.handle('screen:visual-click', handleVisualClick)
  ipcMain.handle('screen:get-config', handleGetConfig)
  ipcMain.handle('screen:save-config', handleSaveConfig)
  ipcMain.handle('screen:capture-screen', handleCaptureScreen)

  // Backward compatibility aliases
  ipcMain.handle('skyvern:start-task', handleStartTask)
  ipcMain.handle('skyvern:stop-task', handleStopTask)
  ipcMain.handle('skyvern:get-status', handleGetStatus)
  ipcMain.handle('skyvern:visual-click', handleVisualClick)
  ipcMain.handle('skyvern:get-config', handleGetConfig)
  ipcMain.handle('skyvern:save-config', handleSaveConfig)
  ipcMain.handle('skyvern:capture-screen', handleCaptureScreen)
  ipcMain.handle('skyvern:run-api-task', async (_event, payload: { url: string; navigation_goal: string; data_extraction_goal?: string }) => {
    return await globalSkyvernAgent!.executeSkyvernApiTask(payload)
  })
}
