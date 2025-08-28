/**
 * @fileoverview Electron Integration Hook
 * @module useElectron
 * @description React hook for integrating with Electron desktop app features
 */

import { useState, useEffect, useCallback } from 'react'

/**
 * React hook for Electron desktop app integration
 *
 * @returns {Object} Electron integration controls and state
 * @returns {boolean} isAlwaysOnTop - Whether the window is set to always be on top
 * @returns {function} toggleAlwaysOnTop - Function to toggle always-on-top state
 * @returns {function} minimizeWindow - Function to minimize the window
 * @returns {function} closeWindow - Function to close the window
 *
 * @example
 * ```tsx
 * const {
 *   isAlwaysOnTop,
 *   toggleAlwaysOnTop,
 *   minimizeWindow,
 *   closeWindow
 * } = useElectron();
 *
 * return (
 *   <div>
 *     <button onClick={toggleAlwaysOnTop}>
 *       {isAlwaysOnTop ? 'Disable' : 'Enable'} Always on Top
 *     </button>
 *     <button onClick={minimizeWindow}>Minimize</button>
 *     <button onClick={closeWindow}>Close</button>
 *   </div>
 * );
 * ```
 */
export function useElectron() {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)

  useEffect(() => {
    if (window.electronAPI) {
      const removeAlwaysOnTopListener = window.electronAPI.on(
        'always-on-top-changed',
        (value: boolean) => {
          setIsAlwaysOnTop(value)
        }
      )

      return () => {
        removeAlwaysOnTopListener()
      }
    }
  }, [])

  const toggleAlwaysOnTop = useCallback(() => {
    if (window.electronAPI) {
      const newAlwaysOnTopState = !isAlwaysOnTop
      console.log('Toggling always on top via Electron API to:', newAlwaysOnTopState)
      window.electronAPI.toggleAlwaysOnTop(newAlwaysOnTopState)
      // State will be updated via the listener if successful
    } else {
      console.warn('Electron API not available for toggleAlwaysOnTop')
    }
  }, [isAlwaysOnTop])

  const minimizeWindow = useCallback(() => {
    if (window.electronAPI) {
      console.log('Minimizing window via Electron API')
      window.electronAPI.minimizeWindow()
    } else {
      console.warn('Electron API not available for minimizeWindow')
    }
  }, [])

  const closeWindow = useCallback(() => {
    if (window.electronAPI) {
      console.log('Closing window via Electron API')
      window.electronAPI.closeWindow()
    } else {
      console.warn('Electron API not available for closeWindow')
    }
  }, [])

  return {
    isAlwaysOnTop,
    toggleAlwaysOnTop,
    minimizeWindow,
    closeWindow
  }
}
