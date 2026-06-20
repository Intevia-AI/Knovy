/**
 * @fileoverview Central type definitions for the renderer process
 */

// Audio types
export interface AudioMessage {
  id: string
  content: string
  timestamp: number
  sourceType: 'microphone' | 'system'
  speaker?: string
}

// AI types
export interface AIMessage {
  id: string
  content: string
  timestamp: number
  type: 'user' | 'assistant'
}

// Electron API types
export interface ElectronAPI {
  platform: string
  send: (channel: string, data?: any) => void
  invoke: (channel: string, data?: any) => Promise<any>
  on: (channel: string, callback: (...args: any[]) => void) => () => void
  getSettings: () => Promise<any>
  setSettings: (settings: any) => Promise<void>
  openExternal: (url: string) => void
  quitApp: () => void
  toggleContentProtection: () => void
  transcriptionSetupEnhancement: () => Promise<{ success: boolean }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
