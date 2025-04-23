const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    // --- Screen Capture ---
    selectSource: (sourceId) => ipcRenderer.invoke('electronAPI:selectSource', sourceId),
    cancelSourceSelection: () => ipcRenderer.invoke('electronAPI:cancelSourceSelection'),
    trimAudio: (blobsBase64) => ipcRenderer.invoke('electronAPI:trimAudio', blobsBase64),

    // --- Window Controls ---
    minimizeWindow: () => ipcRenderer.send('electronAPI:minimizeWindow'),
    closeWindow: () => ipcRenderer.send('electronAPI:closeWindow'),
    toggleAlwaysOnTop: (isAlwaysOnTop) => ipcRenderer.send('electronAPI:toggleAlwaysOnTop', isAlwaysOnTop),
    getInitialAlwaysOnTop: () => ipcRenderer.invoke('electronAPI:getInitialAlwaysOnTop'),

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
        console.warn(`Attempted to listen on invalid channel: ${channel}`);
        return () => {}; // Return a no-op function
    },
    // Removed generic 'send' for security, use specific methods above
});