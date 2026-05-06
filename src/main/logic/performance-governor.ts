import { App, BrowserWindow, IpcMain, shell } from 'electron'
import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

type OptimizerMode = 'eco' | 'balanced' | 'turbo'
type PressureLevel = 'idle' | 'normal' | 'warm' | 'hot'

interface OptimizerSettings {
  mode: OptimizerMode
  autoGovernor: boolean
  reduceAnimations: boolean
  pauseVisionWhenIdle: boolean
  batterySaver: boolean
  backgroundSampling: boolean
  thresholds: {
    cpuHigh: number
    memoryHigh: number
    batteryLow: number
    processMemoryHighMb: number
  }
}

interface OptimizerSample {
  timestamp: number
  cpuUsage: number
  memoryUsage: number
  freeMemoryGb: number
  totalMemoryGb: number
  processMemoryMb: number
  batteryPercent: number | null
  batteryPresent: boolean
  onBattery: boolean
  networkBytesPerSecond: number
  temperature: number | null
  pressure: PressureLevel
}

interface OptimizerRecommendation {
  id: string
  title: string
  detail: string
  severity: 'info' | 'warning' | 'critical'
  impact: string
  actionLabel: string
  action: OptimizerAction
}

type OptimizerAction =
  | 'enable-eco'
  | 'enable-balanced'
  | 'enable-turbo'
  | 'clear-cache'
  | 'open-task-manager'
  | 'reduce-visuals'
  | 'pause-vision'
  | 'battery-saver'

interface OptimizerState {
  settings: OptimizerSettings
  current: OptimizerSample
  history: OptimizerSample[]
  healthScore: number
  recommendations: OptimizerRecommendation[]
  activeProfile: {
    name: string
    detail: string
    sampleIntervalMs: number
    maxVisionFps: number
    animationBudget: string
    voicePriority: string
  }
}

const DEFAULT_SETTINGS: OptimizerSettings = {
  mode: 'balanced',
  autoGovernor: true,
  reduceAnimations: false,
  pauseVisionWhenIdle: true,
  batterySaver: true,
  backgroundSampling: true,
  thresholds: {
    cpuHigh: 72,
    memoryHigh: 82,
    batteryLow: 25,
    processMemoryHighMb: 850
  }
}

const MODE_PROFILES: Record<OptimizerMode, OptimizerState['activeProfile']> = {
  eco: {
    name: 'Eco',
    detail: 'Quiet background mode for laptops, battery use, and older PCs.',
    sampleIntervalMs: 12_000,
    maxVisionFps: 4,
    animationBudget: 'Low',
    voicePriority: 'Balanced'
  },
  balanced: {
    name: 'Balanced',
    detail: 'Default mode for daily use with active voice and normal UI motion.',
    sampleIntervalMs: 8_000,
    maxVisionFps: 8,
    animationBudget: 'Medium',
    voicePriority: 'Fast'
  },
  turbo: {
    name: 'Turbo',
    detail: 'Maximum responsiveness for plugged-in PCs with enough thermal headroom.',
    sampleIntervalMs: 5_000,
    maxVisionFps: 14,
    animationBudget: 'High',
    voicePriority: 'Realtime'
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const roundOne = (value: number) => Number(value.toFixed(1))

const safeJsonParse = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const runPowerShell = (script: string): Promise<string> =>
  new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { maxBuffer: 1024 * 1024, windowsHide: true },
      (_error, stdout) => resolve(stdout ? stdout.trim() : '')
    )
  })

let cpuLastSnapshot = os.cpus()
let cachedNetworkRate = 0
let cachedNetworkAt = 0
let cachedBattery: Pick<OptimizerSample, 'batteryPercent' | 'batteryPresent' | 'onBattery'> = {
  batteryPercent: null,
  batteryPresent: false,
  onBattery: false
}
let cachedBatteryAt = 0

const getConfigPath = (app: App) => path.join(app.getPath('userData'), 'nexus_optimizer.json')

const loadSettings = (app: App): OptimizerSettings => {
  const file = getConfigPath(app)
  if (!fs.existsSync(file)) return DEFAULT_SETTINGS

  const stored = safeJsonParse<Partial<OptimizerSettings>>(fs.readFileSync(file, 'utf8'), {})
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    thresholds: {
      ...DEFAULT_SETTINGS.thresholds,
      ...(stored.thresholds || {})
    }
  }
}

