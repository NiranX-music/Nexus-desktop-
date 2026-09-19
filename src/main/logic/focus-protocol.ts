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

  // Terminate distracting blacklisted processes
  const purgeDistractions = async (blacklist = DEFAULT_BLACKLIST): Promise<string[]> => {
    if (process.platform !== 'win32') return []
    const terminated: string[] = []

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
    return terminated
  }

  // Start deep work protocol
  ipcMain.handle(
    'focus-start-session',
    async (_event, payload?: { minutes?: number; blacklist?: string[] }) => {
      const minutes = payload?.minutes || 25
      const blacklist = payload?.blacklist || DEFAULT_BLACKLIST

      const terminated = await purgeDistractions(blacklist)

      session.isActive = true
      session.startTime = Date.now()
      session.plannedMinutes = minutes
      session.blockedAppsTerminated = [...session.blockedAppsTerminated, ...terminated]

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
