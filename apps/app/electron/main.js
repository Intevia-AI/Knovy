const { app, BrowserWindow, ipcMain, desktopCapturer, session, systemPreferences } = require("electron");
const serve = require("electron-serve");
const path = require("path");
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const isDev = !app.isPackaged;
const outputDir = path.join(__dirname, "../out");

// Initialize electron-serve only in production
const appServe = !isDev ? serve({
  directory: outputDir
}) : null;

let mainWindow; // Keep a reference to the main window
let pendingMediaRequest = null; // Keep track of the callback for the media request

const createWindow = () => {
  mainWindow = new BrowserWindow({ // Assign to mainWindow
    width: 800,
    height: 600,
    frame: false, // Remove default frame to use custom header
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // Recommended for security
      nodeIntegration: false, // Recommended for security
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
  });
}

// Make the ready handler async to use await
app.on("ready", async () => {
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
             pendingMediaRequest({ video: selectedSource, audio: 'loopback' }); // Use selected source
           } else {
             console.error(`Selected source ID ${sourceId} not found!`);
             // Handle error - maybe reject the original request?
           }
           pendingMediaRequest = null; // Consume the callback
        }).catch(err => {
            console.error("Error re-fetching sources for selection:", err);
            pendingMediaRequest = null;
        });
      } else {
        console.warn("Received source selection, but no pending media request callback found.");
      }
      // No return value needed for handle if we consume the callback
    });

     ipcMain.handle('electronAPI:cancelSourceSelection', () => {
        console.log("Renderer cancelled source selection.");
        if (pendingMediaRequest) {
            // How to cancel? Let's try calling callback with empty constraints.
            // This might cause getDisplayMedia to throw an error in the renderer.
            pendingMediaRequest({});
            pendingMediaRequest = null;
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

    // IPC handler to trim and concatenate audio chunks into last 30 seconds
    ipcMain.handle('electronAPI:trimAudio', async (event, blobs) => {
      try {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-'));
        const listFile = path.join(dir, 'list.txt');
        const fileEntries = [];
        // Write each blob's Base64 data to a file
        for (let i = 0; i < blobs.length; i++) {
          const { data, mimeType } = blobs[i];
          const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
          const filePath = path.join(dir, `chunk${i}.${ext}`);
          fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
          // Escape single quotes in path
          fileEntries.push(`file '${filePath.replace(/'/g, "'\\''")}'
`);
        }
        fs.writeFileSync(listFile, fileEntries.join(''));
        const outputPath = path.join(dir, `trimmed.webm`);
        // Run ffmpeg to concat and trim to 30 seconds
        await new Promise((resolve, reject) => {
          const args = [
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', listFile,
            '-c', 'copy',
            '-t', '30',
            outputPath
          ];
          execFile(ffmpegPath, args, (err) => err ? reject(err) : resolve());
        });
        const outBuf = fs.readFileSync(outputPath);
        return outBuf.toString('base64');
      } catch (err) {
        console.error('Error trimming audio in main:', err);
        throw err;
      }
    });

});

app.on("window-all-closed", () => {
    if(process.platform !== "darwin"){
        app.quit();
    }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});