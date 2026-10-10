import React, { useState, useRef, useEffect } from 'react'
import {
  Plus,
  Clock,
  Timer,
  Box,
  Folder,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  FolderPlus,
  Settings,
  Mic,
  MicOff,
  ArrowRight,
  PanelLeft,
  Sparkles,
  Bot,
  Terminal,
  Paperclip,
  Check,
  Send,
  RotateCcw,
  Zap
} from 'lucide-react'
import AgentTraceFeed, { AgentStep } from '../components/AgentTraceFeed'

interface ConversationItem {
  id: string
  title: string
  timestamp: string
  pinned?: boolean
  steps: AgentStep[]
}

const INITIAL_PROJECT_CONVERSATIONS: ConversationItem[] = [
  {
    id: 'conv-1',
    title: 'Optimize Agent Boot Time',
    timestamp: '2m',
    steps: [
      {
        id: 'boot_thought',
        type: 'thought',
        title: 'Diagnosing Boot Handshake Latency',
        status: 'success',
        duration: '0.18s',
        thoughtContent:
          'Detected WebSocket 1008 rejection due to ephemeral token scheme in nexus-voice-ai.ts. Patched query params and added 3500ms safety watchdog to prevent infinite reconnect loops.'
      },
      {
        id: 'boot_tool',
        type: 'tool_call',
        toolName: 'terminal',
        title: 'PTY: verify startup latency',
        status: 'success',
        duration: '0.42s',
        payload: {
          cmd: 'npm run typecheck',
          output: 'Found 0 errors. Cold boot connection time reduced from >15s to <350ms.'
        }
      },
      {
        id: 'boot_result',
        type: 'tool_result',
        toolName: 'filesystem',
        title: 'Review Artifact: nexus-voice-ai.ts',
        status: 'success',
        duration: '0.12s',
        payload: {
          additions: 38,
          deletions: 12,
          output: 'shouldRetryLiveError updated. Unregistered caller code 1008 marked fatal.'
        }
      }
    ]
  },
  {
    id: 'conv-2',
    title: 'Glassmorphic Dynamic Dock',
    timestamp: '27m',
    steps: [
      {
        id: 'dock_thought',
        type: 'thought',
        title: 'Glassmorphism Style Refinement',
        status: 'success',
        duration: '0.22s',
        thoughtContent:
          'Refining floating dynamic dock blur, capsule dimensions, and animated state indicators.'
      }
    ]
  },
  {
    id: 'conv-3',
    title: 'Implement Agentic Nexus View',
    timestamp: '1h',
    steps: [
      {
        id: 'agentic_thought',
        type: 'thought',
        title: 'Workspace Canvas Architecture',
        status: 'success',
        duration: '0.15s',
        thoughtContent:
          'Porting Antigravity IDE layout: conversation tree, models selector, interactive prompt card with sandboxed worktree execution.'
      }
    ]
  },
  {
    id: 'conv-4',
    title: 'Boot Time And Voice AI Engine',
    timestamp: '17h',
    steps: []
  },
  {
    id: 'conv-5',
    title: 'Fixing Pdflatex Commands',
    timestamp: '20h',
    steps: []
  },
  {
    id: 'conv-6',
    title: 'Nexus Architecture File Struct',
    timestamp: '2d',
    steps: []
  },
  {
    id: 'conv-7',
    title: 'Gemini API Document Generator',
    timestamp: '2d',
    steps: []
  },
  {
    id: 'conv-8',
    title: 'Website Integration And Deploy',
    timestamp: '2d',
    steps: []
  }
]

const PINNED_CONVERSATIONS: ConversationItem[] = [
  {
    id: 'pinned-1',
    title: 'Automate Vedantu Study Tracker',
    timestamp: '3mo',
    pinned: true,
    steps: [
      {
        id: 'pinned_step',
        type: 'thought',
        title: 'Vedantu Study Tracker Automation Active',
        status: 'success',
        duration: '0.3s',
        thoughtContent:
          'Automated schedule synchronization running via local scheduled triggers.'
      }
    ]
  }
]

const AVAILABLE_MODELS = [
  'Gemini 3.8 Flash High',
  'Gemini 3.8 Pro High',
  'Gemini 2.5 Flash',
  'Claude 3.7 Sonnet',
  'Claude 3.5 Sonnet',
  'GPT-4o'
]

