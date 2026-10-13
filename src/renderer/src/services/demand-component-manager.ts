/**
 * Nexus On-Demand Component Orchestration System
 * =============================================================================
 * Demand-Driven Component Lifecycle & Resource Governor.
 * 
 * Instead of running all 17+ heavy subsystems simultaneously at startup
 * (which burns CPU, RAM, and GPU context), this dedicated manager keeps all
 * components DORMANT (0 MB overhead) and only awakens a component just-in-time
 * when the user explicitly queries, triggers, or asks about it.
 * 
 * Once idle or dismissed, components auto-hibernate and unmount cleanly.
 * =============================================================================
 */

export type ComponentStatus = 'dormant' | 'activating' | 'active' | 'hibernating'

export interface ComponentDefinition {
  id: string
  name: string
  category: 'widget' | 'service' | 'ai' | 'hardware'
  description: string
  estimatedRamMb: number
  intentKeywords: string[]
  intentRegex?: RegExp
  triggerEvents: string[]
  closeEvents?: string[]
  idleTtlMs: number
}

export interface ComponentLiveState {
  definition: ComponentDefinition
  status: ComponentStatus
  lastRequestedAt: number | null
  lastActiveAt: number | null
  activationCount: number
  bufferedPayload: any
}

export interface DemandTelemetry {
  demandModeEnabled: boolean
  totalComponents: number
  activeCount: number
  dormantCount: number
  estimatedRamSavedMb: number
  activeComponentNames: string[]
  dormantComponentNames: string[]
  totalActivations: number
}

