import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  session,
  systemPreferences,
  globalShortcut,
  screen,
  shell,
  nativeTheme,
  Menu,
  dialog,
  type MenuItemConstructorOptions
} from 'electron'
import path from 'path'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import { installExtension, REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer'
import { is } from '@electron-toolkit/utils'
import * as dbService from './databaseService'
import {
  createPopover,
  closePopover,
  closeAllPopovers,
  forceClosePopover,
  resizePopover,
  getPopover,
  setAdminStatus as setPopoverAdminStatus
} from './popoverManager'
import { positionWindow, type PositionOptions } from './windowManager'
import electronUpdater, { type AppUpdater } from 'electron-updater'
import { getWhisperBackend } from './whisperBackend'
import { getOllamaService } from './ollamaService'
import {
  getChatPrompt,
  getSummarizePrompt,
  getSummarizeJsonSchema,
  getRecommendResponsePrompt,
  getDeepResponsePrompt,
  getKeywordSearchPrompt,
  getScreenshotAnalysisPrompt
} from './localLLMPrompts'
import {
  createSettingsWindow,
  closeSettingsWindow,
  toggleSettingsWindow,
  moveSettingsWindowToDisplay,
  syncSettingsWindowAlwaysOnTop
} from './settingsWindowManager'
import { DEFAULT_AUTO_TRIGGER_SETTINGS } from '../renderer/src/types/settings'
import { getIntentionProcessor } from './intentionProcessor'
import { ConverterFactory, Locale } from 'opencc-js'

// Simplified → Traditional Chinese converter for post-processing enhanced text
const s2twConverter = ConverterFactory(Locale.from.cn, Locale.to.tw)

console.log('[Debug] Imported dbService module:', dbService)

let isScreenSharing = false
let cachedSessionProfile: any | null = null
let currentSessionId: string | null = null // SQLite session ID
let analyticsSessionId: string | null = null // Analytics session ID from renderer
let activeScreenSourceId: string | null = null
let mainWindow: BrowserWindow | null
let selectionWindow: BrowserWindow | null

/**
 * Check if the current user is an admin
 * Beta release restrictions (window resizing, cmd+q, DevTools) only apply to non-admin users
 */
function isAdminUser(): boolean {
  const role = cachedSessionProfile?.role
  const isAdmin = role === 'admin'
  console.log(`[main/index.ts] Role check: ${role}, isAdmin: ${isAdmin}`)
  return isAdmin
}

/**
 * Update application menu based on user role
 * Admin users: Standard macOS quit behavior (cmd+q works normally)
 * Non-admin users: cmd+q shows dialog directing to Settings panel
 */
function updateApplicationMenu(isAdmin: boolean): void {
  console.log(`[main/index.ts] Updating application menu for ${isAdmin ? 'admin' : 'non-admin'} user`)

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        isAdmin
          ? // Admin users: Normal quit behavior
            {
              label: 'Quit',
              accelerator: 'Command+Q',
              role: 'quit'
            }
          : // Non-admin users: Show dialog instead of quitting
            {
              label: 'Quit',
              accelerator: 'Command+Q',
              click: () => {
                dialog.showMessageBox({
                  type: 'info',
                  title: 'Quit Application',
                  message: 'Please quit the application through the Settings panel.',
                  detail: 'You can also right-click the dock icon and select Quit.',
                  buttons: ['OK']
                })
              }
            }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

let isContentProtectionEnabled = false
let isScreenshotInProgress = false
let hiddenWindowsBeforeScreenshot: Set<number> = new Set()

let pendingKeyword: { keyword: string; timestamp: number } | null = null

// Store pending actions that were triggered before popover opened (for race condition fix)
let recentPendingActions: any[] = []

// Store enhancement event cleanup functions to prevent duplicate listeners
let enhancementEventCleanups: Array<() => void> = []

export function getAutoUpdater(): AppUpdater {
  // Using destructuring to access autoUpdater due to the CommonJS module of 'electron-updater'.
  // It is a workaround for ESM compatibility issues, see https://github.com/electron-userland/electron-builder/issues/7976.
  const { autoUpdater } = electronUpdater
  return autoUpdater
}

// This is now the single source of truth for the main window.
// Other modules can get it from here if needed.
export const getMainWindow = (): BrowserWindow | null => mainWindow

function setupAutoUpdaterListeners() {
  const autoUpdater = getAutoUpdater()

  const log = (message: string, ...args: any[]) => {
    const logMessage = `[AutoUpdater] ${message}`
    console.log(logMessage, ...args)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:log', logMessage, ...args)
    }
  }

  autoUpdater.on('checking-for-update', () => {
    log('Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    log('Update available.', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    log('Update not available.', info)
  })

  autoUpdater.on('error', (err) => {
    log('Error in auto-updater:', err)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    const progress = `Downloaded ${Math.round(progressObj.percent)}% (${Math.round(
      progressObj.transferred / 1024
    )}/${Math.round(progressObj.total / 1024)} KB) at ${Math.round(
      progressObj.bytesPerSecond / 1024
    )} KB/s`
    log(progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    log('Update downloaded.', info)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:update-downloaded', info)
    }
  })
}

ipcMain.handle('electronAPI:getMainWindowBounds', () => {
  return mainWindow?.getBounds()
})

ipcMain.on('updater:quit-and-install', () => {
  getAutoUpdater().quitAndInstall()
})

// Manual update check from settings
ipcMain.on('updater:check-for-updates', async (event) => {
  console.log('[AutoUpdater] Manual update check requested from settings')
  try {
    const autoUpdater = getAutoUpdater()
    const checkResult = await autoUpdater.checkForUpdates()

    if (checkResult) {
      console.log('[AutoUpdater] Manual check completed:', {
        currentVersion: checkResult.currentVersion,
        updateVersion: checkResult.updateInfo?.version,
        hasDownloadedUpdate: !!checkResult.downloadedFile
      })

      // If update is already downloaded, notify immediately
      if (checkResult.downloadedFile || (checkResult.updateInfo && checkResult.updateInfo.version !== checkResult.currentVersion)) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:update-downloaded', checkResult.updateInfo)
        }
      }
    }
  } catch (error) {
    console.error('[AutoUpdater] Error during manual update check:', error)
    // Send error notification to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:check-error', error.message)
    }
  }
})

// The popover:create IPC handler now emits an internal event
// instead of directly calling the popover manager.
ipcMain.handle('popover:create', (event, options) => {
  console.log('Received popover:create IPC call', options)
  const parentWindow = BrowserWindow.fromWebContents(event.sender)
  if (!parentWindow) return

  const devServerUrl = import.meta.env['VITE_DEV_SERVER_URL']
  let url
  if (is.dev) {
    const baseUrl = devServerUrl || 'http://localhost:5173'
    url = `${baseUrl}#${options.hash}`
  } else {
    url = `file://${path.join(__dirname, '../renderer/index.html')}#${options.hash}`
  }

  const popoverOptions = {
    ...options,
    url,
    parent: parentWindow
  }

  const popover = createPopover(popoverOptions)
  // The old did-finish-load handler was removed to prevent race conditions.
  // The popover now requests its state when it's ready.
})

// The popover:close IPC handler now emits an internal event.
ipcMain.on('popover:close', (event, id) => {
  closePopover(id)
})

ipcMain.on('popover:close-all', () => {
  closeAllPopovers()
})

ipcMain.on('popover:ready-to-close', (event, id) => {
  forceClosePopover(id)
})

ipcMain.handle('popover:resize', (event, { id, width, height, x, y }) => {
  resizePopover(id, { width, height, x, y })
})

ipcMain.handle('get-screenshare-state', () => {
  return isScreenSharing
})

// Refactored session management functions
async function startSession() {
  console.log('[Debug] startSession invoked.')
  if (currentSessionId) {
    console.warn(
      `[main/index.ts] Tried to start a new session, but one is already active: ${currentSessionId}`
    )
    return currentSessionId
  }
  const newSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    started_at: new Date().toISOString(),
    status: 'active'
  }
  try {
    const { id } = await dbService.createSession(newSession)
    currentSessionId = id

    // Note: IntentionProcessor uses analytics session ID, not SQLite session ID
    // It will be set by the analytics:set-session-id handler

    console.log(`[main/index.ts] Started and set new session ID: ${id}`)
    return id
  } catch (error) {
    console.error('[main/index.ts] Failed to start session:', error)
    return null
  }
}

async function endCurrentSession() {
  if (!currentSessionId) {
    console.warn('[main/index.ts] Request to end session received without an active session ID.')
    return { success: false }
  }
  const sessionIdToEnd = currentSessionId
  currentSessionId = null // Clear session ID immediately

  // Note: IntentionProcessor session ID is cleared by analytics:clear-session-id handler

  try {
    const result = await dbService.endSession(sessionIdToEnd)
    console.log(`[main/index.ts] Ended session: ${sessionIdToEnd}`)
    return result
  } catch (error) {
    console.error(`[main/index.ts] Failed to end session ${sessionIdToEnd}:`, error)
    return { success: false }
  }
}

ipcMain.handle('session:start', startSession)

ipcMain.handle('session:end', endCurrentSession)

ipcMain.handle('session:get-id', () => {
  return currentSessionId
})

ipcMain.handle('session:get-profile', () => {
  return cachedSessionProfile
})

