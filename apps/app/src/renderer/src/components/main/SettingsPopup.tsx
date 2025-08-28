import React from 'react'
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
  isScreenSharing: boolean
  onToggleScreenShare: () => void
}

export function SettingsPopup({
  customPrompt,
  setCustomPrompt,
  isScreenSharing,
  onToggleScreenShare
}: SettingsPopupProps) {
  const { t, language } = useI18n()
  const { setLanguage } = useLanguage()

  const languages = [
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'en-US', name: 'English' },
    { code: 'ja-JP', name: '日本語' }
  ]

  const handleLanguageChange = (value: string) => {
    if (setLanguage) {
      if (isScreenSharing) {
        onToggleScreenShare()
      }
      setLanguage(value as SupportedLanguage)
    }
  }

  return (
    <div className="grid gap-2 p-2 bg-muted/10 rounded-2xl">
      <div className="space-y-1.5">
        <Label htmlFor="language" className="text-xs text-black">
          Language
        </Label>
        <Select value={language || 'zh-TW'} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-full h-8 text-xs bg-black/20 border-white/20 text-black">
            <LanguagesIcon className="h-3 w-3" />
            <SelectValue placeholder={t('languageSelectPlaceholder')} />
          </SelectTrigger>
          <SelectContent className="bg-muted/80 backdrop-blur-md border-white/20 text-black">
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
          className="h-32 text-xs resize-none bg-black/20 border-white/20 placeholder:text-gray-400 text-gray-200"
        />
      </div>
    </div>
  )
}
