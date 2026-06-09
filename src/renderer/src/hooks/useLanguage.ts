/**
 * @fileoverview Language hook for internationalization support.
 * Manages user language preferences with persistent storage through Electron's
 * settings system and provides language switching functionality.
 */

'use client'
import { useState, useEffect } from 'react'
import { SupportedLanguage } from '@/lib/translations'

/**
 * Language hook return type definition.
 */
interface UseLanguageReturn {
  language: SupportedLanguage
  setLanguage: (language: SupportedLanguage) => void
  isLoading: boolean
}

/**
 * Custom hook to manage user language preferences.
 * Loads language settings from Electron's persistent storage on mount
 * and provides language switching functionality with automatic persistence.
 */
export const useLanguage = (): UseLanguageReturn => {
  /** Current language state */
  const [language, setLanguageState] = useState<SupportedLanguage>('zh-TW') // Default language

  /** Loading state while fetching initial language settings */
  const [isLoading, setIsLoading] = useState(true)

  // Load settings on component mount and listen for changes
  useEffect(() => {
    /**
     * Loads the initial language setting from Electron's persistent storage.
     * Falls back to default language if loading fails or no setting exists.
     */
    const loadInitialLanguage = async () => {
      if (window.electronAPI) {
        try {
          const settings = await window.electronAPI.getSettings()
          if (settings && settings.language) {
            setLanguageState(settings.language as SupportedLanguage)
          }
        } catch (error) {
          console.error('Failed to load language setting:', error)
          // Keep default language if loading fails
        }
      }
      setIsLoading(false) // Mark loading as complete
    }
    loadInitialLanguage()

    const handleSettingsChanged = (settings: { language?: SupportedLanguage }) => {
      if (settings && settings.language) {
        setLanguageState(settings.language)
      }
    }

    const unsubscribe = window.electronAPI.on('settings:changed', handleSettingsChanged)

    return () => {
      unsubscribe()
    }
  }, [])

  /**
   * Sets the current language and persists it to Electron's settings storage.
   * Updates both the local state and the persistent storage simultaneously.
   */
  const setLanguage = async (newLanguage: SupportedLanguage) => {
    setLanguageState(newLanguage)
    if (window.electronAPI) {
      try {
        await window.electronAPI.setSettings({ language: newLanguage })
      } catch (error) {
        console.error('Failed to save language setting:', error)
      }
    }
  }

  return {
    language,
    setLanguage,
    isLoading
  }
}
