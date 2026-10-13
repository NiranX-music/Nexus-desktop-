import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import {
  RiRobot2Line,
  RiSendPlane2Line,
  RiRefreshLine,
  RiVolumeUpLine,
  RiStopCircleLine,
  RiMicLine,
  RiMicOffLine,
  RiAttachment2,
  RiFileTextLine,
  RiCloseLine,
  RiFolderOpenLine,
  RiAddLine,
  RiHistoryLine,
  RiKey2Line,
  RiFileCopyLine,
  RiCheckLine,
  RiDownload2Line,
  RiDeleteBinLine,
  RiBrainLine
} from 'react-icons/ri'
import MarkdownMath from '@renderer/components/MarkdownMath'
import {
  AI_GATEWAY_PROVIDERS,
  AiGatewayProvider,
  DEFAULT_AI_GATEWAY_MODEL,
  DEFAULT_AI_GATEWAY_MODELS,
  AiGatewayModel
} from '@renderer/config/ai-provider-models'
import { executePuterChat, listPuterModels } from '@renderer/services/nexus-puter-api'
import { saveMessage } from '@renderer/services/nexus-ai-brain'
import {
  createWhiteboardPayload,
  extractWhiteboardQuestion,
  isWhiteboardCommand,
  publishWhiteboardWrite
} from '@renderer/services/whiteboard'
import { nexusService } from '@renderer/services/nexus-voice-ai'
import { handleImageGeneration } from '@renderer/tools/Image-generator'
import { demandComponentManager } from '@renderer/services/demand-component-manager'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  provider?: string
  model?: string
}

type ChatAttachment = {
  name: string
  mimeType: string
  size: number
  data: string
}

interface SavedSessionSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  provider: string
  model: string
  messages: Array<{ role: string; content: string; timestamp?: string }>
  filePath?: string
}

interface AiChatViewProps {
  isSystemActive: boolean
  isSystemStarting: boolean
  isMicMuted: boolean
  toggleSystem: () => void | Promise<void>
  toggleMic: () => void
}

const systemPrompt = `You are Nexus AI, an advanced sovereign desktop AI intelligence agent.
[MATHEMATICAL FORMATTING REQUIREMENT]: ALWAYS format all mathematical expressions, formulas, scientific notation, numbers, calculations, algebraic variables, limits, integrals, and equations strictly using standard LaTeX syntax.
- Use $...$ for inline equations (e.g. $E=mc^2$, $\\lambda = \\frac{h}{p}$).
- Use $$...$$ on their own separate lines for standalone block formulas.
- Never output raw unformatted formulas.
Provide sharp, structured Markdown with code blocks, tables, and step-by-step reasoning where applicable.`

const cleanSpeechText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, 'code block omitted.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/[*_#>~]/g, '')
    .replace(/\$+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  js: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  html: 'text/html',
  css: 'text/css',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  zip: 'application/zip'
}

const guessAttachmentMimeType = (file: File) => {
  if (file.type) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase()
  return (extension && ATTACHMENT_MIME_BY_EXTENSION[extension]) || 'application/octet-stream'
}

const formatAttachmentSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const readFileAsBase64 = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return window.btoa(binary)
}

const fileToGeminiAttachment = async (file: File): Promise<ChatAttachment> => ({
  name: file.name,
  mimeType: guessAttachmentMimeType(file),
  size: file.size,
  data: await readFileAsBase64(file)
})

const PROVIDER_DISPLAY_NAMES: Record<AiGatewayProvider, string> = {
  puter: 'Puter AI (Primary • 500+ Frontier Models)',
  gemini: 'Google Gemini API',
  groq: 'Groq Cloud LPU',
  openai: 'OpenAI Direct',
  anthropic: 'Anthropic Claude',
  deepseek: 'DeepSeek Direct',
  ollama: 'Ollama / Edge0 (Local Offline)',
  fireworks: 'Fireworks AI'
}