ipcMain.handle('session:set-profile', (event, profile) => {
  cachedSessionProfile = profile
  console.log('[main/index.ts] Session profile cached.')

  // Apply role-based restrictions after profile is loaded
  const isAdmin = isAdminUser()
  console.log(`[main/index.ts] Applying role-based restrictions. User is admin: ${isAdmin}`)

  // Update main window restrictions based on role
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Admin users can resize main window
    mainWindow.setResizable(isAdmin)
    console.log(`[main/index.ts] Main window resizable: ${isAdmin}`)

    // Open DevTools for admin users (even in production builds)
    if (isAdmin && !is.dev) {
      mainWindow.webContents.openDevTools()
      console.log('[main/index.ts] DevTools opened for admin user in production')
    }
  }

  // Update popover admin status (settings window is resizable for all users)
  setPopoverAdminStatus(isAdmin)

  // Update application menu based on role
  if (process.platform === 'darwin') {
    updateApplicationMenu(isAdmin)
  }
})

ipcMain.handle('session:clear-profile', () => {
  cachedSessionProfile = null
  console.log('[main/index.ts] Session profile cache cleared.')
})

// Analytics session ID handlers (separate from SQLite session ID)
ipcMain.handle('analytics:set-session-id', (event, sessionId: string) => {
  analyticsSessionId = sessionId
  console.log('[main/index.ts] ✓ Analytics session ID set:', sessionId)

  // Update IntentionProcessor with analytics session ID (the one used by enhancement service)
  const settings = loadSettings()
  settings.then((s) => {
    const intentionProcessor = getIntentionProcessor(s.autoTrigger)
    intentionProcessor.setSessionId(sessionId)
    console.log('[main/index.ts] Updated IntentionProcessor with analytics session ID:', sessionId)
  }).catch((err) => {
    console.error('[main/index.ts] Failed to update IntentionProcessor session ID:', err)
  })

  // Get all windows for broadcasting
  const allWindows = BrowserWindow.getAllWindows()
  const validWindows = allWindows.filter((win) => !win.isDestroyed())

  console.log(`[main/index.ts] Broadcasting analytics session ID to ${validWindows.length} windows`)

  // Broadcast to ALL windows (including popovers) so they can use the same session_id
  validWindows.forEach((win, index) => {
    try {
      const url = win.webContents.getURL()
      console.log(`[main/index.ts]   → Window ${index + 1}: Sending to ${url.substring(0, 50)}...`)
      win.webContents.send('analytics:session-id-changed', sessionId)
    } catch (error) {
      console.error(`[main/index.ts]   ✗ Window ${index + 1}: Failed to send:`, error.message)
    }
  })

  console.log('[main/index.ts] ✓ Broadcast completed')
  return { success: true }
})

ipcMain.handle('analytics:get-session-id', () => {
  console.log('[main/index.ts] Analytics session ID requested, returning:', analyticsSessionId)
  return analyticsSessionId
})

ipcMain.handle('analytics:clear-session-id', () => {
  analyticsSessionId = null
  console.log('[main/index.ts] Analytics session ID cleared')

  // Clear IntentionProcessor session ID
  const settings = loadSettings()
  settings.then((s) => {
    const intentionProcessor = getIntentionProcessor(s.autoTrigger)
    intentionProcessor.setSessionId(null)
    console.log('[main/index.ts] Cleared IntentionProcessor session ID')
  }).catch((err) => {
    console.error('[main/index.ts] Failed to clear IntentionProcessor session ID:', err)
  })

  // Broadcast to ALL windows
  console.log('[main/index.ts] Broadcasting analytics session ID cleared to all windows')
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('analytics:session-id-changed', null)
    }
  }

  return { success: true }
})

ipcMain.handle('electronAPI:getActiveScreenSourceId', () => {
  return activeScreenSourceId
})

const settingsPath = path.join(app.getPath('userData'), 'settings.json')

async function loadSettings() {
  try {
    await fs.access(settingsPath)
    const data = await fs.readFile(settingsPath, 'utf-8')
    const parsed = JSON.parse(data)

    // Merge with defaults and validate autoTrigger settings
    const autoTrigger = {
      ...DEFAULT_AUTO_TRIGGER_SETTINGS,
      ...parsed.autoTrigger,
      // Clamp confidence threshold to valid range [0, 1]
      confidenceThreshold: Math.max(0, Math.min(1, parsed.autoTrigger?.confidenceThreshold ?? 0.7))
    }

    return {
      language: 'zh-TW',
      customPrompt: '',
      contentProtection: false,
      ...parsed,
      autoTrigger
    }
  } catch (error) {
    console.log('Settings file not found or error reading, returning defaults.')
    return {
      language: 'zh-TW',
      customPrompt: '',
      contentProtection: false,
      autoTrigger: DEFAULT_AUTO_TRIGGER_SETTINGS
    }
  }
}

async function saveSettings(settings: any) {
  try {
    // Validate autoTrigger settings before saving
    if (settings.autoTrigger) {
      // Ensure confidence threshold is in valid range [0, 1]
      if (typeof settings.autoTrigger.confidenceThreshold === 'number') {
        settings.autoTrigger.confidenceThreshold = Math.max(
          0,
          Math.min(1, settings.autoTrigger.confidenceThreshold)
        )
      }

      // Validate per-action thresholds if they exist
      if (settings.autoTrigger.perActionThresholds) {
        Object.keys(settings.autoTrigger.perActionThresholds).forEach((key) => {
          const threshold = settings.autoTrigger.perActionThresholds[key]
          if (typeof threshold === 'number') {
            settings.autoTrigger.perActionThresholds[key] = Math.max(0, Math.min(1, threshold))
          }
        })
      }
    }

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
    console.log('Settings saved to:', settingsPath)
  } catch (error) {
    console.error('Error saving settings:', error)
  }
}

const PROTOCOL = 'intevia'
let oauthCallbackUrlOnStartup: string | null = null

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (url) {
      if (
        mainWindow &&
        !mainWindow.isDestroyed() &&
        mainWindow.webContents &&
        !mainWindow.webContents.isLoading()
      ) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
        mainWindow.webContents.send('electronAPI:oauth-callback', url)
        oauthCallbackUrlOnStartup = null
      } else {
        oauthCallbackUrlOnStartup = url
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        }
      }
    } else {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    }
  })
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  oauthCallbackUrlOnStartup = url
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('electronAPI:oauth-callback', url)
    }
  }
})

ipcMain.on('renderer-auth-ready', (event) => {
  if (oauthCallbackUrlOnStartup) {
    event.sender.send('electronAPI:oauth-callback', oauthCallbackUrlOnStartup)
    oauthCallbackUrlOnStartup = null
  }
})

function createSelectionWindow() {
  console.log('[main/index.ts] Creating selection window')

  // Get the display where the main window is located
  let targetDisplay = screen.getPrimaryDisplay()
  if (mainWindow && !mainWindow.isDestroyed()) {
    targetDisplay = screen.getDisplayMatching(mainWindow.getBounds())
    console.log('[main/index.ts] Using display where main window is located:', targetDisplay.id)
  } else {
    console.log('[main/index.ts] Main window not available, falling back to primary display')
  }

  // Use bounds (full display including menu bar) instead of workArea
  const { x, y, width, height } = targetDisplay.bounds
  console.log('[main/index.ts] Target display bounds:', { x, y, width, height })

  selectionWindow = new BrowserWindow({
    width: width,
    height: height,
    x: x,
    y: y,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    fullscreen: false,
    simpleFullscreen: false,
    skipTaskbar: true,
    enableLargerThanScreen: true, // Allow window to be larger than screen
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Set window level to be above menu bar on macOS
  if (process.platform === 'darwin') {
    selectionWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  if (is.dev) {
    const devServerUrl = import.meta.env['VITE_DEV_SERVER_URL']
    if (devServerUrl) {
      const selectionUrl = `${devServerUrl}/selection.html`
      console.log('[main/index.ts] Loading selection window from:', selectionUrl)
      selectionWindow.loadURL(selectionUrl)
    } else {
      console.warn(
        'VITE_DEV_SERVER_URL is not set, falling back to http://localhost:5173 for selection window'
      )
      selectionWindow.loadURL('http://localhost:5173/selection.html')
    }
  } else {
    const selectionPath = path.join(__dirname, '../renderer/selection.html')
    console.log('[main/index.ts] Loading selection window from file:', selectionPath)
    selectionWindow.loadFile(selectionPath)
  }
  selectionWindow.setIgnoreMouseEvents(false)
  console.log('[main/index.ts] Selection window created and configured')
}

const createWindow = async () => {
  const settings = await loadSettings()

  mainWindow = new BrowserWindow({
    width: 320,
    height: 300,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false, // Beta release: disable window resizing for non-admin users (will be updated after login)
    alwaysOnTop: false, // Start with false since we'll be doing loading/login first
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true // Allow DevTools (will be controlled by role after login)
    }
  })

  const actualDisplayId = positionWindow(mainWindow, {
    position: 'bottom-left',
    displayId: settings.displayId
  })

  // If the window was positioned on a different display than what was saved,
  // update the settings to reflect reality
  if (actualDisplayId !== -1 && actualDisplayId !== settings.displayId) {
    console.log(
      `[createWindow] Window positioned on display ${actualDisplayId}, updating settings from ${settings.displayId}`
    )
    await saveSettings({ ...settings, displayId: actualDisplayId })
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (oauthCallbackUrlOnStartup) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('electronAPI:oauth-callback', oauthCallbackUrlOnStartup)
      }
      oauthCallbackUrlOnStartup = null
    }
  })

  // mainWindow.on('blur', () => {
  //   closeAllPopovers();
  // })

  if (is.dev) {
    const devServerUrl = import.meta.env['VITE_DEV_SERVER_URL']
    if (devServerUrl) {
      mainWindow.loadURL(devServerUrl)
    } else {
      console.warn('VITE_DEV_SERVER_URL is not set, falling back to http://localhost:5173')
      mainWindow.loadURL('http://localhost:5173')
    }
    mainWindow.webContents.openDevTools()
    mainWindow.webContents.on('did-fail-load', () => {
      console.warn('Development server failed to load, retrying in 1 second...')
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reloadIgnoringCache()
        }
      }, 1000)
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Center the window initially since we always start with loading/login
  mainWindow.center()

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const toggleWindow = () => {
  if (!mainWindow) {
    createWindow()
  } else {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  }
}

