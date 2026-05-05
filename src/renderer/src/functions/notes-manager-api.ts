import { listCloudData, saveCloudData } from '@renderer/services/cloud-data'

type CloudNoteValue = {
  title?: string
  content?: string
  timestamp?: string
}

export const saveNote = async (title: string, content: string) => {
  try {
    const result = await window.electron.ipcRenderer.invoke('save-note', { title, content })
    if (result.success) {
      await saveCloudData('notes', title.replace(/[^a-z0-9]/gi, '_').toLowerCase(), {
        title,
        content,
        path: result.path,
        timestamp: new Date().toISOString()
      })
      return `Note saved successfully as ${title}.`
    }
    return `Failed to save note: ${result.error}`
  } catch (e) {
    return 'System Error saving note.'
  }
}

export const readSystemNotes = async () => {
  try {
    const localNotes: any[] = await window.electron.ipcRenderer.invoke('get-notes')
    const cloudRows = await listCloudData<CloudNoteValue>('notes')
    const notesByFilename = new Map<string, any>()

    for (const note of localNotes || []) {
      notesByFilename.set(note.filename, note)
    }

    for (const row of cloudRows) {
      const value = row.value || {}
      const title = value.title || row.item_key.replace(/_/g, ' ')
      const filename = `${row.item_key}.md`
      notesByFilename.set(filename, {
        filename,
        title,
        content: value.content || '',
        createdAt: value.timestamp || row.updated_at || new Date().toISOString()
      })
    }

    const notes = Array.from(notesByFilename.values())
    if (notes.length === 0) return 'Memory Bank is empty. No notes found.'

    return notes
      .slice(0, 10)
      .map((n) => `[NOTE: ${n.title}]\n${n.content}`)
      .join('\n\n')
  } catch (e) {
    return 'System Error: Could not access Memory Bank.'
  }
}
