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
import { dbPromise } from './database'
import { installExtension, REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer'
import { is } from '@electron-toolkit/utils'
import express from 'express'
import cors from 'cors'

let mainWindow: BrowserWindow | null
let selectionWindow: BrowserWindow | null

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

let pendingMediaRequest: ((...args: any[]) => void) | null = null
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
  mainWindow = new BrowserWindow({
    width: 480,
    height: 400,
    frame: false,
    transparent: true,
    vibrancy: 'fullscreen-ui',
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('electronAPI:forceDarkMode')
    if (oauthCallbackUrlOnStartup) {
      mainWindow?.webContents.send('electronAPI:oauth-callback', oauthCallbackUrlOnStartup)
      oauthCallbackUrlOnStartup = null
    }
  })

  mainWindow.setContentProtection(true)

  if (is.dev) {
    const devServerUrl = import.meta.env['VITE_DEV_SERVER_URL']
    if (devServerUrl) {
      mainWindow.loadURL(devServerUrl)
    } else {
      // Fallback to a default port if the env var is not set
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
    pendingMediaRequest = null
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
  if (is.dev) {
    await installExtension(REACT_DEVELOPER_TOOLS).catch(console.log)
  }
  nativeTheme.themeSource = 'dark'

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

  const db = await dbPromise

  globalShortcut.register('CommandOrControl+K', toggleWindow)

  ipcMain.handle('supabase:signInWithOAuth', async (event, provider) => {
    if (provider.urlToOpen) {
      await shell.openExternal(provider.urlToOpen)
      return { success: true }
    }
    return { error: 'No URL provided' }
  })

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    pendingMediaRequest = callback
    desktopCapturer
      .getSources({ types: ['window', 'screen'] })
      .then(async (sources) => {
        mainWindow?.webContents.send(
          'electronAPI:availableSources',
          sources.map((s) => ({ id: s.id, name: s.name }))
        )
      })
      .catch(console.error)
  })

  ipcMain.handle('electronAPI:selectSource', (event, sourceId) => {
    if (pendingMediaRequest) {
      desktopCapturer
        .getSources({ types: ['window', 'screen'] })
        .then((sources) => {
          const selectedSource = sources.find((s) => s.id === sourceId)
          if (selectedSource) {
            try {
              pendingMediaRequest?.({ video: selectedSource, audio: 'loopback' })
            } catch (error) {
              console.error('Error granting access to source:', error)
            }
          }
          pendingMediaRequest = null
        })
        .catch(console.error)
    }
  })

  ipcMain.handle('electronAPI:cancelSourceSelection', () => {
    if (pendingMediaRequest) {
      pendingMediaRequest = null
    }
  })

  ipcMain.on('electronAPI:openExternal', (event, url) => {
    shell.openExternal(url)
  })

  ipcMain.on('electronAPI:minimizeWindow', () => mainWindow?.minimize())
  ipcMain.on('electronAPI:closeWindow', () => mainWindow?.close())
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
      if (address) {
        const url = `http://localhost:${address.port}`
        shell.openExternal(url)
      }
      return
    }

    const historyViewerApp = express()
    historyViewerApp.use(cors())
    const apiRouter = express.Router()

    apiRouter.get('/sessions', async (req, res) => {
      console.log('[History API] GET /api/sessions endpoint hit')
      try {
        const stmt = await db.prepare('SELECT * FROM sessions ORDER BY started_at DESC')
        const sessions = await stmt.all()
        console.log(`[History API] Found ${sessions.length} sessions.`)
        res.json(sessions)
      } catch (error) {
        console.error('[History API] Error fetching sessions:', error)
        res.status(500).json({ error: 'Failed to fetch sessions' })
      }
    })

    apiRouter.get('/sessions/:id/transcripts', async (req, res) => {
      console.log(`[History API] GET /api/sessions/${req.params.id}/transcripts endpoint hit`)
      try {
        const stmt = await db.prepare(
          'SELECT * FROM transcripts WHERE session_id = ? ORDER BY timestamp ASC'
        )
        const transcripts = await stmt.all(req.params.id)
        console.log(
          `[History API] Found ${transcripts.length} transcripts for session ${req.params.id}.`
        )
        res.json(transcripts)
      } catch (error) {
        console.error(
          `[History API] Error fetching transcripts for session ${req.params.id}:`,
          error
        )
        res.status(500).json({
          error: `Failed to fetch transcripts for session ${req.params.id}`
        })
      }
    })

    apiRouter.delete('/sessions/:id', async (req, res) => {
      console.log(`[History API] DELETE /api/sessions/${req.params.id} endpoint hit`)
      try {
        const deleteTranscriptsStmt = await db.prepare(
          'DELETE FROM transcripts WHERE session_id = ?'
        )
        await deleteTranscriptsStmt.run(req.params.id)
        const deleteSessionStmt = await db.prepare('DELETE FROM sessions WHERE id = ?')
        await deleteSessionStmt.run(req.params.id)
        console.log(`[History API] Deleted session ${req.params.id}.`)
        res.json({ success: true })
      } catch (error) {
        console.error(`[History API] Error deleting session ${req.params.id}:`, error)
        res.status(500).json({ error: `Failed to delete session ${req.params.id}` })
      }
    })

    historyViewerApp.use('/api', apiRouter)

    // Serve static files for history viewer in production
    const historyPath = path.join(__dirname, '../renderer/history')
    historyViewerApp.use(express.static(historyPath))

    // Fallback for SPA routing
    historyViewerApp.get('*', (req, res) => {
      res.sendFile(path.join(historyPath, 'index.html'))
    })

    return new Promise<boolean>((resolve) => {
      historyViewerServer = historyViewerApp.listen(4000, () => {
        console.log('History viewer server started on port 4000')
        const url = 'http://localhost:4000'
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
      oauthCallbackUrlOnStartup = cmdLineUrl // Store for did-finish-load
    }
  }

  // Database IPC handlers
  ipcMain.handle('db:create-session', async (event, session) => {
    const { id, started_at, status } = session
    const stmt = await db.prepare('INSERT INTO sessions (id, started_at, status) VALUES (?, ?, ?)')
    await stmt.run(id, started_at, status)
    return { id }
  })

  ipcMain.handle('db:add-transcript', async (event, transcript) => {
    const { id, session_id, timestamp, content } = transcript
    const stmt = await db.prepare(
      'INSERT INTO transcripts (id, session_id, timestamp, content) VALUES (?, ?, ?, ?)'
    )
    await stmt.run(id, session_id, timestamp, content)
    return { id }
  })

  ipcMain.handle('db:get-sessions', async () => {
    const stmt = await db.prepare('SELECT * FROM sessions ORDER BY started_at DESC')
    return await stmt.all()
  })

  ipcMain.handle('db:get-transcripts', async (event, sessionId) => {
    const stmt = await db.prepare(
      'SELECT * FROM transcripts WHERE session_id = ? ORDER BY timestamp ASC'
    )
    return await stmt.all(sessionId)
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
