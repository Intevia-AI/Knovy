import { BrowserWindow } from 'electron'
import path from 'path'
import internalBridge from './internalBridge'

const openPopovers = new Map<string, BrowserWindow>()

interface PopoverOptions {
  id: string
  parent: BrowserWindow
  url: string
  width: number
  height: number
  x?: number
  y?: number
}

function createPopover(options: PopoverOptions): BrowserWindow {
  console.log('[PopoverManager] createPopover called with options:', options);
  const { id, parent, url, width, height } = options

  if (openPopovers.has(id)) {
    const existing = openPopovers.get(id)
    if (existing && !existing.isDestroyed()) {
      console.log(`[PopoverManager] Focusing existing popover: ${id}`);
      existing.focus()
      return existing
    }
  }

  // If x and y are not provided, calculate them to center the popover below the parent
  const parentBounds = parent.getBounds()
  console.log('[PopoverManager] Parent window bounds:', parentBounds);
  const x = options.x ?? parentBounds.x + Math.round((parentBounds.width - width) / 2)
  const y = options.y ?? parentBounds.y + parentBounds.height + 8 // 8px margin
  console.log(`[PopoverManager] Calculated popover position: x=${x}, y=${y}`);

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
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  console.log(`[PopoverManager] Created new BrowserWindow for id: ${id}`);

  popover.loadURL(url)
  console.log(`[PopoverManager] Loading URL: ${url}`);
  openPopovers.set(id, popover)

  popover.show() // Explicitly show the window after creating it
  console.log(`[PopoverManager] Called show() on popover: ${id}`);

  popover.on('closed', () => {
    console.log(`[PopoverManager] Popover closed: ${id}`);
    openPopovers.delete(id)
  })

  return popover
}

function closePopover(id: string): void {
  const popover = openPopovers.get(id)
  if (popover && !popover.isDestroyed()) {
    popover.close()
  }
}

function closeAllPopovers(): void {
  for (const popover of openPopovers.values()) {
    if (popover && !popover.isDestroyed()) {
      popover.close()
    }
  }
  openPopovers.clear()
}

export function initializePopoverManager() {
  console.log('[PopoverManager] Initializing and attaching listeners...');

  internalBridge.on('popover:create', (options: PopoverOptions) => {
    console.log('[PopoverManager] Received popover:create event on internalBridge');
    createPopover(options);
  });

  internalBridge.on('popover:close', (id: string) => {
    closePopover(id)
  })

  internalBridge.on('popover:close-all', () => {
    closeAllPopovers()
  })

  console.log('[PopoverManager] Initialized and listening for events.')
}