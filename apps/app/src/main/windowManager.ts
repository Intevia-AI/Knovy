import { screen, BrowserWindow, Display } from 'electron'

export type WindowPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'

export interface PositionOptions {
  position: WindowPosition
  displayId?: number
  margin?: number
  animate?: boolean
}

function getTargetDisplay(displayId?: number): Display {
  const displays = screen.getAllDisplays()
  if (displayId) {
    const display = displays.find((d) => d.id === displayId)
    if (display) {
      return display
    }
  }
  // If no displayId or display not found, return primary
  return screen.getPrimaryDisplay()
}

export function positionWindow(window: BrowserWindow, options: PositionOptions): void {
  if (!window || window.isDestroyed()) {
    return
  }

  const { position, displayId, margin = 30, animate = true } = options

  // To support multi-display, we first need to determine which display to use.
  // The user might be on a different screen. We should try to open on the screen
  // where the mouse cursor is.
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)

  const targetDisplay = displayId ? getTargetDisplay(displayId) : display

  const { workArea } = targetDisplay
  const windowBounds = window.getBounds()

  let x: number
  let y: number

  switch (position) {
    case 'top-left':
      x = workArea.x + margin
      y = workArea.y + margin
      break
    case 'top-right':
      x = workArea.x + workArea.width - windowBounds.width - margin
      y = workArea.y + margin
      break
    case 'bottom-right':
      x = workArea.x + workArea.width - windowBounds.width - margin
      y = workArea.y + workArea.height - windowBounds.height - margin
      break
    case 'center':
      x = workArea.x + Math.round((workArea.width - windowBounds.width) / 2)
      y = workArea.y + Math.round((workArea.height - windowBounds.height) / 2)
      break
    case 'bottom-left':
    default:
      x = workArea.x + margin
      y = workArea.y + workArea.height - windowBounds.height - margin
      break
  }

  window.setPosition(Math.round(x), Math.round(y), animate)
}