export default function AiChatView({
  isSystemActive,
  isSystemStarting,
  isMicMuted,
  toggleSystem,
  toggleMic
}: AiChatViewProps) {
  // Session State
  const [sessionId, setSessionId] = useState<string>(() => `nexus_session_${Date.now()}`)
  const [sessionTitle, setSessionTitle] = useState<string>('New Nexus Session')
  const [savedSessions, setSavedSessions] = useState<SavedSessionSummary[]>([])
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false)
  const [docsFolderPath, setDocsFolderPath] = useState<string>('')

  // Provider & Model State
  const [provider, setProvider] = useState<AiGatewayProvider>(
    (localStorage.getItem('nexus_ai_chat_provider') as AiGatewayProvider) || 'puter'
  )
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('nexus_ai_chat_model')
    if (!saved || saved === 'models/gemini-1.5-flash' || saved.includes('pollinations')) {
      return DEFAULT_AI_GATEWAY_MODEL.puter
    }
    return saved
  })
  const [customModel, setCustomModel] = useState(() => {
    return localStorage.getItem('nexus_ai_chat_custom_model') || 'gpt-4o'
  })
  const [modelsByProvider, setModelsByProvider] =
    useState<Record<AiGatewayProvider, AiGatewayModel[]>>(DEFAULT_AI_GATEWAY_MODELS)

  // API Key Customization Modal
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false)
  const [customKeyInput, setCustomKeyInput] = useState<string>('')

  // Message & UI State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '✨ **Nexus Sovereign AI Chat is online.**\n\nAll AI providers are connected. Responses automatically format mathematical equations in **LaTeX** ($inline$ and $$block$$). Your complete chat history is continuously persisted directly into your **OS Documents** folder (`Documents/Nexus_Docs/Chat_History/`) as formatted Markdown and JSON documents.',
      timestamp: new Date().toISOString()
    }
  ])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Voice State
  const [voiceReplies, setVoiceReplies] = useState(
    localStorage.getItem('nexus_ai_chat_main_voice') !== 'false'
  )
  const [voiceStatus, setVoiceStatus] = useState('Main voice ready')
  const [voiceProfile, setVoiceProfile] = useState(
    localStorage.getItem('nexus_voice_profile') === 'FEMALE' ? 'Aoede' : 'Puck'
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

  // Persist Preferences
  useEffect(() => {
    localStorage.setItem('nexus_ai_chat_provider', provider)
    localStorage.setItem('nexus_ai_chat_model', model)
  }, [provider, model])

  useEffect(() => {
    localStorage.setItem('nexus_ai_chat_main_voice', String(voiceReplies))
  }, [voiceReplies])

  // Fetch Documents Folder Path & Saved Sessions on Mount
  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('chat-history:get-folder-path').then((res: any) => {
        if (res?.folderPath) setDocsFolderPath(res.folderPath)
      })

      window.electron.ipcRenderer.invoke('chat-history:get-sessions').then((res: any) => {
        if (res?.success && Array.isArray(res.sessions) && res.sessions.length > 0) {
          setSavedSessions(res.sessions)
        }
      })
    }
  }, [])

  // Sync Voice Profile
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

  // Dynamic Model Fetching
  useEffect(() => {
    AI_GATEWAY_PROVIDERS.forEach(async (nextProvider) => {
      try {
        const result = await window.electron.ipcRenderer.invoke('ai-gateway:list-models', {
          provider: nextProvider
        })
        if (result?.success && Array.isArray(result.models) && result.models.length > 0) {
          setModelsByProvider((current) => ({ ...current, [nextProvider]: result.models }))
        }
      } catch {}
    })

    // Fetch Puter catalog models directly from renderer
    listPuterModels().then((puterModels) => {
      if (puterModels.length > 0) {
        setModelsByProvider((current) => ({
          ...current,
          puter: [
            ...puterModels.slice(0, 80),
            { provider: 'puter', id: 'custom', label: 'Custom Model ID (Enter below)' }
          ]
        }))
      }
    })
  }, [])

  // Save Active Session to User's Documents Folder
  const persistSessionToDocuments = async (
    currentMessages: ChatMessage[],
    activeTitle = sessionTitle,
    activeId = sessionId
  ) => {
    if (!window.electron?.ipcRenderer) return
    try {
      const res = await window.electron.ipcRenderer.invoke('chat-history:save-session', {
        id: activeId,
        title: activeTitle,
        provider,
        model: model || 'default',
        messages: currentMessages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp || new Date().toISOString()
        }))
      })

      if (res?.success) {
        // Refresh session list
        const sessionsRes = await window.electron.ipcRenderer.invoke('chat-history:get-sessions')
        if (sessionsRes?.success) setSavedSessions(sessionsRes.sessions)
      }
    } catch (err) {
      console.error('[ChatHistory] Auto-save to documents failed:', err)
    }
  }

  // Create Fresh Session
  const handleNewChat = () => {
    const newId = `nexus_session_${Date.now()}`
    setSessionId(newId)
    setSessionTitle('New Nexus Session')
    setAttachments([])
    setError('')
    const initialWelcome: ChatMessage = {
      role: 'assistant',
      content:
        '✨ **New chat session started.**\n\nAsk any question, request mathematical derivations in LaTeX, generate art, or execute tasks. Everything is safely written to your **Documents** folder.',
      timestamp: new Date().toISOString()
    }
    setMessages([initialWelcome])
    persistSessionToDocuments([initialWelcome], 'New Nexus Session', newId)
  }

  // Load Past Session
  const handleLoadSession = (session: SavedSessionSummary) => {
    setSessionId(session.id)
    setSessionTitle(session.title)
    if (session.provider && AI_GATEWAY_PROVIDERS.includes(session.provider as any)) {
      setProvider(session.provider as AiGatewayProvider)
    }
    if (session.model) setModel(session.model)
    setMessages(
      (session.messages || []).map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: m.content,
        timestamp: m.timestamp
      }))
    )
    setShowHistoryDrawer(false)
  }

  // Delete Past Session
  const handleDeleteSession = async (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.electron?.ipcRenderer) return
    await window.electron.ipcRenderer.invoke('chat-history:delete-session', idToDelete)
    setSavedSessions((current) => current.filter((s) => s.id !== idToDelete))
    if (sessionId === idToDelete) {
      handleNewChat()
    }
  }

  // Open Documents Folder in Windows File Explorer
  const handleOpenDocumentsFolder = async () => {
    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('chat-history:open-folder')
    }
  }

  // Export Session as Markdown Download
  const handleExportMarkdown = () => {
    const mdLines = [
      `# 🧠 Nexus AI Session: ${sessionTitle}`,
      `**Date:** ${new Date().toLocaleString()}`,
      `**Provider:** ${PROVIDER_DISPLAY_NAMES[provider] || provider} | **Model:** ${model}`,
      `\n---\n`
    ]
    messages.forEach((m) => {
      mdLines.push(`### ${m.role === 'user' ? '👤 User' : '🤖 Nexus AI'}`)
      mdLines.push(m.content)
      mdLines.push('\n---\n')
    })
    const blob = new Blob([mdLines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sessionTitle.replace(/\s+/g, '_')}_${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Voice Controls
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
        `Read this AI Chat response aloud using the current Nexus assistant voice. Keep the wording faithful:\n\n${clean.slice(0, 5000)}`,
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

  // Attachments
  const handleAttachFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setError('')
    try {
      const encoded = await Promise.all(files.map(fileToGeminiAttachment))
      setAttachments((current) => [...current, ...encoded])
    } catch (err: any) {
      setError(err?.message || 'Unable to attach selected files.')
    } finally {
      event.target.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, attachmentIndex) => attachmentIndex !== index))
  }

  const copyMessageText = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {}
  }

  // Submit Chat Message
  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault()
    const prompt = input.trim()
    const selectedAttachments = attachments
    if ((!prompt && selectedAttachments.length === 0) || isSending) return

    setError('')
    setInput('')
    setAttachments([])

    const attachmentSummary = selectedAttachments.length
      ? `\n\nAttached files:\n${selectedAttachments
          .map((attachment) => `- ${attachment.name} (${formatAttachmentSize(attachment.size)})`)
          .join('\n')}`
      : ''
    const userContent = `${prompt || 'Please review the attached file(s).'}${attachmentSummary}`

    const userMsg: ChatMessage = {
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString()
    }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setIsSending(true)

    // Update title dynamically if this is the first message
    let activeTitle = sessionTitle
    if (sessionTitle === 'New Nexus Session' && prompt) {
      activeTitle = prompt.slice(0, 40)
      setSessionTitle(activeTitle)
    }

    // Persist immediately to User's Documents folder
    void persistSessionToDocuments(nextMessages, activeTitle)
    void saveMessage('user', userContent)

    // Wake up demand components if requested
    demandComponentManager.evaluatePromptAndActivate(prompt)

    const lowerPrompt = (prompt || '').toLowerCase().trim()

    // 1. Autonomous Screen Use Command
    if (
      lowerPrompt.startsWith('/screen ') ||
      lowerPrompt.startsWith('use screen to ') ||
      lowerPrompt.startsWith('/click ')
    ) {
      const isSingleClick = lowerPrompt.startsWith('/click ')
      const screenGoal = prompt
        .replace(/^\/(?:screen|click)\s+/i, '')
        .replace(/^use screen to\s+/i, '')
        .trim()

      try {
        if (isSingleClick) {
          const clickRes = await window.electron.ipcRenderer.invoke('skyvern:visual-click', screenGoal)
          const response = `👁️ [Screen Visual Click]\n\n${clickRes.message}`
          const assistantMsg: ChatMessage = { role: 'assistant', content: response, timestamp: new Date().toISOString() }
          const updated = [...nextMessages, assistantMsg]
          setMessages(updated)
          void persistSessionToDocuments(updated, activeTitle)
          await saveMessage('nexus', response)
          if (voiceReplies) await speakWithMainVoice(response)
        } else {
          const taskRes = await window.electron.ipcRenderer.invoke('skyvern:start-task', {
            goal: screenGoal,
            mode: 'desktop'
          })
          const response = `👁️ [Screen Use Agent Deployed]\n\n**Goal**: "${screenGoal}"\n**Status**: Initialized (${taskRes.status})\n\nNexus AI is visually inspecting your screen and executing actions autonomously.`
          const assistantMsg: ChatMessage = { role: 'assistant', content: response, timestamp: new Date().toISOString() }
          const updated = [...nextMessages, assistantMsg]
          setMessages(updated)
          void persistSessionToDocuments(updated, activeTitle)
          await saveMessage('nexus', response)
          if (voiceReplies) await speakWithMainVoice(response)
        }
      } catch (err: any) {
        const errResponse = `❌ [Screen Use Error]: ${err?.message || 'Failed to start screen use task.'}`
        const updated: ChatMessage[] = [
          ...nextMessages,
          { role: 'assistant', content: errResponse, timestamp: new Date().toISOString() }
        ]
        setMessages(updated)
        void persistSessionToDocuments(updated, activeTitle)
      } finally {
        setIsSending(false)
      }
      return
    }

    // 2. Pollinations Art / Image Generation Command
    const isArtCommand =
      lowerPrompt.startsWith('/image ') ||
      lowerPrompt.startsWith('/imagine ') ||
      lowerPrompt.startsWith('/art ') ||
      lowerPrompt.startsWith('generate image') ||
      lowerPrompt.startsWith('generate art') ||
      lowerPrompt.startsWith('create image') ||
      lowerPrompt.startsWith('create art') ||
      lowerPrompt.startsWith('draw ') ||
      lowerPrompt.startsWith('paint ')

    if (isArtCommand) {
      const artPrompt =
        prompt
          .replace(/^\/(?:image|imagine|art)\s+/i, '')
          .replace(
            /^(?:generate|create)\s+(?:an?\s+)?(?:image|art|picture|illustration|wallpaper|photo)\s+(?:of\s+)?/i,
            ''
          )
          .replace(/^(?:draw|paint)\s+(?:an?\s+)?/i, '')
          .trim() || prompt

      try {
        const artResult = await handleImageGeneration(artPrompt)
        const response = `🎨 [Puter AI Art Engine]\n\n${artResult}\n\n**Prompt:** "${artPrompt}"\n\n*Saved to your Gallery & Documents folder.*`
        const assistantMsg: ChatMessage = { role: 'assistant', content: response, timestamp: new Date().toISOString() }
        const updated = [...nextMessages, assistantMsg]
        setMessages(updated)
        void persistSessionToDocuments(updated, activeTitle)
        await saveMessage('nexus', response)
        if (voiceReplies) await speakWithMainVoice(`Rendering visual art on Puter AI for ${artPrompt.slice(0, 50)}`)
      } catch (err: any) {
        const errResponse = `❌ [Art Generation Error]: ${err?.message || 'Failed to generate visual art.'}`
        const updated: ChatMessage[] = [
          ...nextMessages,
          { role: 'assistant', content: errResponse, timestamp: new Date().toISOString() }
        ]
        setMessages(updated)
        void persistSessionToDocuments(updated, activeTitle)
      } finally {
        setIsSending(false)
      }
      return
    }

    // 3. Puter AI Direct In-Browser Handler
    const effectiveModel =
      (provider === 'puter' || provider === 'ollama') &&
      (model === 'custom' || !model)
        ? customModel.trim() || 'gpt-4o'
        : model

    if (provider === 'puter') {
      try {
        const puterContent = await executePuterChat({
          model: effectiveModel,
          system: systemPrompt,
          messages: nextMessages
            .filter((m) => !m.content.includes('Nexus Sovereign AI Chat is online'))
            .slice(-14)
            .map((m) => ({ role: m.role, content: m.content }))
        })

        const response = puterContent || 'No response returned from Puter AI.'
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
          provider: 'puter',
          model: effectiveModel
        }
        const updated = [...nextMessages, assistantMsg]
        setMessages(updated)
        void persistSessionToDocuments(updated, activeTitle)
        await saveMessage('nexus', response)

        if (isWhiteboardCommand(userContent)) {
          publishWhiteboardWrite(createWhiteboardPayload(extractWhiteboardQuestion(userContent), response, 'chat'))
        }
        if (voiceReplies) await speakWithMainVoice(response)
      } catch (err: any) {
        console.warn('[Puter AI Direct] Falling back to AI Gateway:', err?.message)
        // Fall back to main process gateway
        await executeGatewayChat(nextMessages, userContent, activeTitle, effectiveModel)
      } finally {
        setIsSending(false)
      }
      return
    }

    // 4. Multi-Provider AI Gateway
    await executeGatewayChat(nextMessages, userContent, activeTitle, effectiveModel)
  }

  const executeGatewayChat = async (
    nextMessages: ChatMessage[],
    userContent: string,
    activeTitle: string,
    effectiveModel: string
  ) => {
    try {
      const requestProvider = attachments.length ? 'gemini' : provider
      const requestModel = attachments.length && provider !== 'gemini' ? DEFAULT_AI_GATEWAY_MODEL.gemini : effectiveModel

      const result = await window.electron.ipcRenderer.invoke('ai-gateway:chat', {
        provider: requestProvider,
        model: requestModel,
        modelsByProvider: {
          puter: effectiveModel,
          gemini: DEFAULT_AI_GATEWAY_MODEL.gemini,
          groq: localStorage.getItem('nexus_default_groq_model') || DEFAULT_AI_GATEWAY_MODEL.groq,
          fireworks: localStorage.getItem('nexus_default_fireworks_model') || DEFAULT_AI_GATEWAY_MODEL.fireworks,
          openai: DEFAULT_AI_GATEWAY_MODEL.openai,
          anthropic: DEFAULT_AI_GATEWAY_MODEL.anthropic,
          deepseek: DEFAULT_AI_GATEWAY_MODEL.deepseek,
          ollama: DEFAULT_AI_GATEWAY_MODEL.ollama
        },
        puterToken: localStorage.getItem('nexus_puter_token') || '',
        geminiApiKey: localStorage.getItem('nexus_gemini_api_key') || '',
        groqApiKey: localStorage.getItem('nexus_groq_api_key') || '',
        openaiApiKey: localStorage.getItem('nexus_openai_api_key') || '',
        anthropicApiKey: localStorage.getItem('nexus_anthropic_api_key') || '',
        deepseekApiKey: localStorage.getItem('nexus_deepseek_api_key') || '',
        system: systemPrompt,
        fallbackOrder: attachments.length
          ? ['gemini']
          : ['puter', 'gemini', 'groq', 'openai', 'anthropic', 'deepseek', 'ollama'],
        attachments,
        messages: nextMessages
          .filter((message) => !message.content.includes('Nexus Sovereign AI Chat is online'))
          .slice(-14)
      })

      if (!result?.success) throw new Error(result?.error || 'AI gateway request failed.')

      const response =
        attachments.length && provider !== 'gemini'
          ? `[Multimodal Attachment via Gemini]\n\n${result.content || 'No response returned.'}`
          : result.provider && result.provider !== provider
          ? `[Automatic Fallback: ${result.provider}]\n\n${result.content || 'No response returned.'}`
          : result.content || 'No response returned.'

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        provider: result.provider || provider,
        model: requestModel
      }
      const updated = [...nextMessages, assistantMsg]
      setMessages(updated)
      void persistSessionToDocuments(updated, activeTitle)
      await saveMessage('nexus', response)

      if (isWhiteboardCommand(userContent)) {
        publishWhiteboardWrite(createWhiteboardPayload(extractWhiteboardQuestion(userContent), response, 'chat'))
      }
      if (voiceReplies) await speakWithMainVoice(response)
    } catch (err: any) {
      // Secondary fallback to Puter AI
      try {
        const backupModel = customModel.trim() || 'gpt-4o'
        const backupContent = await executePuterChat({
          model: backupModel,
          system: systemPrompt,
          messages: nextMessages
            .filter((m) => !m.content.includes('Nexus Sovereign AI Chat is online'))
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.content }))
        })
        const response = `[Active Fallback: Puter AI (${backupModel})]\n\n${backupContent}`
        const assistantMsg: ChatMessage = { role: 'assistant', content: response, timestamp: new Date().toISOString() }
        const updated = [...nextMessages, assistantMsg]
        setMessages(updated)
        void persistSessionToDocuments(updated, activeTitle)
        await saveMessage('nexus', response)
        if (voiceReplies) await speakWithMainVoice(response)
      } catch (backupErr: any) {
        const message = `${err?.message || 'Gateway failed'} (Puter Fallback: ${backupErr?.message || 'Offline'})`
        setError(message)
        const updated: ChatMessage[] = [
          ...nextMessages,
          { role: 'assistant', content: `❌ Error: ${message}`, timestamp: new Date().toISOString() }
        ]
        setMessages(updated)
        void persistSessionToDocuments(updated, activeTitle)
      }
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
    const next = [...messages, { role: 'user' as const, content: prompt, timestamp: new Date().toISOString() }]
    setMessages(next)

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

  const handleSaveCustomKey = async () => {
    const key = customKeyInput.trim()
    if (!key) return
    localStorage.setItem(`nexus_${provider}_api_key`, key)
    if (provider === 'gemini') localStorage.setItem('gemini_api_key', key)
    if (provider === 'groq') localStorage.setItem('groq_api_key', key)

    // Save to secure vault via IPC
    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('secure-save-keys', {
        geminiKey: provider === 'gemini' ? key : localStorage.getItem('nexus_gemini_api_key') || '',
        groqKey: provider === 'groq' ? key : localStorage.getItem('nexus_groq_api_key') || '',
        fireworksKey: provider === 'fireworks' ? key : localStorage.getItem('nexus_fireworks_api_key') || '',
        puterToken: provider === 'puter' ? key : localStorage.getItem('nexus_puter_token') || ''
      })
    }
    setShowKeyModal(false)
    setCustomKeyInput('')
  }

  return (
    <div className="h-full w-full overflow-hidden p-3 text-zinc-100 flex flex-col">
      {/* Top Session Bar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/60 px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold font-mono uppercase tracking-wider text-emerald-300 truncate max-w-[200px]">
              {sessionTitle}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
            ({messages.length} messages)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Documents Folder Indicator & Explorer Button */}
          <button
            type="button"
            onClick={handleOpenDocumentsFolder}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-mono text-emerald-300 transition hover:bg-emerald-500/20 hover:border-emerald-400"
            title={`Chat history saved in: ${docsFolderPath || 'Documents/Nexus_Docs/Chat_History'}. Click to open in File Explorer.`}
          >
            <RiFolderOpenLine size={14} />
            <span className="hidden md:inline">Documents Folder</span>
            <span className="text-[9px] text-emerald-400/70 font-mono">📁 Live Sync</span>
          </button>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-zinc-200 transition hover:bg-white/15"
            title="Start new conversation"
          >
            <RiAddLine size={14} />
            <span>New Chat</span>
          </button>

          {/* History Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowHistoryDrawer((prev) => !prev)}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-zinc-200 transition hover:bg-white/15"
            title="Browse past conversations"
          >
            <RiHistoryLine size={14} />
            <span>History ({savedSessions.length})</span>
          </button>

          {/* Export Markdown */}
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/15"
            title="Download formatted Markdown log"
          >
            <RiDownload2Line size={13} />
          </button>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-12 gap-3">
        {/* Left Control Sidebar */}
        <aside className="col-span-12 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 scrollbar-small rounded-2xl border border-emerald-500/15 bg-black/65 p-3.5 lg:col-span-3">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-300 shadow-sm">
              <RiRobot2Line size={22} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-[0.16em]">Nexus AI</h2>
              <p className="text-[9px] font-mono tracking-widest text-emerald-400/80">
                SOVEREIGN MULTI-ENGINE
              </p>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-bold">
                AI Provider
              </label>
              <button
                type="button"
                onClick={() => setShowKeyModal(true)}
                className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline"
                title="Configure custom API keys"
              >
                <RiKey2Line size={11} /> API Key
              </button>
            </div>

            <select
              value={provider}
              onChange={(event) => {
                const nextProvider = event.target.value as AiGatewayProvider
                setProvider(nextProvider)
                setModel(DEFAULT_AI_GATEWAY_MODEL[nextProvider])
              }}
              className="w-full rounded-lg border border-white/15 bg-black/90 p-2.5 text-xs font-bold text-zinc-100 outline-none focus:border-emerald-400/60 transition"
            >
              <option value="puter">Puter AI (Primary • 500+ Frontier Models • Zero-Auth)</option>
              <option value="gemini">Google Gemini API (Flagship Multimodal)</option>
              <option value="groq">Groq Cloud (Ultra-Fast LPU)</option>
              <option value="openai">OpenAI Direct (GPT-4o / o1 / o3-mini)</option>
              <option value="anthropic">Anthropic (Claude 3.7 / 3.5 Sonnet)</option>
              <option value="deepseek">DeepSeek (V3 / R1 Reasoner)</option>
              <option value="ollama">Ollama / Edge0 (Local Offline)</option>
              <option value="fireworks">Fireworks AI (Open Models)</option>
            </select>
          </div>

          {/* Model Selection */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-bold">
                Active Model
              </label>
              <span className="text-[9px] font-mono text-cyan-400 font-bold uppercase">
                {modelsByProvider[provider]?.length || 0} Models
              </span>
            </div>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/90 p-2.5 text-xs font-bold text-zinc-100 outline-none focus:border-cyan-400/60 transition"
            >
              {(modelsByProvider[provider] || DEFAULT_AI_GATEWAY_MODELS[provider] || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Model Input */}
          {(model === 'custom' || provider === 'puter' || provider === 'ollama') && (
            <div className="flex flex-col gap-1 p-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10">
              <label className="text-[9px] font-mono uppercase tracking-wider text-emerald-300 font-bold">
                Custom Model Identifier
              </label>
              <input
                type="text"
                value={customModel}
                onChange={(e) => {
                  setCustomModel(e.target.value)
                  localStorage.setItem('nexus_ai_chat_custom_model', e.target.value)
                }}
                placeholder="e.g. claude-3-7-sonnet, deepseek-r1, gpt-4o"
                className="rounded-lg border border-white/15 bg-black/90 p-2 text-xs font-mono text-zinc-100 outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {/* LaTeX Math & Storage Status Pill */}
          <div className="p-2.5 rounded-xl border border-white/10 bg-white/[0.03] space-y-1.5 text-[10px]">
            <div className="flex items-center justify-between font-mono font-bold">
              <span className="text-zinc-400">MATH PARSER</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <RiBrainLine /> LaTeX Active
              </span>
            </div>
            <p className="text-zinc-500 leading-snug">
              Equations automatically render with KaTeX. Documents folder updates in real-time.
            </p>
          </div>

          {/* Voice Assistant Module */}
          <div className="mt-auto rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-200">
                Nexus Voice
              </span>
              <span className="rounded-full border border-cyan-400/20 bg-black/60 px-2 py-0.5 text-[8px] font-mono uppercase text-cyan-300">
                {voiceProfile}
              </span>
            </div>
            <div className="mt-1 truncate text-[9px] font-mono uppercase text-zinc-400">
              {voiceStatus}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={toggleMainVoice}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                  nexusService.isConnected && !isMicMuted
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                    : 'border-white/10 bg-white/5 text-zinc-300 hover:text-cyan-200'
                }`}
              >
                {nexusService.isConnected && !isMicMuted ? <RiMicLine /> : <RiMicOffLine />}
                {nexusService.isConnected ? (isMicMuted ? 'Muted' : 'Live') : 'Start'}
              </button>
              <button
                type="button"
                onClick={() => setVoiceReplies((current) => !current)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                  voiceReplies ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-white/10 bg-white/5 text-zinc-400'
                }`}
              >
                <RiVolumeUpLine /> {voiceReplies ? 'Replies' : 'Silent'}
              </button>
            </div>
            <button
              type="button"
              onClick={stopSpeaking}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-200 transition hover:bg-red-500/20"
            >
              <RiStopCircleLine /> Stop Audio
            </button>
          </div>
        </aside>

        {/* Main Chat Center Stage */}
        <main className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/50 lg:col-span-9 relative">
          {/* History Drawer Modal */}
          {showHistoryDrawer && (
            <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-md p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <RiHistoryLine className="text-emerald-400" size={18} />
                  <h3 className="font-bold text-sm text-zinc-100">Saved Conversations in Documents</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryDrawer(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                >
                  <RiCloseLine size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-small">
                {savedSessions.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                    No saved conversations found in Documents folder yet.
                  </div>
                ) : (
                  savedSessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleLoadSession(s)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        s.id === sessionId
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs truncate">{s.title}</div>
                        <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{new Date(s.updatedAt || s.createdAt).toLocaleString()}</span>
                          <span>•</span>
                          <span>{s.provider}</span>
                          <span>•</span>
                          <span>{s.messages?.length || 0} msgs</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                        title="Delete conversation from Documents"
                      >
                        <RiDeleteBinLine size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-small">
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`group relative rounded-2xl border p-4 transition ${
                    message.role === 'user'
                      ? 'ml-auto max-w-[85%] border-emerald-500/25 bg-emerald-500/10 shadow-md'
                      : 'border-white/10 bg-white/[0.04] shadow-md max-w-[92%]'
                  }`}
                >
                  {/* Message Meta Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 mb-2 text-[10px] font-mono text-zinc-400">
                    <span className="font-bold uppercase tracking-wider text-emerald-300/80">
                      {message.role === 'user' ? '👤 You' : `🤖 Nexus AI (${message.provider || provider})`}
                    </span>
                    <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition">
                      {message.timestamp && (
                        <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => copyMessageText(message.content, index)}
                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                        title="Copy message"
                      >
                        {copiedIndex === index ? <RiCheckLine className="text-emerald-400" /> : <RiFileCopyLine />}
                      </button>
                      {message.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => speakWithMainVoice(message.content)}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-cyan-300"
                          title="Read aloud with Nexus Voice"
                        >
                          <RiVolumeUpLine />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Render Message Content with LaTeX Math */}
                  <MarkdownMath content={message.content} />
                </div>
              ))}

              {isSending && (
                <div className="inline-flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 animate-pulse">
                  <RiRefreshLine className="animate-spin text-emerald-400" />
                  <span>Nexus AI is thinking and formulating LaTeX responses...</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {error ? (
            <div className="border-t border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-200 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} className="text-red-300 hover:text-white">
                <RiCloseLine size={16} />
              </button>
            </div>
          ) : null}

          {/* Attachments Preview */}
          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-white/10 bg-white/[0.03] px-3 py-2">
              {attachments.map((attachment, index) => (
                <div
                  key={`${attachment.name}-${attachment.size}-${index}`}
                  className="flex max-w-full items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] text-emerald-100"
                >
                  <RiFileTextLine className="shrink-0" />
                  <span className="max-w-[180px] truncate">{attachment.name}</span>
                  <span className="shrink-0 text-emerald-100/60 font-mono">{formatAttachmentSize(attachment.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="rounded p-0.5 text-emerald-100/70 hover:text-white"
                  >
                    <RiCloseLine />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Quick Prompt Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-1 border-t border-white/5 bg-black/40 text-[10px] font-mono scrollbar-none">
            <span className="text-zinc-500 uppercase tracking-widest shrink-0">Quick:</span>
            <button
              type="button"
              onClick={() => { setInput('Explain Schrödinger equation in quantum mechanics and write it in LaTeX.'); handleSubmit(); }}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-zinc-300 hover:border-emerald-400 hover:text-emerald-300 transition"
            >
              ⚛️ Schrödinger Equation
            </button>
            <button
              type="button"
              onClick={() => { setInput('Derive the quadratic formula step by step with LaTeX math.'); handleSubmit(); }}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-zinc-300 hover:border-emerald-400 hover:text-emerald-300 transition"
            >
              📐 Quadratic Formula
            </button>
            <button
              type="button"
              onClick={() => { setInput('Explain Bayes theorem with formula in LaTeX and an example.'); handleSubmit(); }}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-zinc-300 hover:border-emerald-400 hover:text-emerald-300 transition"
            >
              📊 Bayes Theorem
            </button>
            <button
              type="button"
              onClick={() => { setInput('/image futuristic sovereign quantum cyber desktop workstation neon emerald 8k'); handleSubmit(); }}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-zinc-300 hover:border-emerald-400 hover:text-emerald-300 transition"
            >
              🎨 /image Cyber Workstation
            </button>
          </div>

          {/* Input & Action Bar */}
          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-white/10 p-3 bg-black/80">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleAttachFiles}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-3 text-emerald-200 transition hover:bg-emerald-400 hover:text-black disabled:opacity-40"
              title="Attach documents, images, code files"
            >
              <RiAttachment2 size={18} />
            </button>

            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={attachments.length ? 'Ask about attached files...' : 'Ask Nexus AI (formulas render in LaTeX, history saves to Documents)...'}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/90 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-400/70 transition"
            />

            <button
              type="button"
              onClick={sendToMainVoiceAssistant}
              disabled={isSending || !input.trim()}
              className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3.5 py-3 text-cyan-200 transition hover:bg-cyan-400 hover:text-black disabled:opacity-40"
              title="Send to main voice assistant"
            >
              <RiVolumeUpLine size={18} />
            </button>

            <button
              type="submit"
              disabled={isSending || (!input.trim() && attachments.length === 0)}
              className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
              title="Send prompt to active AI"
            >
              <RiSendPlane2Line size={18} />
            </button>
          </form>
        </main>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-zinc-950 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <RiKey2Line className="text-emerald-400" size={20} />
                <h3 className="font-bold text-sm text-zinc-100">
                  Configure {PROVIDER_DISPLAY_NAMES[provider]} Key
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <RiCloseLine size={20} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Keys are encrypted with Windows DPAPI in your local vault. Puter.js AI runs zero-auth in browser without mandatory keys.
            </p>

            <input
              type="password"
              value={customKeyInput}
              onChange={(e) => setCustomKeyInput(e.target.value)}
              placeholder={`Enter custom ${provider} API key...`}
              className="w-full rounded-xl border border-white/15 bg-black/90 p-3 text-xs font-mono text-zinc-100 outline-none focus:border-emerald-400"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomKey}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400"
              >
                Save Encrypted Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
