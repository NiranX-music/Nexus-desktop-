import React, { useState, useCallback } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow'
import { Tooltip } from 'react-tooltip'
import 'reactflow/dist/style.css'
import 'react-tooltip/dist/react-tooltip.css'
import ToolNode, { getIcon } from '../components/ToolNode'
import ParameterEditorDrawer from '../components/ParameterEditorDrawer'
import MacroManagementMenu from '../components/MacroManagementMenu'
import {
  RiSave3Line,
  RiLayoutColumnLine,
  RiLayoutColumnFill,
  RiAddLine,
  RiPlayFill
} from 'react-icons/ri'

import { getMacroSequence } from '@renderer/code/macro-executor'
import {
  clickOnCoordinate,
  scrollScreen,
  setVolume,
  takeScreenshot
} from '@renderer/functions/keybaord-manager'
import { closeApp, openApp, performWebSearch } from '@renderer/functions/apps-manager-api'
import {
  scheduleWhatsAppMessage,
  sendWhatsAppMessage
} from '@renderer/functions/whatsapp-manager-api'
import { runTerminal } from '@renderer/functions/coding-manager-api'
import { draftEmail, readEmails, sendEmail } from '@renderer/functions/gmail-manager-api'

const CATEGORIZED_TOOLS = {
  TRIGGERS: [
    { name: 'TRIGGER', description: 'Starts the workflow.', parameters: {} },
    {
      name: 'WAIT',
      description: 'Pauses execution.',
      parameters: {
        properties: { milliseconds: { type: 'NUMBER', description: 'Delay in ms (e.g. 2000)' } }
      }
    }
  ],
  SYSTEM: [
    {
      name: 'open_app',
      description: 'Launch desktop app.',
      parameters: { properties: { app_name: { type: 'STRING' } } }
    },
    {
      name: 'close_app',
      description: 'Force close an app.',
      parameters: { properties: { app_name: { type: 'STRING' } } }
    },
    {
      name: 'set_volume',
      description: 'Change system volume (0-100).',
      parameters: { properties: { level: { type: 'NUMBER' } } }
    }
  ],
  AUTOMATION: [
    {
      name: 'ghost_type',
      description: 'Type text via keyboard.',
      parameters: { properties: { text: { type: 'STRING' } } }
    },
    {
      name: 'press_shortcut',
      description: 'e.g. key: "c", modifiers: ["control"].',
      parameters: {
        properties: {
          key: { type: 'STRING' },
          modifiers: { type: 'ARRAY', items: { type: 'STRING' } }
        }
      }
    },
    {
      name: 'click_on_screen',
      description: 'Click on specific X, Y coordinates.',
      parameters: {
        properties: {
          x: { type: 'NUMBER', description: 'X Coordinate (e.g. 960)' },
          y: { type: 'NUMBER', description: 'Y Coordinate (e.g. 540)' }
        }
      }
    },
    {
      name: 'run_terminal',
      description: 'Execute CLI command.',
      parameters: { properties: { command: { type: 'STRING' }, path: { type: 'STRING' } } }
    }
  ],
  WEB_INTELLIGENCE: [
    {
      name: 'google_search',
      description: 'Open a URL or search.',
      parameters: { properties: { query: { type: 'STRING' } } }
    },
    {
      name: 'deep_research',
      description: 'AI Web scrape & Notion report.',
      parameters: { properties: { query: { type: 'STRING' } } }
    },
    {
      name: 'deploy_wormhole',
      description: 'Exposes local server port to the internet.',
      parameters: { properties: { port: { type: 'NUMBER', description: 'e.g. 3000' } } }
    },
    {
      name: 'close_wormhole',
      description: 'Closes the public wormhole.',
      parameters: {}
    }
  ],
  COMMUNICATION: [
    {
      name: 'send_email',
      description: 'Send an email instantly.',
      parameters: {
        properties: {
          to: { type: 'STRING' },
          subject: { type: 'STRING' },
          body: { type: 'STRING' }
        }
      }
    },
    {
      name: 'read_emails',
      description: 'Read latest unread emails.',
      parameters: { properties: { max_results: { type: 'NUMBER', description: 'Default is 5' } } }
    },
    {
      name: 'draft_email',
      description: 'Create an email draft.',
      parameters: {
        properties: {
          to: { type: 'STRING' },
          subject: { type: 'STRING' },
          body: { type: 'STRING' }
        }
      }
    }
  ],
  MOBILE_LINK: [
    {
      name: 'open_mobile_app',
      description: 'Requires Android package name.',
      parameters: { properties: { package_name: { type: 'STRING' } } }
    },
    {
      name: 'toggle_mobile_hardware',
      description: 'Toggle Wifi/Bluetooth.',
      parameters: { properties: { setting: { type: 'STRING' }, state: { type: 'BOOLEAN' } } }
    },
    {
      name: 'send_whatsapp',
      description: 'Send instant message.',
      parameters: {
        properties: {
          name: { type: 'STRING' },
          message: { type: 'STRING' },
          file_path: { type: 'STRING', description: 'Optional' }
        }
      }
    },
    {
      name: 'schedule_whatsapp',
      description: 'Schedule a WhatsApp message.',
      parameters: {
        properties: {
          name: { type: 'STRING' },
          message: { type: 'STRING' },
          delay_minutes: { type: 'NUMBER' },
          file_path: { type: 'STRING', description: 'Optional' }
        }
      }
    }
  ]
}

