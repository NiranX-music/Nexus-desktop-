import { useState, useEffect, useRef, useCallback } from 'react'
import {
  RiAppsLine,
  RiTerminalBoxLine,
  RiChromeLine,
  RiCodeLine,
  RiSpotifyLine,
  RiDiscordLine,
  RiGamepadLine,
  RiSearchLine,
  RiArrowRightUpLine
} from 'react-icons/ri'
import { getAllApps, AppItem } from '@renderer/services/system-info'

const SmartIcon = ({ name }: { name: string }) => {
  if (!name) return <div className="h-10 w-10 rounded-lg border border-white/5 bg-zinc-800" />

  const lower = name.toLowerCase()
  let icon = <RiTerminalBoxLine size={20} />
  let color = 'text-zinc-400'
  let bg = 'bg-zinc-800'

  if (lower.includes('chrome') || lower.includes('edge')) {
    icon = <RiChromeLine size={20} />
    color = 'text-blue-400'
    bg = 'bg-blue-500/10'
  } else if (lower.includes('code') || lower.includes('dev')) {
    icon = <RiCodeLine size={20} />
    color = 'text-cyan-400'
    bg = 'bg-cyan-500/10'
  } else if (lower.includes('spotify') || lower.includes('music')) {
    icon = <RiSpotifyLine size={20} />
    color = 'text-green-400'
    bg = 'bg-green-500/10'
  } else if (lower.includes('discord') || lower.includes('telegram')) {
    icon = <RiDiscordLine size={20} />
    color = 'text-indigo-400'
    bg = 'bg-indigo-500/10'
  } else if (lower.includes('game') || lower.includes('launcher')) {
    icon = <RiGamepadLine size={20} />
    color = 'text-purple-400'
    bg = 'bg-purple-500/10'
  }

  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 ${bg} ${color} shadow-sm transition-transform group-hover:scale-110`}
    >
      {icon}
    </div>
  )
}

const AppCard = ({ app }: { app: AppItem }) => (
  <button
    type="button"
    onClick={() => window.electron.ipcRenderer.invoke('open-app', app.name)}
    className="group flex w-full items-center gap-4 rounded-xl border border-white/5 bg-zinc-950/40 p-4 text-left backdrop-blur-xl transition-all hover:border-emerald-500/30 hover:bg-white/10 active:scale-[0.99]"
  >
    <SmartIcon name={app.name} />
    <div className="min-w-0 flex-1 overflow-hidden">
      <div className="truncate text-sm font-bold text-zinc-200 transition-colors group-hover:text-emerald-400">
        {app.name}
      </div>
      <div className="mt-1 truncate font-mono text-[9px] text-zinc-600 opacity-70 transition-opacity group-hover:opacity-100">
        READY TO LAUNCH
      </div>
    </div>
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/8 bg-black/30 text-zinc-600 transition-all group-hover:border-emerald-500/25 group-hover:text-emerald-300">
      <RiArrowRightUpLine size={16} />
    </div>
  </button>
)

const AppsView = () => {
  const [allApps, setAllApps] = useState<AppItem[]>([])
  const [visibleApps, setVisibleApps] = useState<AppItem[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const observer = useRef<IntersectionObserver | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredApps = allApps.filter((app) => app.name.toLowerCase().includes(normalizedQuery))

  const lastAppElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return
      if (observer.current) observer.current.disconnect()

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && visibleApps.length < filteredApps.length) {
          setPage((prev) => prev + 1)
        }
      })

      if (node) observer.current.observe(node)
    },
    [loading, visibleApps.length, filteredApps.length]
  )

  useEffect(() => {
    getAllApps().then((raw) => {
      const cleanData = (Array.isArray(raw) ? raw : []).filter(
        (item) => item && typeof item === 'object' && item.name && item.id
      )

      setAllApps(cleanData)
      setVisibleApps(cleanData.slice(0, 18))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [normalizedQuery])

  useEffect(() => {
    setVisibleApps(filteredApps.slice(0, page * 12 + 6))
  }, [page, filteredApps])

  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4 animate-in fade-in zoom-in duration-300">
      <div className="shrink-0 rounded-2xl border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(10,18,16,0.92),rgba(3,8,7,0.78))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              <RiAppsLine className="text-emerald-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-[0.14em] text-zinc-100">
                System Applications
              </h2>
              <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
                Indexed software library with direct launch
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:min-w-[28rem]">
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-4 py-3 focus-within:border-emerald-500/35">
              <RiSearchLine className="shrink-0 text-zinc-500" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search installed apps..."
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </label>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/70">
                  Visible
                </p>
                <p className="mt-1 text-sm font-black text-emerald-200">
                  {loading ? 'Indexing...' : `${visibleApps.length} / ${filteredApps.length}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  Total
                </p>
                <p className="mt-1 text-sm font-black text-zinc-100">{allApps.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-zinc-500">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Browsers</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Developer tools
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Media</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Launchers
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-small">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleApps.map((app, index) => {
            const safeKey = `${app.id}-${index}`

            if (visibleApps.length === index + 1) {
              return (
                <div ref={lastAppElementRef} key={safeKey}>
                  <AppCard app={app} />
                </div>
              )
            }

            return <AppCard key={safeKey} app={app} />
          })}

          {loading && (
            <div className="col-span-full rounded-xl border border-white/10 bg-black/25 p-8 text-center text-xs text-zinc-500">
              Scanning system library...
            </div>
          )}

          {!loading && visibleApps.length === 0 && (
            <div className="col-span-full rounded-xl border border-white/10 bg-black/25 p-10 text-center">
              <div className="space-y-2 text-zinc-500">
                <RiAppsLine className="mx-auto text-2xl" />
                <p className="text-xs font-bold uppercase tracking-[0.18em]">No apps found</p>
                <p className="text-[11px]">Try a different search term.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AppsView
