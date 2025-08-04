/**
 * @fileoverview Main Electron process for Intevia AI desktop application.
 * Handles window management, screen capture, OAuth authentication, settings persistence,
 * and IPC communication between main and renderer processes.
 */

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
  nativeTheme,
} from "electron";
import serve from "electron-serve";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {boolean} Development mode flag based on app packaging status */
const isDev = !app.isPackaged;

/** @type {string} Output directory for production build files */
const outputDir = path.join(__dirname, "../out");

/** @type {Function} Electron-serve instance for serving static files in production */
const appServe = serve({ directory: outputDir });

/** @type {string} Path to user settings file in app data directory */
const settingsPath = path.join(app.getPath("userData"), "settings.json");

/**
 * Loads user settings from the persistent settings file.
 * Returns default settings if file doesn't exist or cannot be read.
 *
 * @async
 * @function loadSettings
 * @returns {Promise<Object>} Settings object containing language and customPrompt
 * @returns {Promise<Object>} settings.language - User's preferred language (default: 'zh-TW')
 * @returns {Promise<Object>} settings.customPrompt - User's custom AI prompt (default: '')
 */
async function loadSettings() {
  try {
    await fs.access(settingsPath); // Check if file exists
    const data = await fs.readFile(settingsPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or other error, return default settings
    console.log(
      "Settings file not found or error reading, returning defaults.",
      error.code
    );
    return { language: "zh-TW", customPrompt: "" }; // Default settings
  }
}

/**
 * Saves user settings to the persistent settings file.
 * Creates the file if it doesn't exist and formats JSON for readability.
 *
 * @async
 * @function saveSettings
 * @param {Object} settings - Settings object to save
 * @param {string} settings.language - User's preferred language
 * @param {string} settings.customPrompt - User's custom AI prompt
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  try {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2)); // Pretty print JSON
    console.log("Settings saved to:", settingsPath);
  } catch (error) {
    console.error("Error saving settings:", error);
  }
}

/** @type {BrowserWindow|null} Reference to the main application window */
let mainWindow;

/** @type {BrowserWindow|null} Reference to the screenshot selection overlay window */
let selectionWindow;

/** @type {Function|null} Callback for pending screen capture media requests */
let pendingMediaRequest = null;

/** @type {string} Custom protocol scheme for OAuth callbacks and deep linking */
const PROTOCOL = "intevia";

/** @type {string|null} OAuth callback URL received during app startup */
let oauthCallbackUrlOnStartup = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    // And handle the OAuth callback if it's one.

    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      console.log(`[main.js second-instance] Received URL: ${url}`);
      if (
        mainWindow &&
        mainWindow.webContents &&
        !mainWindow.webContents.isLoading()
      ) {
        // Check isLoading
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        console.log(
          "[main.js second-instance] MainWindow ready, sending URL to renderer."
        );
        mainWindow.webContents.send("electronAPI:oauth-callback", url);
        oauthCallbackUrlOnStartup = null; // Clear if it was somehow set
      } else {
        console.warn(
          "[main.js second-instance] MainWindow not fully ready or not existing. Storing URL."
        );
        oauthCallbackUrlOnStartup = url; // Store URL to be sent later
        // If window exists, focus it. The URL will be sent on did-finish-load if it's still loading.
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      }
    } else {
      // Standard second-instance behavior (focus existing window)
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });
}

// Handle `open-url` event for macOS, this is triggered when the custom protocol link is clicked
app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log(`[main.js open-url] Received URL: ${url}`);
  oauthCallbackUrlOnStartup = url; // Always store the latest URL

  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      console.log(
        "[main.js open-url] MainWindow exists, sending URL to renderer."
      );
      mainWindow.webContents.send("electronAPI:oauth-callback", url);
    } else {
      console.warn(
        "[main.js open-url] MainWindow webContents not ready. URL stored."
      );
    }
  } else {
    console.warn("[main.js open-url] MainWindow not created yet. URL stored.");
    // If the app is not running and is opened by URL, createWindow will be called
    // and the URL will be handled by the did-finish-load event.
  }
});

// Add a new IPC handler for when the renderer is ready
ipcMain.on("renderer-auth-ready", (event) => {
  console.log("[main.js] Renderer is ready for auth callback.");
  if (oauthCallbackUrlOnStartup) {
    console.log(
      "[main.js] Sending stored OAuth URL to now-ready renderer:",
      oauthCallbackUrlOnStartup
    );
    event.sender.send("electronAPI:oauth-callback", oauthCallbackUrlOnStartup);
    oauthCallbackUrlOnStartup = null; // Clear after sending
  }
});

/**
 * Creates the main application window with platform-specific styling and security settings.
 * Configures window properties including transparency, blur effects, and content protection.
 * Loads either the development server or production build based on environment.
 *
 * @async
 * @function createWindow
 * @returns {Promise<void>}
 */