const ALL_TOOLS = Object.values(CATEGORIZED_TOOLS).flat()
const nodeTypes = { customTool: ToolNode }

function Editor() {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [workflowName, setWorkflowName] = useState('New Nexus Macro')
  const [description, setDescription] = useState('Custom Macro')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const totalTools = ALL_TOOLS.length

  const openParameterEditor = useCallback((nodeId: string) => setSelectedNodeId(nodeId), [])

  const loadMacroToCanvas = (macro: any) => {
    setWorkflowName(macro.name)
    setDescription(macro.description)

    const rehydratedNodes = (macro.nodes || []).map((node: any) => ({
      ...node,
      data: {
        ...node.data,
        openParameterEditor
      }
    }))

    setNodes(rehydratedNodes)
    setEdges(macro.edges || [])
    setIsSaved(true)
  }

  const resetCanvas = () => {
    setWorkflowName('New Nexus Macro')
    setDescription('Custom Macro')
    setNodes([])
    setEdges([])
    setIsSaved(false)
  }

  const updateNodeInputs = useCallback(
    (nodeId: string, updatedInputs: any, updatedComment: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, inputs: updatedInputs, comment: updatedComment }
            }
          }
          return node
        })
      )
    },
    []
  )

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  const onConnect = useCallback(
    (params: any) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'default',
            animated: true,
            style: { stroke: '#10b981', strokeWidth: 2, filter: 'drop-shadow(0 0 4px #10b981)' }
          },
          eds
        )
      ),
    []
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const toolName = event.dataTransfer.getData('application/reactflow')
      if (!toolName) return

      const toolSchema = ALL_TOOLS.find((t) => t.name === toolName)
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })

      const newNode = {
        id: `${toolName}_${Date.now()}`,
        type: 'customTool',
        position,
        data: { tool: toolSchema, inputs: {}, comment: '', openParameterEditor }
      }
      setNodes((nds) => nds.concat(newNode))
    },
    [openParameterEditor, screenToFlowPosition]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const saveWorkflow = async () => {
    const sanitizedNodes = nodes.map((node) => {
      const cleanData = { ...node.data }
      delete cleanData.openParameterEditor
      return { ...node, data: cleanData }
    })

    try {
      const res = await (window as any).electron.ipcRenderer.invoke('save-workflow', {
        name: workflowName,
        description: description,
        nodes: sanitizedNodes,
        edges
      })
      if (res.success) {
        setIsSaved(true)
      } else {
      }
    } catch (err) {}
  }

  const runMacroManually = async () => {
    await saveWorkflow()

    const macroRes = await getMacroSequence(workflowName)

    if (!macroRes.success) {
      alert(`❌ Execution Failed: ${macroRes.error}`)
      return
    }

    for (const step of macroRes.steps) {
      try {
        if (step.tool === 'TRIGGER' || step.tool === 'TRIGGER_VOICE') {
        } else if (step.tool === 'WAIT') {
          await new Promise((resolve) =>
            setTimeout(resolve, Number(step.args.milliseconds) || 1000)
          )
        } else if (step.tool === 'set_volume') {
          await setVolume(Number(step.args.level))
        } else if (step.tool === 'open_app') {
          await openApp(step.args.app_name)
        } else if (step.tool === 'close_app') {
          await closeApp(step.args.app_name)
        } else if (step.tool === 'send_whatsapp') {
          await sendWhatsAppMessage(step.args.name, step.args.message, step.args.file_path)
        } else if (step.tool === 'schedule_whatsapp') {
          await scheduleWhatsAppMessage(
            step.args.name,
            step.args.message,
            Number(step.args.delay_minutes),
            step.args.file_path
          )
        } else if (step.tool === 'google_search') {
          await performWebSearch(step.args.query)
        } else if (step.tool === 'run_terminal') {
          await runTerminal(step.args.command, step.args.path)
        } else if (step.tool === 'send_email') {
          await sendEmail(step.args.to, step.args.subject, step.args.body)
        } else if (step.tool === 'draft_email') {
          await draftEmail(step.args.to, step.args.subject, step.args.body)
        } else if (step.tool === 'read_emails') {
          await readEmails(Number(step.args.max_results) || 5)
        } else if (step.tool === 'deploy_wormhole') {
          await (window as any).electron.ipcRenderer.invoke(
            'deploy-wormhole',
            Number(step.args.port)
          )
        } else if (step.tool === 'close_wormhole') {
          await (window as any).electron.ipcRenderer.invoke('close-wormhole')
        } else if (step.tool === 'click_on_screen') {
          await clickOnCoordinate(Number(step.args.x), Number(step.args.y))
        } else if (step.tool === 'scroll_screen') {
          await scrollScreen(step.args.direction, Number(step.args.amount))
        } else if (step.tool === 'ghost_type') {
          await (window as any).electron.ipcRenderer.invoke('ghost-sequence', [
            { type: 'type', text: step.args.text }
          ])
        } else if (step.tool === 'press_shortcut') {
          let safeModifiers: string[] = []

          if (step.args.modifiers) {
            if (Array.isArray(step.args.modifiers)) {
              safeModifiers = step.args.modifiers
            } else if (typeof step.args.modifiers === 'string') {
              safeModifiers = step.args.modifiers
                .split(',')
                .map((m: string) => m.trim())
                .filter(Boolean)
            }
          }

          await (window as any).electron.ipcRenderer.invoke('ghost-sequence', [
            { type: 'press', key: step.args.key, modifiers: safeModifiers }
          ])
        } else if (step.tool === 'take_screenshot') {
          await takeScreenshot()
        } else {
        }
      } catch (stepError) {
        alert(`🔴 Macro Execution Halted! Failed at node: ${step.tool}`)
        break
      }
    }
  }

  return (
    <div className="nexus-macro-editor flex h-full w-full bg-[#09090b] relative overflow-hidden">
      <aside
        className={`nexus-macro-library h-full shrink-0 bg-[#111113]/95 border-r border-[#27272a] flex flex-col gap-1 transition-all duration-300 ease-in-out z-30 scrollbar-small overflow-auto ${
          isSidebarOpen ? 'w-64 p-4 opacity-100' : 'w-0 p-0 opacity-0'
        }`}
      >
        {isSidebarOpen && (
          <>
            <div className="mb-4 border-b border-[#27272a] pb-3">
              <h2 className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-emerald-500 uppercase">
                MODULE LIBRARY
              </h2>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                Drag tools into the canvas and wire a macro flow visually.
              </p>
            </div>

            {Object.entries(CATEGORIZED_TOOLS).map(([category, tools]) => (
              <div key={category} className="mb-6">
                <h3 className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">
                  {category}
                </h3>
                <div className="flex flex-col gap-2">
                  {tools.map((tool: any) => (
                    <div
                      key={tool.name}
                      className="flex items-center gap-3 p-2 bg-[#18181b] border border-[#27272a] rounded-lg cursor-grab hover:border-emerald-500/50 hover:bg-[#27272a]/50 transition-all group"
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData('application/reactflow', tool.name)
                      }
                    >
                      <div className="p-1.5 bg-black rounded shadow-inner border border-white/5">
                        {getIcon(tool.name, 14)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold tracking-widest text-zinc-300 uppercase group-hover:text-white transition-colors">
                          {tool.name.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </aside>

      <div
        className="min-w-0 grow flex flex-col relative transition-all duration-300 ease-in-out"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div className="shrink-0 border-b border-[#202323] bg-[#0c0f0f]/92 px-4 py-3 shadow-[0_14px_38px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-[#27272a] bg-[#111113] text-zinc-600 transition-all hover:border-emerald-500/35 hover:text-emerald-400"
              >
                {isSidebarOpen ? <RiLayoutColumnLine size={18} /> : <RiLayoutColumnFill size={18} />}
              </button>
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-100">
                  Macro Flow Editor
                </h2>
                <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                  {nodes.length} nodes / {edges.length} links / {totalTools} tools available
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em]">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-zinc-500">
                {description}
              </span>
              <span
                className={`rounded-full border px-3 py-1 ${
                  isSaved
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                }`}
              >
                {isSaved ? 'Saved' : 'Unsaved'}
              </span>
            </div>
          </div>

          <div className="mt-3 flex max-w-full flex-wrap items-center gap-3 overflow-x-auto rounded-lg border border-[#27272a] bg-[#0f1110]/90 p-2 shadow-2xl scrollbar-small">
            <button
              onClick={resetCanvas}
              className="p-3 rounded-lg bg-[#18181b] border border-[#27272a] text-zinc-600 hover:text-emerald-500 hover:border-emerald-500/50 transition-colors cursor-pointer"
              data-tooltip-id="global-tooltip"
              data-tooltip-content="Start New Macro"
            >
              <RiAddLine size={16} />
            </button>

            <MacroManagementMenu loadMacroToCanvas={loadMacroToCanvas} />

            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="min-w-48 w-[min(20rem,34vw)] rounded-lg border border-[#27272a] bg-[#18181b] px-4 py-2 text-sm font-bold tracking-wide text-white outline-none shadow-inner focus:border-emerald-500"
            />

            <button
              onClick={runMacroManually}
              className="bg-[#18181b] hover:bg-[#27272a] text-emerald-400 px-5 py-2 rounded-lg text-[11px] font-black tracking-widest transition-all border border-[#27272a] hover:border-emerald-500/50 flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <RiPlayFill size={16} /> RUN
            </button>

            <button
              onClick={saveWorkflow}
              className="bg-emerald-600 hover:bg-emerald-500 text-black px-6 py-2 rounded-lg text-[11px] font-black tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 cursor-pointer"
            >
              <RiSave3Line size={16} /> SAVE
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 p-3">
          <div className="h-full overflow-hidden rounded-xl border border-[#1b2321] bg-[#09090b] shadow-[inset_0_1px_rgba(255,255,255,0.04)]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              className="bg-[#09090b]"
            >
              <Background color="#27272a" gap={20} size={1} />
              <Controls className="react-flow__controls" />
            </ReactFlow>
          </div>
        </div>

        <Tooltip
          id="global-tooltip"
          place="top"
          style={{
            maxWidth: '250px',
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            zIndex: 100
          }}
        />

        {selectedNodeId && (
          <ParameterEditorDrawer
            nodeData={nodes.find((n) => n.id === selectedNodeId)}
            updateNodeInputs={updateNodeInputs}
            closeEditor={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}

export default function WorkFlowEditorView() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  )
}
