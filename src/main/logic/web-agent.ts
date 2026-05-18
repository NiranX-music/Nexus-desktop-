import { IpcMain, shell } from 'electron'
import { keyboard, Key, mouse, Point, Button } from '@nut-tree-fork/nut-js'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { load } from 'cheerio'

puppeteer.use(StealthPlugin())
keyboard.config.autoDelayMs = 18

type BrowserAccessScope = 'tab' | 'tab-group' | 'browser'

interface BrowserControlAction {
  action: string
  detail: string
  ok: boolean
  error?: string
}

interface BrowserSource {
  title: string
  url: string
  snippet: string
}

interface ServerlessBrowserPlan {
  kind:
    | 'search'
    | 'read'
    | 'open'
    | 'type'
    | 'press'
    | 'click'
    | 'scroll'
    | 'media'
    | 'account'
    | 'reload'
    | 'back'
    | 'forward'
  value: string
  direction?: 'up' | 'down'
  amount?: number
}

let serverlessBrowser: any = null
let serverlessPage: any = null
let serverlessBrowserCloseTimer: NodeJS.Timeout | null = null

const SERVERLESS_BROWSER_IDLE_MS = 90_000
const SERVERLESS_TEXT_LIMIT = 5200
const SERVERLESS_SUMMARY_LIMIT = 950
const SERVERLESS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const USER_BOOKMARKS: Record<string, string> = {
  instagram: 'https://instagram.com',
  reddit: 'https://reddit.com',
  chatgpt: 'https://chat.openai.com',
  claude: 'https://claude.ai',
  linkedin: 'https://linkedin.com'
}

const ACCOUNT_TARGETS: Record<string, string> = {
  amazon: 'https://www.amazon.in/ap/signin',
  chatgpt: 'https://chat.openai.com/auth/login',
  claude: 'https://claude.ai/login',
  discord: 'https://discord.com/login',
  facebook: 'https://www.facebook.com/login',
  github: 'https://github.com/login',
  gmail: 'https://accounts.google.com/',
  google: 'https://accounts.google.com/',
  instagram: 'https://www.instagram.com/accounts/login/',
  linkedin: 'https://www.linkedin.com/login',
  microsoft: 'https://login.live.com/',
  netflix: 'https://www.netflix.com/login',
  outlook: 'https://login.live.com/',
  reddit: 'https://www.reddit.com/login/',
  spotify: 'https://accounts.spotify.com/login',
  twitter: 'https://twitter.com/i/flow/login',
  vercel: 'https://vercel.com/login',
  x: 'https://x.com/i/flow/login',
  youtube: 'https://accounts.google.com/'
}

const SERVERLESS_KEY_MAP: Record<string, string> = {
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  space: 'Space',
  escape: 'Escape',
  esc: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End'
}

const SERVERLESS_MODIFIER_MAP: Record<string, string> = {
  control: 'Control',
  ctrl: 'Control',
  command: 'Meta',
  cmd: 'Meta',
  win: 'Meta',
  shift: 'Shift',
  alt: 'Alt'
}

const BROWSER_KEY_MAP: Record<string, Key> = {
  enter: Key.Enter,
  return: Key.Enter,
  tab: Key.Tab,
  space: Key.Space,
  escape: Key.Escape,
  esc: Key.Escape,
  backspace: Key.Backspace,
  delete: Key.Delete,
  up: Key.Up,
  down: Key.Down,
  left: Key.Left,
  right: Key.Right,
  pageup: Key.PageUp,
  pagedown: Key.PageDown,
  home: Key.Home,
  end: Key.End,
  f5: Key.F5,
  a: Key.A,
  b: Key.B,
  c: Key.C,
  d: Key.D,
  e: Key.E,
  f: Key.F,
  g: Key.G,
  h: Key.H,
  i: Key.I,
  j: Key.J,
  k: Key.K,
  l: Key.L,
  m: Key.M,
  n: Key.N,
  o: Key.O,
  p: Key.P,
  q: Key.Q,
  r: Key.R,
  s: Key.S,
  t: Key.T,
  u: Key.U,
  v: Key.V,
  w: Key.W,
  x: Key.X,
  y: Key.Y,
  z: Key.Z
}