const createWindow = async () => {
  mainWindow = new BrowserWindow({
    // Assign to mainWindow
    width: 480,
    height: 400,
    frame: false, // Remove default frame to use custom header
    // Transparent background + blur effect
    transparent: true,
    vibrancy: "fullscreen-ui", // macOS blur material
    visualEffectState: "active", // keep blur even when unfocused

    backgroundMaterial: "acrylic", // on Windows 11
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true, // Recommended for security
      nodeIntegration: false, // Recommended for security
    },
  });

  mainWindow.webContents.on("preload-error", (event, preloadPath, error) => {
    console.error(
      `[main.mjs] Failed to load preload script '${preloadPath}':`,
      error
    );
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[main.js createWindow] WebContents did-finish-load.");
    mainWindow.webContents.send("electronAPI:forceDarkMode");

    // Check if there was an OAuth URL received on startup/while loading
    if (oauthCallbackUrlOnStartup) {
      console.log(
        "[main.js createWindow] Found stored OAuth URL, sending to renderer:",
        oauthCallbackUrlOnStartup
      );
      mainWindow.webContents.send(
        "electronAPI:oauth-callback",
        oauthCallbackUrlOnStartup
      );
      oauthCallbackUrlOnStartup = null; // Clear it after sending
    }
  });

  // Set content protection - prevents screen capture of the app window itself
  mainWindow.setContentProtection(true);

  if (isDev) {
    // Development: Load from Next.js dev server
    mainWindow.loadURL("http://localhost:3001");
    mainWindow.webContents.openDevTools();
    mainWindow.webContents.on("did-fail-load", (e, code, desc) => {
      console.warn("Development server failed to load, retrying...");
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.reloadIgnoringCache();
        }
      }, 1000); // Retry after 1 second
    });
  } else {
    // Production: Serve static files using electron-serve
    try {
      await appServe(mainWindow);
      console.log(`Loading production build from app://-/index.html`);
      mainWindow.loadURL("app://-/index.html");
    } catch (err) {
      console.error("Failed to load production build:", err);
    }
  }

  mainWindow.on("closed", () => {
    mainWindow = null; // Dereference the window object
    pendingMediaRequest = null; // Clear request on window close
    // Note: We don't unregister the shortcut here, as the app might still be running.
  });
};

/**
 * Toggles the main window visibility or creates it if it doesn't exist.
 * Hides the window if it's currently visible and focused, otherwise shows and focuses it.
 * This function is bound to the global keyboard shortcut.
 *
 * @function toggleWindow
 * @returns {void}
 */
const toggleWindow = () => {
  if (!mainWindow) {
    createWindow(); // Create if it doesn't exist
  } else {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show(); // Show if hidden or not focused
      mainWindow.focus(); // Focus it
    }
  }
};

/**
 * Creates a fullscreen transparent overlay window for screenshot area selection.
 * The window covers the entire primary display and allows users to select
 * a rectangular area for screenshot capture.
 *
 * @function createSelectionWindow
 * @returns {void}
 */
function createSelectionWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  // On macOS, we need to account for the menu bar
  const menuBarHeight = process.platform === "darwin" ? -50 : 0;

  selectionWindow = new BrowserWindow({
    width: width,
    height: height + menuBarHeight,
    x: 0,
    y: menuBarHeight,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    selectionWindow.loadURL("http://localhost:3001/selection");
    selectionWindow.webContents.on(
      "preload-error",
      (event, preloadPath, error) => {
        console.error(
          `[main.mjs] Failed to load preload script for selectionWindow '${preloadPath}':`,
          error
        );
      }
    );
  } else {
    selectionWindow.loadURL("app://-/selection.html");
  }

  selectionWindow.setIgnoreMouseEvents(false);
}

