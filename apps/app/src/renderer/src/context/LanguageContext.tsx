/**
 * @fileoverview Language context provider for internationalization support.
 * Manages user language preferences with persistent storage through Electron's
 * settings system and provides language switching functionality.
 */

'use client'
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react'
import { SupportedLanguage } from '@/lib/translations' // Adjust path if needed

/**
 * Language context type definition.
 *
 * @interface LanguageContextType
 * @property {SupportedLanguage} language - Currently selected language
 * @property {Function} setLanguage - Function to change the current language
 */
interface LanguageContextType {
  language: SupportedLanguage
  setLanguage: (language: SupportedLanguage) => void
  isLoading: boolean // Add isLoading to context type
}

/** @type {React.Context} Language context instance */
const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

/**
 * Language provider component that manages user language preferences.
 * Loads language settings from Electron's persistent storage on mount
 * and provides language switching functionality with automatic persistence.
 *
 * @component
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to wrap with language context
 * @returns {JSX.Element} Provider component wrapping children with language context
 */
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  /** @type {SupportedLanguage} Current language state */
  const [language, setLanguageState] = useState<SupportedLanguage>('zh-TW') // Default language

  /** @type {boolean} Loading state while fetching initial language settings */
  const [isLoading, setIsLoading] = useState(true)

  // Load settings on component mount and listen for changes
  useEffect(() => {
    /**
     * Loads the initial language setting from Electron's persistent storage.
     * Falls back to default language if loading fails or no setting exists.
     *
     * @async
     * @function loadInitialLanguage
     * @returns {Promise<void>}
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
   *
   * @async
   * @function setLanguage
   * @param {SupportedLanguage} newLanguage - The language to set as current
   * @returns {Promise<void>}
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

  // Don't render children until settings are loaded to prevent flash of default language
  if (isLoading) {
    return null // Or a loading indicator
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  )
}

/**
 * Custom hook to access the language context.
 * Must be used within a LanguageProvider component tree.
 *
 * @hook useLanguage
 * @returns {LanguageContextType} Language context value with current language and setter
 * @throws {Error} When used outside of LanguageProvider
 */
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