const MODIFIER_KEY_MAP: Record<string, Key> = {
  control: Key.LeftControl,
  ctrl: Key.LeftControl,
  command: Key.LeftSuper,
  cmd: Key.LeftSuper,
  win: Key.LeftSuper,
  shift: Key.LeftShift,
  alt: Key.LeftAlt
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const normalizeUrl = (value: string) => {
  const target = value.trim().replace(/^["']|["']$/g, '')
  if (/^https?:\/\//i.test(target)) return target
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(target)) return `https://${target}`
  return `https://www.google.com/search?q=${encodeURIComponent(target)}`
}

const getGoogleSearchUrl = (query: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`

const splitBrowserPrompt = (prompt: string) =>
  prompt
    .split(/\s+(?:and then|then|after that)\s+|;\s*/i)
    .map((step) => step.trim())
    .filter(Boolean)

const parseShortcut = (value: string) => {
  const tokens = value
    .toLowerCase()
    .replace(/\s*\+\s*/g, '+')
    .split(/[+\s]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const modifiers: Key[] = []
  let key: Key | undefined

  for (const token of tokens) {
    const modifier = MODIFIER_KEY_MAP[token]
    if (modifier !== undefined) {
      modifiers.push(modifier)
      continue
    }

    const mappedKey = BROWSER_KEY_MAP[token]
    if (mappedKey !== undefined) key = mappedKey
  }

  return { modifiers, key }
}

const pressBrowserShortcut = async (value: string) => {
  const { modifiers, key } = parseShortcut(value)
  if (key === undefined) throw new Error(`Unsupported key: ${value}`)

  for (const modifier of modifiers) await keyboard.pressKey(modifier)
  await keyboard.pressKey(key)
  await keyboard.releaseKey(key)
  for (const modifier of modifiers.reverse()) await keyboard.releaseKey(modifier)
}

const openInCurrentTab = async (target: string) => {
  await pressBrowserShortcut('ctrl+l')
  await keyboard.type(target)
  await keyboard.pressKey(Key.Enter)
  await keyboard.releaseKey(Key.Enter)
  await delay(700)
}

const openInTabGroup = async (target: string) => {
  await pressBrowserShortcut('ctrl+t')
  await keyboard.type(target)
  await keyboard.pressKey(Key.Enter)
  await keyboard.releaseKey(Key.Enter)
  await delay(700)
}

const openWithScope = async (target: string, scope: BrowserAccessScope) => {
  if (scope === 'tab') {
    await openInCurrentTab(target)
    return 'Active tab'
  }

  if (scope === 'tab-group') {
    await openInTabGroup(target)
    return 'Current tab group'
  }

  await shell.openExternal(target)
  await delay(700)
  return 'All browser windows'
}

const requireScope = (scope: BrowserAccessScope, allowed: BrowserAccessScope[], action: string) => {
  if (!allowed.includes(scope)) {
    throw new Error(`${action} requires ${allowed.join(' or ')} access.`)
  }
}

const runBrowserStep = async (rawStep: string, scope: BrowserAccessScope) => {
  const step = rawStep.trim()
  const lower = step.toLowerCase()

  if (/^(new tab|open new tab)$/.test(lower)) {
    requireScope(scope, ['tab-group', 'browser'], 'Opening a new tab')
    await pressBrowserShortcut('ctrl+t')
    return { action: 'shortcut', detail: `New tab (${scope})` }
  }

  if (/^(close tab|close current tab)$/.test(lower)) {
    requireScope(scope, ['tab-group', 'browser'], 'Closing tabs')
    await pressBrowserShortcut('ctrl+w')
    return { action: 'shortcut', detail: `Close tab (${scope})` }
  }

  if (/^(new window|open new window)$/.test(lower)) {
    requireScope(scope, ['browser'], 'Opening a new browser window')
    await pressBrowserShortcut('ctrl+n')
    return { action: 'shortcut', detail: 'New browser window' }
  }

  if (/^(reload|refresh)$/.test(lower)) {
    await pressBrowserShortcut('f5')
    return { action: 'shortcut', detail: 'Reload' }
  }

  if (/^(back|go back)$/.test(lower)) {
    await pressBrowserShortcut('alt+left')
    return { action: 'shortcut', detail: 'Back' }
  }

  if (/^(forward|go forward)$/.test(lower)) {
    await pressBrowserShortcut('alt+right')
    return { action: 'shortcut', detail: 'Forward' }
  }

  if (/^(address bar|focus address bar|select address bar)$/.test(lower)) {
    await pressBrowserShortcut('ctrl+l')
    return { action: 'shortcut', detail: 'Address bar' }
  }

  const openMatch = step.match(/^(?:open|go to|visit)\s+(.+)$/i)
  if (openMatch) {
    const target = normalizeUrl(openMatch[1])
    const access = await openWithScope(target, scope)
    return { action: 'open', detail: `${target} via ${access}` }
  }

  const searchMatch = step.match(/^(?:search|google|look up|find)\s+(?:for\s+)?(.+)$/i)
  if (searchMatch) {
    const query = searchMatch[1].trim()
    const target = getGoogleSearchUrl(query)
    const access = await openWithScope(target, scope)
    return { action: 'search', detail: `${query} via ${access}` }
  }

  const typeMatch = step.match(/^(?:type|write|input|paste)\s+(.+)$/i)
  if (typeMatch) {
    const text = typeMatch[1].replace(/^["']|["']$/g, '')
    await keyboard.type(text)
    return { action: 'type', detail: text.length > 80 ? `${text.slice(0, 80)}...` : text }
  }

  const pressMatch = step.match(/^(?:press|hit)\s+(.+)$/i)
  if (pressMatch) {
    await pressBrowserShortcut(pressMatch[1])
    return { action: 'shortcut', detail: pressMatch[1] }
  }

  const coordinateClickMatch = step.match(
    /^(double\s+click|click)(?:\s+at)?\s+(\d{1,5})\s*[,x]\s*(\d{1,5})$/i
  )
  if (coordinateClickMatch) {
    const x = Number(coordinateClickMatch[2])
    const y = Number(coordinateClickMatch[3])
    await mouse.setPosition(new Point(x, y))
    if (/double/i.test(coordinateClickMatch[1])) await mouse.doubleClick(Button.LEFT)
    else await mouse.leftClick()
    return {
      action: /double/i.test(coordinateClickMatch[1]) ? 'double-click' : 'click',
      detail: `${x}, ${y}`
    }
  }

  if (/^double\s+click$/i.test(step)) {
    await mouse.doubleClick(Button.LEFT)
    return { action: 'double-click', detail: 'Current pointer' }
  }

  if (/^click$/i.test(step)) {
    await mouse.leftClick()
    return { action: 'click', detail: 'Current pointer' }
  }

  const scrollMatch = step.match(/^scroll\s+(up|down)(?:\s+(\d+))?$/i)
  if (scrollMatch) {
    const amount = Number(scrollMatch[2] || 420)
    if (scrollMatch[1].toLowerCase() === 'up') await mouse.scrollUp(amount)
    else await mouse.scrollDown(amount)
    return { action: 'scroll', detail: `${scrollMatch[1].toLowerCase()} ${amount}` }
  }

  const fallbackTarget = getGoogleSearchUrl(step)
  const access = await openWithScope(fallbackTarget, scope)
  return { action: 'search', detail: `${step} via ${access}` }
}

const getSmartUrl = (
  query: string
): { url: string; source: string; skipScrape: boolean } | null => {
  const lower = query.toLowerCase()

  for (const [key, url] of Object.entries(USER_BOOKMARKS)) {
    if (lower.includes(key)) {
      return { url, source: 'Bookmark', skipScrape: false }
    }
  }

  if (lower.includes('amazon') || lower.includes('buy') || lower.includes('shop for')) {
    const term = lower.replace(/(amazon|buy|price of|shop for)/g, '').trim()
    return {
      url: `https://www.amazon.in/s?k=${encodeURIComponent(term)}`,
      source: 'Amazon',
      skipScrape: true
    }
  }

  if (lower.includes('github') || lower.includes('repo')) {
    const match = lower.match(/github(?: profile)?(?: of)?\s+(\w+)/)
    const term = match ? match[1] : lower.replace('github', '').trim()
    return {
      url: `https://github.com/${term}`,
      source: 'GitHub',
      skipScrape: false
    }
  }

  if (lower.includes('youtube') || lower.includes('watch')) {
    const term = lower.replace(/(youtube|watch)/g, '').trim()
    return {
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`,
      source: 'YouTube',
      skipScrape: true
    }
  }

  if (lower.startsWith('open ') || lower.startsWith('go to ')) {
    const term = lower.replace(/^(open|go to)( the)?\s+/, '').trim()

    if (!term.includes('who') && !term.includes('what') && !term.includes('how')) {
      return {
        url: `https://duckduckgo.com/?q=!ducky+${encodeURIComponent(term)}`,
        source: 'Smart Redirect',
        skipScrape: false
      }
    }
  }

  return null
}

