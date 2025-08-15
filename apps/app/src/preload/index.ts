import { contextBridge, ipcRenderer } from 'electron'

console.log('[Preload] Script loaded.')

const api = {
  openExternal: (url: string) => ipcRenderer.send('electronAPI:openExternal', url),

  supabaseSignInWithOAuth: (provider) => ipcRenderer.invoke('supabase:signInWithOAuth', provider),

  selectSource: (sourceId) => ipcRenderer.invoke('electronAPI:selectSource', sourceId),

  cancelSourceSelection: () => ipcRenderer.invoke('electronAPI:cancelSourceSelection'),

  minimizeWindow: () => ipcRenderer.send('electronAPI:minimizeWindow'),

  closeWindow: () => ipcRenderer.send('electronAPI:closeWindow'),

  toggleAlwaysOnTop: (isAlwaysOnTop) =>
    ipcRenderer.send('electronAPI:toggleAlwaysOnTop', isAlwaysOnTop),

  getInitialAlwaysOnTop: () => ipcRenderer.invoke('electronAPI:getInitialAlwaysOnTop'),

  getSettings: () => ipcRenderer.invoke('electronAPI:getSettings'),

  setSettings: (settings) => ipcRenderer.invoke('electronAPI:setSettings', settings),

  createSession: (session) => ipcRenderer.invoke('db:create-session', session),
  addTranscript: (transcript) => ipcRenderer.invoke('db:add-transcript', transcript),
  getSessions: () => ipcRenderer.invoke('db:get-sessions'),
  getTranscripts: (sessionId) => ipcRenderer.invoke('db:get-transcripts', sessionId),
  endSession: (sessionId) => ipcRenderer.invoke('db:end-session', sessionId),

  startScreenshot: () => ipcRenderer.send('electronAPI:startScreenshot'),

  captureArea: (bounds) => ipcRenderer.send('electronAPI:captureArea', bounds),

  cancelScreenshot: () => ipcRenderer.send('electronAPI:cancelScreenshot'),

  onScreenshotTaken: (callback) => {
    const subscription = (event, path) => callback(path)
    ipcRenderer.on('electronAPI:screenshotTaken', subscription)
    return () => ipcRenderer.removeListener('electronAPI:screenshotTaken', subscription)
  },

  onScreenshotError: (callback) => {
    const subscription = (event, error) => callback(error)
    ipcRenderer.on('electronAPI:screenshotError', subscription)
    return () => ipcRenderer.removeListener('electronAPI:screenshotError', subscription)
  },

  on: (channel, callback) => {
    const validChannels = [
      'electronAPI:alwaysOnTopChanged',
      'electronAPI:availableSources',
      'electronAPI:screenshotTaken',
      'electronAPI:screenshotError',
      'electronAPI:oauth-callback'
    ]
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    }
    console.warn(`[Preload] Attempted to listen on invalid channel: ${channel}`)
    return () => {}
  },
  send: (channel, ...args) => {
    const validChannels = ['renderer-auth-ready', 'history:open']
    if (!validChannels.includes(channel)) {
      console.warn(`[Preload] Attempted to send on invalid channel: ${channel}`)
      return
    }
    ipcRenderer.send(channel, ...args)
  }
}

try {
  contextBridge.exposeInMainWorld('electronAPI', api)
  console.log('[Preload] contextBridge.exposeInMainWorld executed successfully.')
} catch (error) {
  console.error('[Preload] Error exposing API via contextBridge:', error)
}
