import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI & {
      webFrame?: {
        setZoomFactor(factor: number): void
        getZoomFactor(): number
        setZoomLevel(level: number): void
        getZoomLevel(): number
      }
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>
        send(channel: string, ...args: any[]): void
        on(channel: string, func: (...args: any[]) => void): () => void
        removeAllListeners(channel: string): void
        removeListener(channel: string, func: (...args: any[]) => void): void
      }
    }
    api: unknown
  }
}
