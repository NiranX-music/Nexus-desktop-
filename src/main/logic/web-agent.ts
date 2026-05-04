import { IpcMain, shell } from 'electron'
import { keyboard, Key, mouse, Point, Button } from '@nut-tree-fork/nut-js'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { load } from 'cheerio'

puppeteer.use(StealthPlugin())
keyboard.config.autoDelayMs = 18

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

type BrowserAccessScope = 'tab' | 'tab-group' | 'browser'

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
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
