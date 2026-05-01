import { ipcMain } from 'electron'
import Store from 'electron-store'
import bcrypt from 'bcryptjs'

const StoreClass = (Store as any).default || Store
const store = new StoreClass()
const MIN_VAULT_PASS_LENGTH = 4

const isValidVaultSecret = (secret: unknown) =>
  typeof secret === 'string' && secret.trim().length >= MIN_VAULT_PASS_LENGTH

const saveVaultSecret = async (secret: string) => {
  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hash(secret, salt)
  store.set('nexus_vault_hash', hash)
  return true
}

const verifyVaultSecret = async (secret: string) => {
  const hash = store.get('nexus_vault_hash') as string
  if (!hash) return false
  return await bcrypt.compare(secret, hash)
}

export default function registerSecurityVault() {
  const legacyFace = store.get('nexus_vault_face') as number[] | undefined
  if (legacyFace && !store.get('nexus_vault_faces')) {
    store.set('nexus_vault_faces', [legacyFace])
    store.delete('nexus_vault_face')
  }

  ipcMain.handle('check-vault-status', () => {
    const hasPin = !!store.get('nexus_vault_hash')
    const faces = store.get('nexus_vault_faces') as number[][] | undefined
    const hasFace = faces && faces.length > 0
    return { hasPin, hasDefaultPass: hasPin, hasFace, faceCount: faces ? faces.length : 0 }
  })

  ipcMain.handle('get-personality', () => {
    return store.get('nexus_personality') as string | undefined
  })

  ipcMain.handle('set-personality', (_, text: string) => {
    store.set('nexus_personality', text)
    return true
  })

  ipcMain.handle('setup-vault-pin', async (_, pin: string) => {
    if (!isValidVaultSecret(pin)) return false
    return await saveVaultSecret(pin)
  })

  ipcMain.handle('verify-vault-pin', async (_, pin: string) => {
    if (typeof pin !== 'string') return false
    return await verifyVaultSecret(pin)
  })

  ipcMain.handle('setup-vault-pass', async (_, pass: string) => {
    if (!isValidVaultSecret(pass)) return false
    return await saveVaultSecret(pass)
  })

  ipcMain.handle('verify-vault-pass', async (_, pass: string) => {
    if (typeof pass !== 'string') return false
    return await verifyVaultSecret(pass)
  })

  ipcMain.handle('setup-vault-face', (_, descriptor: number[]) => {
    const faces = (store.get('nexus_vault_faces') as number[][]) || []
    faces.push(descriptor)
    store.set('nexus_vault_faces', faces)
    return true
  })

  ipcMain.handle('verify-vault-face', (_, descriptor: number[]) => {
    const faces = store.get('nexus_vault_faces') as number[][] | undefined
    if (!faces || faces.length === 0) return false

    for (const savedFace of faces) {
      if (savedFace.length !== 128) continue
      let distance = 0
      for (let i = 0; i < descriptor.length; i++) {
        distance += Math.pow(descriptor[i] - savedFace[i], 2)
      }
      distance = Math.sqrt(distance)

      if (distance < 0.55) return true
    }
    return false
  })
}
