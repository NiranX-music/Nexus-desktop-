import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RiBrainLine,
  RiSendPlane2Line,
  RiRobot2Line,
  RiUserVoiceLine,
  RiVolumeUpLine,
  RiStopCircleLine,
  RiRefreshLine
} from 'react-icons/ri'
import {
  DEFAULT_NVIDIA_MODEL_DEFAULTS,
  getModelsForCategory,
  getNvidiaModelById,
  getStoredNvidiaModelDefaults,
  NVIDIA_API_KEY_STORAGE_KEY,
  NvidiaModelDefaults
} from '@renderer/config/nvidia-models'
import { saveMessage } from '@renderer/services/nexus-ai-brain'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

const defaultWelcome =
  'Nexus NVIDIA chat online. Pick a model, type a prompt, and I will route it through NVIDIA Build using the OpenAI-compatible endpoint.'

const systemPrompt = `You are Nexus, a precise AI chat assistant inside a Windows desktop app. Be helpful, concise, technical when useful, and keep a confident but warm tone.`

const categories: Array<keyof NvidiaModelDefaults> = [
  'chat',
  'coding',
  'reasoning',
  'vision',
  'translation'
]

export default function AiChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: defaultWelcome }
  ])
  const [input, setInput] = useState('')
  const [category, setCategory] = useState<keyof NvidiaModelDefaults>('chat')
  const [defaults, setDefaults] = useState<NvidiaModelDefaults>(DEFAULT_NVIDIA_MODEL_DEFAULTS)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_NVIDIA_MODEL_DEFAULTS.chat)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [voiceReplies, setVoiceReplies] = useState(
    localStorage.getItem('nexus_nvidia_voice_replies') === 'true'
  )

  const scrollRef = useRef<HTMLDivElement>(null)

  const models = useMemo(() => getModelsForCategory(category), [category])
  const activeModel = getNvidiaModelById(selectedModel)

  useEffect(() => {
    const storedDefaults = getStoredNvidiaModelDefaults()
    setDefaults(storedDefaults)
    setSelectedModel(storedDefaults.chat)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voiceProfile = localStorage.getItem('nexus_voice_profile') || 'MALE'
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find((voice) =>
      voiceProfile === 'FEMALE'
        ? /female|zira|aria|jenny|susan|eva/i.test(voice.name)
        : /male|david|guy|mark|ravi/i.test(voice.name)
    )

    if (preferredVoice) utterance.voice = preferredVoice
    utterance.rate = 1
    utterance.pitch = voiceProfile === 'FEMALE' ? 1.05 : 0.92
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  const handleCategoryChange = (nextCategory: keyof NvidiaModelDefaults) => {
    setCategory(nextCategory)
    setSelectedModel(defaults[nextCategory] || getModelsForCategory(nextCategory)[0]?.id || '')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const prompt = input.trim()
    if (!prompt || isSending) return

    setError('')
    setInput('')

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: prompt }]
    setMessages(nextMessages)
    setIsSending(true)
    await saveMessage('user', prompt)

    try {
      const apiKey = localStorage.getItem(NVIDIA_API_KEY_STORAGE_KEY) || ''
      const result = await window.electron.ipcRenderer.invoke('nvidia:chat-completion', {
        apiKey,
        model: selectedModel,
        system: systemPrompt,
        messages: nextMessages
          .filter((message) => message.content !== defaultWelcome)
          .slice(-12)
          .map((message) => ({
            role: message.role,
            content: message.content
          }))
      })

      if (!result?.success) {
        throw new Error(result?.error || 'NVIDIA chat request failed.')
      }

      const response = result.content || 'No response content returned.'
      setMessages((current) => [...current, { role: 'assistant', content: response }])
      await saveMessage('nexus', response)
      if (voiceReplies) speak(response)
    } catch (err: any) {
      const message = err?.message || 'Unable to reach NVIDIA Build endpoint.'
      setError(message)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `NVIDIA link failed: ${message}`
        }
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="h-full w-full bg-black p-5 text-zinc-100 overflow-hidden">
      <div className="h-full grid grid-cols-12 gap-4">
        <motion.aside
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          className="col-span-12 lg:col-span-4 xl:col-span-3 rounded-3xl border border-emerald-500/15 bg-zinc-950/70 p-5 overflow-hidden flex flex-col gap-4 shadow-[0_0_45px_rgba(16,185,129,0.08)]"
        >
          <div className="border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-300">
                <RiRobot2Line size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-[0.16em] uppercase">AI Chat</h2>
                <p className="text-[10px] font-mono tracking-widest text-emerald-500/70">
                  NVIDIA BUILD NIM
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => handleCategoryChange(item)}
                  className={`rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                    category === item
                      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/10 bg-black/50 text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-xs font-mono text-zinc-100 outline-none focus:border-emerald-500/50"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </select>
            <p className="min-h-14 rounded-xl border border-white/5 bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-400">
              {activeModel?.description || 'Live NVIDIA model selected.'}
            </p>
          </div>

          <div className="mt-auto space-y-3 rounded-2xl border border-white/5 bg-black/40 p-4">
            <button
              onClick={() => {
                const next = !voiceReplies
                setVoiceReplies(next)
                localStorage.setItem('nexus_nvidia_voice_replies', String(next))
              }}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[10px] font-black tracking-widest transition-all ${
                voiceReplies
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/10 bg-zinc-950 text-zinc-500 hover:text-white'
              }`}
            >
              <RiUserVoiceLine size={16} /> VOICE REPLIES {voiceReplies ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={stopSpeaking}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-[10px] font-black tracking-widest text-zinc-500 transition-all hover:text-red-300 hover:border-red-500/30"
            >
              <RiStopCircleLine size={16} /> STOP VOICE
            </button>
          </div>
        </motion.aside>

        <motion.main
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          className="col-span-12 lg:col-span-8 xl:col-span-9 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_35%),linear-gradient(180deg,rgba(24,24,27,0.85),rgba(0,0,0,0.92))] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-emerald-400">
                <RiBrainLine /> OpenAI-Compatible NVIDIA Endpoint
              </p>
              <h3 className="mt-1 text-sm font-bold text-white">{selectedModel}</h3>
            </div>
            <button
              onClick={() => setMessages([{ role: 'assistant', content: defaultWelcome }])}
              className="rounded-xl border border-white/10 bg-black/50 p-3 text-zinc-500 transition-all hover:text-white"
              title="Reset chat"
            >
              <RiRefreshLine />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-small">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'rounded-br-sm border-emerald-500/25 bg-emerald-500/10 text-emerald-50'
                      : 'rounded-bl-sm border-white/10 bg-black/45 text-zinc-200'
                  }`}
                >
                  {message.content}
                  {message.role === 'assistant' && message.content !== defaultWelcome && (
                    <button
                      onClick={() => speak(message.content)}
                      className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-all hover:text-emerald-300"
                    >
                      <RiVolumeUpLine /> Speak
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-xs font-mono text-emerald-300">
                  NVIDIA model is thinking...
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-red-500/20 bg-red-950/20 px-5 py-2 text-[11px] font-mono text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
            <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-black/60 p-3 focus-within:border-emerald-500/40">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder="Ask Nexus through NVIDIA Build..."
                className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              />
              <button
                type="submit"
                disabled={isSending || input.trim().length === 0}
                className="rounded-xl bg-emerald-400 px-5 py-3 text-black transition-all hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RiSendPlane2Line size={20} />
              </button>
            </div>
          </form>
        </motion.main>
      </div>
    </div>
  )
}
