import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI & {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>
        send(channel: string, ...args: any[]): void
        once(channel: string, func: (...args: any[]) => void): void
        on(channel: string, func: (...args: any[]) => void): () => void
        removeAllListeners(channel: string): void
      }
    }
    api: unknown
  }
}
