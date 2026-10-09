import { IpcMain, BrowserWindow, shell, app } from 'electron'
import { spawn, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { globalSandboxManager } from '../security/sandbox-manager'

function getBrowserExecutablePath(): string | null {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  if (fs.existsSync(chromePath)) return chromePath
  if (fs.existsSync(edgePath)) return edgePath
  return null
}

function compileLatexToPdf(texPath: string, pdfPath: string, browserPath: string): boolean {
  try {
    const rawContent = fs.readFileSync(texPath, 'utf-8')
    let bodyContent = rawContent
    const docMatch = rawContent.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/)
    if (docMatch) {
      bodyContent = docMatch[1]
    }

    const htmlBody = bodyContent
      .replace(/\\section\*?\{([^}]+)\}/g, '<h2>$1</h2>')
      .replace(/\\subsection\*?\{([^}]+)\}/g, '<h3>$1</h3>')
      .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
      .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>')
      .replace(/\\begin\{tcolorbox\}\[title=([^\]]+)\]/g, '<div class="card"><h3 class="card-title">$1</h3>')
      .replace(/\\end\{tcolorbox\}/g, '</div>')
      .replace(/\\begin\{multicols\*?\}\{[^}]+\}/g, '<div class="grid">')
      .replace(/\\end\{multicols\*?\}/g, '</div>')
      .replace(/\\maketitle/g, '<h1 class="title">Document Overview</h1>')
      .replace(/\\\\/g, '<br/>')

    const tempHtml = path.join(os.tmpdir(), `nexus_tex_${Date.now()}.html`)
    const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"
    onload="renderMathInElement(document.body, {delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}, {left: '\\\\[', right: '\\\\]', display: true}, {left: '\\\\(', right: '\\\\)', display: false}]});"></script>
  <style>
    @page { margin: 15mm; size: A4 portrait; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #0f172a; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; padding: 12px; margin-bottom: 12px; break-inside: avoid; }
    .card-title { margin-top: 0; color: #059669; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    h1, h2, h3 { color: #0f172a; }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>`

    fs.writeFileSync(tempHtml, htmlTemplate, 'utf-8')
    spawnSync(browserPath, [
      '--headless',
      '--disable-gpu',
      '--run-all-compositor-stages-before-draw',
      `--print-to-pdf=${pdfPath}`,
      tempHtml
    ])

    return fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0
  } catch {
    return false
  }
}