const COMPONENT_REGISTRY: ComponentDefinition[] = [
  {
    id: 'weather',
    name: 'Weather Radar',
    category: 'widget',
    description: 'Live atmospheric weather data and forecast visualizations.',
    estimatedRamMb: 28,
    intentKeywords: ['weather', 'forecast', 'temperature', 'rain', 'climate', 'humidity', 'wind', 'sunny', 'cloudy'],
    intentRegex: /\b(weather|temperature|forecast|climate|raining|how\s+hot|how\s+cold)\b/i,
    triggerEvents: ['show-weather'],
    closeEvents: ['hide-weather'],
    idleTtlMs: 120_000
  },
  {
    id: 'stock',
    name: 'Market & Stock Ticker',
    category: 'widget',
    description: 'Financial market equity tickers and multi-stock comparisons.',
    estimatedRamMb: 34,
    intentKeywords: ['stock', 'nasdaq', 'crypto', 'shares', 'ticker', 'equity', 'market price', 'dow jones', 'bitcoin'],
    intentRegex: /\b(stock|shares?\s+of|nasdaq|market\s+price|crypto|ticker|bitcoin|portfolio)\b/i,
    triggerEvents: ['show-stock'],
    closeEvents: ['hide-stock'],
    idleTtlMs: 120_000
  },
  {
    id: 'map',
    name: 'Leaflet Earth Navigation',
    category: 'widget',
    description: 'Interactive map and routing canvas using Leaflet tile layers.',
    estimatedRamMb: 85,
    intentKeywords: ['map', 'location', 'navigate', 'route', 'directions', 'satellite', 'earth view', 'where is'],
    intentRegex: /\b(show\s+map|navigate\s+to|directions\s+to|route\s+to|where\s+is|satellite\s+view)\b/i,
    triggerEvents: ['map-update', 'map-route'],
    closeEvents: ['hide-map'],
    idleTtlMs: 180_000
  },
  {
    id: 'terminal',
    name: 'Ghost Shell Terminal',
    category: 'service',
    description: 'High-speed xterm.js ANSI terminal and PTY execution stream.',
    estimatedRamMb: 62,
    intentKeywords: ['terminal', 'shell', 'bash', 'powershell', 'cmd', 'cli', 'ghost shell', 'run command'],
    intentRegex: /\b(open\s+terminal|ghost\s+shell|run\s+command|powershell|bash\s+command|cli\s+output)\b/i,
    triggerEvents: ['terminal-data', 'open-terminal-overlay'],
    closeEvents: ['close-terminal-overlay'],
    idleTtlMs: 120_000
  },
  {
    id: 'live-coding',
    name: 'Neural Forge & Code Studio',
    category: 'widget',
    description: 'Monaco-powered live programming editor with syntax linting.',
    estimatedRamMb: 145,
    intentKeywords: ['code', 'monaco', 'write code', 'scaffold', 'live coding', 'neural forge', 'vscode', 'script'],
    intentRegex: /\b(write\s+code|code\s+editor|live\s+coding|neural\s+forge|generate\s+code|scaffold\s+app)\b/i,
    triggerEvents: ['ai-start-coding', 'ai-open-vscode'],
    closeEvents: ['close-live-coding'],
    idleTtlMs: 240_000
  },
  {
    id: 'oracle-rag',
    name: 'RAG Oracle Codebase Engine',
    category: 'ai',
    description: 'Local vector search and AST retrieval over ingested code repositories.',
    estimatedRamMb: 92,
    intentKeywords: ['oracle', 'rag', 'ingest codebase', 'search codebase', 'codebase rag', 'consult oracle'],
    intentRegex: /\b(consult\s+oracle|ingest\s+codebase|ask\s+codebase|rag\s+oracle)\b/i,
    triggerEvents: ['oracle-ingest-start', 'oracle-progress', 'oracle-ingest-done', 'oracle-thinking', 'oracle-answered'],
    closeEvents: ['close-oracle'],
    idleTtlMs: 180_000
  },
  {
    id: 'deep-research',
    name: 'Deep Research Agent',
    category: 'ai',
    description: 'Multi-hop autonomous web researcher and synthesized report generator.',
    estimatedRamMb: 76,
    intentKeywords: ['deep research', 'investigate topic', 'literature search', 'comprehensive report', 'deep search'],
    intentRegex: /\b(deep\s+research|investigate\s+topic|literature\s+review|comprehensive\s+report)\b/i,
    triggerEvents: ['deep-research-start', 'deep-research-done'],
    closeEvents: ['close-deep-research'],
    idleTtlMs: 180_000
  },
  {
    id: 'semantic-search',
    name: 'Semantic File Indexer',
    category: 'service',
    description: 'Embedding-based file system semantic search engine.',
    estimatedRamMb: 68,
    intentKeywords: ['semantic search', 'smart search files', 'find document', 'index directory', 'search meaning'],
    intentRegex: /\b(semantic\s+search|find\s+file\s+by\s+meaning|index\s+directory)\b/i,
    triggerEvents: ['semantic-start', 'semantic-done'],
    closeEvents: ['close-semantic-search'],
    idleTtlMs: 150_000
  },
  {
    id: 'smart-dropzone',
    name: 'Smart Drop Zones',
    category: 'service',
    description: 'Intelligent desktop drop targets for file classification.',
    estimatedRamMb: 42,
    intentKeywords: ['drop zone', 'dropzone', 'smart drop', 'file sorter', 'file intake'],
    intentRegex: /\b(smart\s+drop\s*zones?|dropzone|file\s+intake)\b/i,
    triggerEvents: ['dropzone-start', 'dropzone-update', 'dropzone-done'],
    closeEvents: ['close-dropzone'],
    idleTtlMs: 120_000
  },
  {
    id: 'agent-fleet',
    name: 'Sub-Agent Fleet HQ',
    category: 'ai',
    description: 'Multi-agent orchestration view tracking Alpha through Epsilon.',
    estimatedRamMb: 58,
    intentKeywords: ['agent fleet', 'fleet status', 'dispatch subagents', 'multi agent', 'fleet orchestrator'],
    intentRegex: /\b(agent\s+fleet|fleet\s+status|sub-?agents|orchestrate\s+agents)\b/i,
    triggerEvents: ['nexus-toggle-fleet-widget'],
    closeEvents: ['close-agent-fleet'],
    idleTtlMs: 180_000
  },
  {
    id: 'wallpaper-forge',
    name: 'Desktop Wallpaper Forge',
    category: 'widget',
    description: 'Generative wallpaper synthesis and direct Win32 background engagement.',
    estimatedRamMb: 48,
    intentKeywords: ['wallpaper', 'desktop background', 'change wallpaper', 'wallpaper forge', 'set background'],
    intentRegex: /\b(wallpaper|desktop\s+background|change\s+wallpaper|set\s+wallpaper)\b/i,
    triggerEvents: ['show-wallpaper-forge'],
    closeEvents: ['close-wallpaper-forge'],
    idleTtlMs: 120_000
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Communications Bridge',
    category: 'service',
    description: 'Scheduled messaging and contact communication bridge.',
    estimatedRamMb: 52,
    intentKeywords: ['whatsapp', 'send whatsapp', 'text whatsapp', 'whatsapp message', 'schedule whatsapp'],
    intentRegex: /\b(whatsapp|send\s+whatsapp|text\s+on\s+whatsapp)\b/i,
    triggerEvents: ['show-whatsapp'],
    closeEvents: ['close-whatsapp'],
    idleTtlMs: 120_000
  },
  {
    id: 'doc-forge',
    name: 'Doc Forge Studio',
    category: 'widget',
    description: 'Autonomous presentation and spreadsheet document synthesizer.',
    estimatedRamMb: 66,
    intentKeywords: ['doc forge', 'presentation', 'slides', 'spreadsheet', 'excel', 'powerpoint', 'make slides'],
    intentRegex: /\b(doc\s+forge|create\s+presentation|make\s+slides|generate\s+spreadsheet|excel\s+sheet)\b/i,
    triggerEvents: ['show-doc-forge'],
    closeEvents: ['close-doc-forge'],
    idleTtlMs: 180_000
  },
  {
    id: 'focus-protocol',
    name: 'Deep Focus Protocol',
    category: 'service',
    description: 'Distraction shielding, ambient noise synthesis, and flow-state timer.',
    estimatedRamMb: 32,
    intentKeywords: ['focus mode', 'focus protocol', 'pomodoro', 'study timer', 'distraction shield'],
    intentRegex: /\b(focus\s+mode|focus\s+protocol|pomodoro|study\s+timer|distraction\s+blocker)\b/i,
    triggerEvents: ['show-focus', 'focus-status-changed'],
    closeEvents: ['close-focus'],
    idleTtlMs: 180_000
  },
  {
    id: 'wormhole',
    name: 'Cloudflare Wormhole Tunnel',
    category: 'service',
    description: 'Edge tunneling and QR-code mobile device synchronization bridge.',
    estimatedRamMb: 26,
    intentKeywords: ['wormhole', 'mobile pair', 'tunnel to phone', 'scan qr', 'edge tunnel'],
    intentRegex: /\b(wormhole|pair\s+mobile|tunnel\s+to\s+phone|mobile\s+bridge\s+qr)\b/i,
    triggerEvents: ['wormhole-opened'],
    closeEvents: ['wormhole-closed', 'close-wormhole'],
    idleTtlMs: 120_000
  },
  {
    id: 'image-gen',
    name: 'Diffusion Image Generator',
    category: 'widget',
    description: 'Local and cloud neural art diffusion generator.',
    estimatedRamMb: 55,
    intentKeywords: ['generate image', 'draw', 'picture of', 'imagine', 'art', 'create image', '/image'],
    intentRegex: /\b(generate\s+image|draw\s+a|picture\s+of|imagine\s+a|\/image|\/art)\b/i,
    triggerEvents: ['image-gen'],
    closeEvents: ['close-image-gen'],
    idleTtlMs: 120_000
  },
  {
    id: 'email',
    name: 'Gmail Dispatch & Inbox',
    category: 'service',
    description: 'Email drafting, reading, and automated correspondence gateway.',
    estimatedRamMb: 44,
    intentKeywords: ['email', 'gmail', 'inbox', 'check email', 'unread emails', 'send email', 'draft email'],
    intentRegex: /\b(check\s+email|gmail|unread\s+emails?|send\s+email|draft\s+email)\b/i,
    triggerEvents: ['show-emails'],
    closeEvents: ['close-emails'],
    idleTtlMs: 120_000
  }
]

