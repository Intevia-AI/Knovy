import { contextBridge, ipcRenderer } from 'electron'

console.log('[Preload] Script loaded.')

const api = {
  openExternal: (url: string) => ipcRenderer.send('electronAPI:openExternal', url),

  supabaseSignInWithOAuth: (provider) => ipcRenderer.invoke('supabase:signInWithOAuth', provider),

  selectSource: (sourceId) => ipcRenderer.invoke('electronAPI:selectSource', sourceId),

  cancelSourceSelection: () => ipcRenderer.invoke('electronAPI:cancelSourceSelection'),

  minimizeWindow: () => ipcRenderer.send('electronAPI:minimizeWindow'),

  closeWindow: () => ipcRenderer.send('electronAPI:closeWindow'),

  quitApp: () => ipcRenderer.send('app:quit'),

  toggleAlwaysOnTop: (isAlwaysOnTop) =>
    ipcRenderer.send('electronAPI:toggleAlwaysOnTop', isAlwaysOnTop),

  getInitialAlwaysOnTop: () => ipcRenderer.invoke('electronAPI:getInitialAlwaysOnTop'),

  getSettings: () => ipcRenderer.invoke('electronAPI:getSettings'),

  getMainWindowBounds: () => ipcRenderer.invoke('electronAPI:getMainWindowBounds'),

  setSettings: (settings) => ipcRenderer.invoke('electronAPI:setSettings', settings),

  createSession: (session) => ipcRenderer.invoke('db:create-session', session),
  addTranscript: (transcript) => ipcRenderer.invoke('db:add-transcript', transcript),
  getSessions: () => ipcRenderer.invoke('db:get-sessions'),
  getTranscripts: (sessionId, page, limit) =>
    ipcRenderer.invoke('db:get-transcripts', { sessionId, page, limit }),
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
      'always-on-top-changed',
      'electronAPI:alwaysOnTopChanged',
      'electronAPI:availableSources',
      'electronAPI:sources-empty',
      'electronAPI:screenshotTaken',
      'electronAPI:screenshotError',
      'electronAPI:oauth-callback',
      'source-picker:select',
      'source-picker:cancel',
      'ai:message',
      'ai:custom-prompt',
      'transcription:data',
      'screenshare:state-changed',
      'popover:prepare-to-close',
      'popover:was-closed',
      'auth:execute-sign-out',
      'updater:log',
      'updater:update-downloaded',
      'keyword:search',
      'screenshare:source-changed',
      'screenshare:restart',
      'session:duration-update'
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
    const validChannels = [
      'renderer-auth-ready',
      'history:open',
      'app:resize-window',
      'app:set-always-on-top',
      'source-picker:select',
      'source-picker:cancel',
      'popover:close',
      'popover:close-all',
      'popover:ready-to-close',
      'set-screenshare-state',
      'transcription:data',
      'auth:request-sign-out',
      'updater:quit-and-install',
      'keyword:click',
      'window:set-position',
      'screenshare:source-changed',
      'settings:request-screenshare-restart',
      'app:quit',
      'session:duration-update'
    ]
    if (!validChannels.includes(channel)) {
      console.warn(`[Preload] Attempted to send on invalid channel: ${channel}`)
      return
    }
    ipcRenderer.send(channel, ...args)
  },
  invoke: (channel, ...args) => {
    const validChannels = [
      'electronAPI:getMainWindowBounds',
      'supabase:signInWithOAuth',
      'electronAPI:selectSource',
      'electronAPI:cancelSourceSelection',
      'electronAPI:getInitialAlwaysOnTop',
      'electronAPI:getSettings',
      'electronAPI:setSettings',
      'db:create-session',
      'db:add-transcript',
      'db:get-sessions',
      'db:get-transcripts',
      'db:end-session',
      'db:get-summary',
      'db:save-summary',
      'popover:create',
      'popover:resize',
      'get-screenshare-state',
      'session:start',
      'session:end',
      'session:get-id',
      'session:get-profile',
      'session:set-profile',
      'session:clear-profile',
      'popover:consume-pending-keyword',
      'electronAPI:getActiveScreenSourceId',
      'electronAPI:getDisplays'
    ]
    if (!validChannels.includes(channel)) {
      return Promise.reject(new Error(`Invalid invoke channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}

try {
  contextBridge.exposeInMainWorld('electronAPI', api)
  console.log('[Preload] contextBridge.exposeInMainWorld executed successfully.')
} catch (error) {
  console.error('[Preload] Error exposing API via contextBridge:', error)
}