const isPrivateHostname = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:')
  ) {
    return true
  }

  if (/^(0|10|127)\./.test(host)) return true
  if (/^169\.254\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true

  const private172 = host.match(/^172\.(\d{1,3})\./)
  if (private172) {
    const octet = Number(private172[1])
    return octet >= 16 && octet <= 31
  }

  return false
}

const normalizePublicHttpUrl = (value: string) => {
  const target = value.trim().replace(/^["']|["']$/g, '')
  const candidate = /^https?:\/\//i.test(target) ? target : `https://${target}`
  const url = new URL(candidate)

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Serverless browser only supports public HTTP and HTTPS pages.')
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error('Serverless browser blocks localhost and private-network URLs.')
  }

  url.username = ''
  url.password = ''
  return url.toString()
}

const looksLikeUrlTarget = (value: string) => {
  const target = value.trim().replace(/^["']|["']$/g, '')
  return /^https?:\/\//i.test(target) || /^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(target)
}

const resolveDuckDuckGoUrl = (href: string) => {
  const url = new URL(href, 'https://duckduckgo.com')
  const uddg = url.searchParams.get('uddg')
  return normalizePublicHttpUrl(uddg ? decodeURIComponent(uddg) : url.toString())
}

const createExtractiveSummary = (text: string, maxLength = SERVERLESS_SUMMARY_LIMIT) => {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean

  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean]
  const selected: string[] = []
  let total = 0

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (trimmed.length < 35) continue
    if (total + trimmed.length > maxLength) break
    selected.push(trimmed)
    total += trimmed.length + 1
  }

  const summary = selected.join(' ')
  if (summary.length >= 120) return summary
  return `${clean.slice(0, maxLength - 3).trim()}...`
}

const parseServerlessBrowserPrompt = (prompt: string): ServerlessBrowserPlan => {
  const command = prompt.trim()
  const lower = command.toLowerCase()

  if (/^(?:reload|refresh)$/i.test(command)) {
    return { kind: 'reload', value: 'current page' }
  }

  if (/^(?:back|go back)$/i.test(command)) {
    return { kind: 'back', value: 'browser history' }
  }

  if (/^(?:forward|go forward)$/i.test(command)) {
    return { kind: 'forward', value: 'browser history' }
  }

  const mediaMatch = command.match(
    /^(?:(?:media|video|audio|song|track)\s+)?(play|pause|resume|toggle|next|previous|prev)(?:\s+(?:media|video|audio|song|track))?$/i
  )
  if (mediaMatch) {
    const raw = mediaMatch[1].toLowerCase()
    return {
      kind: 'media',
      value: raw === 'resume' ? 'play' : raw === 'prev' ? 'previous' : raw
    }
  }

  const accountMatch =
    command.match(
      /^(?:add|connect|open|create)\s+(?:my\s+)?(?:(.+?)\s+)?accounts?(?:\s+(?:on|for|to)\s+(.+))?$/i
    ) || command.match(/^(?:login|log in|sign in|signin)\s+(?:to|into|on)\s+(.+)$/i)
  if (accountMatch) {
    const target = (accountMatch[2] || accountMatch[1] || 'google').trim()
    return { kind: 'account', value: target }
  }

  const typeMatch = command.match(/^(?:type|write|input|paste)\s+(.+)$/i)
  if (typeMatch) {
    return { kind: 'type', value: typeMatch[1].replace(/^["']|["']$/g, '').trim() }
  }

  const pressMatch = command.match(/^(?:press|hit|key)\s+(.+)$/i)
  if (pressMatch) {
    return { kind: 'press', value: pressMatch[1].trim() }
  }

  const clickMatch = command.match(/^(?:click|tap|select|choose)(?:\s+(.+))?$/i)
  if (clickMatch) {
    return { kind: 'click', value: (clickMatch[1] || 'focused element').trim() }
  }

  const scrollMatch = command.match(/^scroll\s+(up|down)(?:\s+(\d+))?$/i)
  if (scrollMatch) {
    return {
      kind: 'scroll',
      value: `${scrollMatch[1].toLowerCase()} ${scrollMatch[2] || 620}`,
      direction: scrollMatch[1].toLowerCase() as 'up' | 'down',
      amount: Number(scrollMatch[2] || 620)
    }
  }

  const openMatch = command.match(/^(?:open|go to|visit)\s+(.+)$/i)
  if (openMatch) {
    const target = openMatch[1].trim()
    return looksLikeUrlTarget(target) || getSmartUrl(target) || lower.startsWith('open ')
      ? { kind: 'open', value: target }
      : { kind: 'search', value: target }
  }

  const searchMatch = command.match(
    /^(?:search|google|look up|find|research|web search)\s+(?:for\s+)?(.+)$/i
  )

  if (searchMatch) {
    return { kind: 'search', value: searchMatch[1].trim() }
  }

  const readMatch = command.match(/^(?:open|read|visit|summari[sz]e|inspect)\s+(.+)$/i)
  if (readMatch) {
    const target = readMatch[1].trim()
    return looksLikeUrlTarget(target)
      ? { kind: 'read', value: target }
      : { kind: 'search', value: target }
  }

  return looksLikeUrlTarget(command)
    ? { kind: 'read', value: command }
    : { kind: 'search', value: command }
}

const scheduleServerlessBrowserClose = () => {
  if (serverlessBrowserCloseTimer) clearTimeout(serverlessBrowserCloseTimer)

  serverlessBrowserCloseTimer = setTimeout(async () => {
    const browser = serverlessBrowser
    serverlessBrowser = null
    serverlessPage = null
    serverlessBrowserCloseTimer = null
    if (browser) await browser.close().catch(() => undefined)
  }, SERVERLESS_BROWSER_IDLE_MS)
}

const getServerlessBrowser = async () => {
  if (serverlessBrowser?.isConnected?.()) {
    scheduleServerlessBrowserClose()
    return serverlessBrowser
  }

  serverlessBrowser = await puppeteer.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--autoplay-policy=no-user-gesture-required',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--no-first-run',
      '--window-size=1366,768'
    ]
  })

  scheduleServerlessBrowserClose()
  return serverlessBrowser
}

const prepareServerlessPage = async (page: any, options: { allowRichAssets?: boolean } = {}) => {
  page.setDefaultTimeout(18_000)
  page.setDefaultNavigationTimeout(18_000)
  page.__nexusAllowRichAssets = Boolean(options.allowRichAssets)
  await page.setUserAgent(SERVERLESS_USER_AGENT)
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 })
  await page.setCacheEnabled(false)

  if (page.__nexusRequestInterceptionReady) return

  await page.setRequestInterception(true)

  page.on('request', (request: any) => {
    const resourceType = request.resourceType()
    if (
      !page.__nexusAllowRichAssets &&
      ['font', 'image', 'media', 'stylesheet'].includes(resourceType)
    ) {
      request.abort().catch(() => undefined)
      return
    }

    request.continue().catch(() => undefined)
  })

  page.__nexusRequestInterceptionReady = true
}

