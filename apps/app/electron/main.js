const { app, BrowserWindow, ipcMain, desktopCapturer, session, systemPreferences, globalShortcut, screen, shell } = require("electron");
const serve = require("electron-serve");
const path = require("path");
const fs = require("fs").promises; // Use promises version of fs

const isDev = !app.isPackaged;
const outputDir = path.join(__dirname, "../out");

// Settings file path
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Function to load settings
async function loadSettings() {
  try {
    await fs.access(settingsPath); // Check if file exists
    const data = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or other error, return default settings
    console.log("Settings file not found or error reading, returning defaults.", error.code);
    return { language: 'zh-TW', customPrompt: '' }; // Default settings
  }
}

// Function to save settings
async function saveSettings(settings) {
  try {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2)); // Pretty print JSON
    console.log("Settings saved to:", settingsPath);
  } catch (error) {
    console.error("Error saving settings:", error);
  }
}

let mainWindow; // Keep a reference to the main window
let selectionWindow;
let pendingMediaRequest = null; // Keep track of the callback for the media request
const PROTOCOL = 'intevia-ai'; // Define protocol here to be accessible by handlers
let oauthCallbackUrlOnStartup = null; // Variable to store the URL if app starts via protocol

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    // And handle the OAuth callback if it's one.

    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      console.log(`[main.js second-instance] Received URL: ${url}`);
      if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) { // Check isLoading
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        console.log('[main.js second-instance] MainWindow ready, sending URL to renderer.');
        mainWindow.webContents.send('oauth-callback', url);
        oauthCallbackUrlOnStartup = null; // Clear if it was somehow set
      } else {
        console.warn('[main.js second-instance] MainWindow not fully ready or not existing. Storing URL.');
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
app.on('open-url', (event, url) => {
  event.preventDefault(); // Prevent default action
  console.log(`[main.js open-url] Received URL: ${url}`);
  // Send the URL to the renderer process
  // Ensure mainWindow and its webContents are available and not loading
  if (app.isReady() && mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) {
    console.log('[main.js open-url] MainWindow ready, sending URL to renderer.');
    mainWindow.webContents.send('oauth-callback', url);
    oauthCallbackUrlOnStartup = null; // Clear it once sent
  } else {
    // If the window isn't ready yet, queue this URL
    console.warn('[main.js open-url] MainWindow not ready or still loading. Storing URL to send after window loads.');
    oauthCallbackUrlOnStartup = url; // Store URL to be sent later
    // If window exists, try to focus it. did-finish-load will handle sending.
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
  }
});

const createWindow = () => {
  mainWindow = new BrowserWindow({ // Assign to mainWindow
    width: 480,
    height: 400,
    frame: false, // Remove default frame to use custom header
    // Transparent background + blur effect
    transparent: true,
    vibrancy: 'fullscreen-ui',           // macOS blur material
    visualEffectState: 'active',         // keep blur even when unfocused

    backgroundMaterial: 'acrylic', // on Windows 11
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // Recommended for security
      nodeIntegration: false, // Recommended for security
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main.js createWindow] WebContents did-finish-load.');
    mainWindow.webContents.send('electronAPI:forceDarkMode');

    // Check if there was an OAuth URL received on startup/while loading
    if (oauthCallbackUrlOnStartup) {
      console.log('[main.js createWindow] Found stored OAuth URL, sending to renderer:', oauthCallbackUrlOnStartup);
      mainWindow.webContents.send('oauth-callback', oauthCallbackUrlOnStartup);
      oauthCallbackUrlOnStartup = null; // Clear it after sending
    }
  });

  // Set content protection - prevents screen capture of the app window itself
  mainWindow.setContentProtection(true);

  if (isDev) {
    // Development: Load from Next.js dev server
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
    mainWindow.webContents.on("did-fail-load", (e, code, desc) => {
      console.warn('Development server failed to load, retrying...');
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.reloadIgnoringCache();
        }
      }, 1000); // Retry after 1 second
    });
  } else {
    // Production: Serve static files using electron-serve
    appServe(mainWindow).then(() => {
      console.log(`Loading production build from app://-/index.html`);
      // Explicitly load index.html via the custom protocol
      mainWindow.loadURL("app://-/index.html")
        .then(() => console.log('Successfully loaded app://-/index.html'))
        .catch(err => console.error('Failed to load URL app://-/index.html:', err));
    }).catch(err => {
        console.error('Electron-serve setup failed:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null; // Dereference the window object
    pendingMediaRequest = null; // Clear request on window close
    // Note: We don't unregister the shortcut here, as the app might still be running.
  });
}

// Function to toggle window visibility or create it
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

// Function to create selection window
function createSelectionWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;
  
  // On macOS, we need to account for the menu bar
  const menuBarHeight = process.platform === 'darwin' ? -50 : 0;
  
  selectionWindow = new BrowserWindow({
    width: width,
    height: height + menuBarHeight,
    x: 0,
    y: menuBarHeight,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  if (isDev) {
    selectionWindow.loadURL("http://localhost:3000/selection");
  } else {
    selectionWindow.loadURL("app://-/selection.html");
  }
  
  selectionWindow.setIgnoreMouseEvents(false);
}

// Make the ready handler async to use await
app.on("ready", async () => {
    // Define your app's custom protocol - MOVED TO TOP LEVEL for accessibility by second-instance
    // const PROTOCOL = 'intevia-ai'; // Based on your appId: com.example.intevia-ai

    // Register the custom protocol client
    // process.execPath will be the path to your packaged Electron app
    // The arguments array can be used to pass data, here we use '--auth-callback'
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, ['--auth-callback']);
    }

    // --- Hide Dock Icon (macOS) ---
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide();
      console.log("Dock icon hidden on macOS.");
    }
    // --- End Hide Dock Icon ---

    // --- Check/Request Screen Recording Permission (macOS) ---
    if (process.platform === 'darwin') { // Only run on macOS
      const screenStatus = systemPreferences.getMediaAccessStatus('screen');
      console.log(`Initial screen recording permission status: ${screenStatus}`);

      if (screenStatus === 'not-determined') {
        try {
          const granted = await systemPreferences.askForMediaAccess('screen');
          console.log(`Screen recording permission request result: ${granted ? 'Granted' : 'Denied'}`);
          if (!granted) {
            // Optional: Inform user they need to grant permission manually
            console.error("Screen recording permission was denied by the user.");
            // You might want to show a dialog here
          }
        } catch (error) {
          console.error("Error requesting screen recording permission:", error);
        }
      } else if (screenStatus === 'denied') {
        console.error("Screen recording permission is denied. Please grant access in System Settings > Privacy & Security > Screen Recording.");
        // Optional: Show a dialog instructing the user
      }
      // If 'granted', we don't need to do anything
    }
    // --- End Permission Check ---

    createWindow();

    // --- Register Global Shortcut ---
    const ret = globalShortcut.register('CommandOrControl+K', toggleWindow);

    if (!ret) {
      console.log('Global shortcut registration failed');
    } else {
      console.log('Global shortcut "CommandOrControl+Shift+I" registered successfully');
    }
    // --- End Global Shortcut Registration ---

    // IPC handler for initiating OAuth flow
    ipcMain.handle('supabase:signInWithOAuth', async (event, provider) => {
      // Note: The Supabase client in the renderer should generate the provider-specific URL.
      // This handler is simplified: assuming the renderer sends the URL to open.
      // Or, if Supabase client were in main, it would be like:
      // const { data, error } = await supabase.auth.signInWithOAuth({
      //   provider: provider,
      //   options: {
      //     redirectTo: `${PROTOCOL}://auth/callback`,
      //   },
      // });
      // if (error) return { error: error.message };
      // if (data.url) {
      //   await shell.openExternal(data.url);
      //   return { success: true };
      // }
      // return { error: 'No URL returned from Supabase' };
      // For now, we expect the renderer to ask to open a pre-constructed URL
      // This part will be simplified later if the renderer handles URL construction.
      console.log(`[main] Received request to sign in with ${provider.urlToOpen}`);
      if (provider.urlToOpen) {
        try {
          await shell.openExternal(provider.urlToOpen);
          return { success: true };
        } catch (e) {
          console.error('Failed to open external URL:', e);
          return { error: e.message };
        }
      } else {
        return { error: 'No URL provided to open.' };
      }
    });

    // --- Set up DisplayMediaRequestHandler ---
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      console.log('Intercepting getDisplayMedia request...');
      pendingMediaRequest = callback; // Store the callback
      desktopCapturer.getSources({ types: ['window', 'screen'] })
        .then(async (sources) => {
          console.log('Sending available sources to renderer:', sources.length);
          // Send sources to the renderer window to show a picker
          mainWindow?.webContents.send('electronAPI:availableSources', sources.map(s => ({
            id: s.id,
            name: s.name,
            // Optionally generate and send thumbnails:
            // thumbnail: s.thumbnail.toDataURL()
          })));
        })
        .catch(error => {
          console.error('Error getting desktop sources:', error);
          // Reject the request if sources couldn't be fetched
          if (pendingMediaRequest) {
            // How to properly reject? The API doesn't specify, maybe call with empty object or let it timeout.
            // For now, let's log and potentially let it timeout or the renderer handle the lack of sources.
             pendingMediaRequest = null;
          }
        });
    });

    // --- Handle Renderer's Source Selection ---
    ipcMain.handle('electronAPI:selectSource', (event, sourceId) => {
      console.log(`Renderer selected source: ${sourceId}`);
      if (pendingMediaRequest) {
        desktopCapturer.getSources({ types: ['window', 'screen'] }).then(sources => {
           const selectedSource = sources.find(s => s.id === sourceId);
           if (selectedSource) {
             console.log(`Granting access to source: ${selectedSource.name} (${selectedSource.id}) with loopback audio`);
             try {
               pendingMediaRequest({ video: selectedSource, audio: 'loopback' }); // Use selected source
             } catch (error) {
               console.error("Error granting access to source:", error);
               // Don't throw the error, just log it and clear the request
             }
           } else {
             console.log(`Selected source ID ${sourceId} not found, treating as cancellation.`);
           }
           pendingMediaRequest = null; // Always clear the request after handling
        }).catch(err => {
            console.error("Error re-fetching sources for selection:", err);
            pendingMediaRequest = null;
        });
      } else {
        console.log("No pending media request found, treating as cancellation.");
      }
    });

     ipcMain.handle('electronAPI:cancelSourceSelection', () => {
        console.log("Renderer cancelled source selection.");
        if (pendingMediaRequest) {
            // Instead of calling with empty constraints, we'll just clear the pending request
            pendingMediaRequest = null;
            console.log("Cleared pending media request without error.");
        }
     });

    // Handle request for desktop sources
    ipcMain.handle('electronAPI:getSources', async () => {
      const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
      // You might want to filter or modify sources here, e.g., add thumbnails
      // For simplicity, returning all sources for now
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        // You can generate thumbnails if needed: source.thumbnail.toDataURL()
      }));
    });

    // Handle window controls
    ipcMain.on('electronAPI:minimizeWindow', () => {
      mainWindow?.minimize();
    });

    ipcMain.on('electronAPI:closeWindow', () => {
      mainWindow?.close();
    });

    ipcMain.on('electronAPI:toggleAlwaysOnTop', (event, isAlwaysOnTop) => {
       mainWindow?.setAlwaysOnTop(isAlwaysOnTop);
       // Optionally send back confirmation or new state
       event.reply('electronAPI:alwaysOnTopChanged', mainWindow?.isAlwaysOnTop());
    });

    // Handle request for initial always on top state
    ipcMain.handle('electronAPI:getInitialAlwaysOnTop', () => {
        return mainWindow?.isAlwaysOnTop() ?? false;
    });

    // Handle settings loading
    ipcMain.handle('electronAPI:getSettings', async () => {
        return await loadSettings();
    });

    // Handle settings saving
    ipcMain.handle('electronAPI:setSettings', async (event, settingsToUpdate) => {
        const currentSettings = await loadSettings();
        const newSettings = { ...currentSettings, ...settingsToUpdate };
        await saveSettings(newSettings);
        // Optionally return the saved settings or success status
        return newSettings;
    });

    // Handle screenshot capture
    ipcMain.on('electronAPI:startScreenshot', (event) => {
      console.log('[Main] Starting screenshot process');
      createSelectionWindow();
    });

    ipcMain.on('electronAPI:captureArea', async (event, bounds) => {
      try {
        console.log('[Main] Capturing area:', bounds);
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.bounds;
        const scaleFactor = primaryDisplay.scaleFactor;

        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: {
            width: width * scaleFactor,
            height: height * scaleFactor
          }
        });

        const source = sources[0];
        if (!source) {
          throw new Error('Screen not found');
        }

        // 在專案目錄中創建 screenshots 資料夾
        const screenshotsDir = path.join(__dirname, '../public/screenshots');
        try {
          await fs.mkdir(screenshotsDir, { recursive: true });
        } catch (err) {
          console.log('Screenshots directory already exists');
        }
        
        // 保存截圖到專案目錄
        const timestamp = Date.now();
        const screenshotPath = path.join(screenshotsDir, `screenshot-${timestamp}.png`);
        
        // Calculate the actual capture bounds
        const captureBounds = {
          x: Math.round(bounds.x * scaleFactor),
          y: Math.round(bounds.y * scaleFactor),
          width: Math.round(bounds.width * scaleFactor),
          height: Math.round(bounds.height * scaleFactor)
        };

        if (process.platform === 'darwin') {
          captureBounds.y = captureBounds.y + 80;
        }

        // Ensure bounds are within the screen
        if (captureBounds.x < 0) captureBounds.x = 0;
        if (captureBounds.y < 0) captureBounds.y = 0;
        if (captureBounds.width > width * scaleFactor) captureBounds.width = width * scaleFactor;
        if (captureBounds.height > height * scaleFactor) captureBounds.height = height * scaleFactor;
        
        const image = source.thumbnail.crop(captureBounds).toPNG();
        await fs.writeFile(screenshotPath, image);
        
        if (selectionWindow) {
          selectionWindow.close();
        }
        
        // Send the relative path back to the main window
        const relativePath = `/screenshots/screenshot-${timestamp}.png`;
        console.log('[Main] Screenshot saved to:', screenshotPath);
        console.log('[Main] Relative path:', relativePath);
        mainWindow?.webContents.send('electronAPI:screenshotTaken', relativePath);
      } catch (error) {
        console.error('[Main] Screenshot error:', error);
        mainWindow?.webContents.send('electronAPI:screenshotError', error.message);
      }
    });

    ipcMain.on('electronAPI:cancelScreenshot', () => {
      if (selectionWindow) {
        selectionWindow.close();
      }
    });

    if (process.platform !== 'darwin' && gotTheLock) { 
      const cmdLineUrl = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
      if (cmdLineUrl) {
          console.log(`[main.js app.ready] Initial command line OAuth URL for Windows/Linux: ${cmdLineUrl}`);
          oauthCallbackUrlOnStartup = cmdLineUrl; // Store for did-finish-load
      }
    }
});

app.on("window-all-closed", () => {
    // On Windows/Linux, closing the window usually quits the app.
    // On macOS, the app often stays active.
    // We keep the shortcut active even if the window is closed on macOS.
    if(process.platform !== "darwin"){
        app.quit(); // This will trigger 'will-quit'
    }
});

app.on('will-quit', () => {
  // Unregister the shortcut when the application is about to quit
  globalShortcut.unregister('CommandOrControl+Shift+I');
  console.log('Global shortcut "CommandOrControl+Shift+I" unregistered');
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});