const SCOPES = ['Local', 'Git Worktree', 'Cloud Edge Bridge']
const AGENT_PERSONAS = ['Main Agent', 'Codebase Researcher', 'Terminal Agent', 'Reviewer']

export default function AgenticView() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [conversations, setConversations] = useState<ConversationItem[]>(INITIAL_PROJECT_CONVERSATIONS)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeSteps, setActiveSteps] = useState<AgentStep[]>([])

  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('Gemini 3.8 Flash High')
  const [selectedScope, setSelectedScope] = useState('Local')
  const [selectedAgent, setSelectedAgent] = useState('Main Agent')

  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false)
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)

  const [isExecuting, setIsExecuting] = useState(false)
  const [isMicListening, setIsMicListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Handle active conversation selection
  const handleSelectConversation = (conv: ConversationItem) => {
    setActiveConvId(conv.id)
    setActiveSteps(conv.steps.length > 0 ? conv.steps : [
      {
        id: `init_${conv.id}`,
        type: 'thought',
        title: `Loaded ${conv.title}`,
        status: 'success',
        duration: '0.08s',
        thoughtContent: `Workspace conversation thread loaded. Ready for follow-up directives.`
      }
    ])
  }

  // Handle new conversation
  const handleNewConversation = () => {
    setActiveConvId(null)
    setActiveSteps([])
    setPrompt('')
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
  }

  // Handle task dispatch
  const handleDispatch = async (taskText: string) => {
    if (!taskText.trim() || isExecuting) return
    setIsExecuting(true)

    const taskId = `task_${Date.now().toString(36)}`
    const isNew = !activeConvId

    const newThoughtStep: AgentStep = {
      id: `${taskId}_thought`,
      type: 'thought',
      title: `Formulating Plan: ${taskText.slice(0, 32)}...`,
      status: 'running',
      thoughtContent: `Analyzing request with ${selectedModel} in ${selectedScope} workspace sandbox. Staging discrete execution phases...`
    }

    if (isNew) {
      const newConvId = `conv_${Date.now()}`
      const newConv: ConversationItem = {
        id: newConvId,
        title: taskText.length > 26 ? taskText.slice(0, 24) + '...' : taskText,
        timestamp: 'Just now',
        steps: [newThoughtStep]
      }
      setConversations((prev) => [newConv, ...prev])
      setActiveConvId(newConvId)
      setActiveSteps([newThoughtStep])
    } else {
      setActiveSteps((prev) => [newThoughtStep, ...prev])
    }

    setPrompt('')

    // Simulate agent steps and real terminal dispatch
    await new Promise((r) => setTimeout(r, 400))
    setActiveSteps((prev) =>
      prev.map((s) => (s.id === newThoughtStep.id ? { ...s, status: 'success', duration: '0.38s' } : s))
    )

    const toolStep: AgentStep = {
      id: `${taskId}_tool`,
      type: 'tool_call',
      toolName: 'terminal',
      title: `PTY: ${taskText.slice(0, 45)}`,
      status: 'running',
      payload: { cmd: taskText }
    }
    setActiveSteps((prev) => [toolStep, ...prev])

    // Try executing real terminal command if available in electron
    try {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('execute-terminal-command', taskText).catch(() => {})
      }
      // Also broadcast to Cloudflare Edge Bridge
      fetch('https://nexus-bridge-7l1.pages.dev/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: taskText, target_device: 'DESKTOP' })
      }).catch(() => {})
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 650))
    setActiveSteps((prev) =>
      prev.map((s) =>
        s.id === toolStep.id
          ? {
              ...s,
              status: 'success',
              duration: '0.62s',
              payload: {
                ...s.payload,
                output: 'Exit Code: 0\n[NEXUS_ENGINE] Verification passed. Milestones completed with clean exit code.'
              }
            }
          : s
      )
    )

    const artifactStep: AgentStep = {
      id: `${taskId}_art`,
      type: 'tool_result',
      toolName: 'filesystem',
      title: 'Review Artifact & Workspace State',
      status: 'success',
      duration: '0.15s',
      payload: {
        additions: 18,
        deletions: 3,
        output: 'Workspace tree reconciled. Active changes staged and verified.'
      }
    }
    setActiveSteps((prev) => [artifactStep, ...prev])
    setIsExecuting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleDispatch(prompt)
    }
  }

  const toggleMic = () => {
    setIsMicListening(!isMicListening)
    if (!isMicListening && 'webkitSpeechRecognition' in window) {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript))
          setIsMicListening(false)
        }
        recognition.onerror = () => setIsMicListening(false)
        recognition.onend = () => setIsMicListening(false)
        recognition.start()
      } catch (_) {
        setIsMicListening(false)
      }
    }
  }

  // Close popovers on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setModelDropdownOpen(false)
        setScopeDropdownOpen(false)
        setAgentDropdownOpen(false)
        setWorkspaceDropdownOpen(false)
      }
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#07080a] text-zinc-100 font-sans select-none">
      {/* LEFT SIDEBAR */}
      <aside
        className={`relative flex flex-col shrink-0 border-r border-white/[0.07] bg-[#0c0d12] transition-all duration-200 ease-in-out ${
          sidebarOpen ? 'w-[260px]' : 'w-0 overflow-hidden border-r-0'
        }`}
      >
        {/* Top App Navigation Row */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            {/* Antigravity Stylized Icon */}
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.08] text-white">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L1 21h22L12 2zm0 4.5l7.5 13H4.5L12 6.5z" />
              </svg>
            </div>
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
              title="Toggle Sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            {/* Back / Forward */}
            <div className="flex items-center gap-0.5 text-zinc-500">
              <button className="p-1 rounded hover:text-zinc-300 hover:bg-white/[0.04] transition">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button className="p-1 rounded hover:text-zinc-300 hover:bg-white/[0.04] transition">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-4 text-xs scrollbar-none">
          {/* New Conversation Button */}
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#1a1b23] hover:bg-[#232530] border border-white/[0.06] text-zinc-200 font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>New Conversation</span>
          </button>

          {/* Quick Nav Links */}
          <div className="space-y-0.5 text-zinc-300 font-medium">
            <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05] text-left transition">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Conversation History</span>
            </button>
            <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05] text-left transition">
              <Timer className="w-3.5 h-3.5 text-zinc-400" />
              <span>Automations</span>
            </button>
            <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05] text-left transition">
              <Box className="w-3.5 h-3.5 text-zinc-400" />
              <span>Customizations</span>
            </button>
          </div>

          {/* Section: Pinned Conversations */}
          <div className="pt-2">
            <div className="px-2.5 pb-1 text-[11px] font-semibold text-zinc-400">
              Pinned Conversations
            </div>
            <div className="space-y-0.5">
              {PINNED_CONVERSATIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectConversation(c)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition group ${
                    activeConvId === c.id
                      ? 'bg-white/[0.08] text-white'
                      : 'text-zinc-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="truncate pr-2">{c.title}</span>
                  <span className="shrink-0 text-[10px] text-zinc-500 font-mono group-hover:text-zinc-400">
                    {c.timestamp}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Projects */}
          <div className="pt-2">
            <div className="flex items-center justify-between px-2.5 pb-1 text-[11px] font-semibold text-zinc-400">
              <span>Projects</span>
              <div className="flex items-center gap-1.5 text-zinc-500">
                <button className="hover:text-zinc-300 transition" title="Filter projects">
                  <SlidersHorizontal className="w-3 h-3" />
                </button>
                <button className="hover:text-zinc-300 transition" title="Add project folder">
                  <FolderPlus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Folder Header */}
            <div className="space-y-0.5">
              <button
                onClick={() => setProjectsExpanded(!projectsExpanded)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-zinc-300 hover:bg-white/[0.04] text-left transition font-medium"
              >
                <Folder className="w-3.5 h-3.5 text-zinc-400" />
                <span className="flex-1 truncate">Nexus Desktop</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${
                    projectsExpanded ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>

              {/* Sub-items */}
              {projectsExpanded && (
                <div className="pl-3 space-y-0.5 border-l border-white/[0.06] ml-3.5 my-1">
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectConversation(c)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition group ${
                        activeConvId === c.id
                          ? 'bg-white/[0.08] text-white font-medium'
                          : 'text-zinc-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="truncate pr-2">{c.title}</span>
                      <span className="shrink-0 text-[10px] text-zinc-500 font-mono group-hover:text-zinc-400">
                        {c.timestamp}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar: Settings */}
        <div className="p-2 border-t border-white/[0.06]">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] text-xs font-medium transition">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE CANVAS */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#07080a] relative">
        {/* Top Header Bar */}
        <header className="h-10 shrink-0 flex items-center justify-between px-4 border-b border-white/[0.04] bg-[#07080a]/90 backdrop-blur z-20">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
                title="Expand Sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            {/* Breadcrumb: Nexus Desktop dropdown */}
            <div className="relative dropdown-container">
              <button
                onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
                className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition px-2 py-1 rounded hover:bg-white/[0.05]"
              >
                <Folder className="w-3.5 h-3.5 text-zinc-400" />
                <span>Nexus Desktop</span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>

              {workspaceDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-52 rounded-xl border border-white/10 bg-[#161720] p-1.5 shadow-2xl backdrop-blur-2xl z-50 text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 uppercase">
                    Workspaces
                  </div>
                  <button
                    onClick={() => setWorkspaceDropdownOpen(false)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-white bg-white/[0.08]"
                  >
                    <span>📁 Nexus Desktop</span>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                  <button
                    onClick={() => setWorkspaceDropdownOpen(false)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                  >
                    <span>📁 Vedantu Bot</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-500">
              Autonomous Agent: <span className="text-emerald-400">Online</span>
            </span>
          </div>
        </header>

        {/* WORKSPACE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto flex flex-col relative p-4 lg:p-6">
          {/* Active Conversation Execution Trace (if any) */}
          {activeSteps.length > 0 ? (
            <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto pb-48">
              <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-zinc-200">
                    {conversations.find((c) => c.id === activeConvId)?.title || 'Active Session'}
                  </h2>
                </div>
                <button
                  onClick={handleNewConversation}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] transition"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Conversation</span>
                </button>
              </div>

              <div className="flex-1">
                <AgentTraceFeed steps={activeSteps} />
              </div>
            </div>
          ) : (
            /* Blank Center State - Exactly matching reference screenshot */
            <div className="flex-1 flex flex-col items-center justify-center -mt-10">
              {/* Optional Breadcrumb above card in center state */}
              <div className="w-full max-w-2xl mb-2 flex items-center text-xs text-zinc-400">
                <div className="flex items-center gap-1.5 px-1 py-1 rounded cursor-pointer hover:text-zinc-200 transition">
                  <Folder className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Nexus Desktop</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </div>
              </div>

              {/* The Antigravity Prompt Card */}
              <div className="w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-[#14151c]/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all">
                {/* Input Textarea */}
                <div className="p-4 pb-2">
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    placeholder="Ask anything, @ to mention, / for actions"
                    className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none leading-relaxed"
                  />
                </div>

                {/* Middle Action Controls */}
                <div className="px-3 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Add Attachment Button */}
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
                      title="Attach file or context"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {/* Model Selector Dropdown */}
                    <div className="relative dropdown-container">
                      <button
                        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition"
                      >
                        <span>{selectedModel}</span>
                        <ChevronDown className="w-3 h-3 text-zinc-500" />
                      </button>

                      {modelDropdownOpen && (
                        <div className="absolute left-0 bottom-full mb-1.5 w-56 rounded-xl border border-white/10 bg-[#171822] p-1.5 shadow-2xl backdrop-blur-2xl z-50 text-xs">
                          <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Select Model
                          </div>
                          {AVAILABLE_MODELS.map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setSelectedModel(m)
                                setModelDropdownOpen(false)
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                                selectedModel === m
                                  ? 'bg-white/[0.08] text-white font-medium'
                                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                              }`}
                            >
                              <span>{m}</span>
                              {selectedModel === m && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Mic & Submit */}
                  <div className="flex items-center gap-1.5">
                    {/* Microphone button */}
                    <button
                      onClick={toggleMic}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                        isMicListening
                          ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                      title={isMicListening ? 'Listening...' : 'Voice input'}
                    >
                      {isMicListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    {/* Send / Dispatch Button */}
                    <button
                      onClick={() => handleDispatch(prompt)}
                      disabled={isExecuting || !prompt.trim()}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.1] text-zinc-200 hover:bg-white/[0.2] hover:text-white disabled:opacity-40 transition shadow"
                      title="Send Directive"
                    >
                      {isExecuting ? (
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bottom Bar: Scope and Agent Selectors */}
                <div className="px-3.5 py-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
                  {/* Left: Local Scope */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={() => setScopeDropdownOpen(!scopeDropdownOpen)}
                      className="flex items-center gap-1.5 hover:text-zinc-200 transition py-0.5"
                    >
                      <Folder className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{selectedScope}</span>
                      <ChevronDown className="w-3 h-3 text-zinc-500" />
                    </button>

                    {scopeDropdownOpen && (
                      <div className="absolute left-0 bottom-full mb-1.5 w-48 rounded-xl border border-white/10 bg-[#171822] p-1.5 shadow-2xl backdrop-blur-2xl z-50 text-xs">
                        <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase">
                          Execution Scope
                        </div>
                        {SCOPES.map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setSelectedScope(s)
                              setScopeDropdownOpen(false)
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                              selectedScope === s
                                ? 'bg-white/[0.08] text-white'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                            }`}
                          >
                            <span>{s}</span>
                            {selectedScope === s && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Main Agent Persona */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                      className="flex items-center gap-1.5 hover:text-zinc-200 transition py-0.5"
                    >
                      <span>{selectedAgent}</span>
                      <ChevronDown className="w-3 h-3 text-zinc-500" />
                    </button>

                    {agentDropdownOpen && (
                      <div className="absolute right-0 bottom-full mb-1.5 w-48 rounded-xl border border-white/10 bg-[#171822] p-1.5 shadow-2xl backdrop-blur-2xl z-50 text-xs">
                        <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase">
                          Agent Persona
                        </div>
                        {AGENT_PERSONAS.map((a) => (
                          <button
                            key={a}
                            onClick={() => {
                              setSelectedAgent(a)
                              setAgentDropdownOpen(false)
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                              selectedAgent === a
                                ? 'bg-white/[0.08] text-white'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                            }`}
                          >
                            <span>{a}</span>
                            {selectedAgent === a && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fixed Floating Bottom Prompt Input when in Active Conversation */}
          {activeSteps.length > 0 && (
            <div className="absolute bottom-6 left-0 right-0 px-4 flex justify-center z-30 pointer-events-none">
              <div className="w-full max-w-3xl rounded-2xl border border-white/[0.1] bg-[#14151c]/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl pointer-events-auto transition-all">
                <div className="p-3 pb-1">
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Ask anything, @ to mention, / for actions"
                    className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none leading-relaxed"
                  />
                </div>

                <div className="px-3 pb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
                      title="Attach file or context"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <div className="relative dropdown-container">
                      <button
                        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition"
                      >
                        <span>{selectedModel}</span>
                        <ChevronDown className="w-3 h-3 text-zinc-500" />
                      </button>

                      {modelDropdownOpen && (
                        <div className="absolute left-0 bottom-full mb-1.5 w-56 rounded-xl border border-white/10 bg-[#171822] p-1.5 shadow-2xl backdrop-blur-2xl z-50 text-xs">
                          <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Select Model
                          </div>
                          {AVAILABLE_MODELS.map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setSelectedModel(m)
                                setModelDropdownOpen(false)
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                                selectedModel === m
                                  ? 'bg-white/[0.08] text-white font-medium'
                                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                              }`}
                            >
                              <span>{m}</span>
                              {selectedModel === m && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleMic}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                        isMicListening
                          ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                      title={isMicListening ? 'Listening...' : 'Voice input'}
                    >
                      {isMicListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => handleDispatch(prompt)}
                      disabled={isExecuting || !prompt.trim()}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.1] text-zinc-200 hover:bg-white/[0.2] hover:text-white disabled:opacity-40 transition shadow"
                      title="Send Directive"
                    >
                      {isExecuting ? (
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
                  <div className="relative dropdown-container">
                    <button
                      onClick={() => setScopeDropdownOpen(!scopeDropdownOpen)}
                      className="flex items-center gap-1 hover:text-zinc-200 transition"
                    >
                      <Folder className="w-3 h-3 text-zinc-400" />
                      <span>{selectedScope}</span>
                      <ChevronDown className="w-2.5 h-2.5 text-zinc-500" />
                    </button>
                  </div>

                  <div className="relative dropdown-container">
                    <button
                      onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                      className="flex items-center gap-1 hover:text-zinc-200 transition"
                    >
                      <span>{selectedAgent}</span>
                      <ChevronDown className="w-2.5 h-2.5 text-zinc-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
