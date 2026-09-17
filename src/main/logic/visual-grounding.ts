import { IpcMain, screen } from 'electron'
import { mouse, Point, Button } from '@nut-tree-fork/nut-js'

export interface NormalizedClickPayload {
  x: number // 0 - 1000 or raw pixel
  y: number // 0 - 1000 or raw pixel
  isNormalized?: boolean
  button?: 'left' | 'right'
  doubleClick?: boolean
}

export function translateCoordinates(
  inputX: number,
  inputY: number,
  isNormalized = true
): { screenX: number; screenY: number } {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height, x: originX, y: originY } = primaryDisplay.bounds

  let targetX = inputX
  let targetY = inputY

  // If coordinates are in 0-1000 range or explicit normalized flag
  if (isNormalized || (inputX >= 0 && inputX <= 1000 && inputY >= 0 && inputY <= 1000)) {
    targetX = originX + Math.round((inputX / 1000) * width)
    targetY = originY + Math.round((inputY / 1000) * height)
  }

  // Clamp within display boundaries
  targetX = Math.max(originX, Math.min(originX + width - 1, targetX))
  targetY = Math.max(originY, Math.min(originY + height - 1, targetY))

  return { screenX: targetX, screenY: targetY }
}

export default function registerVisualGrounding(ipcMain: IpcMain) {
  ipcMain.handle(
    'visual:ground-and-click',
    async (_event, { x, y, isNormalized = true, button = 'left', doubleClick = false }: NormalizedClickPayload) => {
      try {
        const { screenX, screenY } = translateCoordinates(x, y, isNormalized)

        await mouse.setPosition(new Point(screenX, screenY))
        const mouseButton = button === 'right' ? Button.RIGHT : Button.LEFT

        if (doubleClick) {
          await mouse.doubleClick(mouseButton)
        } else {
          await mouse.click(mouseButton)
        }

        return {
          success: true,
          clickedAt: { screenX, screenY },
          message: `Clicked at physical screen coordinates (${screenX}, ${screenY})`
        }
      } catch (err: any) {
        return {
          success: false,
          error: `Grounding click error: ${err?.message || String(err)}`
        }
      }
    }
  )
}
