export const openApp = async (appName: string) => {
  try {
    const result: any = await window.electron.ipcRenderer.invoke('open-app', appName)
    if (result.success) return `Success: ${appName} is opening.`
    return `Error: ${result.error}`
  } catch (err) {
    return `System Error: ${err}`
  }
}

export const performWebSearch = async (query: string) => {
  const result = await window.electron.ipcRenderer.invoke('browser-control:serverless-run', {
    prompt: `search ${query}`,
    scope: 'browser'
  })

  if (result?.success) {
    return `Serverless browser search complete: ${result.summary}`
  }

  return `Serverless browser search failed: ${result?.error || result?.summary || query}`
}

export const closeApp = async (appName: string) => {
  try {
    const result: any = await window.electron.ipcRenderer.invoke('close-app', appName)
    if (result && result.success) return `✅ Terminated ${appName}.`
    return `⚠️ Failed to close ${appName}. It might not be running or the name is incorrect.`
  } catch (err) {
    return 'System Error: Termination failed.'
  }
}
