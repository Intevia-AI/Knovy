import React, { useState, useEffect } from 'react'
import { LanguagesIcon } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { useLanguage } from '@/context/LanguageContext'
import { SupportedLanguage } from '@/lib/translations'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface SettingsPopupProps {
  customPrompt?: string
  setCustomPrompt?: (prompt: string) => void
}

export function SettingsPopup({
  customPrompt,
  setCustomPrompt
}: SettingsPopupProps) {
  const { t, language } = useI18n()
  const { setLanguage } = useLanguage()
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  useEffect(() => {
    const getInitialData = async () => {
      if (window.electronAPI) {
        try {
          const sharingState = await window.electronAPI.invoke('get-screenshare-state')
          setIsScreenSharing(sharingState)
        } catch (error) {
          console.error('[SettingsPopup] Error fetching screen share state:', error)
        }
      }
    }
    getInitialData()
  }, [])

  useEffect(() => {
    if (window.electronAPI) {
      const unsubscribe = window.electronAPI.on(
        'screenshare:state-changed',
        (isScreenSharing: boolean) => {
          setIsScreenSharing(isScreenSharing)
        }
      )
      return () => unsubscribe()
    }
  }, [])

  const languages = [
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'en-US', name: 'English' },
    { code: 'ja-JP', name: '日本語' }
  ]

  const handleLanguageChange = (value: string) => {
    if (setLanguage) {
      if (isScreenSharing) {
        if (window.electronAPI) {
          window.electronAPI.send('screenshare:toggle')
        }
      }
      setLanguage(value as SupportedLanguage)
    }
  }

  return (
    <div className="glass-popover grid gap-2 p-2">
      <div className="space-y-1.5">
        <Label htmlFor="language" className="text-xs text-black">
          Language
        </Label>
        <Select value={language || 'zh-TW'} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-full h-8 text-xs bg-black/5 border-black/20 text-black">
            <LanguagesIcon className="h-3 w-3" />
            <SelectValue placeholder={t('languageSelectPlaceholder')} />
          </SelectTrigger>
          <SelectContent className="bg-muted/80 backdrop-blur-md border-black/20 text-black">
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code} className="text-xs">
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom-prompt" className="text-xs text-black">
          Custom Prompt
        </Label>
        <Textarea
          id="custom-prompt"
          placeholder="Enter a custom prompt for the AI..."
          value={customPrompt}
          onChange={(e) => setCustomPrompt?.(e.target.value)}
          className="h-24 text-xs resize-none bg-black/5 border-black/20 placeholder:text-gray-500 text-black"
        />
      </div>
    </div>
  )
}