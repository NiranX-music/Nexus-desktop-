export interface SlideItem {
  title: string
  subtitle?: string
  bullets: string[]
  footer?: string
}

export interface SpreadsheetPayload {
  title: string
  columns: { key: string; label: string }[]
  rows: Record<string, any>[]
}

export const forgePresentation = async (
  title: string,
  topic: string,
  slides: SlideItem[],
  openAfterCreate = true
) => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke('doc-forge-presentation', {
      title,
      topic,
      slides,
      openAfterCreate
    })
    if (res.success) {
      return `📊 Autonomous Presentation created and saved to Downloads: ${res.filename}`
    }
    return `❌ Presentation generation failed: ${res.error}`
  } catch (err: any) {
    return `❌ Presentation generation error: ${err.message}`
  }
}

export const forgeSpreadsheet = async (
  payload: SpreadsheetPayload,
  openAfterCreate = true
) => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke('doc-forge-spreadsheet', {
      ...payload,
      openAfterCreate
    })
    if (res.success) {
      return `📈 Autonomous Spreadsheet created and saved to Downloads: ${res.filename} (${res.rowCount} rows).`
    }
    return `❌ Spreadsheet generation failed: ${res.error}`
  } catch (err: any) {
    return `❌ Spreadsheet generation error: ${err.message}`
  }
}

export const openDocForgeHUD = (type: 'presentation' | 'spreadsheet' = 'presentation') => {
  window.dispatchEvent(
    new CustomEvent('show-doc-forge', {
      detail: { type }
    })
  )
  return '📑 Document & Office Forge HUD summoned.'
}
