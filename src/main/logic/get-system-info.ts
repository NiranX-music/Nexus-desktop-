import { IpcMain } from 'electron'
import os from 'os'
import { exec, execFile } from 'child_process'

const runCommand = (cmd: string): Promise<string> => {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10, windowsHide: true }, (error, stdout) => {
      if (error) {
      }
      resolve(stdout ? stdout.trim() : '')
    })
  })
}

const runPowerShell = (script: string): Promise<string> => {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { maxBuffer: 1024 * 1024 * 10, windowsHide: true },
      (error, stdout) => {
        if (error) {
        }
        resolve(stdout ? stdout.trim() : '')
      }
    )
  })
}

interface BatterySnapshot {
  isPresent: boolean
  percentage: number | null
  isCharging: boolean
  isOnBattery: boolean
  status: string
  estimatedMinutes: number | null
}

interface HardwareSnapshot {
  battery: BatterySnapshot
  temperature: number | null
  osCaption: string | null
  updatedAt: number
}

interface NetworkSnapshot {
  rxBytesPerSecond: number
  txBytesPerSecond: number
  totalBytesPerSecond: number
  activeInterfaces: number
  updatedAt: number
}

let cpuLastSnapshot = os.cpus()
const HARDWARE_CACHE_MS = 30_000
const NETWORK_CACHE_MS = 5_000
const SYSTEM_STATS_CACHE_MS = 4_000

const defaultBattery: BatterySnapshot = {
  isPresent: false,
  percentage: null,
  isCharging: false,
  isOnBattery: false,
  status: 'No battery',
  estimatedMinutes: null
}

let hardwareCache: HardwareSnapshot = {
  battery: defaultBattery,
  temperature: null,
  osCaption: null,
  updatedAt: 0
}

let hardwareRequest: Promise<HardwareSnapshot> | null = null

let networkCache: NetworkSnapshot = {
  rxBytesPerSecond: 0,
  txBytesPerSecond: 0,
  totalBytesPerSecond: 0,
  activeInterfaces: 0,
  updatedAt: 0
}

let networkRequest: Promise<NetworkSnapshot> | null = null

type SystemStatsSnapshot = {
  cpu: string
  memory: {
    total: string
    free: string
    usedPercentage: string
  }
  temperature: number | null
  battery: BatterySnapshot
  network: NetworkSnapshot
  os: {
    type: string
    release: string
    arch: string
    uptime: string
  }
}

let systemStatsCache: (SystemStatsSnapshot & { updatedAt: number }) | null = null
let systemStatsRequest: Promise<SystemStatsSnapshot> | null = null

