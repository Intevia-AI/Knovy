import { BrowserWindow } from 'electron'
import path from 'path'

const openPopovers = new Map<string, BrowserWindow>()

interface PopoverOptions {
  id: string
  parent: BrowserWindow
  url: string
  width: number
  height: number
  x: number
  y: number
}

export function createPopover(options: PopoverOptions): void {
  console.log('Creating popover with options:', options);
  const { id, parent, url, width, height, x, y } = options

  if (openPopovers.has(id)) {
    const existing = openPopovers.get(id)
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return
    }
  }

  const popover = new BrowserWindow({
    width,
    height,
    x,
    y,
    parent,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      // The preload script path should be handled by the bundler.
      // electron-vite automatically handles __dirname correctly in the main process.
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  popover.loadURL(url)
  openPopovers.set(id, popover)

  popover.on('closed', () => {
    openPopovers.delete(id)
  })

  
}

export function closePopover(id: string): void {
  const popover = openPopovers.get(id)
  if (popover && !popover.isDestroyed()) {
    popover.close()
  }
}

export function closeAllPopovers(): void {
  for (const popover of openPopovers.values()) {
    if (popover && !popover.isDestroyed()) {
      popover.close()
    }
  }
}
