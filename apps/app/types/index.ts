export interface Segment {
  blob: Blob;
  timestamp: number;
}

export interface ElectronSource {
  id: string;
  name: string;
}

export interface AIContextData {
  audioInputs?: { data: string; mimeType: string; label: string }[];
}

// Add type definition for the exposed Electron API
declare global {
  interface Window {
    electronAPI?: {
      getSources: () => Promise<ElectronSource[]>;
      minimizeWindow: () => void;
      closeWindow: () => void;
      toggleAlwaysOnTop: (isAlwaysOnTop: boolean) => void;
      getInitialAlwaysOnTop: () => Promise<boolean>;
      on: (channel: string, callback: (...args: any[]) => void) => () => void; // Returns a cleanup function
      selectSource: (sourceId: string) => void;
      cancelSourceSelection: () => void;
      trimAudio: (blobsBase64: { data: string; mimeType: string }[]) => Promise<string>;
    };
  }
}
