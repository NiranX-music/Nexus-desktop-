export interface WhatsAppScheduleRequest {
  phone: string
  recipientName?: string
  message: string
  delayMinutes: number
}

export const sendWhatsAppMessage = async (phone: string, message: string) => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke('whatsapp-send-direct', {
      phone,
      message
    })
    if (res.success) {
      return `📱 Dispatched WhatsApp message to ${phone}.`
    }
    return `❌ WhatsApp dispatch failed: ${res.error}`
  } catch (err: any) {
    return `❌ WhatsApp dispatch error: ${err.message}`
  }
}

export const scheduleWhatsAppMessage = async (req: WhatsAppScheduleRequest) => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke(
      'whatsapp-schedule-message',
      req
    )
    if (res.success) {
      return `⏱️ Scheduled WhatsApp message for ${req.recipientName || req.phone} in ${req.delayMinutes} minute(s).`
    }
    return `❌ Scheduling failed: ${res.error}`
  } catch (err: any) {
    return `❌ Scheduling error: ${err.message}`
  }
}

export const getScheduledWhatsApp = async () => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke('whatsapp-get-queue')
    return res.queue || []
  } catch {
    return []
  }
}

export const openWhatsAppHUD = (phone = '', message = '') => {
  window.dispatchEvent(
    new CustomEvent('show-whatsapp', {
      detail: { phone, message }
    })
  )
  return '📱 WhatsApp Automation HUD opened.'
}
