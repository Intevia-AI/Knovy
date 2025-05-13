// apps/app/types/electron.d.ts

// Define the structure of the API exposed by preload.js
interface ElectronAPI {
  // Supabase Auth
  supabaseSignInWithOAuth: (provider: { urlToOpen: string }) => Promise<{ success?: boolean; error?: string }>;

  // Screen Capture
  selectSource: (sourceId: string) => Promise<void>; // Assuming no specific return value needed by frontend
  cancelSourceSelection: () => Promise<void>;

  // Window Controls
  minimizeWindow: () => void;
  closeWindow: () => void;
  toggleAlwaysOnTop: (isAlwaysOnTop: boolean) => void;
  getInitialAlwaysOnTop: () => Promise<boolean>;

  // Settings
  getSettings: () => Promise<{ language: string; customPrompt: string; [key: string]: any }>; // Adjust if settings structure is more concrete
  setSettings: (settings: { language?: string; customPrompt?: string; [key: string]: any }) => Promise<{ language: string; customPrompt: string; [key: string]: any }>;

  // Screenshot
  startScreenshot: () => void;
  captureArea: (bounds: { x: number; y: number; width: number; height: number }) => void;
  cancelScreenshot: () => void;
  onScreenshotTaken: (callback: (path: string) => void) => () => void;
  onScreenshotError: (callback: (errorMessage: string) => void) => () => void;

  // Generic IPC Event Listener (from preload.js)
  // This is used for electronAPI.on('channel', callback)
  on: (channel: string, callback: (data: any) => void) => () => void;

  // If there are other methods exposed in preload.js's api object, add them here.
  // For example, if getSources was directly exposed (it seems to be used by selectSource):
  // getSources: () => Promise<Array<{id: string; name: string; thumbnail?: string}>>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI; // Make electronAPI a non-optional property of Window
  }
}

// This empty export makes the file a module, which can be important for global augmentations.
export {}; 