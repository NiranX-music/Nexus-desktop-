import { useMemo, useState } from 'react'
import { RiArrowRightUpLine, RiChatSmile3Line, RiGlobalLine, RiLayoutGridLine, RiSettings4Line, RiShieldFlashLine } from 'react-icons/ri'
import TitleBar from '@renderer/components/Titlebar'
import type { TrialRuntimeProps, TrialTabKey } from './types'
import TrialDashboard from './TrialDashboard'
import TrialAiChat from './TrialAiChat'
import TrialBrowser from './TrialBrowser'
import TrialSettings from './TrialSettings'

const tabs: Array<{
  id: TrialTabKey
  label: string
  detail: string
  icon: React.ReactNode
}> = [
  { id: 'overview', label: 'Overview', detail: 'Core command surface', icon: <RiLayoutGridLine /> },
  { id: 'chat', label: 'AI Chat', detail: 'Hosted NVIDIA trial chat', icon: <RiChatSmile3Line /> },
  { id: 'browser', label: 'Browser', detail: 'Voice and text control', icon: <RiGlobalLine /> },
  { id: 'settings', label: 'Settings', detail: 'Local storage and updates', icon: <RiSettings4Line /> }
]

const stateLabel = (props: TrialRuntimeProps) => {
  if (props.assistantVisualState === 'speaking') return 'Speaking'
  if (props.assistantVisualState === 'running') return 'Running'
  if (props.isSystemStarting) return 'Booting'
  return 'Standby'
}

export default function TrialShell(props: TrialRuntimeProps) {
  const [activeTab, setActiveTab] = useState<TrialTabKey>('overview')
  const activeTabMeta = useMemo(() => tabs.find((tab) => tab.id === activeTab) || tabs[0], [activeTab])

  return (
    <div className="flex h-screen flex-col bg-[#020507] text-zinc-100">
      <TitleBar />

      <div className="flex-1 overflow-hidden p-4 lg:p-5">
        <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-4">
          <header className="rounded-[28px] border border-emerald-400/16 bg-[linear-gradient(135deg,rgba(9,15,15,0.96),rgba(4,8,9,0.92))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.3)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                    <RiShieldFlashLine size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300">
                      Nexus AI Trial
                    </p>
                    <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.08em] text-white">
                      Lightweight desktop edition
                    </h1>
                  </div>
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">
                  This trial build is now a separate app surface with its own files, its own layout,
                  and its own lighter feature set. No cloud auth, no clutter, just the core Nexus loop.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[29rem]">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                    Runtime
                  </p>
                  <div className="mt-3 text-xl font-black uppercase tracking-[0.05em] text-white">
                    {stateLabel(props)}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    {props.isSystemActive
                      ? 'Core voice system is online for text, speech, and browser tasks.'
                      : 'Start the assistant when you want to test live flows.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={props.onUpgrade}
                  className="rounded-2xl border border-amber-300/18 bg-amber-300/10 px-4 py-4 text-left text-amber-50 transition hover:bg-amber-300/16"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                      Unlock full Nexus
                    </span>
                    <RiArrowRightUpLine />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-amber-100/75">
                    Download the full authenticated build with macros, apps, notes vault, gallery, and phone control.
                  </p>
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                    activeTab === tab.id
                      ? 'border-emerald-300/25 bg-emerald-400/12 text-emerald-50'
                      : 'border-white/10 bg-black/28 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span className="text-left">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em]">
                      {tab.label}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">{tab.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </header>

          <section className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-emerald-400/16 bg-[linear-gradient(180deg,rgba(6,10,11,0.97),rgba(3,5,7,0.94))] shadow-[0_30px_90px_rgba(0,0,0,0.25)]">
            <div className="h-full overflow-y-auto p-4 lg:p-5">
              {activeTab === 'overview' && <TrialDashboard {...props} />}
              {activeTab === 'chat' && <TrialAiChat />}
              {activeTab === 'browser' && (
                <TrialBrowser
                  isSystemActive={props.isSystemActive}
                  isMicMuted={props.isMicMuted}
                  toggleMic={props.toggleMic}
                  sendTextCommand={props.sendTextCommand}
                />
              )}
              {activeTab === 'settings' && <TrialSettings isSystemActive={props.isSystemActive} />}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
