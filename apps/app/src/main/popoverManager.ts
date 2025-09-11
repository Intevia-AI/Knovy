import { BrowserWindow } from 'electron'
import path from 'path'

const openPopovers = new Map<string, BrowserWindow>()

export interface PopoverOptions {
  id: string
  parent: BrowserWindow
  url: string
  width: number
  height: number
  x?: number
  y?: number
}

export function createPopover(options: PopoverOptions): BrowserWindow {
  console.log('[PopoverManager] createPopover called with options:', options)
  const { id, parent, url, width, height } = options

  if (openPopovers.has(id)) {
    const existing = openPopovers.get(id)
    if (existing && !existing.isDestroyed()) {
      console.log(`[PopoverManager] Focusing existing popover: ${id}`)
      existing.focus()
      return existing
    }
  }

  const parentBounds = parent.getBounds()
  console.log('[PopoverManager] Parent window bounds:', parentBounds)
  const x = options.x ?? parentBounds.x + Math.round((parentBounds.width - width) / 2)
  const y = options.y ?? parentBounds.y - height - 8 // Position above the parent
  console.log(`[PopoverManager] Calculated popover position: x=${x}, y=${y}`)

  const popover = new BrowserWindow({
    width,
    height,
    x,
    y,
    parent,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true, // Allow resizing
    movable: true, // Allow moving
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  console.log(`[PopoverManager] Created new BrowserWindow for id: ${id}`)

  popover.loadURL(url)
  console.log(`[PopoverManager] Loading URL: ${url}`)
  openPopovers.set(id, popover)

  popover.show()
  console.log(`[PopoverManager] Called show() on popover: ${id}`)

  popover.on('closed', () => {
    console.log(`[PopoverManager] Popover closed: ${id}`)
    openPopovers.delete(id)
  })

  return popover
}

export function closePopover(id: string): void {
  const popover = openPopovers.get(id)
  if (popover && !popover.isDestroyed()) {
    popover.webContents.send('popover:prepare-to-close', id)
  }
}

export function forceClosePopover(id: string): void {
  const popover = openPopovers.get(id)
  if (popover && !popover.isDestroyed()) {
    popover.close()
  }
}

export function closeAllPopovers(): void {
  for (const id of openPopovers.keys()) {
    closePopover(id)
  }
}
