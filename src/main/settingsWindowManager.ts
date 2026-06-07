import { BrowserWindow, screen, Display } from 'electron'
import path from 'path'
import { is } from '@electron-toolkit/utils'

let settingsWindow: BrowserWindow | null = null

/**
 * Synchronize settings window alwaysOnTop state with main window
 */
export function syncSettingsWindowAlwaysOnTop(alwaysOnTop: boolean): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setAlwaysOnTop(alwaysOnTop)
  }
}

// Types for responsive sizing
interface WindowSizeConfig {
  width: number
  height: number
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
}

type DisplayCategory = 'small' | 'medium' | 'large'

/**
 * Calculate responsive window size based on display properties
 * Uses three-tier strategy: small (< 1400px), medium (1400-1920px), large (> 1920px)
 */
function calculateResponsiveSize(display: Display): WindowSizeConfig {
  const { workArea, scaleFactor } = display

  console.log('[SettingsWindowManager] Display info:', {
    workArea,
    scaleFactor,
    displayId: display.id
  })

  // Use physical resolution for categorization to properly detect 4K/5K displays
  // But use effective dimensions for actual window sizing
  const physicalWidth = workArea.width
  const physicalHeight = workArea.height
  // const effectiveWidth = workArea.width / scaleFactor
  // const effectiveHeight = workArea.height / scaleFactor
  const effectiveWidth = workArea.width / 1.0
  const effectiveHeight = workArea.height / 1.0

  console.log('[SettingsWindowManager] Display dimensions:', {
    physical: { width: physicalWidth, height: physicalHeight },
    effective: { width: effectiveWidth, height: effectiveHeight }
  })

  // Categorize based on physical resolution to properly detect HiDPI displays
  const category = categorizeDisplay(physicalWidth, physicalHeight)
  console.log('[SettingsWindowManager] Display category:', category)

  // Calculate target size based on effective dimensions (what users actually see)
  const targetSize = calculateTargetSize(effectiveWidth, effectiveHeight, category)
  console.log('[SettingsWindowManager] Target size:', targetSize)

  // Get constraints for this category
  const constraints = getSizeConstraints(category)
  console.log('[SettingsWindowManager] Size constraints:', constraints)

  // Apply min/max constraints
  const width = Math.max(constraints.minWidth, Math.min(targetSize.width, constraints.maxWidth))

  const height = Math.max(constraints.minHeight, Math.min(targetSize.height, constraints.maxHeight))

  const finalSize = {
    width,
    height,
    ...constraints
  }

  console.log('[SettingsWindowManager] Final calculated size:', finalSize)

  return finalSize
}

/**
 * Categorize display based on physical dimensions
 */
function categorizeDisplay(width: number, height: number): DisplayCategory {
  if (width <= 1920) return 'small'
  if (width <= 2560) return 'medium'
  return 'large'
}

/**
 * Calculate target window size based on display category
 */
function calculateTargetSize(
  width: number,
  height: number,
  category: DisplayCategory
): { width: number; height: number } {
  // Detect portrait orientation (vertical screen)
  const isPortrait = height > width

  switch (category) {
    case 'small':
      // Small displays (≤1920px): conservative sizing
      return {
        width: Math.round(width * (isPortrait ? 0.75 : 0.5)),
        height: Math.round(height * 0.7)
      }
    case 'medium':
      // Medium displays (1920-2560px): balanced sizing
      return {
        width: Math.round(width * (isPortrait ? 0.8 : 0.55)),
        height: Math.round(height * 0.65)
      }
    case 'large':
      // Large displays (>2560px): fixed optimal size
      return {
        width: isPortrait ? 1200 : 1400,
        height: 900
      }
  }
}

/**
 * Get size constraints based on display category
 */
function getSizeConstraints(category: DisplayCategory) {
  const constraints = {
    small: {
      minWidth: 1000,
      minHeight: 600,
      maxWidth: 1200,
      maxHeight: 800
    },
    medium: {
      minWidth: 1000,
      minHeight: 600,
      maxWidth: 1200,
      maxHeight: 900
    },
    large: {
      minWidth: 1200,
      minHeight: 750,
      maxWidth: 1500,
      maxHeight: 1050
    }
  }

  return constraints[category]
}

export function createSettingsWindow(mainWindow: BrowserWindow): BrowserWindow {
  // Singleton pattern - only one settings window
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    console.log('[SettingsWindowManager] Settings window already exists, focusing it')
    settingsWindow.focus()
    return settingsWindow
  }

  console.log('[SettingsWindowManager] Creating new settings window')
  const mainDisplay = screen.getDisplayMatching(mainWindow.getBounds())
  const { width, height, minWidth, minHeight, maxWidth, maxHeight } =
    calculateResponsiveSize(mainDisplay)

  console.log('[SettingsWindowManager] Creating BrowserWindow with size:', {
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight
  })

  // Match main window's alwaysOnTop state
  const mainWindowAlwaysOnTop = mainWindow.isAlwaysOnTop()

  settingsWindow = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    x: mainDisplay.bounds.x + (mainDisplay.bounds.width - width) / 2,
    y: mainDisplay.bounds.y + (mainDisplay.bounds.height - height) / 2,
    frame: false,
    transparent: true,
    vibrancy: 'under-window',
    backgroundColor: '#00000000',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 22 },
    resizable: true, // Allow all users to resize settings window
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: mainWindowAlwaysOnTop,
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

export function toggleSettingsWindow(mainWindow: BrowserWindow): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    // Settings window exists, close it
    settingsWindow.close()
  } else {
    // Settings window doesn't exist, create it
    createSettingsWindow(mainWindow)
  }
}

export function moveSettingsWindowToDisplay(displayId: number): void {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    return
  }

  const displays = screen.getAllDisplays()
  const targetDisplay = displays.find((d) => d.id === displayId)

  if (!targetDisplay) {
    console.warn(`[settingsWindowManager] Display with ID ${displayId} not found`)
    return
  }

  // Calculate responsive size for target display
  const { width, height } = calculateResponsiveSize(targetDisplay)

  // Center settings window on the target display
  const x = targetDisplay.bounds.x + (targetDisplay.bounds.width - width) / 2
  const y = targetDisplay.bounds.y + (targetDisplay.bounds.height - height) / 2

  settingsWindow.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width,
    height
  })
}
