import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiCloseLine,
  RiWhatsappLine,
  RiSendPlaneLine,
  RiTimeLine,
  RiUser3Line,
  RiCheckDoubleLine,
  RiSparklingLine,
  RiDeleteBinLine
} from 'react-icons/ri'
import {
  sendWhatsAppMessage,
  scheduleWhatsAppMessage,
  getScheduledWhatsApp
} from '@renderer/tools/whatsapp-api'

const QUICK_TEMPLATES = [
  '⚡ Nexus Build is complete & verified on device.',
  '🚀 Code review deployed to main. Please review.',
  '📍 Telemetry uplink active. All systems nominal.',
  '⏱️ Scheduled sync in 15 minutes.'
]

export default function WhatsAppWidget() {
  const [isVisible, setIsVisible] = useState(false)
  const [phone, setPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [message, setMessage] = useState('')
  const [delayMinutes, setDelayMinutes] = useState(5)
  const [isScheduling, setIsScheduling] = useState(false)
  const [queue, setQueue] = useState<any[]>([])
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsVisible(true)
      if (e.detail?.phone) setPhone(e.detail.phone)
      if (e.detail?.message) setMessage(e.detail.message)
    }
    window.addEventListener('show-whatsapp', handleOpen)
    return () => window.removeEventListener('show-whatsapp', handleOpen)
  }, [])

  useEffect(() => {
    if (isVisible) {
      loadQueue()
    }
  }, [isVisible])

  const loadQueue = async () => {
    const q = await getScheduledWhatsApp()
    setQueue(q)
  }

  const handleSendDirect = async () => {
    if (!phone || !message) return
    setStatusMsg('DISPATCHING DIRECT MESSAGE...')
    const res = await sendWhatsAppMessage(phone, message)
    setStatusMsg(res.includes('📱') ? 'MESSAGE DISPATCHED' : 'DISPATCH FAILED')
    setTimeout(() => setStatusMsg(null), 3500)
  }

  const handleSchedule = async () => {
    if (!phone || !message) return
    setStatusMsg(`QUEUING FOR ${delayMinutes}M DELAY...`)
    const res = await scheduleWhatsAppMessage({
      phone,
      recipientName,
      message,
      delayMinutes
    })
    setStatusMsg(res.includes('⏱️') ? 'MESSAGE SCHEDULED' : 'SCHEDULING FAILED')
    loadQueue()
    setTimeout(() => setStatusMsg(null), 3500)
  }

  const handleCancelItem = async (id: string) => {
    await (window as any).electron.ipcRenderer.invoke('whatsapp-cancel-scheduled', id)
    loadQueue()
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-9700 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-2xl bg-zinc-950/85 border border-white/10 rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <RiWhatsappLine size={18} />
              </div>
              <div>
                <h2 className="text-white text-sm font-bold tracking-wide uppercase">
                  WhatsApp Automation Engine
                </h2>
                <p className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase">
                  Direct Protocol Uplink • Timed Dispatch Queue
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {statusMsg && (
                <span className="text-[11px] font-mono px-3 py-1 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 animate-pulse">
                  {statusMsg}
                </span>
              )}
              <button
                onClick={() => setIsVisible(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
              >
                <RiCloseLine size={20} />
              </button>
            </div>
          </div>

          {/* Form Controls */}
          <div className="p-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1 block">
                  Recipient Phone (w/ Country Code)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-zinc-500 font-mono text-xs">+</span>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="14155552671"
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1 block">
                  Contact Alias (Optional)
                </label>
                <div className="relative flex items-center">
                  <RiUser3Line className="absolute left-3 text-zinc-500" size={14} />
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Chief Architect"
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 font-sans"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                  Transmission Message
                </label>
                <span className="text-[9px] font-mono text-zinc-500">
                  {message.length} CHARACTERS
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose your neural transmission payload here..."
                rows={3}
                className="w-full bg-zinc-900/80 border border-white/10 rounded-lg p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 font-sans resize-none"
              />
            </div>

            {/* Quick Templates */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <RiSparklingLine size={10} /> Presets:
              </span>
              {QUICK_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => setMessage(tmpl)}
                  className="text-[10px] font-sans px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/5 hover:border-emerald-500/40 text-zinc-400 hover:text-white transition truncate max-w-[200px]"
                >
                  {tmpl}
                </button>
              ))}
            </div>

            {/* Dispatch Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsScheduling(!isScheduling)}
                  className={`px-3 py-2 rounded-lg text-xs font-mono tracking-wider uppercase transition flex items-center gap-1.5 border ${
                    isScheduling
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                      : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <RiTimeLine size={14} />
                  Timed Queue
                </button>

                {isScheduling && (
                  <div className="flex items-center gap-1.5">
                    {[1, 5, 15, 60].map((m) => (
                      <button
                        key={m}
                        onClick={() => setDelayMinutes(m)}
                        className={`text-[10px] font-mono px-2 py-1 rounded ${
                          delayMinutes === m
                            ? 'bg-cyan-500 text-black font-bold'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/5'
                        }`}
                      >
                        +{m}m
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {isScheduling ? (
                  <button
                    disabled={!phone || !message}
                    onClick={handleSchedule}
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs tracking-wider uppercase transition flex items-center gap-2 disabled:opacity-40"
                  >
                    <RiTimeLine size={14} />
                    Schedule ({delayMinutes}m)
                  </button>
                ) : (
                  <button
                    disabled={!phone || !message}
                    onClick={handleSendDirect}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs tracking-wider uppercase transition flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40"
                  >
                    <RiSendPlaneLine size={14} />
                    Transmit Now
                  </button>
                )}
              </div>
            </div>

            {/* Scheduled Queue Viewer */}
            {queue.filter((q) => q.status === 'pending').length > 0 && (
              <div className="mt-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <RiCheckDoubleLine className="text-emerald-400" size={12} />
                  Active Scheduled Transmissions
                </span>
                <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-small">
                  {queue
                    .filter((q) => q.status === 'pending')
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-white/5 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-emerald-400">+{item.recipientPhone}</span>
                          <span className="text-zinc-500 truncate text-[11px] font-sans">
                            "{item.message}"
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-mono text-zinc-400">
                            {new Date(item.scheduledTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <button
                            onClick={() => handleCancelItem(item.id)}
                            className="p-1 text-zinc-500 hover:text-red-400 transition"
                          >
                            <RiDeleteBinLine size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
