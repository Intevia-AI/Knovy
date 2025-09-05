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
import fs from 'fs/promises'
import { installExtension, REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer'
import { is } from '@electron-toolkit/utils'
import express from 'express'
import cors from 'cors'
import * as dbService from './database-service'
import { createPopover, closePopover, closeAllPopovers } from './popoverManager'

console.log('[Debug] Imported dbService module:', dbService)

let isScreenSharing = false
let currentSessionId: string | null = null
let activeScreenSourceId: string | null = null
let mainWindow: BrowserWindow | null
let selectionWindow: BrowserWindow | null

// This is now the single source of truth for the main window.
// Other modules can get it from here if needed.
export const getMainWindow = (): BrowserWindow | null => mainWindow

ipcMain.handle('electronAPI:getMainWindowBounds', () => {
  return mainWindow?.getBounds()
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

ipcMain.handle('electronAPI:getActiveScreenSourceId', () => {
  return activeScreenSourceId
})

// Example of sending a message to a popover, remains the same.
ipcMain.on('popover:sendMessage', (event, { action, prompt }) => {
  // Forward the message to the main window's renderer process
  // so the useAIInteraction hook can handle it.
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log(`Forwarding message to main window: ${prompt}`)
    mainWindow.webContents.send('ai:custom-prompt', { action, prompt })
  }
})

const settingsPath = path.join(app.getPath('userData'), 'settings.json')

async function loadSettings() {
  try {
    await fs.access(settingsPath)
    const data = await fs.readFile(settingsPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.log('Settings file not found or error reading, returning defaults.')
    return { language: 'zh-TW', customPrompt: '' }
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
      if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) {
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
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.bounds
  const menuBarHeight = process.platform === 'darwin' ? -50 : 0

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
      selectionWindow.loadURL(`${devServerUrl}/selection.html`)
    } else {
      console.warn(
        'VITE_DEV_SERVER_URL is not set, falling back to http://localhost:5173 for selection window'
      )
      selectionWindow.loadURL('http://localhost:5173/selection.html')
    }
  } else {
    selectionWindow.loadFile(path.join(__dirname, '../renderer/selection.html'))
  }
  selectionWindow.setIgnoreMouseEvents(false)
}

const createWindow = async () => {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { height: screenHeight } = primaryDisplay.workAreaSize

  mainWindow = new BrowserWindow({
    width: 360,
    height: 50,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true, // Set always on top
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    x: 30, // Position at bottom-left
    y: screenHeight - 50 - 30, // Position at bottom-left with margin
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // mainWindow.setContentProtection(true)

  mainWindow.webContents.on('did-finish-load', () => {
    if (oauthCallbackUrlOnStartup) {
      mainWindow?.webContents.send('electronAPI:oauth-callback', oauthCallbackUrlOnStartup)
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

app.on('ready', async () => {
  console.log('[DB Path] User data path:', app.getPath('userData'))

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

  if (process.platform === 'darwin') {
    const screenStatus = systemPreferences.getMediaAccessStatus('screen')
    if (screenStatus === 'not-determined') {
      await systemPreferences.askForMediaAccess('screen').catch(console.error)
    }
  }

  await createWindow()

  globalShortcut.register("alt+'", toggleWindow)

  ipcMain.handle('supabase:signInWithOAuth', async (event, provider) => {
    if (provider.urlToOpen) {
      await shell.openExternal(provider.urlToOpen)
      return { success: true }
    }
    return { error: 'No URL provided' }
  })

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then(async (sources) => {
        const primaryDisplay = screen.getPrimaryDisplay()
        const primarySource = sources.find((s) => s.display_id === String(primaryDisplay.id))

        if (primarySource) {
          activeScreenSourceId = primarySource.id // Store the source ID
          callback({ video: primarySource, audio: 'loopback' })
        } else if (sources.length > 0) {
          console.warn(
            'Primary display source not found, falling back to the first available screen.'
          )
          activeScreenSourceId = sources[0].id // Store the source ID
          callback({ video: sources[0], audio: 'loopback' })
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

  ipcMain.on('window:center', () => {
    if (mainWindow) {
      mainWindow.center()
    }
  })

  ipcMain.on('window:move-to-bottom-left', () => {
    if (mainWindow) {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { height: screenHeight } = primaryDisplay.workAreaSize
      const y = screenHeight - mainWindow.getBounds().height + 10
      mainWindow.setPosition(30, y, true) // Animate the move
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
    return newSettings
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

  // IPC relay for transcription data
  ipcMain.on('transcription:data', (event, transcriptionContent: string) => {
    if (!currentSessionId) {
      console.warn('[main/index.ts] Received transcription data, but no active session. Ignoring.')
      return
    }

    // 1. Create the full transcript object
    const newTranscript = {
      id: `transcript-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      session_id: currentSessionId,
      timestamp: new Date().toISOString(),
      content: transcriptionContent,
      // Add role and type for consistency with the frontend's TranscriptionMessage type
      role: 'assistant',
      type: 'transcription'
    }

    // 2. Save to database
    dbService.addTranscript(newTranscript).catch((error) => {
      console.error('[main/index.ts] Failed to save transcript:', error)
    })

    // 3. Broadcast the full transcript object to all windows for real-time display
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('transcription:data', newTranscript)
      }
    }
  })

  ipcMain.on('electronAPI:startScreenshot', () => createSelectionWindow())

  ipcMain.on('electronAPI:captureArea', async (event, bounds) => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height } = primaryDisplay.bounds
      const scaleFactor = primaryDisplay.scaleFactor

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: width * scaleFactor, height: height * scaleFactor }
      })

      const source = sources[0]
      if (!source) throw new Error('Screen not found')

      const screenshotsDir = path.join(__dirname, '../../renderer/public/screenshots')
      await fs.mkdir(screenshotsDir, { recursive: true })

      const timestamp = Date.now()
      const screenshotPath = path.join(screenshotsDir, `screenshot-${timestamp}.png`)

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

      if (selectionWindow) {
        selectionWindow.close()
      }

      const relativePath = `/screenshots/screenshot-${timestamp}.png`
      mainWindow?.webContents.send('electronAPI:screenshotTaken', relativePath)
    } catch (error: any) {
      mainWindow?.webContents.send('electronAPI:screenshotError', error.message)
    }
  })

  ipcMain.on('electronAPI:cancelScreenshot', () => {
    if (selectionWindow) {
      selectionWindow.close()
    }
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
        res.json(transcripts)
      } catch (error) {
        console.error(
          `[History API] Error fetching transcripts for session ${req.params.id}`,
          error
        )
        res.status(500).json({ error: `Failed to fetch transcripts for session ${req.params.id}` })
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
  ipcMain.handle('db:get-transcripts', (event, sessionId) => dbService.getTranscripts(sessionId))
  ipcMain.handle('db:end-session', (event, sessionId) => dbService.endSession(sessionId))

  ipcMain.on('app:resize-window', (event, { width, height }) => {
    if (mainWindow) {
      const [currentWidth, currentHeight] = mainWindow.getSize()
      const newWidth = width || currentWidth
      const newHeight = height || currentHeight
      mainWindow.setSize(newWidth, newHeight, true) // Animate the resize
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