// Make the ready handler async to use await
app.on("ready", async () => {
  if (isDev) {
    await installExtension(REACT_DEVELOPER_TOOLS)
      .then((ext) => console.log(`Added Extension:  ${ext.name}`))
      .catch((err) => console.log("An error occurred: ", err));
  }
  // Force dark mode
  nativeTheme.themeSource = "dark";

  // Define your app's custom protocol - MOVED TO TOP LEVEL for accessibility by second-instance
  // const PROTOCOL = 'intevia-ai'; // Based on your appId: com.example.intevia-ai

  // Register the custom protocol client
  // process.execPath will be the path to your packaged Electron app
  // The arguments array can be used to pass data, here we use '--auth-callback'
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      "--auth-callback",
    ]);
  }

  // --- Hide Dock Icon (macOS) ---
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
    console.log("Dock icon hidden on macOS.");
  }
  // --- End Hide Dock Icon ---

  // --- Check/Request Screen Recording Permission (macOS) ---
  if (process.platform === "darwin") {
    // Only run on macOS
    const screenStatus = systemPreferences.getMediaAccessStatus("screen");
    console.log(`Initial screen recording permission status: ${screenStatus}`);

    if (screenStatus === "not-determined") {
      try {
        const granted = await systemPreferences.askForMediaAccess("screen");
        console.log(
          `Screen recording permission request result: ${granted ? "Granted" : "Denied"}`
        );
        if (!granted) {
          // Optional: Inform user they need to grant permission manually
          console.error("Screen recording permission was denied by the user.");
          // You might want to show a dialog here
        }
      } catch (error) {
        console.error("Error requesting screen recording permission:", error);
      }
    } else if (screenStatus === "denied") {
      console.error(
        "Screen recording permission is denied. Please grant access in System Settings > Privacy & Security > Screen Recording."
      );
      // Optional: Show a dialog instructing the user
    }
    // If 'granted', we don't need to do anything
  }
  // --- End Permission Check ---

  await createWindow();

  // --- Register Global Shortcut ---
  const ret = globalShortcut.register("CommandOrControl+K", toggleWindow);

  if (!ret) {
    console.log("Global shortcut registration failed");
  } else {
    console.log(
      'Global shortcut "CommandOrControl+Shift+I" registered successfully'
    );
  }
  // --- End Global Shortcut Registration ---

  // IPC handler for initiating OAuth flow
  ipcMain.handle("supabase:signInWithOAuth", async (event, provider) => {
    console.log(
      `[main] Received request to sign in with provider. URL: ${provider.urlToOpen}`
    );
    if (provider.urlToOpen) {
      try {
        console.log("[main] Attempting to open external URL...");
        await shell.openExternal(provider.urlToOpen);
        console.log("[main] Successfully opened external URL.");
        return { success: true };
      } catch (e) {
        console.error("[main] Failed to open external URL:", e);
        return { error: e.message };
      }
    } else {
      console.error("[main] No URL provided to open for OAuth.");
      return { error: "No URL provided to open." };
    }
  });

  // --- Set up DisplayMediaRequestHandler ---
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    console.log("Intercepting getDisplayMedia request...");
    pendingMediaRequest = callback; // Store the callback
    desktopCapturer
      .getSources({ types: ["window", "screen"] })
      .then(async (sources) => {
        console.log("Sending available sources to renderer:", sources.length);
        // Send sources to the renderer window to show a picker
        mainWindow?.webContents.send(
          "electronAPI:availableSources",
          sources.map((s) => ({
            id: s.id,
            name: s.name,
            // Optionally generate and send thumbnails:
            // thumbnail: s.thumbnail.toDataURL()
          }))
        );
      })
      .catch((error) => {
        console.error("Error getting desktop sources:", error);
        // Reject the request if sources couldn't be fetched
        if (pendingMediaRequest) {
          // How to properly reject? The API doesn't specify, maybe call with empty object or let it timeout.
          // For now, let's log and potentially let it timeout or the renderer handle the lack of sources.
          pendingMediaRequest = null;
        }
      });
  });

  // --- Handle Renderer's Source Selection ---
  ipcMain.handle("electronAPI:selectSource", (event, sourceId) => {
    console.log(`Renderer selected source: ${sourceId}`);
    if (pendingMediaRequest) {
      desktopCapturer
        .getSources({ types: ["window", "screen"] })
        .then((sources) => {
          const selectedSource = sources.find((s) => s.id === sourceId);
          if (selectedSource) {
            console.log(
              `Granting access to source: ${selectedSource.name} (${selectedSource.id}) with loopback audio`
            );
            try {
              pendingMediaRequest({ video: selectedSource, audio: "loopback" }); // Use selected source
            } catch (error) {
              console.error("Error granting access to source:", error);
              // Don't throw the error, just log it and clear the request
            }
          } else {
            console.log(
              `Selected source ID ${sourceId} not found, treating as cancellation.`
            );
          }
          pendingMediaRequest = null; // Always clear the request after handling
        })
        .catch((err) => {
          console.error("Error re-fetching sources for selection:", err);
          pendingMediaRequest = null;
        });
    } else {
      console.log("No pending media request found, treating as cancellation.");
    }
  });

  ipcMain.handle("electronAPI:cancelSourceSelection", () => {
    console.log("Renderer cancelled source selection.");
    if (pendingMediaRequest) {
      // Instead of calling with empty constraints, we'll just clear the pending request
      pendingMediaRequest = null;
      console.log("Cleared pending media request without error.");
    }
  });

  // Handle request for desktop sources
  ipcMain.handle("electronAPI:getSources", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
    });
    // You might want to filter or modify sources here, e.g., add thumbnails
    // For simplicity, returning all sources for now
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      // You can generate thumbnails if needed: source.thumbnail.toDataURL()
    }));
  });

  // Handle window controls
  ipcMain.on("electronAPI:minimizeWindow", () => {
    mainWindow?.minimize();
  });

  ipcMain.on("electronAPI:closeWindow", () => {
    mainWindow?.close();
  });

  ipcMain.on("electronAPI:toggleAlwaysOnTop", (event, isAlwaysOnTop) => {
    mainWindow?.setAlwaysOnTop(isAlwaysOnTop);
    // Optionally send back confirmation or new state
    event.reply("electronAPI:alwaysOnTopChanged", mainWindow?.isAlwaysOnTop());
  });

  // Handle request for initial always on top state
  ipcMain.handle("electronAPI:getInitialAlwaysOnTop", () => {
    return mainWindow?.isAlwaysOnTop() ?? false;
  });

  // Handle settings loading
  ipcMain.handle("electronAPI:getSettings", async () => {
    return await loadSettings();
  });

  // Handle settings saving
  ipcMain.handle("electronAPI:setSettings", async (event, settingsToUpdate) => {
    const currentSettings = await loadSettings();
    const newSettings = { ...currentSettings, ...settingsToUpdate };
    await saveSettings(newSettings);
    // Optionally return the saved settings or success status
    return newSettings;
  });

  // Handle screenshot capture
  ipcMain.on("electronAPI:startScreenshot", (event) => {
    console.log("[Main] Starting screenshot process");
    createSelectionWindow();
  });

  ipcMain.on("electronAPI:captureArea", async (event, bounds) => {
    try {
      console.log("[Main] Capturing area:", bounds);
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.bounds;
      const scaleFactor = primaryDisplay.scaleFactor;

      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: {
          width: width * scaleFactor,
          height: height * scaleFactor,
        },
      });

      const source = sources[0];
      if (!source) {
        throw new Error("Screen not found");
      }

      // 在專案目錄中創建 screenshots 資料夾
      const screenshotsDir = path.join(__dirname, "../public/screenshots");
      try {
        await fs.mkdir(screenshotsDir, { recursive: true });
      } catch (err) {
        console.log("Screenshots directory already exists");
      }

      // 保存截圖到專案目錄
      const timestamp = Date.now();
      const screenshotPath = path.join(
        screenshotsDir,
        `screenshot-${timestamp}.png`
      );

      // Calculate the actual capture bounds
      const captureBounds = {
        x: Math.round(bounds.x * scaleFactor),
        y: Math.round(bounds.y * scaleFactor),
        width: Math.round(bounds.width * scaleFactor),
        height: Math.round(bounds.height * scaleFactor),
      };

      if (process.platform === "darwin") {
        captureBounds.y = captureBounds.y + 80;
      }

      // Ensure bounds are within the screen
      if (captureBounds.x < 0) captureBounds.x = 0;
      if (captureBounds.y < 0) captureBounds.y = 0;
      if (captureBounds.width > width * scaleFactor)
        captureBounds.width = width * scaleFactor;
      if (captureBounds.height > height * scaleFactor)
        captureBounds.height = height * scaleFactor;

      const image = source.thumbnail.crop(captureBounds).toPNG();
      await fs.writeFile(screenshotPath, image);

      if (selectionWindow) {
        selectionWindow.close();
      }

      // Send the relative path back to the main window
      const relativePath = `/screenshots/screenshot-${timestamp}.png`;
      console.log("[Main] Screenshot saved to:", screenshotPath);
      console.log("[Main] Relative path:", relativePath);
      mainWindow?.webContents.send("electronAPI:screenshotTaken", relativePath);
    } catch (error) {
      console.error("[Main] Screenshot error:", error);
      mainWindow?.webContents.send(
        "electronAPI:screenshotError",
        error.message
      );
    }
  });

  ipcMain.on("electronAPI:cancelScreenshot", () => {
    if (selectionWindow) {
      selectionWindow.close();
    }
  });

  if (process.platform !== "darwin" && gotTheLock) {
    const cmdLineUrl = process.argv.find((arg) =>
      arg.startsWith(`${PROTOCOL}://`)
    );
    if (cmdLineUrl) {
      console.log(
        `[main.js app.ready] Initial command line OAuth URL for Windows/Linux: ${cmdLineUrl}`
      );
      oauthCallbackUrlOnStartup = cmdLineUrl; // Store for did-finish-load
    }
  }
});

app.on("window-all-closed", () => {
  // On Windows/Linux, closing the window usually quits the app.
  // On macOS, the app often stays active.
  // We keep the shortcut active even if the window is closed on macOS.
  if (process.platform !== "darwin") {
    app.quit(); // This will trigger 'will-quit'
  }
});

app.on("will-quit", () => {
  // Unregister the shortcut when the application is about to quit
  globalShortcut.unregister("CommandOrControl+Shift+I");
  console.log('Global shortcut "CommandOrControl+Shift+I" unregistered');
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
