const { contextBridge, ipcRenderer } = require("electron");

console.log('[Preload] Script loaded.'); // Log: Script start

const api = {
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

    // --- IPC Event Listener ---
    on: (channel, callback) => {
        // Whitelist channels to prevent arbitrary channel listening
        const validChannels = [
            'electronAPI:alwaysOnTopChanged',
            'electronAPI:availableSources' // Add channel for receiving sources
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