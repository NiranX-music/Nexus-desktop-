import { app, BrowserWindow, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { spawn } from 'child_process'
import { URL } from 'url'

export interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
  content_type?: string
}

export interface GitHubReleasePayload {
  tag_name: string
  name: string
  body?: string
  published_at?: string
  assets: GitHubAsset[]
}

export interface UpdateManifest {
  version: string
  releaseName: string
  releaseNotes: string
  assetName: string
  assetUrl: string
  filePath: string
  fileSize: number
  downloadedAt: number
  readyToInstall: boolean
  deferred?: boolean
}

export interface UpdateStatusData {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  currentVersion: string
  latestVersion?: string
  releaseName?: string
  releaseNotes?: string
  assetName?: string
  assetUrl?: string
  assetSize?: number
  filePath?: string
  downloadProgress?: number
  isDownloaded: boolean
  deferred?: boolean
  error?: string
}

class NexusUpdater {
  private repo = process.env.NEXUS_GITHUB_REPO || 'NiranX-music/Nexus-desktop-'
  private mainWindow: BrowserWindow | null = null
  private currentStatus: UpdateStatusData = {
    status: 'idle',
    currentVersion: app.getVersion(),
    isDownloaded: false
  }
  private activeDownloadPromise: Promise<{ success: boolean; filePath?: string; error?: string }> | null = null
  private activeDownloadRequest: http.ClientRequest | null = null
  private cachedManifest: UpdateManifest | null = null

  public init(window: BrowserWindow): void {
    this.mainWindow = window
    this.loadManifest()
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  private getUpdatesDir(): string {
    const dir = path.join(app.getPath('userData'), 'nexus_updates')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  private getManifestPath(): string {
    return path.join(this.getUpdatesDir(), 'update_manifest.json')
  }

  private loadManifest(): UpdateManifest | null {
    try {
      const manifestPath = this.getManifestPath()
      if (fs.existsSync(manifestPath)) {
        const raw = fs.readFileSync(manifestPath, 'utf8')
        const parsed: UpdateManifest = JSON.parse(raw)
        if (parsed.filePath && fs.existsSync(parsed.filePath)) {
          const stat = fs.statSync(parsed.filePath)
          if (stat.size > 0) {
            this.cachedManifest = parsed
            this.currentStatus = {
              status: 'downloaded',
              currentVersion: app.getVersion(),
              latestVersion: parsed.version,
              releaseName: parsed.releaseName,
              releaseNotes: parsed.releaseNotes,
              assetName: parsed.assetName,
              assetUrl: parsed.assetUrl,
              assetSize: parsed.fileSize,
              filePath: parsed.filePath,
              isDownloaded: true,
              deferred: parsed.deferred
            }
            return parsed
          }
        }
      }
    } catch (err) {
      console.warn('[NexusUpdater] Failed to load local update manifest:', err)
    }
    this.cachedManifest = null
    return null
  }

  private saveManifest(manifest: UpdateManifest): void {
    try {
      this.cachedManifest = manifest
      fs.writeFileSync(this.getManifestPath(), JSON.stringify(manifest, null, 2), 'utf8')
    } catch (err) {
      console.error('[NexusUpdater] Failed to save manifest:', err)
    }
  }

  private sendEvent(status: string, data: Record<string, unknown> = {}, error = ''): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater-event', { status, data, error })
    }
  }

  public compareVersions(a: string, b: string): number {
    const cleanA = a.replace(/^v/i, '').trim()
    const cleanB = b.replace(/^v/i, '').trim()
    const partsA = cleanA.split(/[.-]/).map((p) => parseInt(p, 10) || 0)
    const partsB = cleanB.split(/[.-]/).map((p) => parseInt(p, 10) || 0)
    const len = Math.max(partsA.length, partsB.length)

    for (let i = 0; i < len; i++) {
      const segA = partsA[i] || 0
      const segB = partsB[i] || 0
      if (segA > segB) return 1
      if (segA < segB) return -1
    }
    return 0
  }

  private fetchUrlText(targetUrl: string, redirectCount = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects while checking update.'))
        return
      }

      const client = targetUrl.startsWith('https') ? https : http
      const options: https.RequestOptions = {
        headers: {
          'User-Agent': 'Nexus-AI-Desktop-Updater/2.2.0',
          Accept: 'application/vnd.github.v3+json, text/plain, */*'
        },
        timeout: 10000
      }