function getSystemCpuUsage() {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (let i = 0; i < cpus.length; i++) {
    const cpu = cpus[i]
    const prevCpu = cpuLastSnapshot[i]
    let currentTotal = 0
    for (const type in cpu.times) currentTotal += cpu.times[type]
    let prevTotal = 0
    for (const type in prevCpu.times) prevTotal += prevCpu.times[type]
    idle += cpu.times.idle - prevCpu.times.idle
    total += currentTotal - prevTotal
  }
  cpuLastSnapshot = cpus
  return total === 0 ? '0.0' : (((total - idle) / total) * 100).toFixed(1)
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function asFiniteNumber(value: unknown): number | null {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function clampPercentage(value: unknown): number | null {
  const percent = asFiniteNumber(value)
  if (percent === null) return null
  return Math.max(0, Math.min(100, Math.round(percent)))
}

function getBatteryStatus(statusCode: number | null): string {
  switch (statusCode) {
    case 1:
      return 'Discharging'
    case 2:
      return 'AC power'
    case 3:
      return 'Fully charged'
    case 4:
      return 'Low'
    case 5:
      return 'Critical'
    case 6:
      return 'Charging'
    case 7:
      return 'Charging high'
    case 8:
      return 'Charging low'
    case 9:
      return 'Charging critical'
    case 11:
      return 'Partially charged'
    default:
      return 'Unknown'
  }
}

function parseTemperature(rawThermal: any): number | null {
  const readings = toArray(rawThermal)
    .map((item: any) => asFiniteNumber(item?.CurrentTemperature))
    .filter((value): value is number => value !== null)
    .map((kelvinTenths) => Number((kelvinTenths / 10 - 273.15).toFixed(1)))
    .filter((celsius) => celsius > 0 && celsius < 120)

  if (readings.length === 0) return null
  return Number((readings.reduce((sum, value) => sum + value, 0) / readings.length).toFixed(1))
}

function parseBattery(rawBattery: any): BatterySnapshot {
  const battery = toArray(rawBattery)[0] as any
  if (!battery) return defaultBattery

  const statusCode = asFiniteNumber(battery.BatteryStatus)
  const percentage = clampPercentage(battery.EstimatedChargeRemaining)
  const estimatedMinutes = asFiniteNumber(battery.EstimatedRunTime)
  const chargingStates = new Set([6, 7, 8, 9])
  const batteryStates = new Set([1, 4, 5])

  return {
    isPresent: true,
    percentage,
    isCharging: statusCode !== null && chargingStates.has(statusCode),
    isOnBattery: statusCode !== null && batteryStates.has(statusCode),
    status: getBatteryStatus(statusCode),
    estimatedMinutes:
      estimatedMinutes !== null && estimatedMinutes > 0 && estimatedMinutes < 71582788
        ? Math.round(estimatedMinutes)
        : null
  }
}

async function getHardwareSnapshot(): Promise<HardwareSnapshot> {
  const now = Date.now()
  if (now - hardwareCache.updatedAt < HARDWARE_CACHE_MS) return hardwareCache
  if (hardwareRequest) return hardwareRequest

  const script = `
$battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue |
  Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus,EstimatedRunTime
$thermal = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue |
  Select-Object CurrentTemperature
$osInfo = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue |
  Select-Object -First 1 Caption,Version
[pscustomobject]@{
  battery = $battery
  thermal = $thermal
  osInfo = $osInfo
} | ConvertTo-Json -Depth 5 -Compress
`

  hardwareRequest = runPowerShell(script)
    .then((output) => {
      if (!output) {
        hardwareCache = { ...hardwareCache, updatedAt: Date.now() }
        return hardwareCache
      }

      const parsed = JSON.parse(output)
      const osCaption =
        typeof parsed?.osInfo?.Caption === 'string'
          ? parsed.osInfo.Caption.replace(/^Microsoft\s+/i, '').trim()
          : null

      hardwareCache = {
        battery: parseBattery(parsed?.battery),
        temperature: parseTemperature(parsed?.thermal),
        osCaption,
        updatedAt: Date.now()
      }
      return hardwareCache
    })
    .catch(() => {
      hardwareCache = { ...hardwareCache, updatedAt: Date.now() }
      return hardwareCache
    })
    .finally(() => {
      hardwareRequest = null
    })

  return hardwareRequest
}

async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  const now = Date.now()
  if (now - networkCache.updatedAt < NETWORK_CACHE_MS) return networkCache
  if (networkRequest) return networkRequest

  const script = `
Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -notmatch 'Loopback|isatap|Teredo|Pseudo|Bluetooth' -and
    ($_.BytesReceivedPersec -gt 0 -or $_.BytesSentPersec -gt 0)
  } |
  Select-Object Name,BytesReceivedPersec,BytesSentPersec |
  ConvertTo-Json -Depth 4 -Compress
`

  networkRequest = runPowerShell(script)
    .then((output) => {
      if (!output) {
        networkCache = { ...networkCache, updatedAt: Date.now() }
        return networkCache
      }

      const adapters = toArray(JSON.parse(output))
      const totals = adapters.reduce(
        (sum, adapter: any) => {
          const rx = asFiniteNumber(adapter?.BytesReceivedPersec) ?? 0
          const tx = asFiniteNumber(adapter?.BytesSentPersec) ?? 0
          return {
            rxBytesPerSecond: sum.rxBytesPerSecond + rx,
            txBytesPerSecond: sum.txBytesPerSecond + tx
          }
        },
        { rxBytesPerSecond: 0, txBytesPerSecond: 0 }
      )

      networkCache = {
        rxBytesPerSecond: Math.round(totals.rxBytesPerSecond),
        txBytesPerSecond: Math.round(totals.txBytesPerSecond),
        totalBytesPerSecond: Math.round(totals.rxBytesPerSecond + totals.txBytesPerSecond),
        activeInterfaces: adapters.length,
        updatedAt: Date.now()
      }
      return networkCache
    })
    .catch(() => {
      networkCache = { ...networkCache, updatedAt: Date.now() }
      return networkCache
    })
    .finally(() => {
      networkRequest = null
    })

  return networkRequest
}

function formatUptime(seconds: number): string {
  const hours = seconds / 3600
  if (hours < 48) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

async function getSystemStatsSnapshot(): Promise<SystemStatsSnapshot> {
  const now = Date.now()
  if (systemStatsCache && now - systemStatsCache.updatedAt < SYSTEM_STATS_CACHE_MS) {
    const { updatedAt: _updatedAt, ...snapshot } = systemStatsCache
    return snapshot
  }

  if (systemStatsRequest) return systemStatsRequest

  systemStatsRequest = Promise.all([getHardwareSnapshot(), getNetworkSnapshot()])
    .then(([hardware, network]) => {
      const totalMem = os.totalmem()
      const freeMem = os.freemem()

      const snapshot: SystemStatsSnapshot = {
        cpu: getSystemCpuUsage(),
        memory: {
          total: (totalMem / 1024 ** 3).toFixed(1) + ' GB',
          free: (freeMem / 1024 ** 3).toFixed(1) + ' GB',
          usedPercentage: (((totalMem - freeMem) / totalMem) * 100).toFixed(1)
        },
        temperature: hardware.temperature,
        battery: hardware.battery,
        network,
        os: {
          type: hardware.osCaption || `${os.type()} ${os.release()}`,
          release: os.release(),
          arch: os.arch(),
          uptime: formatUptime(os.uptime())
        }
      }

      systemStatsCache = {
        ...snapshot,
        updatedAt: Date.now()
      }

      return snapshot
    })
    .finally(() => {
      systemStatsRequest = null
    })

  return systemStatsRequest
}

export default function registerSystemHandlers(ipcMain: IpcMain) {
  ipcMain.removeHandler('get-installed-apps')
  ipcMain.handle('get-installed-apps', async () => {
    try {
      if (os.platform() !== 'win32') return []

      const cmd = `powershell "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Depth 1"`

      const jsonOutput = await runCommand(cmd)

      if (!jsonOutput) return []

      let rawData
      try {
        rawData = JSON.parse(jsonOutput)
      } catch (parseError) {
        return []
      }

      const appsArray = Array.isArray(rawData) ? rawData : [rawData]

      return appsArray
        .filter((a: any) => a && a.Name && a.AppID)
        .map((a: any) => ({
          name: a.Name.trim(),
          id: a.AppID.trim()
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch (e) {
      return []
    }
  })

  ipcMain.removeHandler('get-system-stats')
  ipcMain.handle('get-system-stats', async () => {
    return getSystemStatsSnapshot()
  })

  ipcMain.removeHandler('get-drives')
  ipcMain.handle('get-drives', async () => {
    try {
      const cmd = `powershell "Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='FreeGB';E={[math]::round($_.Free/1GB, 2)}}, @{N='TotalGB';E={[math]::round(($_.Used + $_.Free)/1GB, 2)}} | ConvertTo-Json"`
      const output = await runCommand(cmd)
      return output ? JSON.parse(output) : []
    } catch (e) {
      return []
    }
  })
}