const saveSettings = (app: App, settings: OptimizerSettings) => {
  fs.mkdirSync(path.dirname(getConfigPath(app)), { recursive: true })
  fs.writeFileSync(getConfigPath(app), JSON.stringify(settings, null, 2))
}

const getCpuUsage = () => {
  const cpus = os.cpus()
  let idle = 0
  let total = 0

  for (let index = 0; index < cpus.length; index += 1) {
    const current = cpus[index]
    const previous = cpuLastSnapshot[index] || current
    const currentTotal = Object.values(current.times).reduce((sum, value) => sum + value, 0)
    const previousTotal = Object.values(previous.times).reduce((sum, value) => sum + value, 0)

    idle += current.times.idle - previous.times.idle
    total += currentTotal - previousTotal
  }

  cpuLastSnapshot = cpus
  if (total <= 0) return 0
  return roundOne(((total - idle) / total) * 100)
}

const getNetworkRate = async () => {
  const now = Date.now()
  if (now - cachedNetworkAt < 5_000) return cachedNetworkRate
  if (os.platform() !== 'win32') return cachedNetworkRate

  const output = await runPowerShell(`
$adapters = Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -notmatch 'Loopback|isatap|Teredo|Pseudo|Bluetooth' -and
    ($_.BytesReceivedPersec -gt 0 -or $_.BytesSentPersec -gt 0)
  } |
  Select-Object BytesReceivedPersec,BytesSentPersec
$rx = 0
$tx = 0
foreach ($adapter in $adapters) {
  $rx += [double]$adapter.BytesReceivedPersec
  $tx += [double]$adapter.BytesSentPersec
}
[pscustomobject]@{ total = [math]::Round($rx + $tx) } | ConvertTo-Json -Compress
`)

  const parsed = safeJsonParse<any>(output, null)
  cachedNetworkRate = Number.isFinite(Number(parsed?.total)) ? Math.round(Number(parsed.total)) : 0
  cachedNetworkAt = now
  return cachedNetworkRate
}

const getBatterySnapshot = async () => {
  const now = Date.now()
  if (now - cachedBatteryAt < 30_000) return cachedBattery
  if (os.platform() !== 'win32') return cachedBattery

  const output = await runPowerShell(`
$battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue |
  Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus
if ($battery) {
  [pscustomobject]@{
    percentage = $battery.EstimatedChargeRemaining
    status = $battery.BatteryStatus
  } | ConvertTo-Json -Compress
}
`)

  if (!output) {
    cachedBattery = { batteryPercent: null, batteryPresent: false, onBattery: false }
    cachedBatteryAt = now
    return cachedBattery
  }

  const parsed = safeJsonParse<any>(output, null)
  const status = Number(parsed?.status)
  cachedBattery = {
    batteryPercent: Number.isFinite(Number(parsed?.percentage))
      ? clamp(Math.round(Number(parsed.percentage)), 0, 100)
      : null,
    batteryPresent: true,
    onBattery: [1, 4, 5].includes(status)
  }
  cachedBatteryAt = now
  return cachedBattery
}

const getPressure = (sample: Omit<OptimizerSample, 'pressure'>, settings: OptimizerSettings) => {
  let points = 0
  if (sample.cpuUsage >= 90) points += 3
  else if (sample.cpuUsage >= settings.thresholds.cpuHigh) points += 2
  else if (sample.cpuUsage >= 55) points += 1

  if (sample.memoryUsage >= 92) points += 3
  else if (sample.memoryUsage >= settings.thresholds.memoryHigh) points += 2
  else if (sample.memoryUsage >= 68) points += 1

  if (sample.processMemoryMb >= settings.thresholds.processMemoryHighMb) points += 2
  if (sample.batteryPresent && sample.onBattery && (sample.batteryPercent ?? 100) <= settings.thresholds.batteryLow) {
    points += 2
  }
  if (sample.temperature !== null && sample.temperature >= 78) points += 2

  if (points >= 6) return 'hot'
  if (points >= 4) return 'warm'
  if (points >= 2) return 'normal'
  return 'idle'
}

