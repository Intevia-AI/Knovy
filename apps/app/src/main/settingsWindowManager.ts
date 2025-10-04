import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { is } from '@electron-toolkit/utils'

let settingsWindow: BrowserWindow | null = null

export function createSettingsWindow(mainWindow: BrowserWindow): BrowserWindow {
  // Singleton pattern - only one settings window
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return settingsWindow
  }

  const mainDisplay = screen.getDisplayMatching(mainWindow.getBounds())

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 800,
    minHeight: 500,
    x: mainDisplay.bounds.x + (mainDisplay.bounds.width - 900) / 2,
    y: mainDisplay.bounds.y + (mainDisplay.bounds.height - 600) / 2,
    frame: false,
    transparent: true,
    vibrancy: 'under-window',
    backgroundColor: '#00000000',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 22 },
    resizable: true,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Load settings page
  if (is.dev) {
    const devServerUrl = import.meta.env['VITE_DEV_SERVER_URL']
    if (devServerUrl) {
      settingsWindow.loadURL(`${devServerUrl}/settings.html`)
    } else {
      console.warn('VITE_DEV_SERVER_URL is not set for settings window')
      settingsWindow.loadURL('http://localhost:5173/settings.html')
    }
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'))
  }

  // Show when ready
  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show()
  })

  // Cleanup on close
  settingsWindow.on('closed', () => {
    // Notify main window that settings was closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings:closed')
    }
    settingsWindow = null
  })

  // Close when main window closes
  mainWindow.on('close', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close()
    }
  })

  // Blur settings window when main window is focused
  mainWindow.on('focus', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      mainWindow.focus() // Keep main window in front
    }
  })

  return settingsWindow
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close()
  }
}