export default function registerSystemControl(ipcMain: IpcMain) {
  ipcMain.handle('run-shell-command', async (_event, { command, cwd }) => {
    return new Promise((resolve) => {
      // 1. Sandbox Command Firewall Validation
      const validation = globalSandboxManager.validateCommand(command, cwd)
      const broadcastTerminalData = (data: string) => {
        const wins = BrowserWindow.getAllWindows()
        for (const win of wins) {
          if (!win.isDestroyed()) {
            win.webContents.send('terminal-data', data)
          }
        }
      }

      if (!validation.allowed) {
        const errorMsg = `\r\n\x1b[31;1m🛡️ [NEXUS SANDBOX FIREWALL BLOCKED]:\x1b[0m \x1b[31m${validation.reason}\x1b[0m\r\n\x1b[33mCommand:\x1b[0m ${command}\r\n\x1b[32mHost PC filesystem & registry preserved intact.\x1b[0m\r\n\r\n`
        broadcastTerminalData(errorMsg)
        return resolve({
          success: false,
          output: `[NEXUS SANDBOX BLOCKED]: ${validation.reason}`
        })
      }

      const safeCwd = validation.safeCwd

      // 2. Intelligent LaTeX Interceptor: Auto-fallback if pdflatex is not installed
      const pdflatexMatch = command.match(/^\s*pdflatex(?:\.exe)?\s+(?:-[^\s]+\s+)*["']?([^"'\s]+)["']?/i)
      if (pdflatexMatch) {
        let hasPdflatex = false
        try {
          const check = spawnSync('where.exe', ['pdflatex'], { stdio: 'ignore' })
          hasPdflatex = check.status === 0
        } catch {}

        if (!hasPdflatex) {
          const texFileName = pdflatexMatch[1]
          let texPath = path.isAbsolute(texFileName) ? texFileName : path.join(safeCwd, texFileName)
          
          if (!fs.existsSync(texPath)) {
            const altPath1 = path.join(process.cwd(), texFileName)
            const altPath2 = path.join(app.getPath('desktop'), texFileName)
            if (fs.existsSync(altPath1)) texPath = altPath1
            else if (fs.existsSync(altPath2)) texPath = altPath2
          }

          const browser = getBrowserExecutablePath()
          const pdfPath = texPath.replace(/\.tex$/i, '.pdf')

          if (fs.existsSync(texPath) && browser) {
            broadcastTerminalData(`\r\n\x1b[33m⚡ [NEXUS VECTOR ENGINE]:\x1b[0m 'pdflatex' binary not found on Windows host.\r\n`)
            broadcastTerminalData(`\x1b[36m📄 Auto-compiling ${path.basename(texPath)} -> ${path.basename(pdfPath)} via Headless Renderer...\x1b[0m\r\n`)
            
            const ok = compileLatexToPdf(texPath, pdfPath, browser)
            if (ok) {
              broadcastTerminalData(`\x1b[32m✔ PDF Successfully Generated: ${pdfPath}\x1b[0m\r\n\r\n[Process exited with code 0]\r\n`)
              shell.openPath(pdfPath)
              return resolve({ success: true, output: `Compiled to ${pdfPath}` })
            }
          }

          broadcastTerminalData(`\r\n\x1b[33m⚠️ [NEXUS ENGINE WARNING]:\x1b[0m 'pdflatex' is not installed on this PC.\r\n`)
          if (!fs.existsSync(texPath)) {
            broadcastTerminalData(`\x1b[31mTarget file '${texFileName}' was not found in directory: ${safeCwd}\x1b[0m\r\n`)
          }
          broadcastTerminalData(`\x1b[36m💡 Recommended: Ask Nexus to generate an HTML/Markdown study sheet, or run 'winget install MiKTeX.MiKTeX'.\x1b[0m\r\n\r\n[Process exited with code 0]\r\n`)
          return resolve({ success: false, output: `'pdflatex' is not installed on host.` })
        }
      }

      // 3. Command Normalization & Windows Compatibility Fixes
      let executable = 'powershell.exe'
      let args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]

      // PowerShell 5.1 throws syntax errors on '&&' and '||'. Route through cmd.exe /c for seamless execution.
      if (command.includes('&&') || command.includes('||')) {
        executable = 'cmd.exe'
        args = ['/c', command]
      } else if (command.trim().startsWith('touch ')) {
        const fileTarget = command.trim().replace(/^touch\s+/, '').trim()
        executable = 'powershell.exe'
        args = ['-NoProfile', '-Command', `if (!(Test-Path "${fileTarget}")) { New-Item -ItemType File -Path "${fileTarget}" -Force | Out-Null }`]
      } else if (command.trim().startsWith('export ')) {
        const varPart = command.trim().replace(/^export\s+/, '').trim()
        executable = 'powershell.exe'
        args = ['-NoProfile', '-Command', `$env:${varPart}`]
      }

      const child = spawn(executable, args, {
        cwd: safeCwd,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      child.stdout.on('data', (data) => {
        const output = data.toString()
        broadcastTerminalData(output)
      })

      child.stderr.on('data', (data) => {
        const output = data.toString()
        broadcastTerminalData(`\x1b[31m${output}\x1b[0m`)
      })

      child.on('close', (code) => {
        const msg = `\r\n[Process exited with code ${code}]\r\n`
        broadcastTerminalData(msg)
        resolve({ success: code === 0, output: `Completed with code ${code}` })
      })

      child.on('error', (err) => {
        broadcastTerminalData(`Error: ${err.message}`)
        resolve({ success: false, output: err.message })
      })
    })
  })
}
