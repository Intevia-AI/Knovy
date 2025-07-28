/**
 * @fileoverview Preload script for Intevia AI Electron application.
 * Provides secure IPC communication bridge between main and renderer processes.
 * Exposes limited, whitelisted APIs to the renderer for security.
 */

const { contextBridge, ipcRenderer } = require("electron");

console.log("[Preload] Script loaded."); // Log: Script start

/**
 * Secure API object exposed to the renderer process via contextBridge.
 * All methods are carefully whitelisted to prevent security vulnerabilities.
 *
 * @namespace electronAPI
 */
const api = {
  // ------------------------------------------------------------
  // OAuth
  // ------------------------------------------------------------
  /**
   * Initiates OAuth authentication flow with the specified provider.
   * Opens external browser for authentication and handles callback.
   *
   * @method supabaseSignInWithOAuth
   * @param {Object} provider - OAuth provider configuration
   * @param {string} provider.urlToOpen - OAuth URL to open in external browser
   * @returns {Promise<Object>} Authentication result with success/error status
   */
  supabaseSignInWithOAuth: (provider) =>
    ipcRenderer.invoke("supabase:signInWithOAuth", provider),

  // ------------------------------------------------------------
  // Screen Capture
  // ------------------------------------------------------------
  /**
   * Selects a screen/window source for screen capture.
   *
   * @method selectSource
   * @param {string} sourceId - Unique identifier of the selected capture source
   * @returns {Promise<void>}
   */
  selectSource: (sourceId) =>
    ipcRenderer.invoke("electronAPI:selectSource", sourceId),

  /**
   * Cancels the current screen capture source selection process.
   *
   * @method cancelSourceSelection
   * @returns {Promise<void>}
   */
  cancelSourceSelection: () =>
    ipcRenderer.invoke("electronAPI:cancelSourceSelection"),

  // ------------------------------------------------------------
  // Window Controls
  // ------------------------------------------------------------
  /**
   * Minimizes the main application window.
   *
   * @method minimizeWindow
   * @returns {void}
   */
  minimizeWindow: () => ipcRenderer.send("electronAPI:minimizeWindow"),

  /**
   * Closes the main application window.
   *
   * @method closeWindow
   * @returns {void}
   */
  closeWindow: () => ipcRenderer.send("electronAPI:closeWindow"),

  /**
   * Toggles the always-on-top state of the main window.
   *
   * @method toggleAlwaysOnTop
   * @param {boolean} isAlwaysOnTop - Whether window should stay on top
   * @returns {void}
   */
  toggleAlwaysOnTop: (isAlwaysOnTop) =>
    ipcRenderer.send("electronAPI:toggleAlwaysOnTop", isAlwaysOnTop),

  /**
   * Gets the initial always-on-top state of the main window.
   *
   * @method getInitialAlwaysOnTop
   * @returns {Promise<boolean>} Current always-on-top state
   */
  getInitialAlwaysOnTop: () =>
    ipcRenderer.invoke("electronAPI:getInitialAlwaysOnTop"),

  // ------------------------------------------------------------
  // User Settings
  // ------------------------------------------------------------
  /**
   * Retrieves user settings from persistent storage.
   *
   * @method getSettings
   * @returns {Promise<Object>} User settings object
   */
  getSettings: () => ipcRenderer.invoke("electronAPI:getSettings"),

  /**
   * Saves user settings to persistent storage.
   *
   * @method setSettings
   * @param {Object} settings - Settings object to save
   * @returns {Promise<Object>} Updated settings object
   */
  setSettings: (settings) =>
    ipcRenderer.invoke("electronAPI:setSettings", settings),

  // ------------------------------------------------------------
  // Screenshot Capture
  // ------------------------------------------------------------
  /**
   * Initiates screenshot capture process by opening selection overlay.
   *
   * @method startScreenshot
   * @returns {void}
   */
  startScreenshot: () => ipcRenderer.send("electronAPI:startScreenshot"),

  /**
   * Captures a specific area of the screen based on provided bounds.
   *
   * @method captureArea
   * @param {Object} bounds - Screenshot area bounds
   * @param {number} bounds.x - X coordinate of top-left corner
   * @param {number} bounds.y - Y coordinate of top-left corner
   * @param {number} bounds.width - Width of capture area
   * @param {number} bounds.height - Height of capture area
   * @returns {void}
   */
  captureArea: (bounds) => ipcRenderer.send("electronAPI:captureArea", bounds),

  /**
   * Cancels the current screenshot capture process.
   *
   * @method cancelScreenshot
   * @returns {void}
   */
  cancelScreenshot: () => ipcRenderer.send("electronAPI:cancelScreenshot"),

  /**
   * Registers a callback for successful screenshot capture events.
   *
   * @method onScreenshotTaken
   * @param {Function} callback - Callback function to handle screenshot path
   * @returns {Function} Unsubscribe function to remove the listener
   */
  onScreenshotTaken: (callback) => {
    const subscription = (event, path) => callback(path);
    ipcRenderer.on("electronAPI:screenshotTaken", subscription);
    return () =>
      ipcRenderer.removeListener("electronAPI:screenshotTaken", subscription);
  },

  /**
   * Registers a callback for screenshot capture error events.
   *
   * @method onScreenshotError
   * @param {Function} callback - Callback function to handle error messages
   * @returns {Function} Unsubscribe function to remove the listener
   */
  onScreenshotError: (callback) => {
    const subscription = (event, error) => callback(error);
    ipcRenderer.on("electronAPI:screenshotError", subscription);
    return () =>
      ipcRenderer.removeListener("electronAPI:screenshotError", subscription);
  },

  // ------------------------------------------------------------
  // IPC Event Listeners
  // ------------------------------------------------------------
  /**
   * Registers event listeners for whitelisted IPC channels.
   * Provides secure, limited access to IPC events from the renderer process.
   *
   * @method on
   * @param {string} channel - IPC channel name (must be whitelisted)
   * @param {Function} callback - Event handler callback function
   * @returns {Function} Unsubscribe function to remove the listener
   */
  on: (channel, callback) => {
    // Whitelist channels to prevent arbitrary channel listening
    const validChannels = [
      "electronAPI:alwaysOnTopChanged",
      "electronAPI:availableSources", // Add channel for receiving sources
      "electronAPI:screenshotTaken",
      "electronAPI:screenshotError",
      "oauth-callback", // Add channel for OAuth callback from main process
    ];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      // Return a function to remove the listener
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    console.warn(
      `[Preload] Attempted to listen on invalid channel: ${channel}`
    );
    return () => {}; // Return a no-op function
  },
  // Removed generic 'send' for security, use specific methods above
};

console.log("[Preload] Exposing API keys:", Object.keys(api)); // Log: Keys being exposed

try {
  contextBridge.exposeInMainWorld("electronAPI", api);
  console.log(
    "[Preload] contextBridge.exposeInMainWorld executed successfully."
  ); // Log: Success
} catch (error) {
  console.error("[Preload] Error exposing API via contextBridge:", error); // Log: Error
}
