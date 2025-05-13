// This helps TypeScript understand the shape of the API exposed via contextBridge

import type { ElectronSource } from "./index"; // Assuming ElectronSource is in types/index.d.ts or similar
import { SupportedLanguage } from "../lib/translations"; // Adjust path as needed

// Define the structure of the settings object
interface AppSettings {
  language: SupportedLanguage;
  customPrompt: string;
}

export interface IElectronAPI {
  // Existing methods...
  minimizeWindow: () => void;
  closeWindow: () => void;
  toggleAlwaysOnTop: (isAlwaysOnTop: boolean) => void;
  getInitialAlwaysOnTop: () => Promise<boolean>;
  selectSource: (sourceId: string) => Promise<void>; // Assuming it might return a promise
  cancelSourceSelection: () => Promise<void>; // Assuming it might return a promise
  // getSources: () => Promise<ElectronSource[]>; // Uncomment if you have this method exposed

  // Added methods for settings
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings | void>; // Allow partial updates, return type might vary

  // Event listener method
  on: (channel: string, callback: (...args: any[]) => void) => () => void; // Returns a function to unsubscribe
}

// Augment the global Window interface
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
