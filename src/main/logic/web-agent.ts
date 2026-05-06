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
  kind: 'search' | 'read'
  value: string
}

let serverlessBrowser: any = null
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
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--no-first-run'
    ]
  })

  scheduleServerlessBrowserClose()
  return serverlessBrowser
}

const prepareServerlessPage = async (page: any) => {
  page.setDefaultTimeout(18_000)
  page.setDefaultNavigationTimeout(18_000)
  await page.setUserAgent(SERVERLESS_USER_AGENT)
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 })
  await page.setCacheEnabled(false)
  await page.setRequestInterception(true)

  page.on('request', (request: any) => {
    const resourceType = request.resourceType()
    if (['font', 'image', 'media', 'stylesheet'].includes(resourceType)) {
      request.abort()
      return
    }

    request.continue()
  })
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

const runServerlessBrowserPrompt = async (prompt: string, scope: BrowserAccessScope) => {
  const actions: BrowserControlAction[] = []
  let page: any = null

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
    const browser = await getServerlessBrowser()
    page = await browser.newPage()
    await prepareServerlessPage(page)

    actions.push({
      action: `serverless_${plan.kind}`,
      detail: plan.value,
      ok: true
    })

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
    if (page) await page.close().catch(() => undefined)
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
