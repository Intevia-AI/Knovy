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

  toggleContentProtection: () => ipcRenderer.send('app:toggle-content-protection'),

  toggleAlwaysOnTop: (isAlwaysOnTop) =>
    ipcRenderer.send('electronAPI:toggleAlwaysOnTop', isAlwaysOnTop),

  getInitialAlwaysOnTop: () => ipcRenderer.invoke('electronAPI:getInitialAlwaysOnTop'),

  getAppVersion: () => ipcRenderer.invoke('electronAPI:getAppVersion'),

  getMediaAccessStatus: (mediaType: 'microphone' | 'screen' | 'camera') =>
    ipcRenderer.invoke('electronAPI:getMediaAccessStatus', mediaType),

  askForMediaAccess: (mediaType: 'microphone' | 'screen' | 'camera') =>
    ipcRenderer.invoke('electronAPI:askForMediaAccess', mediaType),

  openSystemPreferences: (prefPane: 'microphone' | 'screen' | 'camera') =>
    ipcRenderer.invoke('electronAPI:openSystemPreferences', prefPane),

  getSettings: () => ipcRenderer.invoke('electronAPI:getSettings'),

  getMainWindowBounds: () => ipcRenderer.invoke('electronAPI:getMainWindowBounds'),

  setSettings: (settings) => ipcRenderer.invoke('electronAPI:setSettings', settings),

  // Auto-trigger settings methods
  autoTrigger: {
    getSettings: () => ipcRenderer.invoke('auto-trigger:get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('auto-trigger:update-settings', settings),
    onSettingsChanged: (callback) => {
      const subscription = (event, settings) => callback(settings)
      ipcRenderer.on('auto-trigger:settings-changed', subscription)
      return () => ipcRenderer.removeListener('auto-trigger:settings-changed', subscription)
    }
  },

  // Local transcription methods
  transcriptionInitialize: () => ipcRenderer.invoke('transcription:initialize'),
  transcriptionProcessAudio: (audioBuffer: ArrayBuffer, options: any) =>
    ipcRenderer.invoke('transcription:process-audio', { audioBuffer, options }),
  transcriptionGetModels: () => ipcRenderer.invoke('transcription:get-models'),
  transcriptionDownloadModel: (modelName: string) =>
    ipcRenderer.invoke('transcription:download-model', modelName),
  transcriptionDeleteModel: (modelName: string) =>
    ipcRenderer.invoke('transcription:delete-model', modelName),
  transcriptionGetStorageUsage: () => ipcRenderer.invoke('transcription:get-storage-usage'),
  transcriptionEnsureModelAvailable: () => ipcRenderer.invoke('transcription:ensure-model-available'),
  transcriptionGetDiagnostics: () => ipcRenderer.invoke('transcription:get-diagnostics'),
  transcriptionSetupEnhancement: (supabaseUrl: string, supabaseAnonKey: string, userToken?: string) =>
    ipcRenderer.invoke('transcription:setup-enhancement', { supabaseUrl, supabaseAnonKey, userToken }),
  transcriptionSetEnhancementToken: (token: string) =>
    ipcRenderer.invoke('transcription:set-enhancement-token', token),

  createSession: (session) => ipcRenderer.invoke('db:create-session', session),
  addTranscript: (transcript) => ipcRenderer.invoke('db:add-transcript', transcript),
  getSessions: () => ipcRenderer.invoke('db:get-sessions'),
  getTranscripts: (sessionId, page, limit) =>
    ipcRenderer.invoke('db:get-transcripts', { sessionId, page, limit }),
  endSession: (sessionId) => ipcRenderer.invoke('db:end-session', sessionId),
  getSessionsWithTranscripts: (userId: string, limit: number, offset: number) =>
    ipcRenderer.invoke('db:get-sessions-with-transcripts', { userId, limit, offset }),
  getTotalSessionCount: (userId: string) =>
    ipcRenderer.invoke('db:get-total-session-count', userId),
  exportSession: (sessionId: string, locale?: string, timezone?: string) =>
    ipcRenderer.invoke('db:export-session', { sessionId, locale, timezone }),
  deleteSession: (sessionId: string) => ipcRenderer.invoke('db:delete-session', sessionId),
  getAllSessionDates: () => ipcRenderer.invoke('db:get-all-session-dates'),

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
      'transcription:update',
      'screenshare:state-changed',
      'popover:prepare-to-close',
      'popover:was-closed',
      'auth:execute-sign-out',
      'updater:log',
      'updater:update-downloaded',
      'keyword:search',
      'screenshare:source-changed',
      'app:execute-graceful-stop',
      'session:duration-update',
      'settings:changed',
      'audio:levels-updated',
      'permissions:microphone-denied',
      'permissions:initialization-complete',
      'transcription:error',
      'transcription:warning',
      'transcription:processed',
      'transcription:enhanced',
      'transcription:enhancement-error',
      'transcription:model-error',
      'transcription:model-download-progress',
      'model:download-progress',
      'model:download-complete',
      'settings:closed',
      // Keyboard shortcut events
      'shortcut:toggle-recording',
      'shortcut:toggle-preview-panel',
      'shortcut:toggle-chat-panel',
      'shortcut:toggle-actions-panel',
      'shortcut:ai-action-recommend-response',
      'shortcut:ai-action-screenshot-analysis',
      // AI action triggers
      'ai-action:recommend-response',
      // Auto-trigger events
      'auto-trigger:settings-changed'
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
      'transcription:update',
      'auth:request-sign-out',
      'updater:quit-and-install',
      'keyword:click',
      'window:set-position',
      'settings:move-to-display',
      'screenshare:source-changed',
      'app:graceful-stop-and-execute',
      'app:quit',
      'app:toggle-content-protection',
      'session:duration-update',
      'audio:level-update',
      'transcription:model-error',
      'electronAPI:startScreenshot',
      'electronAPI:captureArea',
      'electronAPI:cancelScreenshot',
      'settings:close',
      'ai-action:trigger-recommend-response'
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
      'db:get-all-transcripts',
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
      'electronAPI:getAppVersion',
      'electronAPI:getMediaAccessStatus',
      'electronAPI:askForMediaAccess',
      'electronAPI:openSystemPreferences',
      'popover:consume-pending-keyword',
      'electronAPI:getActiveScreenSourceId',
      'electronAPI:getDisplays',
      'transcription:initialize',
      'transcription:process-audio',
      'transcription:get-models',
      'transcription:download-model',
      'transcription:delete-model',
      'transcription:get-storage-usage',
      'transcription:get-diagnostics',
      'transcription:setup-enhancement',
      'transcription:set-enhancement-token',
      'settings:open',
      'settings:navigate',
      // Auto-trigger invoke channels
      'auto-trigger:get-settings',
      'auto-trigger:update-settings'
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