const buildSample = async (settings: OptimizerSettings): Promise<OptimizerSample> => {
  const totalMemoryGb = os.totalmem() / 1024 ** 3
  const freeMemoryGb = os.freemem() / 1024 ** 3
  const memoryUsage = ((totalMemoryGb - freeMemoryGb) / totalMemoryGb) * 100
  const processMemoryMb = process.memoryUsage().rss / 1024 ** 2
  const battery = await getBatterySnapshot()

  const partial = {
    timestamp: Date.now(),
    cpuUsage: getCpuUsage(),
    memoryUsage: roundOne(memoryUsage),
    freeMemoryGb: roundOne(freeMemoryGb),
    totalMemoryGb: roundOne(totalMemoryGb),
    processMemoryMb: Math.round(processMemoryMb),
    batteryPercent: battery.batteryPercent,
    batteryPresent: battery.batteryPresent,
    onBattery: battery.onBattery,
    networkBytesPerSecond: await getNetworkRate(),
    temperature: null
  }

  return {
    ...partial,
    pressure: getPressure(partial, settings)
  }
}

const scoreSample = (sample: OptimizerSample, settings: OptimizerSettings) => {
  let score = 100
  score -= clamp(sample.cpuUsage - 45, 0, 55) * 0.45
  score -= clamp(sample.memoryUsage - 58, 0, 42) * 0.55
  score -= clamp(sample.processMemoryMb - 450, 0, 1000) * 0.025

  if (sample.batteryPresent && sample.onBattery) score -= 5
  if (sample.batteryPresent && (sample.batteryPercent ?? 100) <= settings.thresholds.batteryLow) {
    score -= 12
  }
  if (sample.temperature !== null) score -= clamp(sample.temperature - 65, 0, 35) * 0.45

  return Math.round(clamp(score, 0, 100))
}

const buildRecommendations = (
  sample: OptimizerSample,
  settings: OptimizerSettings
): OptimizerRecommendation[] => {
  const items: OptimizerRecommendation[] = []

  if (sample.cpuUsage >= settings.thresholds.cpuHigh) {
    items.push({
      id: 'cpu-pressure',
      title: 'CPU pressure is high',
      detail: 'Switch to Eco mode to slow background sampling and reduce visual work.',
      severity: sample.cpuUsage >= 90 ? 'critical' : 'warning',
      impact: 'Reduces Nexus background load first.',
      actionLabel: 'Enable Eco',
      action: 'enable-eco'
    })
  }

  if (sample.memoryUsage >= settings.thresholds.memoryHigh) {
    items.push({
      id: 'memory-pressure',
      title: 'System memory is tight',
      detail: 'Clear Chromium cache and keep Nexus in a lower animation budget.',
      severity: sample.memoryUsage >= 92 ? 'critical' : 'warning',
      impact: 'Frees cached renderer memory.',
      actionLabel: 'Clear cache',
      action: 'clear-cache'
    })
  }

  if (sample.processMemoryMb >= settings.thresholds.processMemoryHighMb) {
    items.push({
      id: 'nexus-memory',
      title: 'Nexus memory budget is elevated',
      detail: 'Use the cache reset action after long browser, gallery, or AI chat sessions.',
      severity: 'warning',
      impact: 'Refreshes heavy cached assets.',
      actionLabel: 'Reset cache',
      action: 'clear-cache'
    })
  }

  if (sample.batteryPresent && sample.onBattery && (sample.batteryPercent ?? 100) <= settings.thresholds.batteryLow) {
    items.push({
      id: 'battery-saver',
      title: 'Battery saver recommended',
      detail: 'Enable the laptop profile while unplugged or below the battery threshold.',
      severity: 'warning',
      impact: 'Keeps dock and vision features calmer.',
      actionLabel: 'Battery saver',
      action: 'battery-saver'
    })
  }

  if (settings.mode === 'turbo' && sample.pressure !== 'idle') {
    items.push({
      id: 'turbo-pressure',
      title: 'Turbo is active under load',
      detail: 'Balanced mode keeps voice responsive without pushing the machine as hard.',
      severity: 'info',
      impact: 'Better daily thermal behavior.',
      actionLabel: 'Balanced',
      action: 'enable-balanced'
    })
  }

  if (items.length === 0) {
    items.push({
      id: 'healthy',
      title: 'Nexus is inside budget',
      detail: 'No heavy pressure detected. Balanced mode is safe for normal work.',
      severity: 'info',
      impact: 'Keep monitoring quietly.',
      actionLabel: settings.mode === 'balanced' ? 'Refresh' : 'Balanced',
      action: settings.mode === 'balanced' ? 'enable-balanced' : 'enable-balanced'
    })
  }

  return items.slice(0, 4)
}

