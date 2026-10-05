import { IpcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface FocusSession {
  isActive: boolean
  startTime: number | null
  plannedMinutes: number
  blockedAppsTerminated: string[]
  completedSessions: number
  totalFocusMinutes: number
}

const DEFAULT_BLACKLIST = [
  'Discord',
  'Steam',
  'EpicGamesLauncher',
  'Battle.net',
  'Telegram',
  'WhatsApp',
  'TikTok',
  'Spotify'
]

export default function registerFocusProtocol(ipcMain: IpcMain) {
  const session: FocusSession = {
    isActive: false,
    startTime: null,
    plannedMinutes: 25,
    blockedAppsTerminated: [],
    completedSessions: 0,
    totalFocusMinutes: 0
  }

  let activeBlacklist: string[] = DEFAULT_BLACKLIST
  let shieldTimer: NodeJS.Timeout | null = null

  // Terminate distracting blacklisted processes across platforms
  const purgeDistractions = async (blacklist = activeBlacklist): Promise<string[]> => {
    const terminated: string[] = []

    if (process.platform === 'win32') {
      for (const appName of blacklist) {
        try {
          const { stdout } = await execAsync(`taskkill /F /IM ${appName}.exe 2>nul || exit 0`)
          if (stdout && stdout.toLowerCase().includes('success')) {
            terminated.push(appName)
          }
        } catch {
          // Ignored if process was not running
        }
      }
    } else if (process.platform === 'darwin' || process.platform === 'linux') {
      for (const appName of blacklist) {
        try {
          await execAsync(`pkill -f -i "${appName}" || true`)
          terminated.push(appName)
        } catch {
          // Ignored
        }
      }
    }

    return terminated
  }

  const stopShield = () => {
    if (shieldTimer) {
      clearInterval(shieldTimer)
      shieldTimer = null
    }
  }

  const startShield = () => {
    stopShield()
    shieldTimer = setInterval(async () => {
      if (!session.isActive || !session.startTime) {
        stopShield()
        return
      }

      // Check if session duration has completed
      const elapsedMs = Date.now() - session.startTime
      const totalPlannedMs = session.plannedMinutes * 60 * 1000

      if (elapsedMs >= totalPlannedMs) {
        session.completedSessions += 1
        session.totalFocusMinutes += session.plannedMinutes
        session.isActive = false
        session.startTime = null
        stopShield()
        return
      }

      // Active distraction shield enforcement
      const newlyTerminated = await purgeDistractions(activeBlacklist)
      if (newlyTerminated.length > 0) {
        session.blockedAppsTerminated = Array.from(
          new Set([...session.blockedAppsTerminated, ...newlyTerminated])
        )
      }
    }, 15000)
  }

  // Start deep work protocol
  ipcMain.handle(
    'focus-start-session',
    async (_event, payload?: { minutes?: number; blacklist?: string[] }) => {
      const minutes = payload?.minutes || 25
      activeBlacklist = payload?.blacklist || DEFAULT_BLACKLIST

      const terminated = await purgeDistractions(activeBlacklist)

      session.isActive = true
      session.startTime = Date.now()
      session.plannedMinutes = minutes
      session.blockedAppsTerminated = Array.from(
        new Set([...session.blockedAppsTerminated, ...terminated])
      )

      startShield()

      return {
        success: true,
        session: {
          isActive: session.isActive,
          startTime: session.startTime,
          plannedMinutes: session.plannedMinutes,
          terminatedApps: terminated
        }
      }
    }
  )

  // Get current status
  ipcMain.handle('focus-get-status', async () => {
    let elapsedMinutes = 0
    if (session.isActive && session.startTime) {
      elapsedMinutes = Math.floor((Date.now() - session.startTime) / 60000)
    }

    return {
      success: true,
      session: {
        ...session,
        elapsedMinutes
      },
      defaultBlacklist: DEFAULT_BLACKLIST
    }
  })

  // Stop / abort focus session
  ipcMain.handle('focus-stop-session', async () => {
    stopShield()

    if (session.isActive && session.startTime) {
      const elapsed = Math.max(1, Math.floor((Date.now() - session.startTime) / 60000))
      session.totalFocusMinutes += elapsed
      session.completedSessions += 1
    }

    session.isActive = false
    session.startTime = null

    return {
      success: true,
      totalFocusMinutes: session.totalFocusMinutes,
      completedSessions: session.completedSessions
    }
  })
}
