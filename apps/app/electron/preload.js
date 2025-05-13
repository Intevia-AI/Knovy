const { contextBridge, ipcRenderer } = require("electron");

console.log('[Preload] Script loaded.'); // Log: Script start

const api = {
    // --- Supabase Auth ---
    supabaseSignInWithOAuth: (provider) => ipcRenderer.invoke('supabase:signInWithOAuth', provider),

    // --- Screen Capture ---
    selectSource: (sourceId) => ipcRenderer.invoke('electronAPI:selectSource', sourceId),
    cancelSourceSelection: () => ipcRenderer.invoke('electronAPI:cancelSourceSelection'),

    // --- Window Controls ---
    minimizeWindow: () => ipcRenderer.send('electronAPI:minimizeWindow'),
    closeWindow: () => ipcRenderer.send('electronAPI:closeWindow'),
    toggleAlwaysOnTop: (isAlwaysOnTop) => ipcRenderer.send('electronAPI:toggleAlwaysOnTop', isAlwaysOnTop),
    getInitialAlwaysOnTop: () => ipcRenderer.invoke('electronAPI:getInitialAlwaysOnTop'),

    // --- Settings --- 
    getSettings: () => ipcRenderer.invoke('electronAPI:getSettings'),
    setSettings: (settings) => ipcRenderer.invoke('electronAPI:setSettings', settings),

    // --- Screenshot ---
    startScreenshot: () => ipcRenderer.send('electronAPI:startScreenshot'),
    captureArea: (bounds) => ipcRenderer.send('electronAPI:captureArea', bounds),
    cancelScreenshot: () => ipcRenderer.send('electronAPI:cancelScreenshot'),
    onScreenshotTaken: (callback) => {
        const subscription = (event, path) => callback(path);
        ipcRenderer.on('electronAPI:screenshotTaken', subscription);
        return () => ipcRenderer.removeListener('electronAPI:screenshotTaken', subscription);
    },
    onScreenshotError: (callback) => {
        const subscription = (event, error) => callback(error);
        ipcRenderer.on('electronAPI:screenshotError', subscription);
        return () => ipcRenderer.removeListener('electronAPI:screenshotError', subscription);
    },

    // --- IPC Event Listener ---
    on: (channel, callback) => {
        // Whitelist channels to prevent arbitrary channel listening
        const validChannels = [
            'electronAPI:alwaysOnTopChanged',
            'electronAPI:availableSources', // Add channel for receiving sources
            'electronAPI:screenshotTaken',
            'electronAPI:screenshotError',
            'oauth-callback' // Add channel for OAuth callback from main process
        ];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            const subscription = (event, ...args) => callback(...args);
            ipcRenderer.on(channel, subscription);
            // Return a function to remove the listener
            return () => ipcRenderer.removeListener(channel, subscription);
        }
        console.warn(`[Preload] Attempted to listen on invalid channel: ${channel}`);
        return () => {}; // Return a no-op function
    },
    // Removed generic 'send' for security, use specific methods above
};

console.log('[Preload] Exposing API keys:', Object.keys(api)); // Log: Keys being exposed

try {
    contextBridge.exposeInMainWorld("electronAPI", api);
    console.log('[Preload] contextBridge.exposeInMainWorld executed successfully.'); // Log: Success
} catch (error) {
    console.error('[Preload] Error exposing API via contextBridge:', error); // Log: Error
}