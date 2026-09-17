import { useEffect, useState } from 'react'
import {
  RiPlugLine,
  RiAddLine,
  RiDeleteBin6Line,
  RiRefreshLine,
  RiCheckLine,
  RiCloseLine,
  RiTerminalBoxLine,
  RiGlobalLine,
  RiToolsLine,
  RiArrowDownSLine,
  RiArrowRightSLine
} from 'react-icons/ri'
import {
  McpServerConfig,
  McpServerStatus,
  McpToolDefinition,
  listMcpServers,
  saveMcpServer,
  deleteMcpServer,
  getAllMcpTools
} from '../services/mcp-api'

const glassCard =
  'rounded-xl border border-white/10 bg-zinc-950/60 p-4 shadow-xl backdrop-blur-xl transition-all'

const PRESETS: Array<{ name: string; command: string; args: string[]; transport: 'stdio' | 'sse' }> = [
  {
    name: 'Filesystem Server',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:\\Users']
  },
  {
    name: 'Memory Graph Server',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory']
  },
  {
    name: 'GitHub Server',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github']
  },
  {
    name: 'Brave Search Server',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search']
  }
]

export default function McpSettingsTab() {
  const [servers, setServers] = useState<McpServerStatus[]>([])
  const [tools, setTools] = useState<McpToolDefinition[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Add form state
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<'stdio' | 'sse'>('stdio')
  const [command, setCommand] = useState('')
  const [argsStr, setArgsStr] = useState('')
  const [url, setUrl] = useState('')
  const [formError, setFormError] = useState('')

  const refresh = async () => {
    setIsLoading(true)
    try {
      const [srvList, toolList] = await Promise.all([listMcpServers(), getAllMcpTools()])
      setServers(srvList)
      setTools(toolList)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setName(preset.name)
    setTransport(preset.transport)
    setCommand(preset.command)
    setArgsStr(preset.args.join(' '))
    setUrl('')
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setFormError('Server name is required.')
      return
    }

    if (transport === 'stdio' && !command.trim()) {
      setFormError('Command is required for stdio transport.')
      return
    }

    if (transport === 'sse' && !url.trim()) {
      setFormError('URL is required for SSE transport.')
      return
    }

    setFormError('')
    const parsedArgs = argsStr
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    const newConfig: McpServerConfig = {
      id: `mcp-${Date.now()}`,
      name: name.trim(),
      transport,
      enabled: true,
      command: command.trim() || undefined,
      args: parsedArgs.length > 0 ? parsedArgs : undefined,
      url: url.trim() || undefined
    }

    const res = await saveMcpServer(newConfig)
    if (res.success) {
      setShowAddForm(false)
      setName('')
      setCommand('')
      setArgsStr('')
      setUrl('')
      await refresh()
    } else {
      setFormError(res.error || 'Failed to save server.')
    }
  }

  const handleToggleEnable = async (srv: McpServerStatus) => {
    const updated: McpServerConfig = {
      id: srv.id,
      name: srv.name,
      transport: srv.transport,
      enabled: !srv.enabled
    }
    await saveMcpServer(updated)
    await refresh()
  }

  const handleDelete = async (id: string) => {
    await deleteMcpServer(id)
    await refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <RiPlugLine className="text-emerald-400 text-xl" />
            <h3 className="text-sm font-semibold tracking-wider uppercase text-zinc-100 font-mono">
              Model Context Protocol (MCP) Ecosystem
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Connect Nexus to standard MCP servers to dynamically expose external tools, APIs, and databases.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-zinc-300 hover:text-white hover:border-emerald-500/50 transition-all"
          >
            <RiRefreshLine className={isLoading ? 'animate-spin' : ''} />
            SYNC
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-xs font-mono text-emerald-300 hover:bg-emerald-500/30 transition-all"
          >
            <RiAddLine />
            ADD SERVER
          </button>
        </div>
      </div>

      {/* Add Server Drawer */}
      {showAddForm && (
        <div className="rounded-xl border border-emerald-500/30 bg-black/80 p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              Register New MCP Server
            </span>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-zinc-400 hover:text-zinc-200 text-sm"
            >
              <RiCloseLine />
            </button>
          </div>

          {/* Preset Buttons */}
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 block mb-2">
              Fast Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1 rounded bg-zinc-900 border border-white/10 text-[11px] font-mono text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-all"
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase font-mono tracking-wider text-zinc-400 block mb-1">
                Server Label
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. GitHub Agent"
                className="w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-400/50 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase font-mono tracking-wider text-zinc-400 block mb-1">
                Transport Type
              </label>
              <select
                value={transport}
                onChange={(e) => setTransport(e.target.value as 'stdio' | 'sse')}
                className="w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-400/50 font-mono"
              >
                <option value="stdio">stdio (Local Command / Process)</option>
                <option value="sse">SSE (HTTP / Remote Endpoint)</option>
              </select>
            </div>
          </div>

          {transport === 'stdio' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] uppercase font-mono tracking-wider text-zinc-400 block mb-1">
                  Executable Command
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx, python, uvx..."
                  className="w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-400/50 font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase font-mono tracking-wider text-zinc-400 block mb-1">
                  Arguments (Space-separated)
                </label>
                <input
                  type="text"
                  value={argsStr}
                  onChange={(e) => setArgsStr(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-filesystem C:\..."
                  className="w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-400/50 font-mono"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] uppercase font-mono tracking-wider text-zinc-400 block mb-1">
                SSE Endpoint URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:8000/sse"
                className="w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-400/50 font-mono"
              />
            </div>
          )}

          {formError && <p className="text-xs text-red-400 font-mono">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black font-semibold text-xs font-mono hover:bg-emerald-400 transition-all"
            >
              SAVE & CONNECT
            </button>
          </div>
        </div>
      )}

      {/* Server List */}
      <div className="space-y-3">
        {servers.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-xl">
            <RiPlugLine className="text-3xl text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-400 font-mono">No MCP servers registered yet.</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Click &quot;ADD SERVER&quot; or choose a preset above to equip Nexus with external capabilities.
            </p>
          </div>
        ) : (
          servers.map((srv) => {
            const isExpanded = expandedServerId === srv.id
            const serverTools = tools.filter((t) => t.serverId === srv.id)

            return (
              <div key={srv.id} className={glassCard}>
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => setExpandedServerId(isExpanded ? null : srv.id)}
                  >
                    <button className="text-zinc-400 hover:text-white">
                      {isExpanded ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
                    </button>

                    <div className="flex items-center gap-2">
                      {srv.transport === 'stdio' ? (
                        <RiTerminalBoxLine className="text-zinc-400 text-sm" />
                      ) : (
                        <RiGlobalLine className="text-zinc-400 text-sm" />
                      )}
                      <span className="text-xs font-mono font-medium text-zinc-200">{srv.name}</span>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                        srv.status === 'connected'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : srv.status === 'connecting'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          srv.status === 'connected'
                            ? 'bg-emerald-400 animate-pulse'
                            : srv.status === 'connecting'
                              ? 'bg-amber-400 animate-ping'
                              : 'bg-red-400'
                        }`}
                      />
                      {srv.status}
                    </span>

                    <span className="text-[10px] font-mono text-zinc-500">
                      {srv.toolCount} tool{srv.toolCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleEnable(srv)}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all ${
                        srv.enabled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                      }`}
                    >
                      {srv.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleDelete(srv.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete Server"
                    >
                      <RiDeleteBin6Line className="text-xs" />
                    </button>
                  </div>
                </div>

                {srv.error && (
                  <p className="mt-2 text-[11px] font-mono text-red-400 bg-red-950/20 p-2 rounded border border-red-900/30">
                    {srv.error}
                  </p>
                )}

                {/* Expanded Tools Preview */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <div className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      <RiToolsLine className="text-emerald-400" />
                      <span>Exposed Tools ({serverTools.length}):</span>
                    </div>

                    {serverTools.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 font-mono italic">
                        No tools exposed or server not yet connected.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {serverTools.map((t) => (
                          <div
                            key={t.name}
                            className="bg-black/50 p-2 rounded border border-white/5 space-y-0.5"
                          >
                            <span className="text-[11px] font-mono font-semibold text-emerald-300 block">
                              {t.name}
                            </span>
                            <p className="text-[10px] text-zinc-400 line-clamp-2">
                              {t.description || 'No description provided.'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