const getServerlessPage = async (options: { allowRichAssets?: boolean } = {}) => {
  const browser = await getServerlessBrowser()

  if (serverlessPage && !serverlessPage.isClosed?.()) {
    await prepareServerlessPage(serverlessPage, options)
    return serverlessPage
  }

  const page = await browser.newPage()
  serverlessPage = page
  await prepareServerlessPage(page, options)
  page.on('close', () => {
    if (serverlessPage === page) serverlessPage = null
  })

  return page
}

const extractSources = (
  $: ReturnType<typeof load>,
  baseUrl: string,
  limit = 5
): BrowserSource[] => {
  const sources: BrowserSource[] = []

  $('a[href]').each((_, element) => {
    if (sources.length >= limit) return false

    const title = $(element).text().replace(/\s+/g, ' ').trim()
    const href = $(element).attr('href')
    if (!title || !href || title.length < 4) return undefined

    try {
      const url = normalizePublicHttpUrl(new URL(href, baseUrl).toString())
      if (sources.some((source) => source.url === url)) return undefined
      sources.push({ title: title.slice(0, 120), url, snippet: '' })
    } catch {
      return undefined
    }

    return undefined
  })

  return sources
}

const readServerlessPage = async (page: any, targetUrl: string) => {
  const url = normalizePublicHttpUrl(targetUrl)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18_000 })
  await page.waitForSelector('body', { timeout: 5000 }).catch(() => undefined)

  const html = await page.content()
  const $ = load(html)

  $('script, style, noscript, svg, iframe, canvas, form, button, input, select, textarea').remove()

  const title =
    $('title').first().text().replace(/\s+/g, ' ').trim() ||
    $('h1').first().text().replace(/\s+/g, ' ').trim() ||
    url
  const description =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    ''
  const headings = $('main h1, main h2, article h1, article h2, h1, h2')
    .map((_, element) => $(element).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter((text) => text.length >= 6)
    .slice(0, 8)
  const paragraphs = $('main p, article p, p, main li, article li')
    .map((_, element) => $(element).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter((text) => text.length >= 45)
    .slice(0, 18)

  const readableText = [title, description, ...headings, ...paragraphs]
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, SERVERLESS_TEXT_LIMIT)
  const summary = createExtractiveSummary(readableText || title)

  return {
    title,
    url,
    summary,
    readableText,
    sources: extractSources($, url)
  }
}