// Screenshot cache management function
// Screenshots are stored in: ~/Library/Application Support/Knovy/screenshots (macOS)
//                          : %APPDATA%/Knovy/screenshots (Windows)
//                          : ~/.config/Knovy/screenshots (Linux)
async function cleanupScreenshotCache() {
  try {
    // Use the same user data directory for cleanup
    const screenshotsDir = path.join(app.getPath('userData'), 'screenshots')
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000 // 3 days in milliseconds

    console.log(`[main/index.ts] Cleaning screenshot cache in: ${screenshotsDir}`)

    // Create directory if it doesn't exist
    await fs.mkdir(screenshotsDir, { recursive: true })

    // Read directory contents
    const files = await fs.readdir(screenshotsDir)
    const screenshotFiles = files.filter(
      (file) => file.startsWith('screenshot-') && file.endsWith('.png')
    )

    console.log(`[main/index.ts] Found ${screenshotFiles.length} screenshot files`)

    for (const file of screenshotFiles) {
      const filePath = path.join(screenshotsDir, file)
      try {
        const stats = await fs.stat(filePath)
        if (stats.mtime.getTime() < threeDaysAgo) {
          await fs.unlink(filePath)
          console.log(`[main/index.ts] Deleted old screenshot: ${file}`)
        }
      } catch (error) {
        console.warn(`[main/index.ts] Error processing screenshot file ${file}:`, error)
      }
    }
  } catch (error) {
    console.error('[main/index.ts] Error cleaning screenshot cache:', error)
  }
}

// Audio cache management function
// Cached audio files are stored in: /private/var/folders/.../T/knovy-transcription (macOS)
//                                  : %TEMP%/knovy-transcription (Windows)
//                                  : /tmp/knovy-transcription (Linux)
async function cleanupAudioCache() {
  try {
    const audioTempDir = path.join(app.getPath('temp'), 'knovy-transcription')

    console.log(`[main/index.ts] Cleaning audio cache in: ${audioTempDir}`)

    // Check if directory exists
    try {
      await fs.access(audioTempDir)
    } catch {
      console.log(`[main/index.ts] Audio cache directory does not exist, skipping cleanup`)
      return
    }

    // Read directory contents
    const files = await fs.readdir(audioTempDir)
    const audioFiles = files.filter((file) => file.startsWith('audio-') && file.endsWith('.wav'))

    console.log(`[main/index.ts] Found ${audioFiles.length} cached audio files to remove`)

    // Delete all cached audio files from previous sessions
    for (const file of audioFiles) {
      try {
        const filePath = path.join(audioTempDir, file)
        await fs.unlink(filePath)
        console.log(`[main/index.ts] Deleted cached audio file: ${file}`)
      } catch (error) {
        console.warn(`[main/index.ts] Error deleting audio file ${file}:`, error)
      }
    }

    console.log(`[main/index.ts] Audio cache cleanup completed`)
  } catch (error) {
    console.error('[main/index.ts] Error cleaning audio cache:', error)
  }
}

