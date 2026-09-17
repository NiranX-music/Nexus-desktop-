import { IpcMain, app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import http from 'http'
import https from 'https'

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

class McpClient {
  private config: McpServerConfig
  private process: ChildProcess | null = null
  private stdoutBuffer = ''
  private requestId = 1
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void; timer: NodeJS.Timeout }>()
  public tools: McpToolDefinition[] = []
  public status: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected'
  public lastError?: string

  constructor(config: McpServerConfig) {
    this.config = config
  }

  async connect(): Promise<boolean> {
    if (!this.config.enabled) {
      this.status = 'disconnected'
      return false
    }

    if (this.config.transport === 'stdio') {
      return await this.connectStdio()
    } else {
      return await this.connectSse()
    }
  }

  private async connectStdio(): Promise<boolean> {
    if (!this.config.command) {
      this.status = 'error'
      this.lastError = 'Missing command for stdio transport.'
      return false
    }

    this.disconnect()
    this.status = 'connecting'
    this.lastError = undefined

    try {
      const isWin = process.platform === 'win32'
      this.process = spawn(this.config.command, this.config.args || [], {
        env: { ...process.env, ...(this.config.env || {}) },
        shell: isWin,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.process.stdout?.on('data', (chunk: Buffer) => {
        this.handleStdioData(chunk.toString('utf-8'))
      })

      this.process.stderr?.on('data', (chunk: Buffer) => {
        console.warn(`[MCP ${this.config.name} STDERR]:`, chunk.toString('utf-8'))
      })

      this.process.on('close', (code) => {
        this.status = 'disconnected'
        if (code !== 0 && code !== null) {
          this.status = 'error'
          this.lastError = `Process exited with code ${code}`
        }
      })

      this.process.on('error', (err) => {
        this.status = 'error'
        this.lastError = err.message
      })

      // Send initialize handshake
      const initResult = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'Nexus-Neural-OS', version: '2.1.1' }
      })

      if (initResult) {
        this.sendNotification('notifications/initialized', {})
        await this.refreshTools()
        this.status = 'connected'
        return true
      }
      return false
    } catch (err: any) {
      this.status = 'error'
      this.lastError = err?.message || String(err)
      return false
    }
  }

  private async connectSse(): Promise<boolean> {
    // Basic HTTP endpoint probe for SSE
    if (!this.config.url) {
      this.status = 'error'
      this.lastError = 'Missing URL for SSE transport.'
      return false
    }

    this.status = 'connecting'
    try {
      // Send initialize via HTTP POST
      const res = await this.postJson(this.config.url, {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'Nexus-Neural-OS', version: '2.1.1' }
        }
      })

      if (res && res.result) {
        this.status = 'connected'
        await this.refreshTools()
        return true
      } else {
        throw new Error(res?.error?.message || 'Invalid initialization response')
      }
    } catch (err: any) {
      this.status = 'error'
      this.lastError = err?.message || String(err)
      return false
    }
  }

  private handleStdioData(data: string) {
    this.stdoutBuffer += data
    const lines = this.stdoutBuffer.split(/\r?\n/)
    this.stdoutBuffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const msg = JSON.parse(trimmed)
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const req = this.pendingRequests.get(msg.id)!
          clearTimeout(req.timer)
          this.pendingRequests.delete(msg.id)

          if (msg.error) {
            req.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
          } else {
            req.resolve(msg.result)
          }
        }
      } catch {}
    }
  }

  async sendRequest(method: string, params: any = {}, timeoutMs = 15000): Promise<any> {
    if (this.config.transport === 'stdio') {
      if (!this.process || !this.process.stdin) {
        throw new Error(`MCP Server "${this.config.name}" process is not running.`)
      }

      const id = this.requestId++
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(id)
          reject(new Error(`MCP request "${method}" timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        this.pendingRequests.set(id, { resolve, reject, timer })
        this.process!.stdin!.write(payload)
      })
    } else {
      if (!this.config.url) throw new Error('Missing URL for SSE MCP server.')
      const id = this.requestId++
      const res = await this.postJson(this.config.url, { jsonrpc: '2.0', id, method, params })
      if (res.error) throw new Error(res.error.message || JSON.stringify(res.error))
      return res.result
    }
  }

  private sendNotification(method: string, params: any = {}) {
    if (this.config.transport === 'stdio' && this.process && this.process.stdin) {
      const payload = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'
      this.process.stdin.write(payload)
    }
  }

  private postJson(targetUrl: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body)
      const parsed = new URL(targetUrl)
      const isHttps = parsed.protocol === 'https:'
      const requestLib = isHttps ? https : http

      const req = requestLib.request(
        parsed,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          timeout: 15000
        },
        (res) => {
          let chunks = ''
          res.on('data', (c) => (chunks += c))
          res.on('end', () => {
            try {
              resolve(JSON.parse(chunks))
            } catch {
              reject(new Error(`Invalid JSON from ${targetUrl}: ${chunks.slice(0, 200)}`))
            }
          })
        }
      )

      req.on('error', reject)
      req.write(data)
      req.end()
    })
  }

  async refreshTools(): Promise<McpToolDefinition[]> {
    try {
      const result = await this.sendRequest('tools/list', {})
      const rawTools = result?.tools || []
      this.tools = rawTools.map((t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        serverId: this.config.id,
        serverName: this.config.name
      }))
      return this.tools
    } catch (err: any) {
      console.warn(`[MCP ${this.config.name}] Failed to list tools:`, err?.message)
      this.tools = []
      return []
    }
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    const res = await this.sendRequest('tools/call', {
      name,
      arguments: args
    })
    return res
  }

  disconnect() {
    for (const [id, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer)
      req.reject(new Error('Server disconnected'))
    }
    this.pendingRequests.clear()

    if (this.process) {
      try {
        this.process.kill()
      } catch {}
      this.process = null
    }
    this.status = 'disconnected'
  }
}

export class McpManager {
  private configFilePath: string
  private clients = new Map<string, McpClient>()

  constructor() {
    this.configFilePath = path.join(app.getPath('userData'), 'nexus_mcp_servers.json')
  }

  async loadConfigs(): Promise<McpServerConfig[]> {
    try {
      if (!fs.existsSync(this.configFilePath)) {
        // Create default empty or sample config
        const sample: McpServerConfig[] = [
          {
            id: 'sample-filesystem',
            name: 'Local Filesystem (Example)',
            transport: 'stdio',
            enabled: false,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', app.getPath('desktop')]
          }
        ]
        await fsPromises.writeFile(this.configFilePath, JSON.stringify(sample, null, 2), 'utf-8')
        return sample
      }
      const data = await fsPromises.readFile(this.configFilePath, 'utf-8')
      return JSON.parse(data) || []
    } catch {
      return []
    }
  }

  async saveConfigs(configs: McpServerConfig[]) {
    await fsPromises.writeFile(this.configFilePath, JSON.stringify(configs, null, 2), 'utf-8')
  }

  async init() {
    const configs = await this.loadConfigs()
    for (const conf of configs) {
      const client = new McpClient(conf)
      this.clients.set(conf.id, client)
      if (conf.enabled) {
        client.connect().catch((e) => console.warn(`[MCP] Autoconnect error for ${conf.name}:`, e))
      }
    }
  }

  async addOrUpdateServer(config: McpServerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const configs = await this.loadConfigs()
      const existingIdx = configs.findIndex((c) => c.id === config.id)

      if (this.clients.has(config.id)) {
        this.clients.get(config.id)!.disconnect()
      }

      if (existingIdx >= 0) {
        configs[existingIdx] = config
      } else {
        configs.push(config)
      }

      await this.saveConfigs(configs)

      const client = new McpClient(config)
      this.clients.set(config.id, client)

      if (config.enabled) {
        await client.connect()
      }

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  }

  async deleteServer(id: string): Promise<boolean> {
    try {
      const configs = await this.loadConfigs()
      const filtered = configs.filter((c) => c.id !== id)
      await this.saveConfigs(filtered)

      if (this.clients.has(id)) {
        this.clients.get(id)!.disconnect()
        this.clients.delete(id)
      }
      return true
    } catch {
      return false
    }
  }

  async listServers(): Promise<McpServerStatus[]> {
    const configs = await this.loadConfigs()
    return configs.map((c) => {
      const client = this.clients.get(c.id)
      return {
        id: c.id,
        name: c.name,
        transport: c.transport,
        enabled: c.enabled,
        status: client ? client.status : 'disconnected',
        toolCount: client ? client.tools.length : 0,
        error: client?.lastError
      }
    })
  }

  async getAllTools(): Promise<McpToolDefinition[]> {
    const allTools: McpToolDefinition[] = []
    for (const client of this.clients.values()) {
      if (client.status === 'connected') {
        allTools.push(...client.tools)
      }
    }
    return allTools
  }

  async callTool(toolName: string, args: any = {}): Promise<any> {
    for (const client of this.clients.values()) {
      if (client.status === 'connected') {
        const found = client.tools.find((t) => t.name === toolName)
        if (found) {
          return await client.callTool(toolName, args)
        }
      }
    }
    throw new Error(`Tool "${toolName}" not found in any connected MCP server.`)
  }

  destroy() {
    for (const client of this.clients.values()) {
      client.disconnect()
    }
    this.clients.clear()
  }
}

export const globalMcpManager = new McpManager()

export default function registerMcpHandlers(ipcMain: IpcMain) {
  globalMcpManager.init().catch(() => {})

  ipcMain.handle('mcp-list-servers', async () => {
    return await globalMcpManager.listServers()
  })

  ipcMain.handle('mcp-save-server', async (_event, config: McpServerConfig) => {
    return await globalMcpManager.addOrUpdateServer(config)
  })

  ipcMain.handle('mcp-delete-server', async (_event, id: string) => {
    return await globalMcpManager.deleteServer(id)
  })

  ipcMain.handle('mcp-get-all-tools', async () => {
    return await globalMcpManager.getAllTools()
  })

  ipcMain.handle('mcp-call-tool', async (_event, { toolName, args }) => {
    try {
      const result = await globalMcpManager.callTool(toolName, args)
      return { success: true, result }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })
}