export default function registerPerformanceGovernor({
  ipcMain,
  app,
  getMainWindow
}: {
  ipcMain: IpcMain
  app: App
  getMainWindow: () => BrowserWindow | null
}) {
  let settings = loadSettings(app)
  let history: OptimizerSample[] = []
  let monitorTimer: ReturnType<typeof setInterval> | null = null

  const broadcastPolicy = () => {
    getMainWindow()?.webContents.send('optimizer-policy-updated', {
      mode: settings.mode,
      reduceAnimations: settings.reduceAnimations,
      pauseVisionWhenIdle: settings.pauseVisionWhenIdle,
      batterySaver: settings.batterySaver,
      profile: MODE_PROFILES[settings.mode]
    })
  }

  const buildState = async (): Promise<OptimizerState> => {
    const current = await buildSample(settings)
    history = [...history, current].slice(-90)

    if (settings.autoGovernor && current.pressure === 'hot' && settings.mode === 'turbo') {
      settings = { ...settings, mode: 'balanced', reduceAnimations: true }
      saveSettings(app, settings)
      broadcastPolicy()
    }

    return {
      settings,
      current,
      history,
      healthScore: scoreSample(current, settings),
      recommendations: buildRecommendations(current, settings),
      activeProfile: MODE_PROFILES[settings.mode]
    }
  }

  const scheduleMonitor = () => {
    if (monitorTimer) clearInterval(monitorTimer)
    const interval = MODE_PROFILES[settings.mode].sampleIntervalMs
    monitorTimer = setInterval(async () => {
      if (!settings.backgroundSampling) return
      const state = await buildState()
      getMainWindow()?.webContents.send('optimizer-state', state)
    }, interval)
  }

  ipcMain.removeHandler('optimizer:get-state')
  ipcMain.handle('optimizer:get-state', async () => buildState())

  ipcMain.removeHandler('optimizer:set-mode')
  ipcMain.handle('optimizer:set-mode', async (_event, mode: OptimizerMode) => {
    if (!MODE_PROFILES[mode]) return buildState()
    settings = {
      ...settings,
      mode,
      reduceAnimations: mode === 'eco' ? true : settings.reduceAnimations,
      batterySaver: mode === 'eco' ? true : settings.batterySaver
    }
    saveSettings(app, settings)
    scheduleMonitor()
    broadcastPolicy()
    return buildState()
  })

  ipcMain.removeHandler('optimizer:update-settings')
  ipcMain.handle('optimizer:update-settings', async (_event, patch: Partial<OptimizerSettings>) => {
    settings = {
      ...settings,
      ...patch,
      thresholds: {
        ...settings.thresholds,
        ...(patch?.thresholds || {})
      }
    }
    saveSettings(app, settings)
    scheduleMonitor()
    broadcastPolicy()
    return buildState()
  })

  ipcMain.removeHandler('optimizer:quick-action')
  ipcMain.handle('optimizer:quick-action', async (_event, action: OptimizerAction) => {
    if (action === 'enable-eco') {
      settings = { ...settings, mode: 'eco', reduceAnimations: true, batterySaver: true }
    }
    if (action === 'enable-balanced') settings = { ...settings, mode: 'balanced' }
    if (action === 'enable-turbo') settings = { ...settings, mode: 'turbo', reduceAnimations: false }
    if (action === 'reduce-visuals') settings = { ...settings, reduceAnimations: true }
    if (action === 'pause-vision') settings = { ...settings, pauseVisionWhenIdle: true }
    if (action === 'battery-saver') {
      settings = { ...settings, mode: 'eco', batterySaver: true, reduceAnimations: true }
    }
    if (action === 'clear-cache') {
      await getMainWindow()?.webContents.session.clearCache()
    }
    if (action === 'open-task-manager') {
      await shell.openPath('C:\\Windows\\System32\\Taskmgr.exe')
    }

    saveSettings(app, settings)
    scheduleMonitor()
    broadcastPolicy()
    return buildState()
  })

  scheduleMonitor()
}
