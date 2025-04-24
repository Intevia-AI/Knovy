import { useState, useEffect, useCallback } from 'react';
import type { ElectronSource } from '@/types';

export function useElectron() {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [availableSources, setAvailableSources] = useState<ElectronSource[]>([]);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // Effect to handle Electron-specific initialization and listeners
  useEffect(() => {
    let removeAlwaysOnTopListener: (() => void) | undefined;
    let removeSourcesListener: (() => void) | undefined;

    const initializeElectronFeatures = async () => {
      if (window.electronAPI) {
        // Get initial always-on-top state
        try {
          const initialState = await window.electronAPI.getInitialAlwaysOnTop();
          console.log("Initial Always On Top State:", initialState);
          setIsAlwaysOnTop(initialState);
        } catch (error) {
          console.error("Failed to get initial always on top state:", error);
        }

        // Listen for always-on-top changes from the main process
        removeAlwaysOnTopListener = window.electronAPI.on(
          "electronAPI:alwaysOnTopChanged",
          (newState) => {
            console.log("Always On Top state changed from main process:", newState);
            setIsAlwaysOnTop(newState);
          }
        );

        // Listener for available sources from main process
        removeSourcesListener = window.electronAPI.on(
          "electronAPI:availableSources",
          (sources: ElectronSource[]) => {
            console.log("Received available sources from main:", sources.length);
            setAvailableSources(sources);
            setShowSourcePicker(true); // Show the picker UI
          }
        );

      } else {
        console.warn("Electron API not found. Running in browser mode?");
      }
    };

    initializeElectronFeatures();

    // Cleanup listeners on hook unmount
    return () => {
      removeAlwaysOnTopListener?.();
      removeSourcesListener?.();
    };
  }, []);

  const toggleAlwaysOnTop = useCallback(() => {
    if (window.electronAPI) {
      const newAlwaysOnTopState = !isAlwaysOnTop;
      console.log("Toggling always on top via Electron API to:", newAlwaysOnTopState);
      window.electronAPI.toggleAlwaysOnTop(newAlwaysOnTopState);
      // State will be updated via the listener if successful
    } else {
      console.warn("Electron API not available for toggleAlwaysOnTop");
    }
  }, [isAlwaysOnTop]);

  const minimizeWindow = useCallback(() => {
    if (window.electronAPI) {
      console.log("Minimizing window via Electron API");
      window.electronAPI.minimizeWindow();
    } else {
      console.warn("Electron API not available for minimizeWindow");
    }
  }, []);

  const closeWindow = useCallback(() => {
    if (window.electronAPI) {
      console.log("Closing window via Electron API");
      window.electronAPI.closeWindow();
    } else {
      console.warn("Electron API not available for closeWindow");
    }
  }, []);

   const handleSourceSelect = useCallback((sourceId: string) => {
    setShowSourcePicker(false);
    setAvailableSources([]);
    if (window.electronAPI) {
      window.electronAPI.selectSource(sourceId);
    }
  }, []);

  const handleCancelSelect = useCallback(() => {
    setShowSourcePicker(false);
    setAvailableSources([]);
    if (window.electronAPI) {
      window.electronAPI.cancelSourceSelection();
    }
  }, []);

  return {
    isAlwaysOnTop,
    toggleAlwaysOnTop,
    minimizeWindow,
    closeWindow,
    availableSources,
    showSourcePicker,
    handleSourceSelect,
    handleCancelSelect,
    setShowSourcePicker, // Allow external control if needed
    setAvailableSources, // Allow external control if needed
  };
}