const searchServerlessWeb = async (page: any, query: string) => {
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 18_000 })
  await page.waitForSelector('body', { timeout: 5000 }).catch(() => undefined)

  const html = await page.content()
  const $ = load(html)
  const sources: BrowserSource[] = []

  $('.result').each((_, element) => {
    if (sources.length >= 6) return false

    const link = $(element).find('a.result__a').first()
    const title = link.text().replace(/\s+/g, ' ').trim()
    const href = link.attr('href')
    const snippet = $(element).find('.result__snippet').text().replace(/\s+/g, ' ').trim()

    if (!title || !href) return undefined

    try {
      const url = resolveDuckDuckGoUrl(href)
      if (sources.some((source) => source.url === url)) return undefined
      sources.push({ title: title.slice(0, 140), url, snippet: snippet.slice(0, 220) })
    } catch {
      return undefined
    }

    return undefined
  })

  if (sources.length === 0) {
    $('a[href]').each((_, element) => {
      if (sources.length >= 6) return false

      const title = $(element).text().replace(/\s+/g, ' ').trim()
      const href = $(element).attr('href')
      if (!title || !href || title.length < 8) return undefined

      try {
        const url = resolveDuckDuckGoUrl(href)
        if (url.includes('duckduckgo.com') || sources.some((source) => source.url === url)) {
          return undefined
        }
        sources.push({ title: title.slice(0, 140), url, snippet: '' })
      } catch {
        return undefined
      }

      return undefined
    })
  }

  return sources
}

