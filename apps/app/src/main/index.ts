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
  nativeTheme
} from 'electron'
import path from 'path'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import { installExtension, REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer'
import { is } from '@electron-toolkit/utils'
import express from 'express'
import cors from 'cors'
import * as dbService from './databaseService'
import {
  createPopover,
  closePopover,
  closeAllPopovers,
  forceClosePopover,
  resizePopover
} from './popoverManager'
import { positionWindow, type PositionOptions } from './windowManager'
import electronUpdater, { type AppUpdater } from 'electron-updater'
import { getWhisperBackend } from './whisperBackend'

console.log('[Debug] Imported dbService module:', dbService)

let isScreenSharing = false
let cachedSessionProfile: any | null = null
let currentSessionId: string | null = null
let activeScreenSourceId: string | null = null
let mainWindow: BrowserWindow | null
let selectionWindow: BrowserWindow | null

let isContentProtectionEnabled = false
let isScreenshotInProgress = false

let pendingKeyword: { keyword: string; timestamp: number } | null = null

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
})

ipcMain.handle('session:clear-profile', () => {
  cachedSessionProfile = null
  console.log('[main/index.ts] Session profile cache cleared.')
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
    return {
      language: 'zh-TW',
      customPrompt: '',
      contentProtection: false,
      ...parsed
    }
  } catch (error) {
    console.log('Settings file not found or error reading, returning defaults.')
    return { language: 'zh-TW', customPrompt: '', contentProtection: false }
  }
}

