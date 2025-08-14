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
import isDev from 'electron-is-dev'

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
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    selectionWindow.loadURL(`${process.env['VITE_DEV_SERVER_URL']}/selection.html`)
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
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
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

  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL'])
    mainWindow.webContents.openDevTools()
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
  if (isDev) {
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
              pendingMediaRequest({ video: selectedSource, audio: 'loopback' })
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

  // Database IPC handlers
  ipcMain.handle('db:create-session', (event, session) => {
    const { id, started_at, status } = session
    const stmt = db.prepare('INSERT INTO sessions (id, started_at, status) VALUES (?, ?, ?)')
    stmt.run(id, started_at, status)
    return { id }
  })

  ipcMain.handle('db:add-transcript', (event, transcript) => {
    const { id, session_id, timestamp, content } = transcript
    const stmt = db.prepare(
      'INSERT INTO transcripts (id, session_id, timestamp, content) VALUES (?, ?, ?, ?)'
    )
    stmt.run(id, session_id, timestamp, content)
    return { id }
  })

  ipcMain.handle('db:get-sessions', () => {
    const stmt = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC')
    return stmt.all()
  })

  ipcMain.handle('db:get-transcripts', (event, sessionId) => {
    const stmt = db.prepare('SELECT * FROM transcripts WHERE session_id = ? ORDER BY timestamp ASC')
    return stmt.all(sessionId)
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
