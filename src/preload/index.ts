import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {}

const allowedInvokeChannels = new Set([
  'add-message',
  'adb-close-app',
  'adb-connect',
  'adb-disconnect',
  'adb-get-history',
  'adb-get-notifications',
  'adb-hardware-toggle',
  'adb-open-app',
  'adb-pull-file',
  'adb-push-file',
  'adb-quick-action',
  'adb-screenshot',
  'adb-swipe',
  'adb-tap',
  'adb-telemetry',
  'browser-control:run',
  'browser-control:serverless-run',
  'build-animated-website',
  'cancel-ingestion',
  'check-and-download-update',
  'check-for-updates',
  'check-keys-exist',
  'check-vault-status',
  'close-app',
  'close-widgets',
  'close-wormhole',
  'consult-oracle',
  'copy-file-to-clipboard',
  'create-directory',
  'create-widget',
  'delete-image',
  'delete-note',
  'delete-workflow',
  'download-update',
  'email-auth:login',
  'email-auth:logout',
  'email-auth:register',
  'email-auth:verify-session',
  'execute-deep-research',
  'file-ops',
  'file:open',
  'file:reveal',
  'get-app-version',
  'get-drives',
  'get-gallery',
  'get-history',
  'get-installed-apps',
  'get-live-location',
  'get-mobile-info-ai',
  'get-notes',
  'get-personality',
  'get-running-apps',
  'get-screen-size',
  'get-screen-source',
  'get-system-stats',
  'get-update-feed-url',
  'ghost-click-coordinate',
  'ghost-drag-and-drop',
  'ghost-scroll',
  'ghost-sequence',
  'gmail-draft',
  'gmail-read',
  'gmail-send',
  'google-search',
  'hack-website',
  'index-folder',
  'ingest-codebase',
  'install-update',
  'load-workflows',
  'mandatory-update:status',
  'media:control',
  'media:get-sessions',
  'move-file-to-category',
  'nvidia:api-status',
  'nvidia:chat-completion',
  'nvidia:list-models',
  'open-app',
  'open-image-location',
  'open-in-vscode',
  'open-wormhole',
  'optimizer:get-state',
  'optimizer:quick-action',
  'optimizer:set-mode',
  'optimizer:update-settings',
  'read-directory',
  'read-file',
  'run-shell-command',
  'save-core-memory',
  'save-image-external',
  'save-image-to-gallery',
  'save-note',
  'save-workflow',
  'search-core-memory',
  'search-files',
  'secure-get-keys',
  'secure-save-keys',
  'set-personality',
  'set-volume',
  'setup-vault-face',
  'setup-vault-pass',
  'setup-vault-pin',
  'spawn-drop-zone-ui',
  'start-live-coding',
  'take-screenshot',
  'teleport-windows',
  'verify-vault-face',
  'verify-vault-pass',
  'verify-vault-pin',
  'write-file'
])

const allowedSendChannels = new Set([
  'overlay-dock:set-expanded',
  'toggle-overlay',
  'trigger-lockdown',
  'window-close',
  'window-max',
  'window-min'
])

const allowedReceiveChannels = new Set([
  'cloud-auth-callback',
  'live-code-chunk',
  'oauth-callback',
  'optimizer-policy-updated',
  'optimizer-state',
  'oracle-progress',
  'overlay-mode',
  'semantic-progress',
  'terminal-data',
  'updater-event'
])

const isAllowed = (channels: Set<string>, channel: string) => channels.has(channel)

const safeIpcRenderer = {
  invoke: (channel: string, ...args: any[]) => {
    if (!isAllowed(allowedInvokeChannels, channel)) {
      return Promise.reject(new Error(`Blocked unauthorized IPC invoke: ${channel}`))
    }

    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel: string, ...args: any[]) => {
    if (!isAllowed(allowedSendChannels, channel)) return
    ipcRenderer.send(channel, ...args)
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    if (!isAllowed(allowedReceiveChannels, channel)) return () => {}

    const wrappedListener = (_event: IpcRendererEvent, ...args: any[]) => {
      listener(undefined, ...args)
    }

    ipcRenderer.on(channel, wrappedListener)
    return () => ipcRenderer.removeListener(channel, wrappedListener)
  },
  once: (channel: string, listener: (...args: any[]) => void) => {
    if (!isAllowed(allowedReceiveChannels, channel)) return

    ipcRenderer.once(channel, (_event, ...args) => {
      listener(undefined, ...args)
    })
  },
  removeAllListeners: (channel: string) => {
    if (!isAllowed(allowedReceiveChannels, channel)) return
    ipcRenderer.removeAllListeners(channel)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      ipcRenderer: safeIpcRenderer
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {}
} else {
  // @ts-ignore (define in dts)
  window.electron = {
    ...electronAPI,
    ipcRenderer: safeIpcRenderer
  }
  // @ts-ignore (define in dts)
  window.api = api
}
