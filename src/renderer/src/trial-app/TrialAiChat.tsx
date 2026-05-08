import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  RiBrainLine,
  RiRefreshLine,
  RiRobot2Line,
  RiSendPlane2Line,
  RiStopCircleLine,
  RiUserVoiceLine,
  RiVolumeUpLine
} from 'react-icons/ri'
import {
  DEFAULT_NVIDIA_MODEL_DEFAULTS,
  getModelsForCategory,
  getNvidiaModelById,
  getStoredNvidiaModelDefaults,
  NEXUS_AI_PROVIDER_MODE_STORAGE_KEY,
  NVIDIA_API_KEY_STORAGE_KEY,
  type NvidiaModelDefaults
} from '@renderer/config/nvidia-models'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

const defaultWelcome =
  'Nexus Trial is online. This lightweight build keeps the hosted NVIDIA chat route available so you can test the core conversation flow right away.'

const systemPrompt = `You are Nexus Trial, a lightweight desktop AI assistant. Be concise, warm, technical when useful, and optimize for fast direct replies inside a Windows desktop app.`

const categories: Array<keyof NvidiaModelDefaults> = ['chat', 'coding', 'reasoning']

const cleanSpeechText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, 'code block omitted.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/[*_#>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const saveToLocalHistory = async (role: 'user' | 'model', text: string) => {
  if (!text.trim()) return
  try {
    await window.electron.ipcRenderer.invoke('add-message', {
      role,
      parts: [{ text }]
    })
  } catch {}
}

export default function TrialAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: defaultWelcome }
  ])
  const [input, setInput] = useState('')
  const [category, setCategory] = useState<keyof NvidiaModelDefaults>('chat')
  const [defaults, setDefaults] = useState<NvidiaModelDefaults>(DEFAULT_NVIDIA_MODEL_DEFAULTS)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_NVIDIA_MODEL_DEFAULTS.chat)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [voiceReplies, setVoiceReplies] = useState(true)
  const [providerMode, setProviderMode] = useState(
    localStorage.getItem(NEXUS_AI_PROVIDER_MODE_STORAGE_KEY) || 'nexus'
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const models = useMemo(() => getModelsForCategory(category), [category])
  const activeModel = getNvidiaModelById(selectedModel)

  useEffect(() => {
    const storedDefaults = getStoredNvidiaModelDefaults()
    setDefaults(storedDefaults)
    setSelectedModel(storedDefaults.chat)
    setProviderMode(localStorage.getItem(NEXUS_AI_PROVIDER_MODE_STORAGE_KEY) || 'nexus')
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const spokenText = cleanSpeechText(text)
    if (!spokenText) return

    const utterance = new SpeechSynthesisUtterance(spokenText)
    const voices = window.speechSynthesis.getVoices()
    const voiceProfile = localStorage.getItem('nexus_voice_profile') || 'MALE'
    const preferredVoice = voices.find((voice) =>
      voiceProfile === 'FEMALE'
        ? /female|zira|aria|jenny|susan|eva/i.test(voice.name)
        : /male|david|guy|mark|ravi/i.test(voice.name)
    )
    if (preferredVoice) utterance.voice = preferredVoice
    utterance.rate = 1
    utterance.pitch = voiceProfile === 'FEMALE' ? 1.04 : 0.95
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
    await saveToLocalHistory('user', prompt)

    try {
      const useNexusServers = providerMode !== 'own-key'
      const apiKey = useNexusServers ? '' : localStorage.getItem(NVIDIA_API_KEY_STORAGE_KEY) || ''
      const result = await window.electron.ipcRenderer.invoke('nvidia:chat-completion', {
        apiKey,
        useNexusServers,
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
      await saveToLocalHistory('model', response)
      if (voiceReplies) speak(response)
    } catch (err: any) {
      const message = err?.message || 'Unable to reach the NVIDIA Build endpoint.'
      setError(message)
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: `NVIDIA link failed: ${message}` }
      ])
      if (voiceReplies) speak(`NVIDIA chat failed. ${message}`)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[0.78fr_1.22fr]">
      <aside className="rounded-3xl border border-emerald-400/14 bg-[linear-gradient(180deg,rgba(8,14,14,0.96),rgba(4,7,8,0.92))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-emerald-400/18 bg-emerald-400/10 p-3 text-emerald-200">
              <RiRobot2Line size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                Trial AI Chat
              </p>
              <h2 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
                NVIDIA Core
              </h2>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Category
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleCategoryChange(item)}
                  className={`rounded-2xl border px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                    category === item
                      ? 'border-emerald-300/25 bg-emerald-400/12 text-emerald-100'
                      : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/25"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.provider} / {model.name}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              {activeModel?.description || 'Hosted trial model for lightweight desktop chat.'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/28 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Voice Replies
              </span>
              <button
                type="button"
                onClick={() => setVoiceReplies((current) => !current)}
                className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                  voiceReplies
                    ? 'border-emerald-300/25 bg-emerald-400/12 text-emerald-100'
                    : 'border-white/10 bg-black/35 text-zinc-400'
                }`}
              >
                {voiceReplies ? 'On' : 'Off'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setProviderMode(localStorage.getItem(NEXUS_AI_PROVIDER_MODE_STORAGE_KEY) || 'nexus')}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-white/20"
              >
                <RiRefreshLine /> Reload routing
              </button>
              <button
                type="button"
                onClick={stopSpeaking}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-300/18 bg-red-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-100 transition hover:bg-red-400/16"
              >
                <RiStopCircleLine /> Stop voice
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-400/6 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                Current route
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                {providerMode === 'own-key'
                  ? 'Using your local NVIDIA override key.'
                  : 'Using Nexus hosted routing for fast trial access.'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-3xl border border-emerald-400/14 bg-[linear-gradient(180deg,rgba(8,14,14,0.96),rgba(4,7,8,0.92))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
              Conversation
            </p>
            <h3 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
              Lightweight test session
            </h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
            <RiUserVoiceLine /> Text in, voice out
          </div>
        </div>

        <div ref={scrollRef} className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'ml-auto max-w-[82%] border-emerald-300/18 bg-emerald-400/10 text-emerald-50'
                  : 'max-w-[88%] border-white/8 bg-black/30 text-zinc-300'
              }`}
            >
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                {message.role === 'user' ? 'Operator' : 'Nexus'}
              </p>
              <p>{message.content}</p>
            </div>
          ))}

          {isSending && (
            <div className="max-w-[12rem] rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <RiBrainLine className="animate-pulse text-emerald-300" />
                Thinking…
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-300/18 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Nexus Trial something..."
            className="min-h-[4.5rem] min-w-0 flex-1 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/25"
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setVoiceReplies((current) => !current)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                voiceReplies
                  ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                  : 'border-white/10 bg-black/35 text-zinc-400'
              }`}
            >
              <RiVolumeUpLine /> {voiceReplies ? 'Voice On' : 'Voice Off'}
            </button>

            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:bg-emerald-300 disabled:opacity-50"
            >
              <RiSendPlane2Line /> Send
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
