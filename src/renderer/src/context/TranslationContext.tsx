/**
 * @fileoverview Translation Context for global internationalization
 * Provides translation functionality throughout the entire application
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, TranslationKey, SupportedLanguage } from '@/lib/translations'

interface TranslationContextType {
  language: SupportedLanguage
  setLanguage: (language: SupportedLanguage) => Promise<void>
  t: (key: TranslationKey) => string
  isLoading: boolean
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

interface TranslationProviderProps {
  children: ReactNode
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const [language, setLanguageState] = useState<SupportedLanguage>('zh-TW')
  const [isLoading, setIsLoading] = useState(true)

  // Load initial language from settings
  useEffect(() => {
    const loadInitialLanguage = async () => {
      if (window.electronAPI) {
        try {
          const settings = await window.electronAPI.getSettings()
          if (settings && settings.language) {
            setLanguageState(settings.language as SupportedLanguage)
          }
        } catch (error) {
          console.error('[TranslationContext] Failed to load language setting:', error)
        }
      }
      setIsLoading(false)
    }
    loadInitialLanguage()

    // Listen for settings changes from other windows
    const handleSettingsChanged = (settings: { language?: SupportedLanguage }) => {
      if (settings && settings.language) {
        console.log('[TranslationContext] Language changed to:', settings.language)
        setLanguageState(settings.language)
      }
    }

    const unsubscribe = window.electronAPI.on('settings:changed', handleSettingsChanged)

    return () => {
      unsubscribe()
    }
  }, [])

  // Update language and persist to settings
  const setLanguage = async (newLanguage: SupportedLanguage) => {
    console.log('[TranslationContext] Setting language to:', newLanguage)
    setLanguageState(newLanguage)
    if (window.electronAPI) {
      try {
        await window.electronAPI.setSettings({ language: newLanguage })
      } catch (error) {
        console.error('[TranslationContext] Failed to save language setting:', error)
      }
    }
  }

  // Translation function
  const t = (key: TranslationKey): string => {
    const currentLang = language || 'en-US'
    return translations[currentLang]?.[key] || translations['en-US']?.[key] || key
  }

  const value: TranslationContextType = {
    language,
    setLanguage,
    t,
    isLoading
  }

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>
}

export function useTranslation(): TranslationContextType {
  const context = useContext(TranslationContext)
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider')
  }
  return context
}