async function saveSettings(settings: any) {
  try {
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
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.bounds
  const menuBarHeight = process.platform === 'darwin' ? -50 : 0
  console.log('[main/index.ts] Primary display bounds:', { width, height, menuBarHeight })

  selectionWindow = new BrowserWindow({
    width: width,
    height: height + menuBarHeight,
    x: 0,
    y: menuBarHeight,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

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
    alwaysOnTop: false, // Start with false since we'll be doing loading/login first
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  positionWindow(mainWindow, { position: 'bottom-left', displayId: settings.displayId })

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

app.on('ready', async () => {
  console.log('[DB Path] User data path:', app.getPath('userData'))

  // Clean up screenshot cache on startup
  await cleanupScreenshotCache()

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

  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide()
  }

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
    getAutoUpdater().checkForUpdatesAndNotify()
  }

  globalShortcut.register("alt+'", toggleWindow)

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

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then(async (sources) => {
        const settings = await loadSettings()
        let targetSource = null

        // 1. Try to find source based on saved displayId
        if (settings.displayId) {
          const selectedDisplaySource = sources.find(
            (s) => s.display_id === String(settings.displayId)
          )
          if (selectedDisplaySource) {
            targetSource = selectedDisplaySource
            console.log(`[ScreenShare] Using saved display ID: ${settings.displayId}`)
          } else {
            console.warn(
              `[ScreenShare] Saved display ID ${settings.displayId} not found. Falling back.`
            )
          }
        }

        // 2. If no target yet, find source for the display where the main window is
        if (!targetSource && mainWindow) {
          const windowDisplay = screen.getDisplayMatching(mainWindow.getBounds())
          const windowSource = sources.find((s) => s.display_id === String(windowDisplay.id))
          if (windowSource) {
            targetSource = windowSource
            console.log(
              `[ScreenShare] Using display where main window is located: ${windowDisplay.id}`
            )
          }
        }

        // 3. If no target yet, fallback to primary display
        if (!targetSource) {
          const primaryDisplay = screen.getPrimaryDisplay()
          const primarySource = sources.find((s) => s.display_id === String(primaryDisplay.id))
          if (primarySource) {
            targetSource = primarySource
            console.log(`[ScreenShare] Falling back to primary display.`)
          }
        }

        // 4. If still no target, fallback to first available source
        if (!targetSource && sources.length > 0) {
          targetSource = sources[0]
          console.warn('[ScreenShare] Falling back to first available screen source.')
        }

        if (targetSource) {
          activeScreenSourceId = targetSource.id // Store the source ID
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
    }
  })
  ipcMain.on('electronAPI:toggleAlwaysOnTop', (event, isAlwaysOnTop) => {
    mainWindow?.setAlwaysOnTop(isAlwaysOnTop)
    event.reply('electronAPI:alwaysOnTopChanged', mainWindow?.isAlwaysOnTop())
  })
  ipcMain.handle('electronAPI:getInitialAlwaysOnTop', () => mainWindow?.isAlwaysOnTop() ?? false)
  ipcMain.handle('electronAPI:getSettings', async () => loadSettings())
  ipcMain.handle('electronAPI:setSettings', async (event, settingsToUpdate) => {
    const currentSettings = await loadSettings()
    const newSettings = { ...currentSettings, ...settingsToUpdate }
    await saveSettings(newSettings)

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

  // IPC relay for transcription data with enhanced error handling
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
        // 1. Create the full transcript object for display (with keywords)
        const transcriptId = randomUUID()
        const displayTranscript = {
          id: transcriptId,
          session_id: currentSessionId,
          timestamp: new Date().toISOString(),
          content: transcriptionData.text,
          sourceType: transcriptionData.sourceType,
          // Add role and type for consistency with the frontend's TranscriptionMessage type
          role: 'assistant',
          type: 'transcription'
        }

        // 2. Create a clean version for database storage (remove backticks)
        const cleanContent = transcriptionData.text.replace(/`([^`]*)`/g, '$1')
        const dbTranscript = {
          ...displayTranscript,
          content: cleanContent
        }

        // 3. Save clean version to database with proper error handling
        try {
          await dbService.addTranscript(dbTranscript)
          console.log(`[main/index.ts] Successfully saved transcript ${transcriptId} to database`)
        } catch (dbError) {
          console.error(`[main/index.ts] Failed to save transcript ${transcriptId} to database:`, dbError)
          // Continue with broadcast even if database save fails
          event.sender.send('transcription:warning', {
            warning: 'Failed to save transcription to database',
            transcriptId,
            error: dbError.message
          })
        }

        // 4. Broadcast the original version (with keywords) to all windows for real-time display
        const windows = BrowserWindow.getAllWindows()
        const validWindows = windows.filter(win => !win.isDestroyed())

        console.log(`[main/index.ts] Broadcasting transcript ${transcriptId} to ${validWindows.length} windows`)

        let broadcastSuccessCount = 0
        const broadcastPromises = validWindows.map(async (win, index) => {
          try {
            // Use a promise-based approach to track broadcast success
            return new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error(`Broadcast timeout for window ${index}`))
              }, 2000) // 2 second timeout per window

              try {
                win.webContents.send('transcription:data', displayTranscript)
                broadcastSuccessCount++
                clearTimeout(timeout)
                resolve()
              } catch (sendError) {
                clearTimeout(timeout)
                reject(sendError)
              }
            })
          } catch (error) {
            console.warn(`[main/index.ts] Failed to broadcast to window ${index}:`, error)
            throw error
          }
        })

        // Wait for all broadcasts with timeout
        try {
          await Promise.allSettled(broadcastPromises)
          console.log(`[main/index.ts] Broadcast completed for transcript ${transcriptId}. Success: ${broadcastSuccessCount}/${validWindows.length}`)

          // Send confirmation back to sender
          event.sender.send('transcription:processed', {
            transcriptId,
            broadcastCount: broadcastSuccessCount,
            totalWindows: validWindows.length
          })
        } catch (broadcastError) {
          console.error(`[main/index.ts] Broadcast errors for transcript ${transcriptId}:`, broadcastError)
        }

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
      const settings = await loadSettings()
      const displays = screen.getAllDisplays()
      let targetDisplay = null

      // 1. Find target display from settings
      if (settings.displayId) {
        targetDisplay = displays.find((d) => d.id === settings.displayId)
      }

      // 2. If not found, find display where window is
      if (!targetDisplay && mainWindow) {
        targetDisplay = screen.getDisplayMatching(mainWindow.getBounds())
      }

      // 3. Fallback to primary
      if (!targetDisplay) {
        targetDisplay = screen.getPrimaryDisplay()
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
  let historyViewerServer

  ipcMain.on('history:open', async () => {
    await startHistoryViewerServer()
  })

  async function startHistoryViewerServer() {
    if (historyViewerServer) {
      const address = historyViewerServer.address()
      if (address && typeof address === 'object') {
        const url = is.dev ? 'http://localhost:3000' : `http://localhost:${address.port}`
        shell.openExternal(url)
      }
      return
    }

    const historyViewerApp = express()
    historyViewerApp.use(cors())
    const apiRouter = express.Router()

    apiRouter.get('/sessions', async (req, res) => {
      try {
        const sessions = await dbService.getSessions()
        res.json(sessions)
      } catch (error) {
        console.error('[History API] Error fetching sessions:', error)
        res.status(500).json({ error: 'Failed to fetch sessions' })
      }
    })

    apiRouter.get('/sessions/:id/transcripts', async (req, res) => {
      try {
        const transcripts = await dbService.getTranscripts(req.params.id)
        if (!transcripts || transcripts.length === 0) {
          return res.status(404).json({
            error: 'No transcripts found for this session',
            code: 'TRANSCRIPTS_NOT_FOUND'
          })
        }
        res.json(transcripts)
      } catch (error) {
        console.error(
          `[History API] Error fetching transcripts for session ${req.params.id}`,
          error
        )
        res.status(500).json({
          error: `Failed to fetch transcripts for session ${req.params.id}`,
          code: 'INTERNAL_ERROR'
        })
      }
    })

    apiRouter.get('/sessions/:id/summary', async (req, res) => {
      try {
        const summary = await dbService.getSummary(req.params.id)
        if (!summary) {
          return res.status(404).json({
            error: 'No summary found for this session',
            code: 'SUMMARY_NOT_FOUND'
          })
        }
        res.json(summary)
      } catch (error) {
        console.error(`[History API] Error fetching summary for session ${req.params.id}`, error)
        res.status(500).json({
          error: `Failed to fetch summary for session ${req.params.id}`,
          code: 'INTERNAL_ERROR'
        })
      }
    })

    apiRouter.delete('/sessions/:id', async (req, res) => {
      try {
        await dbService.deleteSession(req.params.id)
        res.json({ success: true })
      } catch (error) {
        console.error(`[History API] Error deleting session ${req.params.id}:`, error)
        res.status(500).json({ error: `Failed to delete session ${req.params.id}` })
      }
    })

    historyViewerApp.use('/api', apiRouter)

    if (!is.dev) {
      const historyPath = path.join(__dirname, '../renderer/history')
      historyViewerApp.use(express.static(historyPath))
      historyViewerApp.get('*', (req, res) => {
        res.sendFile(path.join(historyPath, 'index.html'))
      })
    }

    return new Promise<boolean>((resolve) => {
      const port = 4000
      historyViewerServer = historyViewerApp.listen(port, () => {
        console.log(`History viewer API server started on port ${port}`)
        const url = is.dev ? 'http://localhost:3000' : `http://localhost:${port}`
        shell.openExternal(url)
        resolve(true)
      })
    })
  }

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
  ipcMain.handle('db:get-sessions', () => dbService.getSessions())
  ipcMain.handle('db:get-transcripts', (event, { sessionId, page, limit }) =>
    dbService.getTranscripts(sessionId, page, limit)
  )
  ipcMain.handle('db:get-all-transcripts', (event, sessionId) =>
    dbService.getAllTranscripts(sessionId)
  )
  ipcMain.handle('db:end-session', (event, sessionId) => dbService.endSession(sessionId))
  ipcMain.handle('db:get-summary', (event, sessionId) => dbService.getSummary(sessionId))
  ipcMain.handle('db:save-summary', (event, summary) => dbService.saveSummary(summary))

  // Local transcription IPC handlers
  ipcMain.handle('transcription:initialize', async () => {
    try {
      console.log('[main/index.ts] Starting transcription initialization...')

      const transcriptionService = getWhisperBackend()
      console.log('[main/index.ts] Got transcription service instance')

      const initialized = await transcriptionService.initialize()
      console.log('[main/index.ts] Transcription service initialization result:', initialized)

      if (!initialized) {
        const result = { success: false, error: 'WhisperBackend.initialize() returned false - check binary or model availability' }
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
      const result = await transcriptionService.transcribeAudio(audioBuffer, options)

      console.log(`[main/index.ts] Local transcription completed: "${result.text}" (${result.processingTime}ms)`)
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

      const whisperBinaryPath = path.join(resourcesPath, 'whisper.cpp', `${binaryName}-${platform}-${arch}`)
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

  ipcMain.on('audio:level-update', (event, levels) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('audio:levels-updated', levels)
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

  // Cleanup local transcription service
  try {
    const transcriptionService = getWhisperBackend()
    await transcriptionService.cleanup()
    console.log('[main/index.ts] Local transcription service cleanup completed')
  } catch (error) {
    console.error('[main/index.ts] Error during local transcription cleanup:', error)
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
