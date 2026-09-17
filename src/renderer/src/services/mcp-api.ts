export interface McpServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  enabled: boolean
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}

export interface McpToolDefinition {
  name: string
  description?: string
  inputSchema?: any
  serverId: string
  serverName: string
}

export interface McpServerStatus {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  enabled: boolean
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  toolCount: number
  error?: string
}

export const listMcpServers = async (): Promise<McpServerStatus[]> => {
  try {
    return (await window.electron.ipcRenderer.invoke('mcp-list-servers')) || []
  } catch {
    return []
  }
}

export const saveMcpServer = async (
  config: McpServerConfig
): Promise<{ success: boolean; error?: string }> => {
  try {
    return await window.electron.ipcRenderer.invoke('mcp-save-server', config)
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}

export const deleteMcpServer = async (id: string): Promise<boolean> => {
  try {
    return await window.electron.ipcRenderer.invoke('mcp-delete-server', id)
  } catch {
    return false
  }
}

export const getAllMcpTools = async (): Promise<McpToolDefinition[]> => {
  try {
    return (await window.electron.ipcRenderer.invoke('mcp-get-all-tools')) || []
  } catch {
    return []
  }
}

export const callMcpTool = async (
  toolName: string,
  args: any = {}
): Promise<{ success: boolean; result?: any; error?: string }> => {
  try {
    return await window.electron.ipcRenderer.invoke('mcp-call-tool', { toolName, args })
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}