class DemandComponentManager {
  private states = new Map<string, ComponentLiveState>()
  private idleTimers = new Map<string, NodeJS.Timeout>()
  private listeners: Array<() => void> = []
  private isDemandMode = true
  private hasInstalledEventListeners = false

  constructor() {
    this.initRegistry()
    this.loadSettings()
    this.installGlobalEventInterceptors()
  }

  private initRegistry() {
    for (const def of COMPONENT_REGISTRY) {
      this.states.set(def.id, {
        definition: def,
        status: 'dormant',
        lastRequestedAt: null,
        lastActiveAt: null,
        activationCount: 0,
        bufferedPayload: null
      })
    }
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem('nexus_demand_mode')
      if (saved !== null) {
        this.isDemandMode = saved === 'true'
      } else {
        // Default to TRUE for maximum efficiency and resource preservation
        this.isDemandMode = true
        localStorage.setItem('nexus_demand_mode', 'true')
      }
    } catch {
      this.isDemandMode = true
    }
  }

  public setDemandMode(enabled: boolean) {
    this.isDemandMode = enabled
    try {
      localStorage.setItem('nexus_demand_mode', String(enabled))
    } catch {}
    if (!enabled) {
      // If disabled, user wants all systems online simultaneously
      console.log('[DemandManager] Demand mode disabled: waking up all components.')
    } else {
      console.log('[DemandManager] Demand mode engaged: resource conservation active.')
      // Hibernate everything that isn't currently receiving interaction
      this.hibernateInactiveComponents()
    }
    this.notify()
  }

  public isDemandModeEnabled(): boolean {
    return this.isDemandMode
  }

  /**
   * Intercepts native events dispatched by tools/APIs.
   * If a tool dispatches `show-weather`, `map-update`, etc.,
   * this automatically wakes up the targeted component just-in-time!
   */
  private installGlobalEventInterceptors() {
    if (this.hasInstalledEventListeners || typeof window === 'undefined') return
    this.hasInstalledEventListeners = true

    for (const def of COMPONENT_REGISTRY) {
      // Listen to trigger events
      for (const evName of def.triggerEvents) {
        window.addEventListener(evName, (event: any) => {
          this.demandComponent(def.id, event.detail, `event:${evName}`)
        })
      }

      // Listen to close events
      if (def.closeEvents) {
        for (const closeEv of def.closeEvents) {
          window.addEventListener(closeEv, () => {
            this.releaseComponent(def.id, `event:${closeEv}`)
          })
        }
      }
    }
  }

  /**
   * Evaluates a user prompt (from AI Chat, Voice, or Dock)
   * and wakes up ONLY the component the user is asking about!
   */
  public evaluatePromptAndActivate(prompt: string): string | null {
    if (!prompt || typeof prompt !== 'string') return null
    const cleaned = prompt.trim()

    for (const def of COMPONENT_REGISTRY) {
      let matched = false
      if (def.intentRegex && def.intentRegex.test(cleaned)) {
        matched = true
      } else {
        const lower = cleaned.toLowerCase()
        matched = def.intentKeywords.some((kw) => lower.includes(kw.toLowerCase()))
      }

      if (matched) {
        console.log(`[DemandManager] Intent match detected: "${def.name}" (${def.id}) from prompt "${prompt}"`)
        this.demandComponent(def.id, { prompt: cleaned }, 'intent-prompt')
        return def.id
      }
    }

    return null
  }

  /**
   * Demands that a specific component transition to ACTIVE state.
   */
  public demandComponent(id: string, payload?: any, reason: string = 'manual'): boolean {
    const state = this.states.get(id)
    if (!state) return false

    // Clear any pending hibernation timer
    this.clearIdleTimer(id)

    state.status = 'active'
    state.lastRequestedAt = Date.now()
    state.lastActiveAt = Date.now()
    state.activationCount++
    if (payload !== undefined) {
      state.bufferedPayload = payload
    }

    // Schedule auto-hibernation if idle
    this.scheduleIdleTimer(id)

    // Broadcast activation event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nexus-component-activated', {
          detail: { id, definition: state.definition, payload: state.bufferedPayload, reason }
        })
      )
    }

    this.notify()
    return true
  }

  /**
   * Releases an active component and returns it to DORMANT state, freeing memory.
   */
  public releaseComponent(id: string, reason: string = 'closed'): boolean {
    const state = this.states.get(id)
    if (!state) return false

    this.clearIdleTimer(id)

    state.status = 'dormant'
    state.bufferedPayload = null

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nexus-component-hibernated', {
          detail: { id, definition: state.definition, reason }
        })
      )
    }

    this.notify()
    return true
  }

  public recordInteraction(id: string) {
    const state = this.states.get(id)
    if (!state || state.status !== 'active') return
    state.lastActiveAt = Date.now()
    this.scheduleIdleTimer(id)
  }

  private scheduleIdleTimer(id: string) {
    this.clearIdleTimer(id)
    const state = this.states.get(id)
    if (!state) return

    const ttl = state.definition.idleTtlMs || 120_000
    const timer = setTimeout(() => {
      console.log(`[DemandManager] Component "${state.definition.name}" idle timeout reached (${ttl}ms). Auto-hibernating.`)
      this.releaseComponent(id, 'idle-timeout')
    }, ttl)

    this.idleTimers.set(id, timer)
  }

  private clearIdleTimer(id: string) {
    const timer = this.idleTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.idleTimers.delete(id)
    }
  }

  public hibernateInactiveComponents() {
    for (const [id, state] of this.states.entries()) {
      if (state.status === 'active') {
        const lastActive = state.lastActiveAt || 0
        if (Date.now() - lastActive > 60_000) {
          this.releaseComponent(id, 'mode-toggle')
        }
      }
    }
  }

  public isComponentActive(id: string): boolean {
    if (!this.isDemandMode) return true // If demand mode is off, all are active
    const state = this.states.get(id)
    return state ? state.status === 'active' : false
  }

  public getBufferedPayload(id: string): any {
    return this.states.get(id)?.bufferedPayload
  }

  public clearBufferedPayload(id: string) {
    const state = this.states.get(id)
    if (state) state.bufferedPayload = null
  }

  public getComponentState(id: string): ComponentLiveState | undefined {
    return this.states.get(id)
  }

  public getAllComponents(): ComponentLiveState[] {
    return Array.from(this.states.values())
  }

  public getTelemetry(): DemandTelemetry {
    let activeCount = 0
    let dormantCount = 0
    let ramSaved = 0
    let totalActivations = 0
    const activeNames: string[] = []
    const dormantNames: string[] = []

    for (const state of this.states.values()) {
      totalActivations += state.activationCount
      if (this.isDemandMode && state.status !== 'active') {
        dormantCount++
        ramSaved += state.definition.estimatedRamMb
        dormantNames.push(state.definition.name)
      } else {
        activeCount++
        activeNames.push(state.definition.name)
      }
    }

    return {
      demandModeEnabled: this.isDemandMode,
      totalComponents: this.states.size,
      activeCount,
      dormantCount,
      estimatedRamSavedMb: ramSaved,
      activeComponentNames: activeNames,
      dormantComponentNames: dormantNames,
      totalActivations
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (err) {
        console.error('[DemandManager] Listener error:', err)
      }
    }
  }
}

export const demandComponentManager = new DemandComponentManager()
