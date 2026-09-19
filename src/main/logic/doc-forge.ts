import { IpcMain, app, shell } from 'electron'
import fs from 'fs'
import path from 'path'

export interface SlideData {
  title: string
  subtitle?: string
  bullets: string[]
  footer?: string
}

export interface SpreadsheetColumn {
  key: string
  label: string
}

export default function registerDocForge(ipcMain: IpcMain) {
  const downloadsDir = app.getPath('downloads')

  // Generate interactive presentation file (HTML presentation deck + JSON)
  ipcMain.handle(
    'doc-forge-presentation',
    async (
      _event,
      payload: {
        title: string
        topic: string
        slides: SlideData[]
        openAfterCreate?: boolean
      }
    ) => {
      try {
        const safeTitle = (payload.title || 'Nexus-Presentation').replace(/[^\w\s-]/gi, '_')
        const filename = `${safeTitle}_${Date.now()}.html`
        const targetPath = path.join(downloadsDir, filename)

        const slidesHtml = payload.slides
          .map(
            (slide, idx) => `
          <div class="slide ${idx === 0 ? 'active' : ''}" id="slide-${idx}">
            <div class="slide-num">SLIDE ${idx + 1} / ${payload.slides.length}</div>
            <h1 class="slide-title">${slide.title}</h1>
            ${slide.subtitle ? `<h3 class="slide-subtitle">${slide.subtitle}</h3>` : ''}
            <ul class="slide-bullets">
              ${slide.bullets.map((b) => `<li>${b}</li>`).join('')}
            </ul>
            ${slide.footer ? `<div class="slide-footer">${slide.footer}</div>` : ''}
          </div>
        `
          )
          .join('\n')

        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${payload.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #030303;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      user-select: none;
    }
    .deck-container {
      width: 90vw;
      max-width: 1100px;
      height: 75vh;
      background: rgba(18, 18, 22, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.8), 0 0 40px rgba(16, 185, 129, 0.1);
      position: relative;
      padding: 60px 80px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .slide { display: none; height: 100%; flex-direction: column; justify-content: center; }
    .slide.active { display: flex; animation: fadeIn 0.4s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .slide-num { font-family: monospace; font-size: 11px; letter-spacing: 2px; color: #10b981; margin-bottom: 12px; }
    .slide-title { font-size: 38px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; margin-bottom: 8px; }
    .slide-subtitle { font-size: 18px; color: #a1a1aa; font-weight: 400; margin-bottom: 32px; }
    .slide-bullets { list-style: none; display: flex; flex-direction: column; gap: 16px; }
    .slide-bullets li {
      font-size: 18px;
      line-height: 1.6;
      color: #d4d4d8;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .slide-bullets li::before {
      content: '';
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
    }
    .controls {
      display: flex;
      gap: 16px;
      margin-top: 24px;
      align-items: center;
    }
    button {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      color: #fff;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-family: monospace;
      font-size: 12px;
      transition: all 0.2s;
    }
    button:hover { background: #10b981; color: #000; }
  </style>
</head>
<body>
  <div class="deck-container">
    ${slidesHtml}
  </div>
  <div class="controls">
    <button onclick="prevSlide()">◀ PREV</button>
    <span id="nav-indicator" style="font-family:monospace;font-size:12px;color:#71717a;">USE ARROWS TO NAVIGATE</span>
    <button onclick="nextSlide()">NEXT ▶</button>
  </div>
  <script>
    let cur = 0;
    const total = ${payload.slides.length};
    function show(i) {
      document.querySelectorAll('.slide').forEach((s, idx) => s.classList.toggle('active', idx === i));
    }
    function nextSlide() { if (cur < total - 1) { cur++; show(cur); } }
    function prevSlide() { if (cur > 0) { cur--; show(cur); } }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    });
  </script>
</body>
</html>`

        fs.writeFileSync(targetPath, htmlContent, 'utf8')

        if (payload.openAfterCreate !== false) {
          await shell.openPath(targetPath)
        }

        return { success: true, path: targetPath, filename }
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to forge presentation.' }
      }
    }
  )

  // Generate structured spreadsheet (.CSV / Excel-compatible)
  ipcMain.handle(
    'doc-forge-spreadsheet',
    async (
      _event,
      payload: {
        title: string
        columns: SpreadsheetColumn[]
        rows: Record<string, any>[]
        openAfterCreate?: boolean
      }
    ) => {
      try {
        const safeTitle = (payload.title || 'Nexus-Spreadsheet').replace(/[^\w\s-]/gi, '_')
        const filename = `${safeTitle}_${Date.now()}.csv`
        const targetPath = path.join(downloadsDir, filename)

        const headerLine = payload.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',')
        const dataLines = payload.rows.map((r) =>
          payload.columns
            .map((c) => {
              const val = r[c.key] !== undefined && r[c.key] !== null ? String(r[c.key]) : ''
              return `"${val.replace(/"/g, '""')}"`
            })
            .join(',')
        )

        const csvContent = [headerLine, ...dataLines].join('\r\n')
        fs.writeFileSync(targetPath, csvContent, 'utf8')

        if (payload.openAfterCreate !== false) {
          await shell.openPath(targetPath)
        }

        return { success: true, path: targetPath, filename, rowCount: payload.rows.length }
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to forge spreadsheet.' }
      }
    }
  )
}
