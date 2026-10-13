import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  RiAddLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiBookOpenLine,
  RiBrainLine,
  RiCheckLine,
  RiCloseLine,
  RiCpuLine,
  RiDeleteBin6Line,
  RiExternalLinkLine,
  RiEyeLine,
  RiFileCopyLine,
  RiGlobalLine,
  RiHistoryLine,
  RiHome4Line,
  RiLoader4Line,
  RiLockLine,
  RiMagicLine,
  RiMicLine,
  RiMicOffLine,
  RiRefreshLine,
  RiRobotLine,
  RiSearchLine,
  RiSendPlane2Line,
  RiShieldCheckLine,
  RiStarFill,
  RiStarLine,
  RiZoomInLine,
  RiZoomOutLine
} from 'react-icons/ri'
import { executePuterChat } from '@renderer/services/nexus-puter-api'
import { nexusService } from '@renderer/services/nexus-voice-ai'
import SkyvernScreenStudio from '@renderer/components/SkyvernScreenStudio'

export interface BrowserControlViewProps {
  isSystemActive: boolean
  isSystemStarting: boolean
  isMicMuted: boolean
  toggleSystem: () => void | Promise<void>
  toggleMic: () => void
  sendTextCommand: (command: string) => Promise<void>
}

export interface BrowserTab {
  id: string
  title: string
  url: string
  favicon?: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  history: string[]
  historyIndex: number
}

interface BookmarkItem {
  id: string
  title: string
  url: string
  icon?: string
  category?: string
}

interface HistoryItem {
  id: string
  title: string
  url: string
  timestamp: number
}

interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: number
}

type SearchEngineKey =
  | 'google'
  | 'duckduckgo'
  | 'bing'
  | 'brave'
  | 'youtube'
  | 'github'
  | 'wikipedia'

const SEARCH_ENGINES: Record<
  SearchEngineKey,
  { name: string; url: string; icon: string; placeholder: string }
> = {
  google: {
    name: 'Google',
    url: 'https://www.google.com/search?q=',
    icon: '🔍',
    placeholder: 'Search Google or type URL'
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q=',
    icon: '🦆',
    placeholder: 'Search private DuckDuckGo'
  },
  bing: {
    name: 'Bing',
    url: 'https://www.bing.com/search?q=',
    icon: '🌊',
    placeholder: 'Search Microsoft Bing'
  },
  brave: {
    name: 'Brave',
    url: 'https://search.brave.com/search?q=',
    icon: '🦁',
    placeholder: 'Search Brave'
  },
  youtube: {
    name: 'YouTube',
    url: 'https://www.youtube.com/results?search_query=',
    icon: '▶️',
    placeholder: 'Search YouTube videos'
  },
  github: {
    name: 'GitHub',
    url: 'https://github.com/search?q=',
    icon: '🐙',
    placeholder: 'Search GitHub repos'
  },
  wikipedia: {
    name: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Special:Search?search=',
    icon: '📚',
    placeholder: 'Search encyclopedia'
  }
}

