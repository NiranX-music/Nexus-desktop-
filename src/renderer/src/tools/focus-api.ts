export const startFocusSession = async (minutes = 25, blacklist?: string[]) => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke('focus-start-session', {
      minutes,
      blacklist
    })
    if (res.success) {
      window.dispatchEvent(
        new CustomEvent('focus-status-changed', {
          detail: { isActive: true, session: res.session }
        })
      )
      const count = res.session?.terminatedApps?.length || 0
      return `🛡️ Deep Work Protocol engaged for ${minutes} min. Distraction shield active (${count} apps closed).`
    }
    return '❌ Failed to initialize Deep Work Protocol.'
  } catch (err: any) {
    return `❌ Deep Work Protocol error: ${err.message}`
  }
}

export const getFocusStatus = async () => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke('focus-get-status')
    return res
  } catch {
    return { success: false, session: { isActive: false } }
  }
}

export const stopFocusSession = async () => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke('focus-stop-session')
    window.dispatchEvent(
      new CustomEvent('focus-status-changed', {
        detail: { isActive: false }
      })
    )
    return `✅ Focus Protocol deactivated. Total focus logged: ${res.totalFocusMinutes || 0} minutes.`
  } catch (err: any) {
    return `❌ Error deactivating Focus Protocol: ${err.message}`
  }
}

export const openFocusHUD = (minutes = 25) => {
  window.dispatchEvent(
    new CustomEvent('show-focus', {
      detail: { minutes }
    })
  )
  return '🛡️ Deep Work Focus HUD summoned.'
}