app.on('ready', async () => {
  console.log('[DB Path] User data path:', app.getPath('userData'))

  // Clean up screenshot cache on startup
  await cleanupScreenshotCache()

  // Clean up audio cache on startup
  await cleanupAudioCache()

  if (is.dev) {
    await installExtension(REACT_DEVELOPER_TOOLS).catch(console.log)
  }
  nativeTheme.themeSource = 'light'

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, ['--auth-callback'])
  }

  // Show dock icon for all users (beta release requirement)
  // Dock icon allows right-click → Quit functionality
  // if (process.platform === 'darwin' && app.dock) {
  //   app.dock.hide()
  // }

  await createWindow()

  // Request permissions AFTER window creation to avoid blocking UI
  if (process.platform === 'darwin') {
    // Use setTimeout to ensure window is fully rendered before showing permission dialogs
    setTimeout(async () => {
      try {
        // Request screen permission
        const screenStatus = systemPreferences.getMediaAccessStatus('screen')
        if (screenStatus === 'not-determined') {
          console.log('[main/index.ts] Requesting screen permission...')
          await systemPreferences.askForMediaAccess('screen').catch(console.error)
        }

        // Request microphone permission
        const microphoneStatus = systemPreferences.getMediaAccessStatus('microphone')
        if (microphoneStatus === 'not-determined') {
          console.log('[main/index.ts] Requesting microphone permission...')
          const microphoneGranted = await systemPreferences
            .askForMediaAccess('microphone')
            .catch(console.error)
          if (!microphoneGranted) {
            console.warn('[main/index.ts] Microphone permission not granted')
          } else {
            console.log('[main/index.ts] Microphone permission granted')
          }
        } else if (microphoneStatus === 'granted') {
          console.log('[main/index.ts] Microphone permission already granted')
        } else if (microphoneStatus === 'denied') {
          console.warn('[main/index.ts] Microphone permission denied')
          // Notify renderer about permission status
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('permissions:microphone-denied')
          }
        }

        // Notify renderer that permission checks are complete
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('permissions:initialization-complete')
        }
      } catch (error) {
        console.error('[main/index.ts] Error during permission requests:', error)
      }
    }, 1000) // 1 second delay to ensure smooth app startup
  }

  if (!is.dev) {
    setupAutoUpdaterListeners()

    // Check if there's an update already downloaded and ready to install
    const autoUpdater = getAutoUpdater()

    // Small delay to ensure mainWindow is fully loaded before checking for updates
    setTimeout(async () => {
      try {
        // Check for updates (this will also detect previously downloaded updates)
        const checkResult = await autoUpdater.checkForUpdates()

        if (checkResult) {
          const currentVersion = checkResult.currentVersion
          const updateVersion = checkResult.updateInfo?.version

          console.log('[AutoUpdater] Update check completed on startup:', {
            currentVersion,
            updateVersion,
            hasDownloadedUpdate: !!checkResult.downloadedFile
          })

          // Only notify if there's actually a NEW version available
          // Don't notify if current version is the same as or newer than the update version
          if (checkResult.downloadedFile && updateVersion && currentVersion !== updateVersion) {
            // There's a downloaded update ready to install AND it's a newer version
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('updater:update-downloaded', checkResult.updateInfo)
              console.log('[AutoUpdater] Notified user of previously downloaded update:', updateVersion)
            }
          } else if (updateVersion === currentVersion) {
            console.log('[AutoUpdater] Already on the latest version:', currentVersion)
          }
        }
      } catch (error) {
        console.error('[AutoUpdater] Error checking for updates on startup:', error)
      }
    }, 2000) // 2 second delay to ensure window is ready to receive events
  }

  // Global shortcuts - All using Alt modifier to avoid conflicts with other apps

  // Alt+\ - Toggle main window (show/hide Knovy)
  globalShortcut.register('alt+\\', toggleWindow)

  // Alt+, - Toggle Settings window (opens to History tab)
  globalShortcut.register('alt+,', () => {
    if (mainWindow) {
      toggleSettingsWindow(mainWindow)
    }
  })

  // Alt+R - Toggle recording
  globalShortcut.register('alt+r', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shortcut:toggle-recording')
    }
  })

  // Alt+P - Toggle Preview Panel (only works when recording)
  globalShortcut.register('alt+p', () => {
    if (mainWindow && !mainWindow.isDestroyed() && isScreenSharing) {
      mainWindow.webContents.send('shortcut:toggle-preview-panel')
    }
  })

  // Alt+C - Toggle Chat Panel (only works when recording)
  globalShortcut.register('alt+c', () => {
    if (mainWindow && !mainWindow.isDestroyed() && isScreenSharing) {
      mainWindow.webContents.send('shortcut:toggle-chat-panel')
    }
  })

  // Alt+A - Toggle Actions Panel (only works when recording)
  globalShortcut.register('alt+a', () => {
    if (mainWindow && !mainWindow.isDestroyed() && isScreenSharing) {
      mainWindow.webContents.send('shortcut:toggle-actions-panel')
    }
  })

  // Alt+1 - AI Action: Recommend Response (only works when recording)
  globalShortcut.register('alt+1', () => {
    if (mainWindow && !mainWindow.isDestroyed() && isScreenSharing) {
      mainWindow.webContents.send('shortcut:ai-action-recommend-response')
    }
  })

  // Alt+2 - AI Action: Screenshot Analysis (only works when recording)
  globalShortcut.register('alt+2', () => {
    if (mainWindow && !mainWindow.isDestroyed() && isScreenSharing) {
      mainWindow.webContents.send('shortcut:ai-action-screenshot-analysis')
    }
  })

  // Set initial application menu for non-admin users (before login)
  // Will be updated to admin menu when admin user logs in
  if (process.platform === 'darwin') {
    updateApplicationMenu(false) // Start with non-admin restrictions
  }

  // Settings window IPC handlers
  ipcMain.handle('settings:open', () => {
    if (mainWindow) {
      createSettingsWindow(mainWindow)
      return { success: true }
    }
    return { success: false, error: 'Main window not available' }
  })

  ipcMain.on('settings:close', () => {
    closeSettingsWindow()
  })

  ipcMain.on('settings:move-to-display', (event, { displayId }: { displayId: number }) => {
    moveSettingsWindowToDisplay(displayId)
  })

  ipcMain.handle('settings:navigate', (event, section: string) => {
    // Navigation handled in renderer, just for future use
    return { success: true, section }
  })

  ipcMain.handle('supabase:signInWithOAuth', async (event, provider) => {
    if (provider.urlToOpen) {
      await shell.openExternal(provider.urlToOpen)
      return { success: true }
    }
    return { error: 'No URL provided' }
  })

  ipcMain.on('auth:request-sign-out', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:execute-sign-out')
    }
  })

  // Auto-trigger settings IPC handlers
  ipcMain.handle('auto-trigger:get-settings', async () => {
    const settings = await loadSettings()
    return settings.autoTrigger
  })

  ipcMain.handle('auto-trigger:update-settings', async (event, updates) => {
    const currentSettings = await loadSettings()
    const newAutoTrigger = { ...currentSettings.autoTrigger, ...updates }
    await saveSettings({ ...currentSettings, autoTrigger: newAutoTrigger })

    // Update IntentionProcessor settings
    const intentionProcessor = getIntentionProcessor(newAutoTrigger)
    intentionProcessor.updateSettings(newAutoTrigger)

    // Broadcast change to all windows
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('auto-trigger:settings-changed', newAutoTrigger)
      }
    }

    console.log('[main/index.ts] Auto-trigger settings updated:', newAutoTrigger)
    return newAutoTrigger
  })

  // Auto-trigger action IPC handlers
  ipcMain.handle('auto-trigger:approve-action', async (event, actionId: string) => {
    try {
      console.log(`[main/index.ts] Approving action: ${actionId}`)

      // Broadcast approval to all windows
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('auto-trigger:action-approved', actionId)
        }
      }

      return { success: true, actionId }
    } catch (error) {
      console.error(`[main/index.ts] Failed to approve action ${actionId}:`, error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('auto-trigger:reject-action', async (event, actionId: string) => {
    try {
      console.log(`[main/index.ts] Rejecting action: ${actionId}`)

      // Broadcast rejection to all windows
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('auto-trigger:action-rejected', actionId)
        }
      }

      return { success: true, actionId }
    } catch (error) {
      console.error(`[main/index.ts] Failed to reject action ${actionId}:`, error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('auto-trigger:execute-action', async (event, { actionId, actionType, context }) => {
    try {
      console.log(`[main/index.ts] Executing action ${actionId} of type ${actionType}`)

      // Broadcast execution start to all windows
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('auto-trigger:action-executing', actionId)
        }
      }

      // Execute the action based on type
      let result
      switch (actionType) {
        case 'recommendResponse':
          // Trigger the recommend response AI action
          // Send ONLY to the actions popover (not all windows)
          const actionsPopover = getPopover('actions')
          if (actionsPopover && !actionsPopover.isDestroyed()) {
            actionsPopover.webContents.send('ai-action:recommend-response', { actionId, context })
            result = { success: true, message: 'Recommend response action triggered' }
          } else {
            console.warn('[main/index.ts] Actions popover not found or destroyed')
            result = { success: false, error: 'Actions popover not available' }
          }
          break

        case 'scheduleReminder':
          // Future implementation
          result = { success: false, error: 'Schedule reminder not yet implemented' }
          break

        case 'sendEmail':
          // Future implementation
          result = { success: false, error: 'Send email not yet implemented' }
          break

        default:
          result = { success: false, error: `Unknown action type: ${actionType}` }
      }

      // Broadcast execution result to all windows
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          if (result.success) {
            win.webContents.send('auto-trigger:action-completed', { actionId, result })
          } else {
            win.webContents.send('auto-trigger:action-failed', { actionId, error: result.error })
          }
        }
      }

      console.log(`[main/index.ts] Action ${actionId} execution result:`, result)
      return result
    } catch (error) {
      console.error(`[main/index.ts] Failed to execute action ${actionId}:`, error)

      // Broadcast failure to all windows
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('auto-trigger:action-failed', { actionId, error: error.message })
        }
      }

      return { success: false, error: error.message }
    }
  })

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then(async (sources) => {
        const settings = await loadSettings()
        let targetSource = null
        let targetDisplayId = null

        // 1. PRIORITY: Use the display where the main window is currently located
        // This ensures the preview always matches where the app is visually shown
        if (mainWindow && !mainWindow.isDestroyed()) {
          const windowDisplay = screen.getDisplayMatching(mainWindow.getBounds())
          const windowSource = sources.find((s) => s.display_id === String(windowDisplay.id))
          if (windowSource) {
            targetSource = windowSource
            targetDisplayId = windowDisplay.id
            console.log(
              `[ScreenShare] Using display where main window is located: Display ${windowDisplay.id}`
            )

            // Update settings if it differs from saved displayId
            if (settings.displayId !== windowDisplay.id) {
              console.log(
                `[ScreenShare] Updating saved displayId from ${settings.displayId} to ${windowDisplay.id}`
              )
              await saveSettings({ ...settings, displayId: windowDisplay.id })
            }
          }
        }

        // 2. Fallback: Try saved displayId (if window detection failed)
        if (!targetSource && settings.displayId) {
          const selectedDisplaySource = sources.find(
            (s) => s.display_id === String(settings.displayId)
          )
          if (selectedDisplaySource) {
            targetSource = selectedDisplaySource
            targetDisplayId = settings.displayId
            console.log(`[ScreenShare] Using saved display ID: ${settings.displayId}`)
          } else {
            console.warn(
              `[ScreenShare] Saved display ID ${settings.displayId} not found. Falling back.`
            )
          }
        }

        // 3. Fallback: Primary display
        if (!targetSource) {
          const primaryDisplay = screen.getPrimaryDisplay()
          const primarySource = sources.find((s) => s.display_id === String(primaryDisplay.id))
          if (primarySource) {
            targetSource = primarySource
            targetDisplayId = primaryDisplay.id
            console.log(`[ScreenShare] Falling back to primary display.`)
          }
        }

        // 4. Final fallback: First available source
        if (!targetSource && sources.length > 0) {
          targetSource = sources[0]
          console.warn('[ScreenShare] Falling back to first available screen source.')
        }

        if (targetSource) {
          activeScreenSourceId = targetSource.id // Store the source ID
          console.log(
            `[ScreenShare] activeScreenSourceId set to: ${activeScreenSourceId} (Display ${targetDisplayId})`
          )
          callback({ video: targetSource, audio: 'loopback' })
        } else {
          console.error('No screen sources found!')
          activeScreenSourceId = null // Clear the source ID
          callback({ video: null, audio: null })
        }
      })
      .catch((error) => {
        console.error('Error getting desktop sources:', error)
        activeScreenSourceId = null // Clear the source ID
        callback({ video: null, audio: null })
      })
  })

  ipcMain.on('electronAPI:openExternal', (event, url) => {
    shell.openExternal(url)
  })

  ipcMain.on('electronAPI:minimizeWindow', () => mainWindow?.minimize())
  ipcMain.on('electronAPI:closeWindow', () => mainWindow?.close())
  ipcMain.on('app:quit', () => app.quit())

  ipcMain.on('window:set-position', (event, options: PositionOptions) => {
    if (mainWindow) {
      positionWindow(mainWindow, options)
    }
  })

  ipcMain.handle('electronAPI:getDisplays', () => {
    return screen.getAllDisplays()
  })

  // Permission status handlers
  ipcMain.handle(
    'electronAPI:getMediaAccessStatus',
    (event, mediaType: 'microphone' | 'screen' | 'camera') => {
      if (process.platform === 'darwin') {
        return systemPreferences.getMediaAccessStatus(mediaType)
      }
      return 'granted' // Other platforms don't have the same permission system
    }
  )

  ipcMain.handle(
    'electronAPI:askForMediaAccess',
    async (event, mediaType: 'microphone' | 'screen' | 'camera') => {
      if (process.platform === 'darwin') {
        try {
          return await systemPreferences.askForMediaAccess(mediaType)
        } catch (error) {
          console.error(`[main/index.ts] Error requesting ${mediaType} permission:`, error)
          return false
        }
      }
      return true // Other platforms don't need explicit permission requests
    }
  )

  ipcMain.handle(
    'electronAPI:openSystemPreferences',
    async (event, prefPane: 'microphone' | 'screen' | 'camera') => {
      if (process.platform === 'darwin') {
        let url = ''
        switch (prefPane) {
          case 'microphone':
            url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
            break
          case 'screen':
            url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
            break
          case 'camera':
            url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera'
            break
        }
        try {
          await shell.openExternal(url)
          return true
        } catch (error) {
          console.error(`[main/index.ts] Error opening system preferences for ${prefPane}:`, error)
          return false
        }
      }
      return false // Not supported on other platforms
    }
  )

  ipcMain.handle('electronAPI:getAppVersion', () => {
    return app.getVersion()
  })

  ipcMain.on('app:set-always-on-top', (event, { alwaysOnTop }) => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(alwaysOnTop)
      // Sync settings window to match
      syncSettingsWindowAlwaysOnTop(alwaysOnTop)
    }
  })
  ipcMain.on('electronAPI:toggleAlwaysOnTop', (event, isAlwaysOnTop) => {
    mainWindow?.setAlwaysOnTop(isAlwaysOnTop)
    // Sync settings window to match
    syncSettingsWindowAlwaysOnTop(isAlwaysOnTop)
    event.reply('electronAPI:alwaysOnTopChanged', mainWindow?.isAlwaysOnTop())
  })
  ipcMain.handle('electronAPI:getInitialAlwaysOnTop', () => mainWindow?.isAlwaysOnTop() ?? false)
  ipcMain.handle('electronAPI:getSettings', async () => {
    const settings = await loadSettings()

    // Always return the actual display where the main window is currently positioned
    if (mainWindow && !mainWindow.isDestroyed()) {
      const windowBounds = mainWindow.getBounds()
      const currentDisplay = screen.getDisplayMatching(windowBounds)
      settings.displayId = currentDisplay.id
    }

    return settings
  })
  ipcMain.handle('electronAPI:setSettings', async (event, settingsToUpdate) => {
    const currentSettings = await loadSettings()
    const newSettings = { ...currentSettings, ...settingsToUpdate }
    await saveSettings(newSettings)

    // If display ID changed and screen sharing is active, update the active screen source
    if (
      settingsToUpdate.displayId !== undefined &&
      settingsToUpdate.displayId !== currentSettings.displayId &&
      isScreenSharing
    ) {
      console.log(
        `[main/index.ts] Display changed from ${currentSettings.displayId} to ${settingsToUpdate.displayId} during active session`
      )

      // Update the active screen source ID for the new display
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] })
        const newDisplaySource = sources.find(
          (s) => s.display_id === String(settingsToUpdate.displayId)
        )

        if (newDisplaySource) {
          activeScreenSourceId = newDisplaySource.id
          console.log(
            `[main/index.ts] Updated activeScreenSourceId to ${activeScreenSourceId} for display ${settingsToUpdate.displayId}`
          )

          // Broadcast source-changed event to trigger PreviewPanel refresh
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send('screenshare:source-changed')
            }
          }
        } else {
          console.warn(
            `[main/index.ts] Could not find screen source for display ${settingsToUpdate.displayId}`
          )
        }
      } catch (error) {
        console.error('[main/index.ts] Error updating screen source after display change:', error)
      }
    }

    // Broadcast the settings change to all windows
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('settings:changed', newSettings)
      }
    }

    return newSettings
  })

  isContentProtectionEnabled = (await loadSettings()).contentProtection

  ipcMain.on('app:toggle-content-protection', async () => {
    isContentProtectionEnabled = !isContentProtectionEnabled
    await saveSettings({ contentProtection: isContentProtectionEnabled })

    // If a screenshot is in progress, don't apply the change immediately.
    // The `endScreenshotSession` function will apply the final correct state.
    if (isScreenshotInProgress) {
      console.log(
        '[main/index.ts] Content protection toggled during screenshot. Change will be applied after.'
      )
      return
    }

    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        const url = win.webContents.getURL()
        if (url.includes('#screen-preview')) {
          win.setContentProtection(false)
        } else {
          win.setContentProtection(isContentProtectionEnabled)
        }
      }
    }
  })

  app.on('browser-window-created', (_, window) => {
    window.webContents.on('did-finish-load', () => {
      const url = window.webContents.getURL()
      // Always keep preview panel unprotected
      if (url.includes('#screen-preview')) {
        window.setContentProtection(false)
      } else {
        window.setContentProtection(isContentProtectionEnabled)
      }
    })
  })

  ipcMain.on('app:graceful-stop-and-execute', (event, { postAction }) => {
    console.log(`[main/index.ts] Received graceful stop request with postAction: ${postAction}`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:execute-graceful-stop', { postAction })
    }
  })

  // IPC handler for setting and broadcasting screen share state
  ipcMain.on('set-screenshare-state', async (event, newState: boolean) => {
    isScreenSharing = newState
    console.log(
      `[main/index.ts] Set isScreenSharing = ${isScreenSharing}. Broadcasting to all windows.`
    )

    if (newState) {
      await startSession()
    } else {
      await endCurrentSession()
      activeScreenSourceId = null // Clear the source ID when screen sharing ends
    }

    // Broadcast to all windows (including the sender, which is simpler and harmless)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('screenshare:state-changed', isScreenSharing)
      }
    }
  })

  // IPC relay for transcription data with real-time enhancement
  // Enhancement happens BEFORE broadcasting - only enhanced text reaches the UI
  ipcMain.on(
    'transcription:data',
    async (event, transcriptionData: { text: string; sourceType: 'microphone' | 'system' }) => {
      const senderId = event.sender.id
      console.log(`[main/index.ts] Received transcription data from renderer ${senderId}:`, {
        textLength: transcriptionData?.text?.length || 0,
        sourceType: transcriptionData?.sourceType,
        hasText: !!transcriptionData?.text?.trim()
      })

      // Validate session
      if (!currentSessionId) {
        const errorMsg = 'Received transcription data, but no active session'
        console.warn(`[main/index.ts] ${errorMsg}`)
        event.sender.send('transcription:error', {
          error: errorMsg,
          code: 'NO_ACTIVE_SESSION'
        })
        return
      }

      // Validate transcription data
      if (!transcriptionData?.text?.trim()) {
        const errorMsg = 'Received empty or invalid transcription data'
        console.warn(`[main/index.ts] ${errorMsg}`, transcriptionData)
        event.sender.send('transcription:error', {
          error: errorMsg,
          code: 'INVALID_TRANSCRIPTION_DATA'
        })
        return
      }

      try {
        const transcriptId = randomUUID()
        const timestamp = new Date().toISOString()

        // 1. Save raw transcript to database with pending enhancement status
        const enhancedDbTranscript = {
          id: transcriptId,
          session_id: currentSessionId,
          timestamp,
          content: transcriptionData.text,
          sourceType: transcriptionData.sourceType,
          rawText: transcriptionData.text,
          detectedLanguage: transcriptionData.detectedLanguage,
          whisperLanguage: transcriptionData.whisperLanguage,
          userLanguage: transcriptionData.userLanguage,
          usedTwoStageDetection: transcriptionData.usedTwoStageDetection,
          processingTimeMs: transcriptionData.processingTime,
          enhancementStatus: 'pending' as const
        }

        try {
          await dbService.addEnhancedTranscript(enhancedDbTranscript)
          console.log(
            `[main/index.ts] Saved raw transcript ${transcriptId} to database`
          )
        } catch (dbError) {
          console.error(
            `[main/index.ts] Failed to save transcript ${transcriptId} to database:`,
            dbError
          )
          event.sender.send('transcription:warning', {
            warning: 'Failed to save transcription to database',
            transcriptId,
            error: dbError.message
          })
        }

        // 2. Attempt real-time enhancement before broadcasting
        let displayContent = transcriptionData.text // Fallback: raw text
        let enhancedData: any = null
        const ollamaSvc = getOllamaService()

        if (ollamaSvc.getStatus() === 'ready') {
          try {
            const userLanguage = cachedSessionProfile?.profile?.language ||
                               cachedSessionProfile?.app_settings?.language ||
                               'auto'

            const segment = {
              id: transcriptId,
              rawText: transcriptionData.text,
              timestamp: Date.now(),
              sourceType: transcriptionData.sourceType
            }

            const sessionContext = {
              sessionId: analyticsSessionId || currentSessionId,
              conversationHistory: [] as string[],
              userLanguage
            }

            const enhanceResult = await ollamaSvc.enhance([segment], sessionContext)

            if (enhanceResult.segments.length > 0) {
              const enhanced = enhanceResult.segments[0]
              // Ensure Traditional Chinese after enhancement (model may output Simplified)
              if (userLanguage === 'zh-TW' && enhanced.corrected) {
                enhanced.corrected = s2twConverter(enhanced.corrected)
              }
              displayContent = enhanced.corrected
              enhancedData = enhanced

              // Update database with enhanced text
              try {
                await dbService.updateTranscriptEnhancement(transcriptId, {
                  enhancedText: enhanced.corrected,
                  enhancementMetadata: {
                    intention: enhanced.intention,
                    keywords: enhanced.keywords,
                    confidence: enhanced.confidence,
                    processingTime: enhanceResult.processingTime
                  }
                })
              } catch (dbError) {
                console.error(
                  `[main/index.ts] Failed to update enhancement in DB for ${transcriptId}:`,
                  dbError
                )
              }

              // Process through IntentionProcessor for auto-trigger
              const intentionProcessor = getIntentionProcessor()
              intentionProcessor.processEnhancedSegment({
                sessionId: sessionContext.sessionId,
                original: segment,
                enhanced,
                processingTime: enhanceResult.processingTime
              })

              console.log(
                `[main/index.ts] Real-time enhancement for ${transcriptId}: "${transcriptionData.text.substring(0, 40)}..." → "${displayContent.substring(0, 40)}..." (${enhanceResult.processingTime}ms)`
              )
            }
          } catch (enhanceError) {
            console.warn(
              `[main/index.ts] Enhancement failed for ${transcriptId}, using raw text:`,
              enhanceError
            )
            // Fallback: displayContent remains as raw text
          }
        } else {
          console.log(
            `[main/index.ts] Ollama not ready (${ollamaSvc.getStatus()}), broadcasting raw text for ${transcriptId}`
          )
        }

        // 3. Broadcast enhanced (or raw fallback) text to all windows
        const displayTranscript = {
          id: transcriptId,
          session_id: currentSessionId,
          timestamp,
          content: displayContent,
          sourceType: transcriptionData.sourceType,
          role: 'assistant',
          type: 'transcription',
          keywords: enhancedData?.keywords || []
        }

        const windows = BrowserWindow.getAllWindows()
        const validWindows = windows.filter((win) => !win.isDestroyed())

        let broadcastSuccessCount = 0
        for (const win of validWindows) {
          try {
            win.webContents.send('transcription:data', displayTranscript)
            broadcastSuccessCount++
          } catch (sendError) {
            console.error(`[main/index.ts] Error sending to window:`, sendError)
          }
        }

        console.log(
          `[main/index.ts] Broadcast transcript ${transcriptId} to ${broadcastSuccessCount}/${validWindows.length} windows`
        )

        event.sender.send('transcription:processed', {
          transcriptId,
          broadcastCount: broadcastSuccessCount,
          totalWindows: validWindows.length
        })
      } catch (processingError) {
        console.error(`[main/index.ts] Error processing transcription:`, processingError)
        event.sender.send('transcription:error', {
          error: 'Failed to process transcription',
          code: 'PROCESSING_ERROR',
          details: processingError.message
        })
      }
    }
  )

  // Handle transcription updates (for enhancement replacements)
  ipcMain.on(
    'transcription:update',
    (
      event,
      updateData: { id: string; enhancedText: string; sourceType?: 'microphone' | 'system' }
    ) => {
      console.log(`[main/index.ts] Received transcription update for ID ${updateData.id}`)

      // Broadcast the update to all windows
      const windows = BrowserWindow.getAllWindows()
      const validWindows = windows.filter((win) => !win.isDestroyed())

      validWindows.forEach((win) => {
        win.webContents.send('transcription:update', updateData)
      })

      console.log(
        `[main/index.ts] Broadcasted transcription update to ${validWindows.length} windows`
      )
    }
  )

  ipcMain.on('electronAPI:startScreenshot', () => {
    if (isScreenshotInProgress) {
      console.warn('[main/index.ts] Screenshot process already in progress.')
      return
    }
    isScreenshotInProgress = true
    console.log('[main/index.ts] startScreenshot IPC event received, creating selection window')

    console.log('[main/index.ts] Forcing content protection for screenshot.')
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        const url = win.webContents.getURL()
        if (!url.includes('#screen-preview')) {
          win.setContentProtection(true)
        }
      }
    }

    // Hide all windows except screen-preview to avoid visual distraction during screenshot
    console.log('[main/index.ts] Hiding all non-preview windows for screenshot')
    hiddenWindowsBeforeScreenshot.clear()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        const url = win.webContents.getURL()
        // Keep only screen-preview windows visible (they show the actual screen content)
        if (!url.includes('#screen-preview') && win.isVisible()) {
          console.log('[main/index.ts] Hiding window:', url)
          hiddenWindowsBeforeScreenshot.add(win.id)
          win.hide()
        }
      }
    }

    createSelectionWindow()
  })

  function endScreenshotSession() {
    if (!isScreenshotInProgress) return
    isScreenshotInProgress = false

    console.log('[main/index.ts] Ending screenshot session.')

    if (selectionWindow) {
      selectionWindow.close()
      selectionWindow = null
    }

    // Restore visibility of windows that were hidden for screenshot
    console.log('[main/index.ts] Restoring visibility of hidden windows')
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && hiddenWindowsBeforeScreenshot.has(win.id)) {
        console.log('[main/index.ts] Showing window:', win.webContents.getURL())
        win.show()
        // Focus the main window if it was hidden
        if (win === mainWindow) {
          win.focus()
        }
      }
    }
    hiddenWindowsBeforeScreenshot.clear()

    console.log(
      `[main/index.ts] Restoring content protection to user setting: ${isContentProtectionEnabled}`
    )
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        const url = win.webContents.getURL()
        if (url.includes('#screen-preview')) {
          win.setContentProtection(false)
        } else {
          win.setContentProtection(isContentProtectionEnabled)
        }
      }
    }
  }

  ipcMain.on('electronAPI:captureArea', async (event, bounds) => {
    try {
      console.log('[main/index.ts] Screenshot capture started with bounds:', bounds)
      let targetDisplay = null

      // 1. Prioritize the display where the main window is currently located
      // This ensures screenshot captures from the same display as the selection mask
      if (mainWindow && !mainWindow.isDestroyed()) {
        targetDisplay = screen.getDisplayMatching(mainWindow.getBounds())
        console.log('[main/index.ts] Using display where main window is located:', targetDisplay.id)
      }

      // 2. Fallback to primary display if main window is not available
      if (!targetDisplay) {
        targetDisplay = screen.getPrimaryDisplay()
        console.log('[main/index.ts] Falling back to primary display')
      }

      const { width, height } = targetDisplay.bounds
      const scaleFactor = targetDisplay.scaleFactor

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(width * scaleFactor),
          height: Math.round(height * scaleFactor)
        }
      })

      const source = sources.find((s) => s.display_id === String(targetDisplay.id))
      if (!source) throw new Error('Target screen source not found for screenshot')

      // Use user data directory for screenshots (works in both dev and production)
      const screenshotsDir = path.join(app.getPath('userData'), 'screenshots')
      await fs.mkdir(screenshotsDir, { recursive: true })
      console.log('[main/index.ts] Screenshots directory created/verified:', screenshotsDir)

      const timestamp = Date.now()
      const screenshotPath = path.join(screenshotsDir, `screenshot-${timestamp}.png`)
      console.log('[main/index.ts] Saving screenshot to:', screenshotPath)

      const captureBounds = {
        x: Math.round(bounds.x * scaleFactor),
        y: Math.round(bounds.y * scaleFactor),
        width: Math.round(bounds.width * scaleFactor),
        height: Math.round(bounds.height * scaleFactor)
      }

      if (process.platform === 'darwin') {
        captureBounds.y = captureBounds.y + 80
      }

      const image = source.thumbnail.crop(captureBounds).toPNG()
      await fs.writeFile(screenshotPath, image)
      console.log('[main/index.ts] Screenshot saved successfully, size:', image.length, 'bytes')

      // Read the file and convert to base64 for the renderer
      console.log('[main/index.ts] Converting screenshot to base64 for renderer')
      try {
        const imageBuffer = await fs.readFile(screenshotPath)
        const base64Data = `data:image/png;base64,${imageBuffer.toString('base64')}`
        console.log('[main/index.ts] Screenshot converted to base64, size:', base64Data.length)

        // Broadcast screenshot data (base64) to all windows
        console.log('[main/index.ts] Broadcasting screenshot base64 data to all windows')
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('electronAPI:screenshotTaken', base64Data)
          }
        }
      } catch (readError) {
        console.error('[main/index.ts] Error reading screenshot file:', readError)
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('electronAPI:screenshotError', 'Failed to read screenshot file')
          }
        }
      }
    } catch (error: any) {
      console.error('[main/index.ts] Screenshot capture error:', error)
      // Broadcast error to all windows
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('electronAPI:screenshotError', error.message)
        }
      }
    } finally {
      endScreenshotSession()
    }
  })

  ipcMain.on('electronAPI:cancelScreenshot', () => {
    endScreenshotSession()
  })

  // Note: History viewer has been integrated into the settings window.
  // The old Express server and separate Next.js app have been removed.

  if (process.platform !== 'darwin' && gotTheLock) {
    const cmdLineUrl = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (cmdLineUrl) {
      console.log(
        `[main.js app.ready] Initial command line OAuth URL for Windows/Linux: ${cmdLineUrl}`
      )
      oauthCallbackUrlOnStartup = cmdLineUrl
    }
  }

  // Database IPC handlers
  ipcMain.handle('db:create-session', (event, session) => {
    console.log('[main] db:create-session received for id:', session.id)
    return dbService.createSession(session)
  })
  ipcMain.handle('db:add-transcript', (event, transcript) => dbService.addTranscript(transcript))
  ipcMain.handle('db:add-enhanced-transcript', (event, transcript) =>
    dbService.addEnhancedTranscript(transcript)
  )
  ipcMain.handle('db:update-transcript-enhancement', (event, { transcriptId, enhancementData }) =>
    dbService.updateTranscriptEnhancement(transcriptId, enhancementData)
  )
  ipcMain.handle('db:update-transcript-enhancement-status', (event, { transcriptId, status }) =>
    dbService.updateTranscriptEnhancementStatus(transcriptId, status)
  )
  ipcMain.handle('db:get-transcript-by-id', (event, transcriptId) =>
    dbService.getTranscriptById(transcriptId)
  )
  ipcMain.handle('db:get-sessions', () => dbService.getSessions())
  ipcMain.handle('db:get-transcripts', (event, { sessionId, page, limit }) =>
    dbService.getTranscripts(sessionId, page, limit)
  )
  ipcMain.handle('db:get-enhanced-transcripts', (event, { sessionId, page, limit }) =>
    dbService.getEnhancedTranscripts(sessionId, page, limit)
  )
  ipcMain.handle('db:get-all-transcripts', (event, sessionId) =>
    dbService.getAllTranscripts(sessionId)
  )
  ipcMain.handle('db:end-session', (event, sessionId) => dbService.endSession(sessionId))
  ipcMain.handle('db:get-summary', (event, sessionId) => dbService.getSummary(sessionId))
  ipcMain.handle('db:save-summary', (event, summary) => dbService.saveSummary(summary))
  ipcMain.handle('db:get-sessions-with-transcripts', (event, { limit, offset }) =>
    dbService.getSessionsWithTranscripts(limit, offset)
  )
  ipcMain.handle('db:get-total-session-count', () =>
    dbService.getTotalSessionCount()
  )
  ipcMain.handle('db:export-session', (event, { sessionId, locale, timezone }) =>
    dbService.exportSession(sessionId, locale, timezone)
  )
  ipcMain.handle('db:delete-session', async (event, sessionId) => {
    const result = await dbService.deleteSession(sessionId)

    if (result.success) {
      // Broadcast session deletion to all windows so they can refresh their history views
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('session:deleted', sessionId)
        }
      }
      console.log(`[main/index.ts] Broadcasted session deletion: ${sessionId}`)
    }

    return result
  })
  ipcMain.handle('db:get-all-session-dates', () => dbService.getAllSessionDates())

  // Local transcription IPC handlers
  ipcMain.handle('transcription:initialize', async () => {
    try {
      console.log('[main/index.ts] Starting transcription initialization...')

      const transcriptionService = getWhisperBackend()
      console.log('[main/index.ts] Got transcription service instance')

      const initialized = await transcriptionService.initialize()
      console.log('[main/index.ts] Transcription service initialization result:', initialized)

      if (!initialized) {
        const result = {
          success: false,
          error: 'WhisperBackend.initialize() returned false - check binary or model availability'
        }
        console.log('[main/index.ts] Returning failure result:', result)
        return result
      }

      const result = { success: true }
      console.log('[main/index.ts] Returning success result:', result)
      return result
    } catch (error) {
      console.error('[main/index.ts] Failed to initialize local transcription:', error)
      const errorResult = { success: false, error: error?.message || 'Unknown error' }
      console.log('[main/index.ts] Returning error result:', errorResult)
      return errorResult
    }
  })

  ipcMain.handle('transcription:process-audio', async (event, { audioBuffer, options }) => {
    try {
      const transcriptionService = getWhisperBackend()
      // Pass sessionId and timestamp for enhancement triggering
      const result = await transcriptionService.transcribeAudio(
        audioBuffer,
        options,
        currentSessionId,
        Date.now()
      )

      console.log(
        `[main/index.ts] Local transcription completed: "${result.text}" (${result.processingTime}ms)`
      )
      return { success: true, result }
    } catch (error) {
      console.error('[main/index.ts] Local transcription failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('transcription:get-models', async () => {
    try {
      const transcriptionService = getWhisperBackend()
      const models = await transcriptionService.getAvailableModels()
      return { success: true, models }
    } catch (error) {
      console.error('[main/index.ts] Failed to get models:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('transcription:download-model', async (event, modelName) => {
    try {
      const transcriptionService = getWhisperBackend()
      const success = await transcriptionService.downloadModel(modelName)
      return { success }
    } catch (error) {
      console.error(`[main/index.ts] Failed to download model ${modelName}:`, error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('transcription:delete-model', async (event, modelName) => {
    try {
      const transcriptionService = getWhisperBackend()
      const success = await transcriptionService.deleteModel(modelName)
      return { success }
    } catch (error) {
      console.error(`[main/index.ts] Failed to delete model ${modelName}:`, error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('transcription:get-storage-usage', async () => {
    try {
      const transcriptionService = getWhisperBackend()
      const usage = await transcriptionService.getStorageUsage()
      return { success: true, usage }
    } catch (error) {
      console.error('[main/index.ts] Failed to get storage usage:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('transcription:ensure-model-available', async (event) => {
    try {
      const transcriptionService = getWhisperBackend()

      const success = await transcriptionService.ensureModelAvailable((modelName, progress) => {
        // Send progress updates to the renderer process
        event.sender.send('transcription:model-download-progress', { modelName, progress })
      })

      return { success }
    } catch (error) {
      console.error('[main/index.ts] Failed to ensure model availability:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('transcription:get-diagnostics', async () => {
    try {
      const path = require('path')
      const fs = require('fs/promises')
      const { app } = require('electron')

      const platform = process.platform
      const arch = process.arch
      let binaryName = 'whisper'
      if (platform === 'win32') {
        binaryName = 'whisper.exe'
      }

      const isDev = !app.isPackaged
      const resourcesPath = isDev
        ? path.join(__dirname, '../../resources')
        : path.join(process.resourcesPath, 'resources')

      const whisperBinaryPath = path.join(
        resourcesPath,
        'whisper.cpp',
        `${binaryName}-${platform}-${arch}`
      )
      const modelsPath = path.join(app.getPath('userData'), 'whisper-models')
      const bundledModelPath = path.join(resourcesPath, 'whisper.cpp', 'models', 'ggml-tiny.bin')

      const diagnostics = {
        platform,
        arch,
        isDev,
        resourcesPath,
        whisperBinaryPath,
        modelsPath,
        bundledModelPath,
        binaryExists: false,
        binaryExecutable: false,
        binarySize: 0,
        bundledModelExists: false,
        bundledModelSize: 0
      }

      try {
        await fs.access(whisperBinaryPath, fs.constants.F_OK)
        diagnostics.binaryExists = true
        const binaryStats = await fs.stat(whisperBinaryPath)
        diagnostics.binarySize = binaryStats.size

        try {
          await fs.access(whisperBinaryPath, fs.constants.X_OK)
          diagnostics.binaryExecutable = true
        } catch {}
      } catch {}

      try {
        await fs.access(bundledModelPath, fs.constants.F_OK)
        diagnostics.bundledModelExists = true
        const modelStats = await fs.stat(bundledModelPath)
        diagnostics.bundledModelSize = modelStats.size
      } catch {}

      return { success: true, diagnostics }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Transcription enhancement setup handler
  // Enhancement now happens inline in transcription:data handler (real-time, no batch)
  // This handler initializes Ollama connection + IntentionProcessor for auto-trigger
  ipcMain.handle(
    'transcription:setup-enhancement',
    async () => {
      try {
        // Clean up old event listeners to prevent duplicates
        console.log(
          `[main/index.ts] Cleaning up ${enhancementEventCleanups.length} old enhancement event listeners`
        )
        enhancementEventCleanups.forEach((cleanup) => cleanup())
        enhancementEventCleanups = []

        // Initialize Ollama service, restore persisted model, and check connection
        const ollamaService = getOllamaService()
        const enhancementSettings = await loadSettings()
        if (enhancementSettings.ollamaModel) {
          ollamaService.setActiveModel(enhancementSettings.ollamaModel)
        }
        await ollamaService.checkConnection()
        ollamaService.startConnectionMonitoring()

        // Initialize IntentionProcessor with current settings for auto-trigger
        const settings = await loadSettings()
        const intentionProcessor = getIntentionProcessor(settings.autoTrigger)
        intentionProcessor.setSessionId(analyticsSessionId)

        // Clear existing listeners to prevent duplicates
        intentionProcessor.removeAllListeners('actionTriggered')
        console.log('[main/index.ts] Cleared all existing IntentionProcessor listeners')

        // Listen for triggered actions from IntentionProcessor
        const actionTriggeredHandler = (pendingAction) => {
          console.log('[main/index.ts] Action triggered by IntentionProcessor:', pendingAction.actionType)

          recentPendingActions.push({...pendingAction, timestamp: Date.now()})
          const twoSecondsAgo = Date.now() - 2000
          recentPendingActions = recentPendingActions.filter(a => a.timestamp > twoSecondsAgo)

          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send('auto-trigger:action-triggered', pendingAction)
            }
          }
        }

        intentionProcessor.on('actionTriggered', actionTriggeredHandler)
        console.log('[main/index.ts] Added IntentionProcessor actionTriggered listener')

        enhancementEventCleanups.push(() => {
          intentionProcessor.off('actionTriggered', actionTriggeredHandler)
          console.log('[main/index.ts] Removed IntentionProcessor actionTriggered listener')
        })

        console.log('[main/index.ts] Enhancement setup complete (real-time mode)')
        return { success: true }
      } catch (error) {
        console.error('[main/index.ts] Failed to setup transcription enhancement:', error)
        return { success: false, error: error.message }
      }
    }
  )

  // Ollama management IPC handlers
  ipcMain.handle('ollama:get-status', async () => {
    const ollamaService = getOllamaService()
    return {
      status: ollamaService.getStatus(),
      activeModel: ollamaService.getActiveModel()
    }
  })

  ipcMain.handle('ollama:get-models', async () => {
    const ollamaService = getOllamaService()
    return await ollamaService.getModels()
  })

  ipcMain.handle('ollama:pull-model', async (event, modelName: string) => {
    const ollamaService = getOllamaService()

    // Forward pull progress to renderer
    const progressHandler = (data: any) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('ollama:pull-progress', data)
        }
      }
    }
    ollamaService.on('pullProgress', progressHandler)

    try {
      const success = await ollamaService.pullModel(modelName)
      return { success }
    } finally {
      ollamaService.off('pullProgress', progressHandler)
    }
  })

  ipcMain.handle('ollama:set-model', async (event, modelName: string) => {
    const ollamaService = getOllamaService()
    ollamaService.setActiveModel(modelName)
    await ollamaService.checkConnection()
    // Persist model selection to settings
    const currentSettings = await loadSettings()
    await saveSettings({ ...currentSettings, ollamaModel: modelName })
    return { success: true }
  })

  ipcMain.handle('ollama:delete-model', async (event, modelName: string) => {
    const ollamaService = getOllamaService()
    const success = await ollamaService.deleteModel(modelName)
    return { success }
  })

  ipcMain.handle('ollama:check-connection', async () => {
    const ollamaService = getOllamaService()
    const connected = await ollamaService.checkConnection()
    return { connected, status: ollamaService.getStatus() }
  })

  // Forward Ollama status changes to renderer
  const ollamaService = getOllamaService()
  ollamaService.on('statusChanged', (data) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('ollama:status-changed', data)
      }
    }
  })

  // ─── AI Action IPC Handlers (Local Ollama) ───

  ipcMain.handle('ai:chat', async (_event, payload: {
    text_input: string
    existing_summary?: string
    recent_transcriptions?: string
    language?: string
  }) => {
    const svc = getOllamaService()
    if (svc.getStatus() !== 'ready') {
      throw new Error('Ollama is not ready. Please check AI Models settings.')
    }
    const prompt = getChatPrompt({
      textInput: payload.text_input,
      existingSummary: payload.existing_summary,
      recentTranscriptions: payload.recent_transcriptions,
      language: payload.language || 'en'
    })
    const result = await svc.chat({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.7
    })
    return { response: result.content, processingTime: result.processingTime }
  })

  ipcMain.handle('ai:summarize', async (_event, payload: {
    text_input: string
    existing_summary?: string
    language?: string
  }) => {
    const svc = getOllamaService()
    if (svc.getStatus() !== 'ready') {
      throw new Error('Ollama is not ready. Please check AI Models settings.')
    }
    const prompt = getSummarizePrompt({
      textInput: payload.text_input,
      existingSummary: payload.existing_summary,
      language: payload.language || 'en'
    })
    const result = await svc.chat({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      format: getSummarizeJsonSchema(),
      temperature: 0.3
    })
    try {
      const parsed = JSON.parse(result.content)
      return {
        summary: parsed.long_summary,
        short_summary: parsed.short_summary,
        long_summary: parsed.long_summary,
        context: parsed.context,
        processingTime: result.processingTime
      }
    } catch {
      // If JSON parsing fails, return raw content as summary
      return {
        summary: result.content,
        short_summary: result.content.substring(0, 100),
        long_summary: result.content,
        context: {},
        processingTime: result.processingTime
      }
    }
  })

  ipcMain.handle('ai:recommend-response', async (_event, payload: {
    text_input: string
    existing_summary?: string
    recent_transcriptions?: string
    language?: string
  }) => {
    const svc = getOllamaService()
    if (svc.getStatus() !== 'ready') {
      throw new Error('Ollama is not ready. Please check AI Models settings.')
    }
    const prompt = getRecommendResponsePrompt({
      textInput: payload.text_input,
      existingSummary: payload.existing_summary,
      recentTranscriptions: payload.recent_transcriptions,
      language: payload.language || 'en'
    })
    const result = await svc.chat({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.7
    })
    return { recommendation: result.content, processingTime: result.processingTime }
  })

  ipcMain.handle('ai:deep-response', async (_event, payload: {
    text_input: string
    existing_summary?: string
    recent_transcriptions?: string
    language?: string
  }) => {
    const svc = getOllamaService()
    if (svc.getStatus() !== 'ready') {
      throw new Error('Ollama is not ready. Please check AI Models settings.')
    }
    const prompt = getDeepResponsePrompt({
      textInput: payload.text_input,
      existingSummary: payload.existing_summary,
      recentTranscriptions: payload.recent_transcriptions,
      language: payload.language || 'en'
    })
    const result = await svc.chat({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.7
    })
    return { recommendation: result.content, processingTime: result.processingTime }
  })

  ipcMain.handle('ai:keyword-search', async (_event, payload: {
    text_input: string
    existing_summary?: string
    recent_transcriptions?: string
    language?: string
  }) => {
    const svc = getOllamaService()
    if (svc.getStatus() !== 'ready') {
      throw new Error('Ollama is not ready. Please check AI Models settings.')
    }
    const prompt = getKeywordSearchPrompt({
      textInput: payload.text_input,
      existingSummary: payload.existing_summary,
      recentTranscriptions: payload.recent_transcriptions,
      language: payload.language || 'en'
    })
    const result = await svc.chat({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.5
    })
    return { response: result.content, processingTime: result.processingTime }
  })

  ipcMain.handle('ai:screenshot-analysis', async (_event, payload: {
    text_input: string
    image_input?: string
    existing_summary?: string
    recent_transcriptions?: string
    language?: string
  }) => {
    const svc = getOllamaService()
    if (svc.getStatus() !== 'ready') {
      throw new Error('Ollama is not ready. Please check AI Models settings.')
    }
    const prompt = getScreenshotAnalysisPrompt({
      textInput: payload.text_input,
      existingSummary: payload.existing_summary,
      recentTranscriptions: payload.recent_transcriptions,
      language: payload.language || 'en'
    })

    // Build messages with optional image for multimodal
    const messages: Array<{ role: string; content: string; images?: string[] }> = [
      { role: 'system', content: prompt.system }
    ]

    if (payload.image_input) {
      // Ollama expects base64 image data without the data URL prefix
      const base64Image = payload.image_input.replace(/^data:image\/\w+;base64,/, '')
      messages.push({
        role: 'user',
        content: prompt.user,
        images: [base64Image]
      })
    } else {
      messages.push({ role: 'user', content: prompt.user })
    }

    const result = await svc.chat({
      messages,
      temperature: 0.5
    })
    return { analysis: result.content, processingTime: result.processingTime }
  })

  ipcMain.on('app:resize-window', (event, { width, height }) => {
    if (mainWindow) {
      const [currentWidth, currentHeight] = mainWindow.getSize()
      const newWidth = width || currentWidth
      const newHeight = height || currentHeight
      mainWindow.setSize(newWidth, newHeight, true) // Animate the resize
    }
  })

  ipcMain.on('keyword:click', (event, keyword: string) => {
    console.log(`[main/index.ts] Keyword clicked: ${keyword}. Broadcasting to all windows.`)
    pendingKeyword = { keyword, timestamp: Date.now() }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('keyword:search', keyword)
      }
    }
  })

  ipcMain.handle('popover:consume-pending-keyword', () => {
    // Consume the keyword only if it's very recent, to avoid stale state.
    if (pendingKeyword && Date.now() - pendingKeyword.timestamp < 2000) {
      const keywordToReturn = pendingKeyword.keyword
      pendingKeyword = null // Consume it
      return keywordToReturn
    }
    return null
  })

  // Retrieve pending actions for newly opened popovers (race condition fix)
  ipcMain.handle('popover:consume-pending-actions', () => {
    // Return recent actions (within last 2 seconds) and clear the cache
    const now = Date.now()
    const recentActions = recentPendingActions.filter(a => (now - a.timestamp) < 2000)
    console.log(`[main/index.ts] Popover requested pending actions, returning ${recentActions.length} actions`)
    // Clear the cache after consuming
    recentPendingActions = []
    return recentActions
  })

  ipcMain.on('audio:level-update', (event, levels) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('audio:levels-updated', levels)
      }
    }
  })

  // AI action triggers - broadcast to all windows
  ipcMain.on('ai-action:trigger-recommend-response', () => {
    console.log('[main/index.ts] Broadcasting ai-action:recommend-response to all windows')
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('ai-action:recommend-response')
      }
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let isQuitting = false

// Gracefully handle quit-time errors
app.on('before-quit', () => {
  isQuitting = true
})

process.on('uncaughtException', (error) => {
  // Suppress the "Object has been destroyed" error on quit.
  // This is a known race condition in Electron apps where an async operation
  // tries to access a window that has already been closed during shutdown.
  if (isQuitting && error.message.includes('Object has been destroyed')) {
    console.error('[main/index.ts] Suppressing known quit-time error:', error)
    // Returning here prevents the default behavior of showing a dialog.
    return
  }
  // For any other uncaught exception, we should probably still show it.
  console.error('[main/index.ts] Uncaught Exception:', error)
})

app.on('will-quit', async () => {
  globalShortcut.unregisterAll()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