      const req = client.get(targetUrl, options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, targetUrl).toString()
          resolve(this.fetchUrlText(nextUrl, redirectCount + 1))
          return
        }

        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`GitHub server responded with HTTP ${res.statusCode || 'unknown'}`))
          return
        }

        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => resolve(body))
      })

      req.on('timeout', () => {
        req.destroy(new Error('Update request timed out.'))
      })
      req.on('error', reject)
    })
  }

  public async checkForUpdates(forceCheck = false): Promise<UpdateStatusData> {
    this.sendEvent('checking')
    this.currentStatus.status = 'checking'

    // Check if we already have a downloaded update saved locally
    const existing = this.loadManifest()
    const currentVersion = app.getVersion()

    try {
      const apiUrl = `https://api.github.com/repos/${this.repo}/releases/latest`
      let releaseInfo: GitHubReleasePayload | null = null

      try {
        const jsonText = await this.fetchUrlText(apiUrl)
        releaseInfo = JSON.parse(jsonText)
      } catch (apiErr) {
        console.warn('[NexusUpdater] GitHub API failed, attempting fallback to latest.yml:', apiErr)
        // Fallback directly to raw latest.yml on GitHub releases (bypasses GitHub REST API rate limits)
        const ymlUrl = `https://github.com/${this.repo}/releases/latest/download/latest.yml`
        const ymlText = await this.fetchUrlText(ymlUrl)
        const versionMatch = ymlText.match(/^version:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1]?.trim()
        const pathMatch = ymlText.match(/^path:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1]?.trim()
        if (versionMatch) {
          const assetName = pathMatch || `nexus-ai-${versionMatch}-setup.exe`
          releaseInfo = {
            tag_name: `v${versionMatch}`,
            name: `Nexus AI ${versionMatch}`,
            body: `Nexus AI ${versionMatch} update released on GitHub.`,
            assets: [
              {
                name: assetName,
                browser_download_url: `https://github.com/${this.repo}/releases/download/v${versionMatch}/${assetName}`,
                size: 0
              }
            ]
          }
        }
      }

      if (!releaseInfo || !releaseInfo.tag_name) {
        throw new Error('Unable to parse release information from GitHub.')
      }

      const latestVersion = releaseInfo.tag_name.replace(/^v/i, '').trim()
      const isNewer = this.compareVersions(latestVersion, currentVersion) > 0 || forceCheck

      // Pick platform-appropriate installer asset
      const platform = process.platform
      let matchingAsset: GitHubAsset | undefined

      if (platform === 'win32') {
        matchingAsset =
          releaseInfo.assets.find((a) => a.name.toLowerCase().endsWith('-setup.exe')) ||
          releaseInfo.assets.find((a) => a.name.toLowerCase().endsWith('setup.exe')) ||
          releaseInfo.assets.find((a) => a.name.toLowerCase().endsWith('.exe'))
      } else if (platform === 'darwin') {
        matchingAsset =
          releaseInfo.assets.find((a) => a.name.toLowerCase().endsWith('.dmg')) ||
          releaseInfo.assets.find((a) => a.name.toLowerCase().endsWith('.zip'))
      } else {
        matchingAsset =
          releaseInfo.assets.find((a) => a.name.toLowerCase().endsWith('.appimage')) ||
          releaseInfo.assets.find((a) => a.name.toLowerCase().endsWith('.deb'))
      }

      if (!matchingAsset && releaseInfo.assets.length > 0) {
        matchingAsset = releaseInfo.assets[0]
      }

      const assetName = matchingAsset?.name || `nexus-ai-${latestVersion}-setup.exe`
      const assetUrl =
        matchingAsset?.browser_download_url ||
        `https://github.com/${this.repo}/releases/download/${releaseInfo.tag_name}/${assetName}`
      const assetSize = matchingAsset?.size || 0
      const releaseNotes = releaseInfo.body || `Nexus AI ${latestVersion} update released on GitHub.`

      // Check if this latest version has already been downloaded and preserved
      const targetFilePath = path.join(this.getUpdatesDir(), assetName)
      let alreadyDownloaded = false

      if (fs.existsSync(targetFilePath)) {
        const fileStat = fs.statSync(targetFilePath)
        if (assetSize > 0 ? fileStat.size === assetSize : fileStat.size > 1024 * 1024) {
          alreadyDownloaded = true
          this.cachedManifest = {
            version: latestVersion,
            releaseName: releaseInfo.name || `Nexus AI ${latestVersion}`,
            releaseNotes,
            assetName,
            assetUrl,
            filePath: targetFilePath,
            fileSize: fileStat.size,
            downloadedAt: existing?.downloadedAt || Date.now(),
            readyToInstall: true,
            deferred: existing?.deferred || false
          }
          this.saveManifest(this.cachedManifest)
        }
      }

      if (!isNewer && !alreadyDownloaded) {
        this.currentStatus = {
          status: 'not-available',
          currentVersion,
          latestVersion,
          isDownloaded: false
        }
        this.sendEvent('not-available', { version: latestVersion })
        return this.currentStatus
      }

      if (alreadyDownloaded) {
        this.currentStatus = {
          status: 'downloaded',
          currentVersion,
          latestVersion,
          releaseName: releaseInfo.name || `Nexus AI ${latestVersion}`,
          releaseNotes,
          assetName,
          assetUrl,
          assetSize,
          filePath: targetFilePath,
          isDownloaded: true,
          deferred: this.cachedManifest?.deferred
        }
        this.sendEvent('downloaded', {
          version: latestVersion,
          releaseName: this.currentStatus.releaseName,
          releaseNotes,
          assetName,
          filePath: targetFilePath,
          isDownloaded: true,
          deferred: this.cachedManifest?.deferred
        })
        return this.currentStatus
      }

      // New update available to download
      this.currentStatus = {
        status: 'available',
        currentVersion,
        latestVersion,
        releaseName: releaseInfo.name || `Nexus AI ${latestVersion}`,
        releaseNotes,
        assetName,
        assetUrl,
        assetSize,
        isDownloaded: false
      }
      this.sendEvent('available', {
        version: latestVersion,
        releaseName: this.currentStatus.releaseName,
        releaseNotes,
        assetName,
        assetUrl,
        assetSize
      })
      return this.currentStatus
    } catch (err: any) {
      const errorMsg = err?.message || 'Error checking GitHub releases.'
      console.error('[NexusUpdater] Update check failed:', errorMsg)
      this.currentStatus = {
        status: 'error',
        currentVersion,
        isDownloaded: false,
        error: errorMsg
      }
      this.sendEvent('error', {}, errorMsg)
      return this.currentStatus
    }
  }

  public async downloadUpdate(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (this.currentStatus.isDownloaded && this.currentStatus.filePath) {
      if (fs.existsSync(this.currentStatus.filePath)) {
        this.sendEvent('downloaded', {
          version: this.currentStatus.latestVersion,
          releaseName: this.currentStatus.releaseName,
          releaseNotes: this.currentStatus.releaseNotes,
          assetName: this.currentStatus.assetName,
          filePath: this.currentStatus.filePath,
          isDownloaded: true
        })
        return { success: true, filePath: this.currentStatus.filePath }
      }
    }

    if (this.activeDownloadPromise) {
      return await this.activeDownloadPromise
    }

    // Ensure we have target asset information
    if (!this.currentStatus.assetUrl || !this.currentStatus.assetName) {
      const checkResult = await this.checkForUpdates(true)
      if (!checkResult.assetUrl || !checkResult.assetName) {
        const error = 'No downloadable update package found for this platform.'
        this.sendEvent('error', {}, error)
        return { success: false, error }
      }
    }

    const assetUrl = this.currentStatus.assetUrl!
    const assetName = this.currentStatus.assetName!
    const targetFilePath = path.join(this.getUpdatesDir(), assetName)
    const tempFilePath = `${targetFilePath}.downloading`

    this.sendEvent('downloading', { percent: 0, transferred: 0, total: this.currentStatus.assetSize || 0 })
    this.currentStatus.status = 'downloading'
    this.currentStatus.downloadProgress = 0

    const downloadTask = new Promise<string>((resolve, reject) => {
      const downloadWithRedirects = (currentUrl: string, redirects = 0) => {
        if (redirects > 8) {
          reject(new Error('Too many redirects while downloading update.'))
          return
        }

        const client = currentUrl.startsWith('https') ? https : http
        const options: https.RequestOptions = {
          headers: {
            'User-Agent': 'Nexus-AI-Desktop-Updater/2.2.0',
            Accept: 'application/octet-stream, */*'
          }
        }

        const req = client.get(currentUrl, options, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const nextUrl = new URL(res.headers.location, currentUrl).toString()
            downloadWithRedirects(nextUrl, redirects + 1)
            return
          }

          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`Download failed with HTTP ${res.statusCode || 'unknown'}`))
            return
          }

          const totalBytes =
            parseInt(res.headers['content-length'] || '0', 10) || this.currentStatus.assetSize || 0
          let transferredBytes = 0
          let lastProgressUpdate = Date.now()
          let lastTransferred = 0

          const fileStream = fs.createWriteStream(tempFilePath)

          res.on('data', (chunk: Buffer) => {
            transferredBytes += chunk.length
            const now = Date.now()
            // Throttle progress events to ~250ms
            if (now - lastProgressUpdate > 250 || transferredBytes === totalBytes) {
              const deltaSeconds = (now - lastProgressUpdate) / 1000 || 0.25
              const bytesPerSecond = Math.round((transferredBytes - lastTransferred) / deltaSeconds)
              const percent = totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 50

              this.currentStatus.downloadProgress = percent
              this.sendEvent('downloading', {
                percent,
                transferred: transferredBytes,
                total: totalBytes,
                bytesPerSecond,
                assetName
              })

              lastProgressUpdate = now
              lastTransferred = transferredBytes
            }
          })

          res.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close(() => {
              try {
                // If the target file already exists, remove it first
                if (fs.existsSync(targetFilePath)) {
                  try {
                    fs.unlinkSync(targetFilePath)
                  } catch {}
                }
                fs.renameSync(tempFilePath, targetFilePath)

                const finalStat = fs.statSync(targetFilePath)
                const manifest: UpdateManifest = {
                  version: this.currentStatus.latestVersion || app.getVersion(),
                  releaseName: this.currentStatus.releaseName || `Nexus AI ${this.currentStatus.latestVersion}`,
                  releaseNotes: this.currentStatus.releaseNotes || 'Update downloaded from GitHub.',
                  assetName,
                  assetUrl,
                  filePath: targetFilePath,
                  fileSize: finalStat.size,
                  downloadedAt: Date.now(),
                  readyToInstall: true,
                  deferred: false
                }
                this.saveManifest(manifest)

                this.currentStatus.status = 'downloaded'
                this.currentStatus.filePath = targetFilePath
                this.currentStatus.isDownloaded = true
                this.currentStatus.downloadProgress = 100

                // Emit downloaded event so the app can ask the user "Update & Restart Now" or "Later"
                this.sendEvent('downloaded', {
                  version: manifest.version,
                  releaseName: manifest.releaseName,
                  releaseNotes: manifest.releaseNotes,
                  assetName,
                  filePath: targetFilePath,
                  isDownloaded: true,
                  deferred: false
                })

                resolve(targetFilePath)
              } catch (renameErr) {
                reject(renameErr)
              }
            })
          })

          fileStream.on('error', (err) => {
            try {
              if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
            } catch {}
            reject(err)
          })
        })

        this.activeDownloadRequest = req
        req.on('error', (err) => {
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
          } catch {}
          reject(err)
        })
      }

      downloadWithRedirects(assetUrl)
    })

    this.activeDownloadPromise = downloadTask
      .then((filePath) => {
        this.activeDownloadPromise = null
        this.activeDownloadRequest = null
        return { success: true, filePath }
      })
      .catch((err) => {
        this.activeDownloadPromise = null
        this.activeDownloadRequest = null
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
        } catch {}
        const errorMsg = err?.message || 'Download failed.'
        console.error('[NexusUpdater] Download error:', errorMsg)
        this.currentStatus.status = 'error'
        this.currentStatus.error = errorMsg
        this.sendEvent('error', {}, errorMsg)
        return { success: false, error: errorMsg }
      })

    return await this.activeDownloadPromise
  }

  public deferUpdate(): { success: boolean } {
    if (this.cachedManifest) {
      this.cachedManifest.deferred = true
      this.saveManifest(this.cachedManifest)
    }
    this.currentStatus.deferred = true
    this.sendEvent('update-deferred', {
      version: this.currentStatus.latestVersion,
      filePath: this.currentStatus.filePath
    })
    return { success: true }
  }

  public installUpdate(): { success: boolean; error?: string } {
    const filePath = this.currentStatus.filePath || this.cachedManifest?.filePath

    if (!filePath || !fs.existsSync(filePath)) {
      const error = 'No downloaded installer found on disk. Please download update first.'
      this.sendEvent('error', {}, error)
      return { success: false, error }
    }

    try {
      console.log('[NexusUpdater] Launching installer:', filePath)

      // Keep the file on disk (it is preserved in userData/nexus_updates)
      // Execute the installer detached
      if (process.platform === 'win32') {
        const child = spawn(filePath, [], {
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
      } else if (process.platform === 'darwin') {
        shell.openPath(filePath)
      } else {
        // Linux: Make sure it has execute permission then run
        try {
          fs.chmodSync(filePath, 0o755)
        } catch {}
        const child = spawn(filePath, [], {
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
      }

      // Strip all window listeners and quit app cleanly to let installer overwrite files
      setTimeout(() => {
        app.removeAllListeners('window-all-closed')
        app.quit()
      }, 500)

      return { success: true }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to launch installer.'
      console.error('[NexusUpdater] Install error:', errorMsg)
      this.sendEvent('error', {}, errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  public openUpdatesFolder(): void {
    const filePath = this.currentStatus.filePath || this.cachedManifest?.filePath
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath)
    } else {
      shell.openPath(this.getUpdatesDir())
    }
  }

  public getStatus(): UpdateStatusData {
    return { ...this.currentStatus }
  }
}

export const nexusUpdater = new NexusUpdater()
