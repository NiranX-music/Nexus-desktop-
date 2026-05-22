type MacroStepInput = {
  tool: string
  args?: Record<string, any>
  comment?: string
}

const TOOL_LIBRARY: Record<string, { name: string; description: string; parameters: any }> = {
  TRIGGER: { name: 'TRIGGER', description: 'Starts the workflow.', parameters: {} },
  WAIT: {
    name: 'WAIT',
    description: 'Pauses execution.',
    parameters: { properties: { milliseconds: { type: 'NUMBER', description: 'Delay in ms' } } }
  },
  open_app: {
    name: 'open_app',
    description: 'Launch desktop app.',
    parameters: { properties: { app_name: { type: 'STRING' } } }
  },
  close_app: {
    name: 'close_app',
    description: 'Force close an app.',
    parameters: { properties: { app_name: { type: 'STRING' } } }
  },
  set_volume: {
    name: 'set_volume',
    description: 'Change system volume.',
    parameters: { properties: { level: { type: 'NUMBER' } } }
  },
  ghost_type: {
    name: 'ghost_type',
    description: 'Type text via keyboard.',
    parameters: { properties: { text: { type: 'STRING' } } }
  },
  press_shortcut: {
    name: 'press_shortcut',
    description: 'Press a keyboard shortcut.',
    parameters: { properties: { key: { type: 'STRING' }, modifiers: { type: 'ARRAY' } } }
  },
  click_on_screen: {
    name: 'click_on_screen',
    description: 'Click on screen coordinates.',
    parameters: { properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } } }
  },
  run_terminal: {
    name: 'run_terminal',
    description: 'Execute CLI command.',
    parameters: { properties: { command: { type: 'STRING' }, path: { type: 'STRING' } } }
  },
  google_search: {
    name: 'google_search',
    description: 'Open a URL or web search.',
    parameters: { properties: { query: { type: 'STRING' } } }
  },
  send_email: {
    name: 'send_email',
    description: 'Send an email.',
    parameters: {
      properties: { to: { type: 'STRING' }, subject: { type: 'STRING' }, body: { type: 'STRING' } }
    }
  },
  draft_email: {
    name: 'draft_email',
    description: 'Create an email draft.',
    parameters: {
      properties: { to: { type: 'STRING' }, subject: { type: 'STRING' }, body: { type: 'STRING' } }
    }
  },
  read_emails: {
    name: 'read_emails',
    description: 'Read latest unread emails.',
    parameters: { properties: { max_results: { type: 'NUMBER' } } }
  },
  send_whatsapp: {
    name: 'send_whatsapp',
    description: 'Send a WhatsApp message.',
    parameters: {
      properties: { name: { type: 'STRING' }, message: { type: 'STRING' }, file_path: { type: 'STRING' } }
    }
  },
  schedule_whatsapp: {
    name: 'schedule_whatsapp',
    description: 'Schedule a WhatsApp message.',
    parameters: {
      properties: {
        name: { type: 'STRING' },
        message: { type: 'STRING' },
        delay_minutes: { type: 'NUMBER' },
        file_path: { type: 'STRING' }
      }
    }
  }
}

const normalizeTool = (tool: string) => {
  const clean = tool.trim()
  return TOOL_LIBRARY[clean] ? clean : 'ghost_type'
}

const createWorkflowGraph = (steps: MacroStepInput[]) => {
  const fullSteps: MacroStepInput[] = [{ tool: 'TRIGGER', comment: 'AI generated macro start' }, ...steps]

  const nodes = fullSteps.map((step, index) => {
    const toolName = normalizeTool(step.tool)
    return {
      id: `${toolName}_${Date.now()}_${index}`,
      type: 'customTool',
      position: { x: index % 3 === 0 ? 80 : index % 3 === 1 ? 390 : 700, y: 120 + Math.floor(index / 3) * 190 },
      data: {
        tool: TOOL_LIBRARY[toolName],
        inputs: step.args || {},
        comment: step.comment || ''
      }
    }
  })

  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `edge_${node.id}_${nodes[index + 1].id}`,
    source: node.id,
    target: nodes[index + 1].id,
    type: 'default',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2, filter: 'drop-shadow(0 0 4px #10b981)' }
  }))

  return { nodes, edges }
}

export const createMacroFlow = async (
  name: string,
  description: string,
  steps: MacroStepInput[]
) => {
  const safeName = name?.trim() || 'AI Generated Macro'
  const cleanSteps = steps?.length ? steps : [{ tool: 'WAIT', args: { milliseconds: 1000 } }]
  const { nodes, edges } = createWorkflowGraph(cleanSteps)

  const result = await window.electron.ipcRenderer.invoke('save-workflow', {
    name: safeName,
    description: description?.trim() || 'Created by Nexus AI from the user request.',
    nodes,
    edges
  })

  if (!result?.success) {
    return `Could not create macro "${safeName}": ${result?.error || 'Unknown save error'}`
  }

  window.dispatchEvent(new CustomEvent('nexus-macro-created', { detail: { name: safeName } }))
  return `Created macro "${safeName}" with ${cleanSteps.length} automation step(s). It is saved in the Macros page and can be edited or run there.`
}
