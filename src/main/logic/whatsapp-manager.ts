import { IpcMain, shell, app } from 'electron'
import fs from 'fs'
import path from 'path'

export interface WhatsAppQueueItem {
  id: string
  recipientPhone: string
  recipientName: string
  message: string
  scheduledTime: number
  status: 'pending' | 'sent' | 'cancelled'
  createdAt: number
}

export default function registerWhatsAppManager(ipcMain: IpcMain) {
  const queuePath = path.join(app.getPath('userData'), 'whatsapp_queue.json')

  const readQueue = (): WhatsAppQueueItem[] => {
    try {
      if (!fs.existsSync(queuePath)) return []
      return JSON.parse(fs.readFileSync(queuePath, 'utf8'))
    } catch {
      return []
    }
  }

  const writeQueue = (queue: WhatsAppQueueItem[]) => {
    try {
      fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), 'utf8')
    } catch (err) {
      console.error('[WhatsAppManager] Failed to write queue:', err)
    }
  }

  const cleanPhoneNumber = (phone: string) => {
    return phone.replace(/[^\d+]/g, '').replace(/^0+/, '')
  }

  // Direct dispatch of WhatsApp message
  ipcMain.handle(
    'whatsapp-send-direct',
    async (_event, payload: { phone: string; message: string }) => {
      try {
        const cleanPhone = cleanPhoneNumber(payload.phone)
        const encodedText = encodeURIComponent(payload.message)

        if (!cleanPhone) {
          throw new Error('Valid phone number with country code is required.')
        }

        // Try launching native desktop client first
        const nativeProtocol = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
        const webUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`

        try {
          await shell.openExternal(nativeProtocol)
        } catch {
          // Fallback to web WhatsApp in browser
          await shell.openExternal(webUrl)
        }

        return {
          success: true,
          phone: cleanPhone,
          message: 'WhatsApp dispatch pipeline initiated.'
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'WhatsApp dispatch failed.' }
      }
    }
  )

  // Schedule WhatsApp message
  ipcMain.handle(
    'whatsapp-schedule-message',
    async (
      _event,
      payload: {
        phone: string
        recipientName?: string
        message: string
        delayMinutes: number
      }
    ) => {
      try {
        const cleanPhone = cleanPhoneNumber(payload.phone)
        if (!cleanPhone) throw new Error('Valid phone number is required.')

        const queue = readQueue()
        const now = Date.now()
        const scheduledTime = now + (payload.delayMinutes || 1) * 60 * 1000

        const newItem: WhatsAppQueueItem = {
          id: `wa_${now}_${Math.random().toString(36).slice(2, 7)}`,
          recipientPhone: cleanPhone,
          recipientName: payload.recipientName || cleanPhone,
          message: payload.message,
          scheduledTime,
          status: 'pending',
          createdAt: now
        }

        queue.push(newItem)
        writeQueue(queue)

        return { success: true, item: newItem }
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to schedule message.' }
      }
    }
  )

  // Retrieve scheduled queue
  ipcMain.handle('whatsapp-get-queue', async () => {
    return { success: true, queue: readQueue() }
  })

  // Cancel scheduled item
  ipcMain.handle('whatsapp-cancel-scheduled', async (_event, id: string) => {
    const queue = readQueue()
    const item = queue.find((q) => q.id === id)
    if (item) {
      item.status = 'cancelled'
      writeQueue(queue)
      return { success: true }
    }
    return { success: false, error: 'Queue item not found.' }
  })
}
