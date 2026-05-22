import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  RiRobot2Line,
  RiSendPlane2Line,
  RiRefreshLine,
  RiVolumeUpLine,
  RiStopCircleLine,
  RiMicLine,
  RiMicOffLine
} from 'react-icons/ri'
import MarkdownMath from '@renderer/components/MarkdownMath'
import {
  AI_GATEWAY_PROVIDERS,
  AiGatewayProvider,
  DEFAULT_AI_GATEWAY_MODEL,
  DEFAULT_AI_GATEWAY_MODELS,
  AiGatewayModel
} from '@renderer/config/ai-provider-models'
import { saveMessage } from '@renderer/services/nexus-ai-brain'
import {
  createWhiteboardPayload,
  extractWhiteboardQuestion,
  isWhiteboardCommand,
  publishWhiteboardWrite
} from '@renderer/services/whiteboard'
import { nexusService } from '@renderer/services/nexus-voice-ai'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

interface AiChatViewProps {
  isSystemActive: boolean
  isSystemStarting: boolean
  isMicMuted: boolean
  toggleSystem: () => void | Promise<void>
  toggleMic: () => void
}

const systemPrompt =
  'You are Nexus AI inside the desktop app. Be concise, useful, and write math with LaTeX when needed.'

const cleanSpeechText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, 'code block omitted.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/[*_#>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export default function AiChatView({
  isSystemActive,
  isSystemStarting,
  isMicMuted,
  toggleSystem,
  toggleMic
}: AiChatViewProps) {
  const [provider, setProvider] = useState<AiGatewayProvider>(
    (localStorage.getItem('nexus_ai_chat_provider') as AiGatewayProvider) || 'gemini'
  )
  const [model, setModel] = useState(
    localStorage.getItem('nexus_ai_chat_model') || DEFAULT_AI_GATEWAY_MODEL.gemini
  )
  const [modelsByProvider, setModelsByProvider] =
    useState<Record<AiGatewayProvider, AiGatewayModel[]>>(DEFAULT_AI_GATEWAY_MODELS)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Nexus AI Chat is online. Choose Gemini or Groq and send a prompt.'
    }
  ])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [voiceReplies, setVoiceReplies] = useState(
    localStorage.getItem('nexus_ai_chat_main_voice') !== 'false'
  )
  const [voiceStatus, setVoiceStatus] = useState('Main voice ready')
  const [voiceProfile, setVoiceProfile] = useState(
    localStorage.getItem('nexus_voice_profile') === 'FEMALE' ? 'Aoede' : 'Puck'
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    localStorage.setItem('nexus_ai_chat_provider', provider)
    localStorage.setItem('nexus_ai_chat_model', model)
  }, [provider, model])

  useEffect(() => {
    localStorage.setItem('nexus_ai_chat_main_voice', String(voiceReplies))
  }, [voiceReplies])

  useEffect(() => {
    const syncVoiceProfile = () => {
      setVoiceProfile(localStorage.getItem('nexus_voice_profile') === 'FEMALE' ? 'Aoede' : 'Puck')
    }

    syncVoiceProfile()
    const timer = window.setInterval(syncVoiceProfile, 1000)
    window.addEventListener('storage', syncVoiceProfile)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', syncVoiceProfile)
    }
  }, [])

  useEffect(() => {
    const handleVoiceMessage = (event: any) => {
      const detail = event.detail || {}
      if (!detail.content || (detail.role !== 'user' && detail.role !== 'assistant')) return

      setMessages((current) => {
        const last = current[current.length - 1]
        if (last?.role === detail.role && last.content === detail.content) return current
        return [...current, { role: detail.role, content: detail.content }]
      })
    }

    window.addEventListener('nexus-voice-message', handleVoiceMessage)
    return () => window.removeEventListener('nexus-voice-message', handleVoiceMessage)
  }, [])

  useEffect(() => {
    AI_GATEWAY_PROVIDERS.forEach(async (nextProvider) => {
      if (nextProvider === 'gemini') return
      try {
        const result = await window.electron.ipcRenderer.invoke('ai-gateway:list-models', {
          provider: nextProvider
        })
        if (result?.success && Array.isArray(result.models) && result.models.length > 0) {
          setModelsByProvider((current) => ({ ...current, [nextProvider]: result.models }))
        }
      } catch {}
    })
  }, [])

  const ensureMainVoiceOnline = async () => {
    if (!nexusService.isConnected) {
      setVoiceStatus(isSystemStarting ? 'Main voice starting' : 'Starting main voice')
      if (!isSystemStarting && !isSystemActive) await toggleSystem()

      const deadline = Date.now() + 12000
      while (!nexusService.isConnected && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 250))
      }
    }

    if (!nexusService.isConnected) throw new Error('Main voice assistant is not online.')
    setVoiceStatus('Main voice online')
  }

  const speakWithMainVoice = async (text: string) => {
    if (!voiceReplies) return
    const clean = cleanSpeechText(text)
    if (!clean) return

    try {
      await ensureMainVoiceOnline()
      nexusService.speakInstruction(
        `Read this AI Chat response aloud using the current Nexus assistant voice. Keep the wording faithful and do not add new information:\n\n${clean.slice(0, 5000)}`,
        { persistTranscript: false }
      )
      setVoiceStatus(`Speaking with ${voiceProfile}`)
    } catch (error: any) {
      setVoiceStatus(error?.message || 'Main voice unavailable')
    }
  }

  const stopSpeaking = () => {
    nexusService.stopAudioOutput()
    setVoiceStatus('Main voice stopped')
  }

  const toggleMainVoice = async () => {
    if (isSystemStarting) {
      setVoiceStatus('Main voice starting')
      return
    }

    try {
      if (!isSystemActive || !nexusService.isConnected) {
        await ensureMainVoiceOnline()
        setVoiceStatus('Main voice online')
        return
      }

      toggleMic()
      setVoiceStatus(isMicMuted ? 'Main voice mic live' : 'Main voice mic muted')
    } catch (error: any) {
      setVoiceStatus(error?.message || 'Main voice unavailable')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const prompt = input.trim()
    if (!prompt || isSending) return

    setError('')
    setInput('')
    const nextMessages = [...messages, { role: 'user' as const, content: prompt }]
    setMessages(nextMessages)
    setIsSending(true)
    await saveMessage('user', prompt)

    try {
      const result = await window.electron.ipcRenderer.invoke('ai-gateway:chat', {
        provider,
        model,
        modelsByProvider: {
          gemini: DEFAULT_AI_GATEWAY_MODEL.gemini,
          groq: localStorage.getItem('nexus_default_groq_model') || DEFAULT_AI_GATEWAY_MODEL.groq,
          fireworks:
            localStorage.getItem('nexus_default_fireworks_model') ||
            DEFAULT_AI_GATEWAY_MODEL.fireworks
        },
        system: systemPrompt,
        messages: nextMessages
          .filter((message) => !message.content.includes('Nexus AI Chat is online'))
          .slice(-12)
      })

      if (!result?.success) throw new Error(result?.error || 'AI gateway request failed.')

      const response =
        result.provider && result.provider !== provider
          ? `[Fallback: ${result.provider}]\n\n${result.content || 'No response returned.'}`
          : result.content || 'No response returned.'
      setMessages((current) => [...current, { role: 'assistant', content: response }])
      await saveMessage('nexus', response)

      if (isWhiteboardCommand(prompt)) {
        publishWhiteboardWrite(
          createWhiteboardPayload(extractWhiteboardQuestion(prompt), response, 'chat')
        )
      }

      if (voiceReplies) await speakWithMainVoice(response)
    } catch (err: any) {
      const message = err?.message || 'Unable to reach the AI gateway.'
      setError(message)
      setMessages((current) => [...current, { role: 'assistant', content: `Error: ${message}` }])
      if (voiceReplies) await speakWithMainVoice(`AI chat failed. ${message}`)
    } finally {
      setIsSending(false)
    }
  }

  const sendToMainVoiceAssistant = async () => {
    const prompt = input.trim()
    if (!prompt || isSending) return

    setError('')
    setInput('')
    setIsSending(true)
    setMessages((current) => [...current, { role: 'user', content: prompt }])

    try {
      await ensureMainVoiceOnline()
      await nexusService.sendTextPrompt(`[AI CHAT PAGE]\n${prompt}`, 'queue')
      setVoiceStatus('Sent to main voice assistant')
    } catch (err: any) {
      const message = err?.message || 'Unable to reach the main voice assistant.'
      setError(message)
      setMessages((current) => [...current, { role: 'assistant', content: `Error: ${message}` }])
      setVoiceStatus(message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="h-full w-full overflow-hidden p-4 text-zinc-100">
      <div className="grid h-full min-h-0 grid-cols-12 gap-3">
        <aside className="col-span-12 flex min-h-0 flex-col gap-4 overflow-hidden rounded-2xl border border-emerald-500/15 bg-black/55 p-4 lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-300">
              <RiRobot2Line size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-[0.16em]">AI Chat</h2>
              <p className="text-[10px] font-mono tracking-widest text-emerald-400/70">
                GATEWAY + MAIN VOICE
              </p>
            </div>
          </div>

          <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
            Provider
          </label>
          <select
            value={provider}
            onChange={(event) => {
              const nextProvider = event.target.value as AiGatewayProvider
              setProvider(nextProvider)
              setModel(DEFAULT_AI_GATEWAY_MODEL[nextProvider])
            }}
            className="rounded-lg border border-white/10 bg-black/80 p-3 text-xs font-bold text-zinc-100 outline-none"
          >
            <option value="gemini">Gemini API</option>
            <option value="groq">Groq API</option>
            <option value="fireworks">Fireworks API</option>
          </select>

          <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
            Model
          </label>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="rounded-lg border border-white/10 bg-black/80 p-3 text-xs font-bold text-zinc-100 outline-none"
          >
            {(modelsByProvider[provider] || DEFAULT_AI_GATEWAY_MODELS[provider]).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="mt-auto rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-200">
                Main Voice
              </span>
              <span className="rounded-full border border-cyan-400/20 bg-black/50 px-2 py-0.5 text-[8px] font-mono uppercase text-cyan-200/80">
                {voiceProfile}
              </span>
            </div>
            <div className="mt-2 truncate text-[9px] font-mono uppercase tracking-widest text-zinc-500">
              {voiceStatus}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={toggleMainVoice}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition ${
                  nexusService.isConnected && !isMicMuted
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                    : 'border-white/10 bg-white/5 text-zinc-300 hover:text-cyan-200'
                }`}
              >
                {nexusService.isConnected && !isMicMuted ? <RiMicLine /> : <RiMicOffLine />}
                {nexusService.isConnected ? (isMicMuted ? 'Muted' : 'Live') : 'Start'}
              </button>
              <button
                onClick={() => setVoiceReplies((current) => !current)}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition ${
                  voiceReplies
                    ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
                    : 'border-white/10 bg-white/5 text-zinc-400'
                }`}
              >
                <RiVolumeUpLine /> {voiceReplies ? 'Replies' : 'Silent'}
              </button>
            </div>
            <button
              onClick={stopSpeaking}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-200 transition hover:bg-red-500/20"
            >
              <RiStopCircleLine /> Stop Voice
            </button>
          </div>
        </aside>

        <main className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/45 lg:col-span-9">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 scrollbar-small">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[86%] rounded-xl border p-4 ${
                    message.role === 'user'
                      ? 'ml-auto border-emerald-400/20 bg-emerald-400/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <MarkdownMath content={message.content} />
                </div>
              ))}
              {isSending && (
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-zinc-400">
                  <RiRefreshLine className="animate-spin" /> Thinking...
                </div>
              )}
            </div>
          </div>

          {error ? (
            <div className="border-t border-red-400/20 bg-red-500/10 px-4 py-2 text-xs text-red-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-white/10 p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Nexus AI..."
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/70 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-400/50"
            />
            <button
              type="button"
              onClick={sendToMainVoiceAssistant}
              disabled={isSending || !input.trim()}
              className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-cyan-200 transition hover:bg-cyan-300 hover:text-black disabled:opacity-40"
              title="Ask the main voice assistant"
            >
              <RiVolumeUpLine />
            </button>
            <button
              disabled={isSending || !input.trim()}
              className="rounded-lg bg-emerald-500 px-5 py-3 text-black disabled:opacity-40"
              title="Send to AI chat gateway"
            >
              <RiSendPlane2Line />
            </button>
          </form>
        </main>
      </div>
    </div>
  )
}