const DEFAULT_BOOKMARKS: BookmarkItem[] = [
  { id: 'bm-google', title: 'Google', url: 'https://www.google.com', icon: '🔍' },
  { id: 'bm-youtube', title: 'YouTube', url: 'https://www.youtube.com', icon: '▶️' },
  { id: 'bm-github', title: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { id: 'bm-chatgpt', title: 'ChatGPT', url: 'https://chatgpt.com', icon: '🤖' },
  { id: 'bm-claude', title: 'Claude', url: 'https://claude.ai', icon: '🧠' },
  { id: 'bm-reddit', title: 'Reddit', url: 'https://www.reddit.com', icon: '💬' },
  { id: 'bm-wiki', title: 'Wikipedia', url: 'https://www.wikipedia.org', icon: '📚' },
  { id: 'bm-puter', title: 'Puter Cloud', url: 'https://puter.com', icon: '🌐' },
  { id: 'bm-hn', title: 'Hacker News', url: 'https://news.ycombinator.com', icon: '⚡' },
  { id: 'bm-x', title: 'X / Twitter', url: 'https://x.com', icon: '𝕏' }
]

const SPEED_DIAL_ITEMS = [
  {
    title: 'Google Search',
    url: 'https://www.google.com',
    icon: '🔍',
    category: 'Search & Explore',
    desc: 'Web, research, maps and tools'
  },
  {
    title: 'YouTube Music & Videos',
    url: 'https://www.youtube.com',
    icon: '▶️',
    category: 'Media',
    desc: 'Podcasts, video streams and tutorials'
  },
  {
    title: 'GitHub Repositories',
    url: 'https://github.com',
    icon: '🐙',
    category: 'Developer',
    desc: 'Open source codebase, PRs and releases'
  },
  {
    title: 'Puter Cloud & AI',
    url: 'https://puter.com',
    icon: '🌐',
    category: 'AI Cloud',
    desc: 'Zero-friction sovereign AI cloud computing'
  },
  {
    title: 'ChatGPT & OpenAI',
    url: 'https://chatgpt.com',
    icon: '🤖',
    category: 'AI Assistant',
    desc: 'Conversations, code and reasoning'
  },
  {
    title: 'Claude AI',
    url: 'https://claude.ai',
    icon: '🧠',
    category: 'AI Assistant',
    desc: 'Anthropic deep thought & analysis'
  },
  {
    title: 'Reddit Discussions',
    url: 'https://www.reddit.com',
    icon: '💬',
    category: 'Community',
    desc: 'Tech news, discussions and trends'
  },
  {
    title: 'Wikipedia Encyclopedia',
    url: 'https://www.wikipedia.org',
    icon: '📚',
    category: 'Knowledge',
    desc: 'Universal free knowledge base'
  },
  {
    title: 'Hacker News',
    url: 'https://news.ycombinator.com',
    icon: '⚡',
    category: 'Tech News',
    desc: 'Silicon Valley & startup pulse'
  },
  {
    title: 'arXiv AI Papers',
    url: 'https://arxiv.org/list/cs.AI/recent',
    icon: '📄',
    category: 'Research',
    desc: 'Latest CS & Machine Learning preprints'
  },
  {
    title: 'Hugging Face Hub',
    url: 'https://huggingface.co',
    icon: '🤗',
    category: 'Open Source AI',
    desc: 'Open models, spaces and datasets'
  },
  {
    title: 'X / Social Feed',
    url: 'https://x.com',
    icon: '𝕏',
    category: 'Real-time News',
    desc: 'Breaking news, tech and updates'
  }
]

const normalizeInputToUrl = (input: string, engineKey: SearchEngineKey): string => {
  const trimmed = input.trim()
  if (!trimmed || trimmed === 'nexus://start' || trimmed === 'home' || trimmed === 'about:blank') {
    return 'nexus://start'
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  if (
    /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed) ||
    /^localhost(:[0-9]+)?(\/.*)?$/i.test(trimmed) ||
    /^127\.0\.0\.1(:[0-9]+)?(\/.*)?$/i.test(trimmed)
  ) {
    return `https://${trimmed}`
  }
  const engine = SEARCH_ENGINES[engineKey] || SEARCH_ENGINES.google
  return `${engine.url}${encodeURIComponent(trimmed)}`
}

export default function BrowserControlView({
  isSystemActive,
  isSystemStarting,
  isMicMuted,
  toggleSystem,
  toggleMic
}: BrowserControlViewProps) {
  // Tabs State
  const [tabs, setTabs] = useState<BrowserTab[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_browser_open_tabs')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [
      {
        id: 'tab-1',
        title: 'Nexus Start Portal',
        url: 'nexus://start',
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        history: ['nexus://start'],
        historyIndex: 0
      }
    ]
  })

  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || 'tab-1')

  // Omnibox & Navigation State
  const [addressBarInput, setAddressBarInput] = useState('nexus://start')
  const [searchEngine, setSearchEngine] = useState<SearchEngineKey>('google')
  const [showEngineDropdown, setShowEngineDropdown] = useState(false)
  const [zoomFactor, setZoomFactor] = useState(1.0)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Bookmarks & History
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_browser_bookmarks')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return DEFAULT_BOOKMARKS
  })

  const [historyList, setHistoryList] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_browser_history')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
    return []
  })

  const [showBookmarksBar, setShowBookmarksBar] = useState(true)

  // Modes & Copilot
  const [activeMode, setActiveMode] = useState<'browser' | 'skyvern'>('browser')
  const [showCopilot, setShowCopilot] = useState(false)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotSummary, setCopilotSummary] = useState('')
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'I am your Nexus Web Copilot powered by Puter AI. I can summarize any page, extract key points, answer questions about live content, or assist in browsing.',
      timestamp: Date.now()
    }
  ])
  const [copilotInput, setCopilotInput] = useState('')
  const [readerMode, setReaderMode] = useState(false)
  const [readerContent, setReaderContent] = useState<string>('')

  // Refs
  const webviewRef = useRef<any>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const copilotChatRef = useRef<HTMLDivElement>(null)

  // Active Tab Helper
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]

  // Persist Tabs
  useEffect(() => {
    try {
      localStorage.setItem('nexus_browser_open_tabs', JSON.stringify(tabs))
    } catch {}
  }, [tabs])

  // Persist Bookmarks
  useEffect(() => {
    try {
      localStorage.setItem('nexus_browser_bookmarks', JSON.stringify(bookmarks))
    } catch {}
  }, [bookmarks])

  // Persist History
  useEffect(() => {
    try {
      localStorage.setItem('nexus_browser_history', JSON.stringify(historyList.slice(0, 100)))
    } catch {}
  }, [historyList])

  // Sync Address Bar with Active Tab URL
  useEffect(() => {
    if (activeTab) {
      setAddressBarInput(activeTab.url === 'nexus://start' ? '' : activeTab.url)
    }
  }, [activeTab?.id, activeTab?.url])

  // Add History Record
  const recordHistory = (url: string, title: string) => {
    if (!url || url === 'nexus://start' || url.startsWith('about:')) return
    setHistoryList((prev) => [
      { id: `h-${Date.now()}-${Math.random()}`, url, title: title || url, timestamp: Date.now() },
      ...prev.filter((item) => item.url !== url).slice(0, 99)
    ])
  }

  // Update specific tab
  const updateTab = (id: string, patch: Partial<BrowserTab>) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, ...patch }
          if (patch.url && patch.url !== t.url) {
            const history = [...t.history.slice(0, t.historyIndex + 1), patch.url]
            updated.history = history
            updated.historyIndex = history.length - 1
            updated.canGoBack = updated.historyIndex > 0
            updated.canGoForward = false
          }
          return updated
        }
        return t
      })
    )
  }

  // Create new tab
  const handleNewTab = (initialUrl = 'nexus://start') => {
    const newId = `tab-${Date.now()}`
    const isStart = initialUrl === 'nexus://start'
    const newTab: BrowserTab = {
      id: newId,
      title: isStart ? 'Nexus Start Portal' : 'New Tab',
      url: initialUrl,
      isLoading: !isStart,
      canGoBack: false,
      canGoForward: false,
      history: [initialUrl],
      historyIndex: 0
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newId)
    setReaderMode(false)
  }

  // Close tab
  const handleCloseTab = (idToClose: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (tabs.length === 1) {
      // Reset to Start Page rather than leaving zero tabs
      updateTab(tabs[0].id, {
        title: 'Nexus Start Portal',
        url: 'nexus://start',
        favicon: undefined,
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        history: ['nexus://start'],
        historyIndex: 0
      })
      setActiveTabId(tabs[0].id)
      return
    }

    const nextTabs = tabs.filter((t) => t.id !== idToClose)
    setTabs(nextTabs)
    if (activeTabId === idToClose) {
      const idx = tabs.findIndex((t) => t.id === idToClose)
      const nextActive = nextTabs[Math.max(0, idx - 1)]
      if (nextActive) setActiveTabId(nextActive.id)
    }
  }

  // Navigation: Navigate to URL
  const navigateTo = (urlOrQuery: string) => {
    const finalUrl = normalizeInputToUrl(urlOrQuery, searchEngine)
    setReaderMode(false)
    setReaderContent('')

    if (finalUrl === 'nexus://start') {
      updateTab(activeTabId, {
        title: 'Nexus Start Portal',
        url: 'nexus://start',
        favicon: undefined,
        isLoading: false
      })
      return
    }

    updateTab(activeTabId, {
      title: finalUrl.replace(/^https?:\/\//i, '').split('/')[0] || finalUrl,
      url: finalUrl,
      isLoading: true
    })

    const wv = webviewRef.current
    if (wv && typeof wv.loadURL === 'function') {
      try {
        wv.loadURL(finalUrl)
      } catch {
        // Fallback handled by react re-render of src
      }
    }
  }

  // Submit Address Bar Form
  const handleAddressSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!addressBarInput.trim()) {
      navigateTo('nexus://start')
      return
    }
    navigateTo(addressBarInput)
  }

  // Navigation Buttons
  const handleGoBack = () => {
    const wv = webviewRef.current
    if (wv && typeof wv.goBack === 'function' && wv.canGoBack?.()) {
      wv.goBack()
      return
    }
    if (activeTab && activeTab.historyIndex > 0) {
      const newIndex = activeTab.historyIndex - 1
      const prevUrl = activeTab.history[newIndex]
      updateTab(activeTabId, {
        url: prevUrl,
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: true
      })
    }
  }

  const handleGoForward = () => {
    const wv = webviewRef.current
    if (wv && typeof wv.goForward === 'function' && wv.canGoForward?.()) {
      wv.goForward()
      return
    }
    if (activeTab && activeTab.historyIndex < activeTab.history.length - 1) {
      const newIndex = activeTab.historyIndex + 1
      const nextUrl = activeTab.history[newIndex]
      updateTab(activeTabId, {
        url: nextUrl,
        historyIndex: newIndex,
        canGoBack: true,
        canGoForward: newIndex < activeTab.history.length - 1
      })
    }
  }

  const handleReloadOrStop = () => {
    const wv = webviewRef.current
    if (activeTab.isLoading) {
      if (wv && typeof wv.stop === 'function') wv.stop()
      updateTab(activeTabId, { isLoading: false })
    } else {
      if (wv && typeof wv.reload === 'function') {
        wv.reload()
      } else {
        // Force refresh
        navigateTo(activeTab.url)
      }
      updateTab(activeTabId, { isLoading: true })
    }
  }

  // Zoom controls
  const handleZoom = (delta: number) => {
    const nextZoom = Math.min(2.0, Math.max(0.5, Number((zoomFactor + delta).toFixed(2))))
    setZoomFactor(nextZoom)
    const wv = webviewRef.current
    if (wv && typeof wv.setZoomFactor === 'function') {
      wv.setZoomFactor(nextZoom)
    }
  }

  // Bookmark Toggle
  const isBookmarked = bookmarks.some((b) => b.url === activeTab?.url)
  const handleToggleBookmark = () => {
    if (!activeTab || activeTab.url === 'nexus://start') return
    if (isBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url))
    } else {
      const newBm: BookmarkItem = {
        id: `bm-${Date.now()}`,
        title: activeTab.title || activeTab.url,
        url: activeTab.url,
        icon: '🔖'
      }
      setBookmarks((prev) => [...prev, newBm])
    }
  }

  // Copy URL
  const handleCopyUrl = async () => {
    if (!activeTab || !activeTab.url) return
    try {
      await navigator.clipboard.writeText(activeTab.url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {}
  }

  // Open in External OS Browser
  const handleOpenExternal = async () => {
    if (!activeTab || !activeTab.url || activeTab.url === 'nexus://start') return
    try {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('open-external-url', activeTab.url)
      } else {
        window.open(activeTab.url, '_blank')
      }
    } catch {
      window.open(activeTab.url, '_blank')
    }
  }

  // Webview Lifecycle & Events
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onStartLoading = () => {
      updateTab(activeTabId, { isLoading: true })
    }

    const onStopLoading = () => {
      updateTab(activeTabId, {
        isLoading: false,
        canGoBack: wv.canGoBack ? wv.canGoBack() : false,
        canGoForward: wv.canGoForward ? wv.canGoForward() : false
      })
    }

    const onNavigate = (e: any) => {
      const currentUrl = e.url || ''
      if (currentUrl && currentUrl !== 'about:blank') {
        updateTab(activeTabId, {
          url: currentUrl,
          canGoBack: wv.canGoBack ? wv.canGoBack() : false,
          canGoForward: wv.canGoForward ? wv.canGoForward() : false
        })
        recordHistory(currentUrl, activeTab?.title || currentUrl)
      }
    }

    const onTitleUpdated = (e: any) => {
      if (e.title) {
        updateTab(activeTabId, { title: e.title })
        if (activeTab?.url) recordHistory(activeTab.url, e.title)
      }
    }

    const onFaviconUpdated = (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        updateTab(activeTabId, { favicon: e.favicons[0] })
      }
    }

    const onNewWindow = (e: any) => {
      if (e.url) handleNewTab(e.url)
    }

    try {
      wv.addEventListener('did-start-loading', onStartLoading)
      wv.addEventListener('did-stop-loading', onStopLoading)
      wv.addEventListener('did-navigate', onNavigate)
      wv.addEventListener('did-navigate-in-page', onNavigate)
      wv.addEventListener('page-title-updated', onTitleUpdated)
      wv.addEventListener('page-favicon-updated', onFaviconUpdated)
      wv.addEventListener('new-window', onNewWindow)
    } catch {}

    return () => {
      try {
        wv.removeEventListener('did-start-loading', onStartLoading)
        wv.removeEventListener('did-stop-loading', onStopLoading)
        wv.removeEventListener('did-navigate', onNavigate)
        wv.removeEventListener('did-navigate-in-page', onNavigate)
        wv.removeEventListener('page-title-updated', onTitleUpdated)
        wv.removeEventListener('page-favicon-updated', onFaviconUpdated)
        wv.removeEventListener('new-window', onNewWindow)
      } catch {}
    }
  }, [activeTabId])

  // Extract Page Text for AI
  const extractPageText = async (): Promise<string> => {
    const wv = webviewRef.current
    if (wv && typeof wv.executeJavaScript === 'function') {
      try {
        const text = await wv.executeJavaScript(`
          (() => {
            const el = document.querySelector('article') || document.querySelector('main') || document.body;
            return el ? el.innerText.slice(0, 15000) : '';
          })()
        `)
        if (typeof text === 'string' && text.trim().length > 30) {
          return text.trim()
        }
      } catch {}
    }

    // Try iframe fallback if in iframe mode
    if (iframeRef.current) {
      try {
        const doc = iframeRef.current.contentDocument
        if (doc?.body?.innerText) {
          return doc.body.innerText.slice(0, 15000)
        }
      } catch {}
    }

    return `Page title: ${activeTab.title || 'Untitled'}\nURL: ${activeTab.url}`
  }

  // AI Copilot: Summarize Page
  const handleSummarizePage = async () => {
    setShowCopilot(true)
    setCopilotLoading(true)
    setCopilotSummary('')

    try {
      const pageText = await extractPageText()
      const prompt = `You are Nexus AI Web Copilot. Provide a high-impact, professional executive summary of the following webpage content.\n\nPAGE TITLE: ${activeTab.title}\nPAGE URL: ${activeTab.url}\n\nCONTENT:\n${pageText.slice(0, 8000)}\n\nFormat your answer with:\n1. 🎯 Quick Snapshot (1-2 sentences)\n2. 🔑 Key Takeaways (3-5 bullet points)\n3. 💡 Recommended Action or Insight`

      const reply = await executePuterChat({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }]
      })

      setCopilotSummary(reply)
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          text: `Here is the AI summary for ${activeTab.title}:\n\n${reply}`,
          timestamp: Date.now()
        }
      ])
    } catch (err: any) {
      setCopilotSummary(`Unable to summarize page: ${err?.message || 'Error occurred'}`)
    } finally {
      setCopilotLoading(false)
    }
  }

  // AI Copilot: Send QA Chat
  const handleSendCopilotChat = async (e?: FormEvent) => {
    e?.preventDefault()
    const question = copilotInput.trim()
    if (!question || copilotLoading) return

    setCopilotInput('')
    const userMsg: CopilotMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: Date.now()
    }
    setCopilotMessages((prev) => [...prev, userMsg])
    setCopilotLoading(true)

    try {
      const pageText = await extractPageText()
      const systemPrompt = `You are Nexus AI Web Copilot. You are inspecting the user's active browser page titled "${activeTab.title}" at "${activeTab.url}". Answer the user's question clearly, accurately, and concisely using the page text whenever available.`

      const response = await executePuterChat({
        model: 'gpt-4o',
        system: systemPrompt,
        messages: [
          { role: 'user', content: `PAGE CONTEXT:\n${pageText.slice(0, 6000)}\n\nUSER QUESTION: ${question}` }
        ]
      })

      const botMsg: CopilotMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: response,
        timestamp: Date.now()
      }
      setCopilotMessages((prev) => [...prev, botMsg])
    } catch (err: any) {
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `Copilot error: ${err?.message || 'Failed to get answer'}`,
          timestamp: Date.now()
        }
      ])
    } finally {
      setCopilotLoading(false)
      setTimeout(() => {
        copilotChatRef.current?.scrollTo({
          top: copilotChatRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }
  }

  // Reader Mode Toggle
  const handleToggleReaderMode = async () => {
    if (!readerMode) {
      const text = await extractPageText()
      setReaderContent(text)
      setReaderMode(true)
    } else {
      setReaderMode(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#05070a] text-zinc-100 select-none">
      {/* =========================================================================
          TOP COMMAND STRIP: TABS + APP STATUS
      ========================================================================== */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-black/60 px-3 py-1.5 backdrop-blur-xl">
        {/* TAB BAR STRIP */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none pr-3">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group relative flex h-8 max-w-[220px] min-w-[130px] cursor-pointer items-center gap-2 rounded-lg border px-3 transition-all duration-150 ${
                  isActive
                    ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-500/15 to-transparent text-emerald-200 shadow-[0_2px_12px_rgba(16,185,129,0.12)]'
                    : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-zinc-200'
                }`}
              >
                {/* Favicon or Loading Spinner */}
                {tab.isLoading ? (
                  <RiLoader4Line className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-400" />
                ) : tab.favicon ? (
                  <img
                    src={tab.favicon}
                    alt=""
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                    className="h-3.5 w-3.5 shrink-0 rounded-sm object-contain"
                  />
                ) : (
                  <RiGlobalLine
                    className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`}
                  />
                )}

                {/* Tab Title */}
                <span className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide">
                  {tab.title || (tab.url === 'nexus://start' ? 'Nexus Start' : tab.url)}
                </span>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-sm text-zinc-500 opacity-60 transition hover:bg-white/10 hover:text-red-300 hover:opacity-100"
                  title="Close tab (Ctrl+W)"
                >
                  <RiCloseLine className="h-3 w-3" />
                </button>
              </div>
            )
          })}

          {/* New Tab Button */}
          <button
            type="button"
            onClick={() => handleNewTab()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/5 bg-white/[0.02] text-zinc-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
            title="Open new tab (Ctrl+T)"
          >
            <RiAddLine className="h-4 w-4" />
          </button>
        </div>

        {/* TOP RIGHT TOOLBAR BUTTONS */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Autonomous Screen Agent / Browser Mode Switcher */}
          <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setActiveMode('browser')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                activeMode === 'browser'
                  ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <RiGlobalLine className="text-xs" />
              Browser
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('skyvern')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                activeMode === 'skyvern'
                  ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Launch Skyvern Autonomous Screen Agent"
            >
              <RiEyeLine className="text-xs" />
              Screen Studio
            </button>
          </div>

          {/* AI Copilot Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowCopilot((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold tracking-wide transition ${
              showCopilot
                ? 'border-emerald-400/50 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-emerald-500/30 hover:text-emerald-300'
            }`}
          >
            <RiMagicLine className="text-emerald-400 text-sm animate-pulse" />
            <span>AI Copilot</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          NAVIGATION BAR & OMNIBOX
      ========================================================================== */}
      {activeMode === 'browser' && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.06] bg-zinc-950/70 px-3 py-2 backdrop-blur-md">
          {/* Back / Forward / Reload / Home Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleGoBack}
              disabled={!activeTab?.canGoBack && activeTab?.historyIndex <= 0}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-black/30 text-zinc-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-30 disabled:hover:border-white/5 disabled:hover:bg-black/30 disabled:hover:text-zinc-400"
              title="Back"
            >
              <RiArrowLeftLine className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleGoForward}
              disabled={!activeTab?.canGoForward && activeTab?.historyIndex >= activeTab?.history.length - 1}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-black/30 text-zinc-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-30 disabled:hover:border-white/5 disabled:hover:bg-black/30 disabled:hover:text-zinc-400"
              title="Forward"
            >
              <RiArrowRightLine className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleReloadOrStop}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-black/30 text-zinc-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
              title={activeTab.isLoading ? 'Stop loading' : 'Reload page (Ctrl+R)'}
            >
              {activeTab.isLoading ? (
                <RiCloseLine className="h-4 w-4 text-red-400" />
              ) : (
                <RiRefreshLine className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => navigateTo('nexus://start')}
              className={`grid h-8 w-8 place-items-center rounded-lg border transition ${
                activeTab.url === 'nexus://start'
                  ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/5 bg-black/30 text-zinc-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300'
              }`}
              title="Nexus Start Portal"
            >
              <RiHome4Line className="h-4 w-4" />
            </button>
          </div>

          {/* OMNIBOX (SMART ADDRESS & SEARCH BAR) */}
          <form onSubmit={handleAddressSubmit} className="relative flex min-w-0 flex-1 items-center">
            <div className="flex h-9 w-full items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-3 transition-all focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/15">
              {/* Search Engine Picker Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEngineDropdown((prev) => !prev)}
                  className="flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/[0.08]"
                  title="Switch Search Engine"
                >
                  <span>{SEARCH_ENGINES[searchEngine].icon}</span>
                  <span className="hidden sm:inline font-mono text-[10px] uppercase font-bold text-emerald-400/80">
                    {SEARCH_ENGINES[searchEngine].name}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {showEngineDropdown && (
                  <div className="absolute top-8 left-0 z-50 w-44 rounded-xl border border-white/10 bg-zinc-950 p-1 shadow-2xl backdrop-blur-2xl">
                    <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-500">
                      Search Engines
                    </div>
                    {Object.entries(SEARCH_ENGINES).map(([key, val]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSearchEngine(key as SearchEngineKey)
                          setShowEngineDropdown(false)
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition ${
                          searchEngine === key
                            ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                            : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                        }`}
                      >
                        <span>{val.icon}</span>
                        <span>{val.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Security SSL Lock Indicator */}
              {activeTab.url !== 'nexus://start' && (
                <div
                  className="flex shrink-0 items-center text-emerald-400/80"
                  title="Connection secure (SSL 256-bit)"
                >
                  <RiLockLine className="h-3.5 w-3.5" />
                </div>
              )}

              {/* Address / Query Text Input */}
              <input
                type="text"
                value={addressBarInput}
                onChange={(e) => setAddressBarInput(e.target.value)}
                placeholder={SEARCH_ENGINES[searchEngine].placeholder}
                className="min-w-0 flex-1 bg-transparent text-xs font-mono text-zinc-100 outline-none placeholder:text-zinc-600 selection:bg-emerald-500/30 selection:text-white"
                onFocus={(e) => e.target.select()}
              />

              {/* In-bar actions: Bookmark, Copy, External */}
              <div className="flex shrink-0 items-center gap-1">
                {activeTab.url !== 'nexus://start' && (
                  <>
                    {/* Bookmark Toggle */}
                    <button
                      type="button"
                      onClick={handleToggleBookmark}
                      className={`grid h-6 w-6 place-items-center rounded transition ${
                        isBookmarked
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                      title={isBookmarked ? 'Remove Bookmark' : 'Bookmark this page'}
                    >
                      {isBookmarked ? (
                        <RiStarFill className="h-3.5 w-3.5" />
                      ) : (
                        <RiStarLine className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Copy Link */}
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="grid h-6 w-6 place-items-center rounded text-zinc-500 transition hover:text-zinc-300"
                      title={copiedUrl ? 'Copied!' : 'Copy Link'}
                    >
                      {copiedUrl ? (
                        <RiCheckLine className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <RiFileCopyLine className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Open in OS External Browser */}
                    <button
                      type="button"
                      onClick={handleOpenExternal}
                      className="grid h-6 w-6 place-items-center rounded text-zinc-500 transition hover:text-cyan-300"
                      title="Open in system browser (Chrome/Edge)"
                    >
                      <RiExternalLinkLine className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>

          {/* Quick Toolbar: Zoom, Reader, AI Summary */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Zoom Controls */}
            <div className="flex items-center rounded-lg border border-white/5 bg-black/40 px-1 py-0.5 text-xs text-zinc-400">
              <button
                type="button"
                onClick={() => handleZoom(-0.1)}
                className="px-1 text-zinc-500 hover:text-zinc-200"
                title="Zoom Out"
              >
                <RiZoomOutLine />
              </button>
              <span className="font-mono text-[10px] w-9 text-center text-zinc-400">
                {Math.round(zoomFactor * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleZoom(0.1)}
                className="px-1 text-zinc-500 hover:text-zinc-200"
                title="Zoom In"
              >
                <RiZoomInLine />
              </button>
            </div>

            {/* Reader Mode Toggle */}
            {activeTab.url !== 'nexus://start' && (
              <button
                type="button"
                onClick={handleToggleReaderMode}
                className={`flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs transition ${
                  readerMode
                    ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/5 bg-black/30 text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                }`}
                title="Toggle Clean Reader Mode"
              >
                <RiBookOpenLine className="h-3.5 w-3.5" />
                <span className="hidden md:inline text-[10px] font-bold">Reader</span>
              </button>
            )}

            {/* Quick Summarize Button */}
            {activeTab.url !== 'nexus://start' && (
              <button
                type="button"
                onClick={handleSummarizePage}
                className="flex h-8 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs text-emerald-300 transition hover:bg-emerald-500/20 shadow-sm"
                title="Summarize page with Puter AI"
              >
                <RiCpuLine className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden lg:inline text-[10px] font-bold">Summarize</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          BOOKMARKS BAR
      ========================================================================== */}
      {activeMode === 'browser' && showBookmarksBar && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.04] bg-black/40 px-3 py-1 text-xs scrollbar-none">
          {bookmarks.map((bm) => (
            <button
              key={bm.id}
              type="button"
              onClick={() => navigateTo(bm.url)}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-100"
              title={bm.url}
            >
              <span>{bm.icon || '🔖'}</span>
              <span className="max-w-[120px] truncate font-medium text-[11px]">{bm.title}</span>
            </button>
          ))}

          {/* Quick Bookmark Add / Manage */}
          <button
            type="button"
            onClick={handleToggleBookmark}
            className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-white/5 hover:text-emerald-300"
            title="Bookmark Current Page"
          >
            + Add Bookmark
          </button>
        </div>
      )}

      {/* =========================================================================
          MAIN VIEWPORT AREA (START PAGE OR REAL CHROMIUM WEBVIEW OR SCREEN AGENT)
      ========================================================================== */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* SKYVERN AUTONOMOUS SCREEN STUDIO MODE */}
        {activeMode === 'skyvern' ? (
          <div className="h-full w-full overflow-hidden">
            <SkyvernScreenStudio />
          </div>
        ) : (
          <div className="relative flex h-full w-full min-w-0 flex-1 overflow-hidden">
            {/* 1. START PAGE / SPEED DIAL (nexus://start) */}
            {activeTab.url === 'nexus://start' ? (
              <div className="h-full w-full overflow-y-auto p-6 md:p-10 scrollbar-small bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-[#05070a] to-[#030508]">
                <div className="mx-auto max-w-5xl space-y-8">
                  {/* HERO BANNER */}
                  <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/30 to-black/60 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <RiGlobalLine className="text-2xl animate-spin" style={{ animationDuration: '18s' }} />
                          <span className="text-[11px] font-black uppercase tracking-[0.25em]">
                            Nexus Quantum Browser
                          </span>
                        </div>
                        <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                          Cybernetic Web Gateway
                        </h1>
                        <p className="mt-1 text-xs text-zinc-400">
                          Chromium engine with Puter AI Copilot, live page summaries, and autonomous steering.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-right">
                          <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-400">Engine Status</p>
                          <p className="text-xs font-black text-white">Chromium 120 // Live</p>
                        </div>
                      </div>
                    </div>

                    {/* BIG CENTER SEARCH BAR */}
                    <form onSubmit={handleAddressSubmit} className="mt-6">
                      <div className="relative flex items-center rounded-2xl border border-emerald-400/30 bg-black/80 p-2 shadow-2xl transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/15">
                        <span className="px-3 text-lg">{SEARCH_ENGINES[searchEngine].icon}</span>
                        <input
                          type="text"
                          value={addressBarInput}
                          onChange={(e) => setAddressBarInput(e.target.value)}
                          placeholder={`Search ${SEARCH_ENGINES[searchEngine].name} or enter any URL (e.g. github.com, youtube.com)...`}
                          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2 text-xs font-black uppercase tracking-wider text-black shadow-lg transition hover:brightness-110"
                        >
                          Explore
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* SPEED DIAL CARDS GRID */}
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                        Speed Dial Destinations
                      </h2>
                      <span className="text-[10px] font-mono text-emerald-400/70">
                        Instant 1-Click Launch
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {SPEED_DIAL_ITEMS.map((item) => (
                        <div
                          key={item.title}
                          onClick={() => navigateTo(item.url)}
                          className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-emerald-500/[0.06] hover:shadow-[0_10px_30px_rgba(16,185,129,0.1)]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xl transition-transform duration-200 group-hover:scale-110">
                              {item.icon}
                            </span>
                            <RiExternalLinkLine className="text-xs text-zinc-600 opacity-0 transition group-hover:text-emerald-400 group-hover:opacity-100" />
                          </div>
                          <div className="mt-4">
                            <p className="truncate text-xs font-bold text-zinc-200 group-hover:text-emerald-200">
                              {item.title}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-500">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RECENT BROWSING HISTORY */}
                  {historyList.length > 0 && (
                    <div className="rounded-2xl border border-white/5 bg-black/40 p-5 backdrop-blur-md">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-400">
                          <RiHistoryLine className="text-emerald-400" />
                          Recent History
                        </div>
                        <button
                          type="button"
                          onClick={() => setHistoryList([])}
                          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-400"
                        >
                          <RiDeleteBin6Line /> Clear History
                        </button>
                      </div>

                      <div className="grid gap-2">
                        {historyList.slice(0, 6).map((h) => (
                          <div
                            key={h.id}
                            onClick={() => navigateTo(h.url)}
                            className="flex cursor-pointer items-center justify-between rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2 transition hover:border-white/10 hover:bg-white/[0.04]"
                          >
                            <div className="min-w-0 pr-4">
                              <p className="truncate text-xs font-semibold text-zinc-200">
                                {h.title || h.url}
                              </p>
                              <p className="truncate font-mono text-[10px] text-zinc-500">{h.url}</p>
                            </div>
                            <span className="shrink-0 font-mono text-[9px] text-zinc-600">
                              {new Date(h.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : readerMode ? (
              /* 2. READER MODE VIEWPORT */
              <div className="h-full w-full overflow-y-auto bg-zinc-950 p-6 md:p-12 scrollbar-small">
                <div className="mx-auto max-w-3xl space-y-6">
                  <div className="border-b border-white/10 pb-4">
                    <button
                      type="button"
                      onClick={() => setReaderMode(false)}
                      className="mb-3 flex items-center gap-1 text-xs font-bold text-emerald-400 hover:underline"
                    >
                      ← Exit Reader Mode
                    </button>
                    <h1 className="text-2xl font-black text-white">{activeTab.title}</h1>
                    <p className="mt-1 font-mono text-xs text-zinc-500">{activeTab.url}</p>
                  </div>
                  <div className="prose prose-invert max-w-none text-zinc-300 whitespace-pre-wrap leading-relaxed text-sm">
                    {readerContent || 'Extracting article contents...'}
                  </div>
                </div>
              </div>
            ) : (
              /* 3. REAL CHROMIUM WEBVIEW */
              <div className="relative h-full w-full flex-1 bg-white">
                <webview
                  ref={webviewRef}
                  key={activeTab.id}
                  src={activeTab.url}
                  className="h-full w-full border-0 bg-white"
                  allowpopups={true}
                  webpreferences="contextIsolation=no, nodeIntegration=no"
                  style={{ width: '100%', height: '100%' }}
                />

                {/* Loading indicator bar */}
                {activeTab.isLoading && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/20 overflow-hidden z-20">
                    <div className="h-full w-1/3 bg-gradient-to-r from-emerald-400 to-cyan-400 animate-pulse" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            COLLAPSIBLE AI COPILOT DRAWER (RIGHT PANEL)
        ========================================================================== */}
        {showCopilot && activeMode === 'browser' && (
          <aside className="flex h-full w-96 shrink-0 flex-col border-l border-white/[0.08] bg-zinc-950/95 backdrop-blur-2xl shadow-2xl transition-all duration-300">
            {/* COPILOT HEADER */}
            <div className="flex items-center justify-between border-b border-white/10 p-3.5 bg-black/40">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-black shadow-md">
                  <RiRobotLine className="text-base" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Nexus Web Copilot
                  </h3>
                  <p className="text-[9px] font-mono text-emerald-400">Puter AI / GPT-4o</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCopilot(false)}
                className="grid h-6 w-6 place-items-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-white"
              >
                <RiCloseLine className="text-base" />
              </button>
            </div>

            {/* COPILOT CONTEXT CARD */}
            <div className="border-b border-white/5 bg-white/[0.02] p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Active Tab</p>
              <p className="mt-0.5 truncate text-xs font-bold text-zinc-200">{activeTab.title}</p>
              <p className="truncate font-mono text-[10px] text-zinc-500">{activeTab.url}</p>

              {/* QUICK ACTION BUTTONS */}
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleSummarizePage}
                  disabled={copilotLoading}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <RiCpuLine className="text-xs" />
                  Summarize
                </button>
                <button
                  type="button"
                  onClick={handleToggleReaderMode}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-1.5 text-[10px] font-bold text-zinc-300 transition hover:bg-white/10"
                >
                  <RiBookOpenLine className="text-xs" />
                  Clean View
                </button>
              </div>
            </div>

            {/* COPILOT CHAT MESSAGES */}
            <div ref={copilotChatRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-small">
              {copilotMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 rounded-br-xs'
                        : 'bg-white/[0.04] border border-white/10 text-zinc-200 rounded-bl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                  <span className="mt-1 text-[8px] font-mono text-zinc-600">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}

              {copilotLoading && (
                <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-400">
                  <RiLoader4Line className="h-4 w-4 animate-spin text-emerald-400" />
                  <span>Analyzing webpage content...</span>
                </div>
              )}
            </div>

            {/* COPILOT INPUT FORM */}
            <form onSubmit={handleSendCopilotChat} className="border-t border-white/10 p-3 bg-black/60">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-1.5 focus-within:border-emerald-500/40">
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  placeholder="Ask AI anything about this page..."
                  className="min-w-0 flex-1 bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
                />
                <button
                  type="submit"
                  disabled={!copilotInput.trim() || copilotLoading}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300 transition hover:bg-emerald-500 hover:text-black disabled:opacity-30"
                >
                  <RiSendPlane2Line className="text-xs" />
                </button>
              </div>
            </form>
          </aside>
        )}
      </div>
    </div>
  )
}
