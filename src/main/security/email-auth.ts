import { ipcMain } from 'electron'
import Store from 'electron-store'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes, randomUUID } from 'crypto'

type EmailUser = {
  id: string
  name: string
  email: string
  passwordHash: string
  createdAt: string
  lastLoginAt?: string
}

type EmailSession = {
  userId: string
  tokenHash: string
  createdAt: string
  expiresAt: string
}

const StoreClass = (Store as any).default || Store
const store = new StoreClass()
const USERS_KEY = 'nexus_email_auth_users'
const SESSIONS_KEY = 'nexus_email_auth_sessions'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

const normalizeEmail = (email: string) => email.trim().toLowerCase()
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const publicUser = (user: EmailUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt
})

const getUsers = () => ((store.get(USERS_KEY) as EmailUser[] | undefined) || [])
const setUsers = (users: EmailUser[]) => store.set(USERS_KEY, users)
const getSessions = () => ((store.get(SESSIONS_KEY) as EmailSession[] | undefined) || [])
const setSessions = (sessions: EmailSession[]) => store.set(SESSIONS_KEY, sessions)

const createSession = (userId: string) => {
  const token = `nexus_email_${randomBytes(32).toString('hex')}`
  const now = new Date()
  const session: EmailSession = {
    userId,
    tokenHash: tokenHash(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString()
  }

  const sessions = getSessions().filter((item) => new Date(item.expiresAt).getTime() > Date.now())
  sessions.push(session)
  setSessions(sessions)

  return token
}

export default function registerEmailAuth() {
  ipcMain.handle('email-auth:register', async (_, payload: { name: string; email: string; password: string }) => {
    const name = payload.name?.trim()
    const email = normalizeEmail(payload.email || '')
    const password = payload.password || ''

    if (!name || name.length < 2) {
      return { ok: false, error: 'Enter a display name.' }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Enter a valid email address.' }
    }
    if (password.length < 8) {
      return { ok: false, error: 'Use at least 8 characters for your password.' }
    }

    const users = getUsers()
    if (users.some((user) => user.email === email)) {
      return { ok: false, error: 'An account already exists for this email.' }
    }

    const now = new Date().toISOString()
    const passwordHash = await bcrypt.hash(password, 12)
    const user: EmailUser = {
      id: randomUUID(),
      name,
      email,
      passwordHash,
      createdAt: now,
      lastLoginAt: now
    }

    users.push(user)
    setUsers(users)

    return { ok: true, token: createSession(user.id), user: publicUser(user) }
  })

  ipcMain.handle('email-auth:login', async (_, payload: { email: string; password: string }) => {
    const email = normalizeEmail(payload.email || '')
    const password = payload.password || ''
    const users = getUsers()
    const user = users.find((item) => item.email === email)

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return { ok: false, error: 'Email or password is incorrect.' }
    }

    user.lastLoginAt = new Date().toISOString()
    setUsers(users)

    return { ok: true, token: createSession(user.id), user: publicUser(user) }
  })

  ipcMain.handle('email-auth:verify-session', (_, token: string) => {
    if (!token) return { ok: false }

    const hash = tokenHash(token)
    const now = Date.now()
    const sessions = getSessions().filter((session) => new Date(session.expiresAt).getTime() > now)
    const session = sessions.find((item) => item.tokenHash === hash)
    setSessions(sessions)

    if (!session) return { ok: false }

    const user = getUsers().find((item) => item.id === session.userId)
    if (!user) return { ok: false }

    return { ok: true, user: publicUser(user) }
  })

  ipcMain.handle('email-auth:logout', (_, token: string) => {
    if (!token) return true

    const hash = tokenHash(token)
    setSessions(getSessions().filter((session) => session.tokenHash !== hash))
    return true
  })
}
