import { FormEvent, useMemo, useState } from 'react'
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiRefreshLine,
  RiSearchLine,
  RiPlayFill,
  RiPauseFill,
  RiUserAddLine,
  RiKey2Line,
  RiBookmarkLine,
  RiHome4Line,
  RiStopFill,
  RiExternalLinkLine
} from 'react-icons/ri'

const glassPanel = 'bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl'

const normalizeUrl = (value: string) => {
  const input = value.trim()
  if (!input) return 'https://www.google.com/search?q=Nexus%20AI'
  if (/^https?:\/\//i.test(input)) return input
  if (input.includes('.') && !input.includes(' ')) return `https://${input}`
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`
}

export default function ServerlessBrowserView() {
  const [address, setAddress] = useState('https://www.google.com/search?q=Nexus%20AI')
  const [currentUrl, setCurrentUrl] = useState(address)
  const [history, setHistory] = useState<string[]>([address])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [browserKey, setBrowserKey] = useState(0)
  const [accountNote, setAccountNote] = useState(
    localStorage.getItem('nexus_browser_account_note') || ''
  )

  const displayUrl = useMemo(() => currentUrl.replace(/^https?:\/\//, ''), [currentUrl])

  const navigateTo = (target: string) => {
    const nextUrl = normalizeUrl(target)
    setCurrentUrl(nextUrl)
    setAddress(nextUrl)
    const nextHistory = [...history.slice(0, index + 1), nextUrl]
    setHistory(nextHistory)
    setIndex(nextHistory.length - 1)
    setPaused(false)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigateTo(address)
  }

  const goBack = () => {
    if (index <= 0) return
    const nextIndex = index - 1
    setIndex(nextIndex)
    setCurrentUrl(history[nextIndex])
    setAddress(history[nextIndex])
  }

  const goForward = () => {
    if (index >= history.length - 1) return
    const nextIndex = index + 1
    setIndex(nextIndex)
    setCurrentUrl(history[nextIndex])
    setAddress(history[nextIndex])
  }

  const saveAccountNote = (value: string) => {
    setAccountNote(value)
    localStorage.setItem('nexus_browser_account_note', value)
  }

  return (
    <div className="h-full w-full overflow-hidden p-4 grid grid-cols-12 gap-4 bg-white/2 animate-in fade-in duration-300">
      <div className="col-span-12 xl:col-span-9 flex flex-col gap-4 min-h-0">
        <div className={`${glassPanel} p-3 border-emerald-500/10`}>
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              className="h-10 w-10 rounded-lg border border-white/10 bg-black/40 text-zinc-400 hover:text-emerald-300"
              title="Back"
            >
              <RiArrowLeftLine className="mx-auto" />
            </button>
            <button
              type="button"
              onClick={goForward}
              className="h-10 w-10 rounded-lg border border-white/10 bg-black/40 text-zinc-400 hover:text-emerald-300"
              title="Forward"
            >
              <RiArrowRightLine className="mx-auto" />
            </button>
            <button
              type="button"
              onClick={() => setBrowserKey((key) => key + 1)}
              className="h-10 w-10 rounded-lg border border-white/10 bg-black/40 text-zinc-400 hover:text-emerald-300"
              title="Reload"
            >
              <RiRefreshLine className="mx-auto" />
            </button>
            <div className="min-w-0 flex-1 h-10 rounded-lg border border-emerald-500/20 bg-black/60 flex items-center gap-2 px-3">
              <RiSearchLine className="shrink-0 text-emerald-400" />
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs font-mono text-zinc-100 outline-none placeholder:text-zinc-600"
                placeholder="Search or enter URL"
              />
            </div>
            <button
              type="submit"
              className="h-10 px-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-black tracking-widest text-emerald-300 hover:bg-emerald-400 hover:text-black"
            >
              GO
            </button>
          </form>
        </div>

        <div className={`${glassPanel} flex-1 min-h-0 overflow-hidden border-emerald-500/10`}>
          <div className="h-9 border-b border-white/5 px-4 flex items-center justify-between text-[9px] font-mono tracking-widest uppercase text-zinc-500">
            <span className="truncate">{displayUrl}</span>
            <span className={paused ? 'text-yellow-400' : 'text-emerald-400'}>{paused ? 'Paused' : 'Live'}</span>
          </div>
          <div className="relative h-[calc(100%-2.25rem)] bg-black">
            {!paused ? (
              <iframe
                key={`${currentUrl}-${browserKey}`}
                src={currentUrl}
                title="Nexus serverless browser"
                className="h-full w-full border-0 bg-white"
                sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs tracking-widest uppercase">
                Browser paused
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-12 xl:col-span-3 flex flex-col gap-4 min-h-0">
        <div className={`${glassPanel} p-4 border-cyan-500/10`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <span className="text-[10px] font-black tracking-widest text-zinc-400">
              CONTROL BUS
            </span>
            <span className="text-[8px] text-cyan-400 font-mono">SERVERLESS</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaused((value) => !value)}
              className="h-16 rounded-xl border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-1 text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-300"
            >
              {paused ? <RiPlayFill size={20} /> : <RiPauseFill size={20} />}
              <span className="text-[9px] font-black tracking-widest">{paused ? 'PLAY' : 'PAUSE'}</span>
            </button>
            <button
              onClick={() => navigateTo('https://www.google.com')}
              className="h-16 rounded-xl border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-1 text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-300"
            >
              <RiHome4Line size={20} />
              <span className="text-[9px] font-black tracking-widest">HOME</span>
            </button>
            <button
              onClick={() => setPaused(true)}
              className="h-16 rounded-xl border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-1 text-zinc-300 hover:border-red-400/40 hover:text-red-300"
            >
              <RiStopFill size={20} />
              <span className="text-[9px] font-black tracking-widest">STOP</span>
            </button>
            <button
              onClick={() => navigateTo('https://accounts.google.com')}
              className="h-16 rounded-xl border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-1 text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-300"
            >
              <RiUserAddLine size={20} />
              <span className="text-[9px] font-black tracking-widest">ACCOUNT</span>
            </button>
            <button
              onClick={() => navigateTo('https://passwords.google.com')}
              className="h-16 rounded-xl border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-1 text-zinc-300 hover:border-yellow-400/40 hover:text-yellow-300"
            >
              <RiKey2Line size={20} />
              <span className="text-[9px] font-black tracking-widest">KEYS</span>
            </button>
            <button
              onClick={() => localStorage.setItem('nexus_browser_bookmark', currentUrl)}
              className="h-16 rounded-xl border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-1 text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-300"
            >
              <RiBookmarkLine size={20} />
              <span className="text-[9px] font-black tracking-widest">SAVE</span>
            </button>
            <button
              onClick={() => window.open(currentUrl, '_blank')}
              className="h-16 rounded-xl border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-1 text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-300"
            >
              <RiExternalLinkLine size={20} />
              <span className="text-[9px] font-black tracking-widest">OPEN</span>
            </button>
          </div>
        </div>

        <div className={`${glassPanel} p-4 flex-1 min-h-0 border-emerald-500/10`}>
          <div className="text-[10px] font-black tracking-widest text-zinc-400 mb-3">
            ACCOUNT REQUESTS
          </div>
          <textarea
            value={accountNote}
            onChange={(event) => saveAccountNote(event.target.value)}
            className="h-full w-full resize-none rounded-xl border border-white/10 bg-black/60 p-3 text-xs leading-relaxed text-zinc-200 outline-none focus:border-emerald-400/50"
            placeholder="Ask Nexus to add accounts, sign in, search, play, pause, or control this browser..."
          />
        </div>
      </div>
    </div>
  )
}