const resolveServerlessOpenUrl = (value: string) => {
  const target = value.trim().replace(/^["']|["']$/g, '')
  const smartRoute = getSmartUrl(target)
  if (smartRoute) return normalizePublicHttpUrl(smartRoute.url)
  if (looksLikeUrlTarget(target)) return normalizePublicHttpUrl(target)
  return normalizePublicHttpUrl(getGoogleSearchUrl(target))
}

const resolveServerlessAccountTarget = (value: string) => {
  const target = value
    .toLowerCase()
    .replace(/\b(my|the|an|a|account|accounts|login|sign in|signin)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const [key, url] of Object.entries(ACCOUNT_TARGETS)) {
    if (target.includes(key) || key.includes(target)) {
      return { provider: key, url: normalizePublicHttpUrl(url) }
    }
  }

  if (looksLikeUrlTarget(value)) {
    return { provider: 'custom', url: normalizePublicHttpUrl(value) }
  }

  return { provider: 'google', url: normalizePublicHttpUrl(ACCOUNT_TARGETS.google) }
}

const snapshotServerlessPage = async (page: any) => {
  const url = page.url()
  const title = ((await page.title().catch(() => '')) || url || 'Serverless browser').trim()
  let readableText = ''
  let sources: BrowserSource[] = []

  try {
    const html = await page.content()
    const $ = load(html)
    $('script, style, noscript, svg, iframe, canvas').remove()
    readableText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, SERVERLESS_TEXT_LIMIT)
    sources = extractSources($, url)
  } catch {
    readableText = ''
    sources = []
  }

  return {
    title,
    url,
    readableText,
    sources,
    summary: readableText
      ? `${title}: ${createExtractiveSummary(readableText, 520)}`
      : `${title} is open in Serverless Chromium.`
  }
}

const normalizeServerlessKey = (token: string) => {
  const lower = token.toLowerCase()
  if (SERVERLESS_KEY_MAP[lower]) return SERVERLESS_KEY_MAP[lower]
  if (/^f\d{1,2}$/i.test(token)) return token.toUpperCase()
  if (token.length === 1) return token.toUpperCase()
  return token
}

const pressServerlessShortcut = async (page: any, value: string) => {
  const tokens = value
    .toLowerCase()
    .replace(/\s*\+\s*/g, '+')
    .split(/[+\s]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const modifiers: string[] = []
  let key = ''

  for (const token of tokens) {
    const modifier = SERVERLESS_MODIFIER_MAP[token]
    if (modifier) modifiers.push(modifier)
    else key = normalizeServerlessKey(token)
  }

  if (!key) throw new Error(`Unsupported serverless key: ${value}`)

  for (const modifier of modifiers) await page.keyboard.down(modifier)
  try {
    await page.keyboard.press(key)
  } finally {
    for (const modifier of modifiers.reverse()) await page.keyboard.up(modifier)
  }
}

const focusServerlessInput = async (page: any) => {
  const result = await page.evaluate(() => {
    const doc = (globalThis as any).document
    const win = (globalThis as any).window
    if (!doc || !win) return { ok: false, detail: 'No page is loaded.' }

    const isVisible = (element: any) => {
      const rect = element.getBoundingClientRect()
      const style = win.getComputedStyle(element)
      return rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden'
    }

    const getWritableState = (element: any) => {
      const tag = String(element.tagName || '').toLowerCase()
      const type = String(element.getAttribute?.('type') || '').toLowerCase()
      if (element.disabled || element.readOnly) return { writable: false, blocked: false }
      if (type === 'password') return { writable: false, blocked: true }
      if (tag === 'textarea') return { writable: true, blocked: false }
      if (tag === 'input') {
        const accepted = ['', 'text', 'search', 'email', 'url', 'tel', 'number'].includes(type)
        return { writable: accepted, blocked: false }
      }
      return {
        writable: element.isContentEditable || element.getAttribute?.('role') === 'textbox',
        blocked: false
      }
    }

    const labelFor = (element: any) =>
      (
        element.getAttribute?.('aria-label') ||
        element.getAttribute?.('placeholder') ||
        element.getAttribute?.('name') ||
        element.getAttribute?.('id') ||
        element.textContent ||
        element.tagName ||
        'text field'
      )
        .replace(/\s+/g, ' ')
        .trim()

    const active = doc.activeElement
    if (active && active !== doc.body && isVisible(active)) {
      const state = getWritableState(active)
      if (state.blocked) return { ok: false, detail: 'Focused field is a password field.' }
      if (state.writable) {
        active.focus()
        return { ok: true, detail: labelFor(active) }
      }
    }

    const elements = Array.from(
      doc.querySelectorAll('textarea,input,[contenteditable="true"],[role="textbox"]')
    ) as any[]
    for (const element of elements) {
      if (!isVisible(element)) continue
      const state = getWritableState(element)
      if (state.blocked) continue
      if (!state.writable) continue
      element.focus()
      return { ok: true, detail: labelFor(element) }
    }

    return { ok: false, detail: 'No visible writable text box found.' }
  })

  if (!result.ok) throw new Error(result.detail)
  return result.detail
}

const clickServerlessTarget = async (page: any, target: string) => {
  const candidate = await page.evaluate((targetText: string) => {
    const doc = (globalThis as any).document
    const win = (globalThis as any).window
    if (!doc || !win) return null

    const needle = targetText.toLowerCase().replace(/\s+/g, ' ').trim()
    const useFocused = !needle || needle === 'focused element' || needle === 'current'
    const isVisible = (element: any) => {
      const rect = element.getBoundingClientRect()
      const style = win.getComputedStyle(element)
      return rect.width > 3 && rect.height > 3 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const labelFor = (element: any) =>
      [
        element.innerText,
        element.textContent,
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title'),
        element.getAttribute?.('placeholder'),
        element.getAttribute?.('value'),
        element.getAttribute?.('alt')
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    const toCandidate = (element: any) => {
      const rect = element.getBoundingClientRect()
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        label: labelFor(element) || element.tagName || 'element'
      }
    }

    const active = doc.activeElement
    if (useFocused && active && active !== doc.body && isVisible(active)) return toCandidate(active)

    const elements = Array.from(
      doc.querySelectorAll(
        'button,a,input,textarea,select,label,[role="button"],[role="link"],[aria-label],[title],[contenteditable="true"]'
      )
    ) as any[]

    for (const element of elements) {
      if (!isVisible(element)) continue
      const label = labelFor(element).toLowerCase()
      if (useFocused || label.includes(needle)) return toCandidate(element)
    }

    return null
  }, target)

  if (!candidate) throw new Error(`No visible serverless target matched "${target}".`)
  await page.mouse.click(candidate.x, candidate.y)
  await delay(650)
  return candidate.label
}

const scrollServerlessPage = async (
  page: any,
  direction: 'up' | 'down' = 'down',
  amount = 620
) => {
  return page.evaluate(
    ({ direction, amount }: { direction: 'up' | 'down'; amount: number }) => {
      const win = (globalThis as any).window
      if (!win) return 0
      win.scrollBy({ top: direction === 'up' ? -amount : amount, behavior: 'smooth' })
      return Math.round(win.scrollY || 0)
    },
    { direction, amount }
  )
}

const controlServerlessMedia = async (page: any, command: string) => {
  const result = await page.evaluate(async (mediaCommand: string) => {
    const doc = (globalThis as any).document
    if (!doc) return { ok: false, detail: 'No page is loaded.' }

    const labelFor = (element: any) =>
      [
        element.innerText,
        element.textContent,
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title')
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

    const clickByLabel = (patterns: RegExp[]) => {
      const elements = Array.from(doc.querySelectorAll('button,a,[role="button"],[aria-label]')) as any[]
      for (const element of elements) {
        const label = labelFor(element)
        if (!patterns.some((pattern) => pattern.test(label))) continue
        element.click()
        return label || 'media button'
      }
      return ''
    }

    if (mediaCommand === 'next') {
      const label = clickByLabel([/next/i, /skip/i])
      return label
        ? { ok: true, detail: `Clicked ${label}` }
        : { ok: false, detail: 'No next media control was visible.' }
    }

    if (mediaCommand === 'previous') {
      const label = clickByLabel([/previous/i, /prev/i, /back/i])
      return label
        ? { ok: true, detail: `Clicked ${label}` }
        : { ok: false, detail: 'No previous media control was visible.' }
    }

    const media = Array.from(doc.querySelectorAll('video,audio')) as any[]
    const target = media.find((item) => !item.paused) || media[0]

    if (!target) {
      const label = clickByLabel([
        mediaCommand === 'pause' ? /pause/i : /play/i,
        /play/i,
        /pause/i
      ])
      return label
        ? { ok: true, detail: `Clicked ${label}` }
        : { ok: false, detail: 'No playable media element was found.' }
    }

    try {
      if (mediaCommand === 'pause') target.pause()
      else if (mediaCommand === 'play') await target.play()
      else if (target.paused) await target.play()
      else target.pause()

      return {
        ok: true,
        detail: target.paused ? 'Media paused.' : 'Media playing.'
      }
    } catch (error: any) {
      return { ok: false, detail: error?.message || 'Media control was blocked by the page.' }
    }
  }, command)

  if (!result.ok && ['play', 'pause', 'toggle'].includes(command)) {
    await page.keyboard.press('Space').catch(() => undefined)
    return `${result.detail} Sent Space as a fallback media toggle.`
  }

  if (!result.ok) throw new Error(result.detail)
  return result.detail
}

const runServerlessBrowserPrompt = async (prompt: string, scope: BrowserAccessScope) => {
  const actions: BrowserControlAction[] = []

  if (!prompt) {
    return {
      success: false,
      summary: 'No serverless browser prompt received.',
      scope,
      runtime: 'serverless-chromium',
      actions,
      sources: []
    }
  }

  try {
    const plan = parseServerlessBrowserPrompt(prompt)
    const page = await getServerlessPage({
      allowRichAssets: !['search', 'read'].includes(plan.kind)
    })

    actions.push({
      action: `serverless_${plan.kind}`,
      detail: plan.value,
      ok: true
    })

    const finishControlAction = async (summaryPrefix: string, includeReadableText = false) => {
      const snapshot = await snapshotServerlessPage(page)
      return {
        success: true,
        summary: `${summaryPrefix} Current page: ${snapshot.title}.`,
        scope,
        runtime: 'serverless-chromium',
        actions,
        sources: snapshot.sources,
        readableText: includeReadableText ? snapshot.readableText : undefined,
        url: snapshot.url,
        title: snapshot.title
      }
    }

    if (plan.kind === 'read') {
      const pageResult = await readServerlessPage(page, plan.value)
      actions.push({ action: 'read_page', detail: pageResult.url, ok: true })

      return {
        success: true,
        summary: pageResult.summary,
        scope,
        runtime: 'serverless-chromium',
        actions,
        sources: pageResult.sources,
        readableText: pageResult.readableText,
        url: pageResult.url,
        title: pageResult.title
      }
    }

    if (plan.kind === 'open') {
      const url = resolveServerlessOpenUrl(plan.value)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 22_000 })
      await page.waitForSelector('body', { timeout: 5000 }).catch(() => undefined)
      actions.push({ action: 'open_page', detail: url, ok: true })
      return finishControlAction('Opened in the persistent serverless browser.', true)
    }

    if (plan.kind === 'account') {
      const account = resolveServerlessAccountTarget(plan.value)
      await page.goto(account.url, { waitUntil: 'domcontentloaded', timeout: 22_000 })
      await page.waitForSelector('body', { timeout: 5000 }).catch(() => undefined)
      actions.push({ action: 'account_page', detail: `${account.provider}: ${account.url}`, ok: true })
      const snapshot = await snapshotServerlessPage(page)
      return {
        success: true,
        summary: `Opened the ${account.provider} account page in Serverless Chromium. Credentials are not stored or auto-filled; use explicit text commands or the live bridge when you are ready.`,
        scope,
        runtime: 'serverless-chromium',
        actions,
        sources: snapshot.sources,
        readableText: snapshot.readableText,
        url: snapshot.url,
        title: snapshot.title
      }
    }

    if (plan.kind === 'type') {
      const field = await focusServerlessInput(page)
      await page.keyboard.type(plan.value, { delay: 8 })
      actions.push({ action: 'type_text', detail: `Typed into ${field}`, ok: true })
      return finishControlAction(`Typed into ${field} in Serverless Chromium.`)
    }

    if (plan.kind === 'press') {
      await pressServerlessShortcut(page, plan.value)
      actions.push({ action: 'press_key', detail: plan.value, ok: true })
      return finishControlAction(`Pressed ${plan.value} in Serverless Chromium.`)
    }

    if (plan.kind === 'click') {
      const label = await clickServerlessTarget(page, plan.value)
      actions.push({ action: 'click_target', detail: label, ok: true })
      return finishControlAction(`Clicked ${label} in Serverless Chromium.`, true)
    }

    if (plan.kind === 'scroll') {
      const y = await scrollServerlessPage(page, plan.direction, plan.amount)
      actions.push({ action: 'scroll_page', detail: `${plan.value}; y=${y}`, ok: true })
      return finishControlAction(`Scrolled ${plan.direction || 'down'} in Serverless Chromium.`)
    }

    if (plan.kind === 'media') {
      const detail = await controlServerlessMedia(page, plan.value)
      actions.push({ action: 'media_control', detail, ok: true })
      return finishControlAction(`Media command completed: ${detail}`)
    }

    if (plan.kind === 'reload') {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 18_000 })
      actions.push({ action: 'reload_page', detail: page.url(), ok: true })
      return finishControlAction('Reloaded the serverless browser page.', true)
    }

    if (plan.kind === 'back') {
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 18_000 }).catch(() => null)
      actions.push({ action: 'history_back', detail: page.url(), ok: true })
      return finishControlAction('Moved back in serverless browser history.', true)
    }

    if (plan.kind === 'forward') {
      await page.goForward({ waitUntil: 'domcontentloaded', timeout: 18_000 }).catch(() => null)
      actions.push({ action: 'history_forward', detail: page.url(), ok: true })
      return finishControlAction('Moved forward in serverless browser history.', true)
    }

    const sources = await searchServerlessWeb(page, plan.value)
    actions.push({
      action: 'search_results',
      detail: `${sources.length} public result${sources.length === 1 ? '' : 's'}`,
      ok: sources.length > 0
    })

    if (sources.length === 0) {
      return {
        success: false,
        summary: 'Serverless browser searched the web but did not find readable results.',
        scope,
        runtime: 'serverless-chromium',
        actions,
        sources: []
      }
    }

    let pageSummary = ''
    let readableText = ''
    let primaryTitle = sources[0].title

    try {
      const pageResult = await readServerlessPage(page, sources[0].url)
      pageSummary = pageResult.summary
      readableText = pageResult.readableText
      primaryTitle = pageResult.title || primaryTitle
      actions.push({ action: 'read_top_result', detail: sources[0].url, ok: true })
    } catch (error: any) {
      actions.push({
        action: 'read_top_result',
        detail: sources[0].url,
        ok: false,
        error: error?.message || 'Top result could not be read.'
      })
    }

    const searchSummary = sources
      .slice(0, 3)
      .map(
        (source, index) =>
          `${index + 1}. ${source.title}${source.snippet ? ` - ${source.snippet}` : ''}`
      )
      .join(' ')
    const summary = pageSummary
      ? `${primaryTitle}: ${pageSummary}`
      : `Serverless browser found ${sources.length} results. ${createExtractiveSummary(searchSummary)}`

    return {
      success: true,
      summary,
      scope,
      runtime: 'serverless-chromium',
      actions,
      sources,
      readableText,
      title: primaryTitle
    }
  } catch (error: any) {
    actions.push({
      action: 'serverless_error',
      detail: prompt,
      ok: false,
      error: error?.message || 'Serverless browser failed.'
    })

    return {
      success: false,
      summary: error?.message || 'Serverless browser failed.',
      scope,
      runtime: 'serverless-chromium',
      actions,
      sources: []
    }
  } finally {
    scheduleServerlessBrowserClose()
  }
}

