import { IpcMain } from 'electron'
import os from 'os'
import { execFile } from 'child_process'

const runPowerShellWithOutput = (script: string): Promise<string> => {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { maxBuffer: 1024 * 1024 * 10, windowsHide: true },
      (_error, stdout) => resolve(stdout ? stdout.trim() : '')
    )
  })
}

const winRtPrelude = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
function Await-WinRtOperation($AsyncOperation, [Type]$ResultType) {
  $methods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
  }
  $method = $methods | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' } | Select-Object -First 1
  if (-not $method) { return $null }
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOperation))
  $task.Wait() | Out-Null
  return $task.Result
}
`

const getSessionsScript = `
${winRtPrelude}
$manager = Await-WinRtOperation ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
if (-not $manager) { @() | ConvertTo-Json -Compress; exit }
$current = $manager.GetCurrentSession()
$sessions = @($manager.GetSessions())
$result = for ($i = 0; $i -lt $sessions.Count; $i++) {
  $session = $sessions[$i]
  $media = Await-WinRtOperation ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $playback = $session.GetPlaybackInfo()
  $timeline = $session.GetTimelineProperties()
  $controls = $playback.Controls
  [pscustomobject]@{
    id = "$i"
    index = $i
    source = $session.SourceAppUserModelId
    title = if ($media.Title) { $media.Title } else { 'Unknown media' }
    artist = if ($media.Artist) { $media.Artist } else { '' }
    albumTitle = if ($media.AlbumTitle) { $media.AlbumTitle } else { '' }
    status = $playback.PlaybackStatus.ToString()
    isCurrent = [object]::ReferenceEquals($session, $current)
    positionMs = [int64]$timeline.Position.TotalMilliseconds
    durationMs = [int64]$timeline.EndTime.TotalMilliseconds
    canPlay = $controls.IsPlayEnabled
    canPause = $controls.IsPauseEnabled
    canNext = $controls.IsNextEnabled
    canPrevious = $controls.IsPreviousEnabled
  }
}
$result | ConvertTo-Json -Depth 6 -Compress
`

const controlScript = (sessionIndex: number, action: string) => `
${winRtPrelude}
$manager = Await-WinRtOperation ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
if (-not $manager) { [pscustomobject]@{ success = $false; error = 'Media manager unavailable' } | ConvertTo-Json -Compress; exit }
$sessions = @($manager.GetSessions())
$index = ${sessionIndex}
if ($index -lt 0 -or $index -ge $sessions.Count) { [pscustomobject]@{ success = $false; error = 'Media session not found' } | ConvertTo-Json -Compress; exit }
$session = $sessions[$index]
$action = '${action}'
$operation = $null
switch ($action) {
  'play' { $operation = $session.TryPlayAsync() }
  'pause' { $operation = $session.TryPauseAsync() }
  'toggle' { $operation = $session.TryTogglePlayPauseAsync() }
  'next' { $operation = $session.TrySkipNextAsync() }
  'previous' { $operation = $session.TrySkipPreviousAsync() }
}
if (-not $operation) { [pscustomobject]@{ success = $false; error = 'Unsupported media command' } | ConvertTo-Json -Compress; exit }
$ok = Await-WinRtOperation ($operation) ([bool])
[pscustomobject]@{ success = [bool]$ok } | ConvertTo-Json -Compress
`

export default function registerMediaControl(ipcMain: IpcMain) {
  ipcMain.removeHandler('media:get-sessions')
  ipcMain.handle('media:get-sessions', async () => {
    if (os.platform() !== 'win32') return []

    try {
      const output = await runPowerShellWithOutput(getSessionsScript)
      if (!output) return []
      const parsed = JSON.parse(output)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return []
    }
  })

  ipcMain.removeHandler('media:control')
  ipcMain.handle(
    'media:control',
    async (_event, payload: { sessionIndex: number; action: string }) => {
      if (os.platform() !== 'win32') {
        return { success: false, error: 'Media controls are only available on Windows.' }
      }

      const action = String(payload?.action || '').toLowerCase()
      if (!['play', 'pause', 'toggle', 'next', 'previous'].includes(action)) {
        return { success: false, error: 'Unsupported media command.' }
      }

      const sessionIndex = Number(payload?.sessionIndex)
      if (!Number.isInteger(sessionIndex) || sessionIndex < 0) {
        return { success: false, error: 'Invalid media session.' }
      }

      try {
        const output = await runPowerShellWithOutput(controlScript(sessionIndex, action))
        return output ? JSON.parse(output) : { success: false, error: 'No media response.' }
      } catch {
        return { success: false, error: 'Media command failed.' }
      }
    }
  )
}
