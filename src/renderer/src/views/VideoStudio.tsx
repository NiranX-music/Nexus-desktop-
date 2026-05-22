import { FormEvent, useEffect, useState } from 'react'
import {
  RiDownloadCloud2Line,
  RiExternalLinkLine,
  RiFilmLine,
  RiFolderOpenLine,
  RiPlayLine,
  RiRefreshLine
} from 'react-icons/ri'
import {
  DEFAULT_LANCE_MODEL_PATH,
  DEFAULT_LANCE_REPO_PATH,
  VIDEO_GENERATION_MODELS
} from '@renderer/config/video-models'

type LanceStatus = {
  repoPath: string
  modelPath: string
  resolvedModelPath: string
  repoReady: boolean
  weightsReady: boolean
  gitAvailable: boolean
  bashAvailable: boolean
  pythonAvailable: boolean
  requirements: string
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-400/50'

export default function VideoStudio() {
  const [repoPath, setRepoPath] = useState(
    localStorage.getItem('nexus_lance_repo_path') || DEFAULT_LANCE_REPO_PATH
  )
  const [modelPath, setModelPath] = useState(
    localStorage.getItem('nexus_lance_model_path') || DEFAULT_LANCE_MODEL_PATH
  )
  const [prompt, setPrompt] = useState('')
  const [height, setHeight] = useState(480)
  const [width, setWidth] = useState(848)
  const [frames, setFrames] = useState(50)
  const [seed, setSeed] = useState(42)
  const [status, setStatus] = useState<LanceStatus | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [videoPath, setVideoPath] = useState('')

  const model = VIDEO_GENERATION_MODELS[0]

  const refreshStatus = async () => {
    const result = await window.electron.ipcRenderer.invoke('lance:status', { repoPath, modelPath })
    if (result?.success) setStatus(result)
  }

  useEffect(() => {
    localStorage.setItem('nexus_lance_repo_path', repoPath)
    localStorage.setItem('nexus_lance_model_path', modelPath)
  }, [repoPath, modelPath])

  useEffect(() => {
    refreshStatus().catch(() => {})
  }, [])

  const cloneRepo = async () => {
    setIsBusy(true)
    setMessage('Cloning Lance repo...')
    try {
      const result = await window.electron.ipcRenderer.invoke('lance:clone', { repoPath })
      setMessage(result?.success ? result.message : result?.error || 'Clone failed.')
      await refreshStatus()
    } finally {
      setIsBusy(false)
    }
  }

  const generate = async (event: FormEvent) => {
    event.preventDefault()
    setIsBusy(true)
    setMessage('Starting Lance video generation...')
    setVideoPath('')
    try {
      const result = await window.electron.ipcRenderer.invoke('lance:generate-video', {
        repoPath,
        modelPath,
        prompt,
        height,
        width,
        frames,
        seed,
        steps: 30,
        cfgScale: 4
      })
      if (!result?.success) throw new Error(result?.error || 'Lance generation failed.')
      setVideoPath(result.videoPath || '')
      setMessage(result.videoPath ? `Generated: ${result.videoPath}` : `Finished: ${result.saveDir}`)
    } catch (error: any) {
      setMessage(error?.message || 'Lance generation failed.')
    } finally {
      setIsBusy(false)
      await refreshStatus().catch(() => {})
    }
  }

  return (
    <div className="h-full w-full overflow-hidden p-4 text-zinc-100">
      <div className="grid h-full min-h-0 grid-cols-12 gap-3">
        <aside className="col-span-12 flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-emerald-500/15 bg-black/55 p-4 lg:col-span-4">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
              <RiFilmLine size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-[0.16em]">Video Model</h2>
              <p className="text-[10px] font-mono tracking-widest text-emerald-400/70">
                {model.label}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-6 text-zinc-300">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Runtime
            </div>
            <p>{model.requirements}</p>
          </div>

          <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
            Lance repo path
          </label>
          <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} className={inputClass} />

          <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
            Lance weights path
          </label>
          <input value={modelPath} onChange={(event) => setModelPath(event.target.value)} className={inputClass} />

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={refreshStatus}
              disabled={isBusy}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-200 disabled:opacity-40"
            >
              <RiRefreshLine /> Check
            </button>
            <button
              onClick={cloneRepo}
              disabled={isBusy}
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-emerald-200 disabled:opacity-40"
            >
              <RiDownloadCloud2Line /> Clone
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/50 p-3 text-[11px] font-mono text-zinc-400">
            <div>Repo: {status?.repoReady ? 'ready' : 'missing'}</div>
            <div>Weights: {status?.weightsReady ? 'ready' : 'missing'}</div>
            <div>Bash: {status?.bashAvailable ? 'ready' : 'missing'}</div>
            <div>Python: {status?.pythonAvailable ? 'ready' : 'missing'}</div>
          </div>
        </aside>

        <main className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/45 lg:col-span-8">
          <form onSubmit={generate} className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            <div>
              <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
                Text-to-video prompt
              </label>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the video Lance should generate..."
                className="h-40 w-full resize-none rounded-2xl border border-white/10 bg-black/70 p-4 text-sm leading-6 text-zinc-100 outline-none focus:border-emerald-400/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Height', height, setHeight],
                ['Width', width, setWidth],
                ['Frames', frames, setFrames],
                ['Seed', seed, setSeed]
              ].map(([label, value, setter]) => (
                <label key={label as string} className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    {label as string}
                  </span>
                  <input
                    type="number"
                    value={value as number}
                    onChange={(event) => (setter as (next: number) => void)(Number(event.target.value))}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>

            {message ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">
                {message}
              </div>
            ) : null}

            {videoPath ? (
              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-emerald-400/20 bg-black">
                <video src={`file:///${videoPath.replaceAll('\\', '/')}`} controls className="h-full w-full" />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-xs font-mono uppercase tracking-widest text-zinc-600">
                Lance output appears here
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                disabled={isBusy || !prompt.trim()}
                className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-xs font-black uppercase tracking-widest text-black disabled:opacity-40"
              >
                {isBusy ? <RiRefreshLine className="animate-spin" /> : <RiPlayLine />} Generate
              </button>
              <button
                type="button"
                disabled={!status?.repoPath}
                onClick={() => window.electron.ipcRenderer.invoke('lance:open-path', status?.repoPath)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-zinc-300 disabled:opacity-40"
              >
                <RiFolderOpenLine /> Repo
              </button>
              <button
                type="button"
                onClick={() => window.electron.ipcRenderer.invoke('lance:open-path', model.repoUrl)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-zinc-300"
              >
                <RiExternalLinkLine /> GitHub
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}