export default function registerWebAgent(ipcMain: IpcMain) {
  ipcMain.removeHandler('browser-control:run')
  ipcMain.handle(
    'browser-control:run',
    async (_event, payload: { prompt?: string; scope?: BrowserAccessScope } = {}) => {
      const prompt = String(payload.prompt || '').trim()
      const requestedScope = payload.scope || 'tab'
      const scope: BrowserAccessScope = ['tab', 'tab-group', 'browser'].includes(requestedScope)
        ? requestedScope
        : 'tab'

      if (!prompt) {
        return {
          success: false,
          summary: 'No browser command received.',
          scope,
          actions: []
        }
      }

      const steps = splitBrowserPrompt(prompt)
      const actions: Array<{ action: string; detail: string; ok: boolean; error?: string }> = []

      for (const step of steps) {
        try {
          const result = await runBrowserStep(step, scope)
          actions.push({ ...result, ok: true })
        } catch (error: any) {
          actions.push({
            action: 'error',
            detail: step,
            ok: false,
            error: error?.message || 'Browser action failed.'
          })
          break
        }
      }

      const completed = actions.filter((action) => action.ok).length
      const failed = actions.find((action) => !action.ok)

      return {
        success: !failed,
        summary: failed
          ? `Completed ${completed}/${steps.length} ${scope} browser actions. ${failed.error}`
          : `Completed ${completed} ${scope} browser action${completed === 1 ? '' : 's'}.`,
        scope,
        actions
      }
    }
  )

  ipcMain.removeHandler('browser-control:serverless-run')
  ipcMain.handle(
    'browser-control:serverless-run',
    async (_event, payload: { prompt?: string; scope?: BrowserAccessScope } = {}) => {
      const prompt = String(payload.prompt || '').trim()
      const requestedScope = payload.scope || 'tab'
      const scope: BrowserAccessScope = ['tab', 'tab-group', 'browser'].includes(requestedScope)
        ? requestedScope
        : 'tab'

      return runServerlessBrowserPrompt(prompt, scope)
    }
  )

  ipcMain.handle('google-search', async (_event, query: string) => {
    let browser: any = null

    try {
      const smartRoute = getSmartUrl(query)
      const finalUrl = smartRoute
        ? smartRoute.url
        : `https://www.google.com/search?q=${encodeURIComponent(query)}`

      shell.openExternal(finalUrl)

      if (smartRoute && smartRoute.skipScrape) {
        return `I've opened ${smartRoute.source} for you.`
      }

      browser = await puppeteer.launch({
        headless: true,
        args: ['--disable-dev-shm-usage']
      })

      const page = await browser.newPage()
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      const scrapeUrl = smartRoute
        ? finalUrl
        : `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web`

      await page.goto(scrapeUrl, { waitUntil: 'networkidle2', timeout: 15000 })

      const html = await page.content()
      const $ = load(html)
      let summary = ''

      if (smartRoute?.source === 'GitHub') {
        const name = $('.p-name').text().trim()
        const bio = $('.p-note').text().trim()
        summary = `GitHub Profile: ${name}\nBio: ${bio}`
      } else {
        const paragraphs = $('p')
          .map((_, el) => $(el).text().trim())
          .get()
          .filter((t) => t.length > 50)
          .slice(0, 3)

        summary = paragraphs.join('\n\n')

        if (!summary) {
          const snippets = $('.result__snippet')
            .map((_, el) => $(el).text().trim())
            .get()
            .slice(0, 3)
          summary = snippets.join('\n\n')
        }
      }

      await browser.close()

      if (!summary || summary.length < 20) {
        return "I've opened the website for you."
      }

      return `I've opened the link. Here is a quick summary:\n${summary.substring(0, 500)}...`
    } catch (error: any) {
      if (browser) await browser.close()
      return "I opened the browser, but couldn't read the content."
    }
  })
}
