import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { LanguagesIcon, History, LogOut } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/hooks/useI18n'
import { useLanguage } from '@/context/LanguageContext'
import { SupportedLanguage } from '@/lib/translations'
import { useAuth } from '@/context/AuthContext'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  customPrompt?: string
  setCustomPrompt?: (prompt: string) => void
}

export function SettingsModal({
  isOpen,
  onClose,
  customPrompt,
  setCustomPrompt
}: SettingsModalProps) {
  const { t } = useI18n()
  const { language, setLanguage } = useLanguage()
  const { signOut } = useAuth()
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [draftPrompt, setDraftPrompt] = useState(customPrompt || '')

  useEffect(() => {
    setDraftPrompt(customPrompt || '')
  }, [customPrompt])

  useEffect(() => {
    const getInitialData = async () => {
      if (window.electronAPI) {
        try {
          const sharingState = await window.electronAPI.invoke('get-screenshare-state')
          setIsScreenSharing(sharingState)
          const unsubscribe = window.electronAPI.on(
            'screenshare:state-changed',
            (isSharing: boolean) => {
              setIsScreenSharing(isSharing)
            }
          )
          return () => unsubscribe()
        } catch (error) {
          console.error('[SettingsModal] Error fetching screen share state:', error)
        }
      }
    }
    getInitialData()
  }, [])

  const languages = [
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'en-US', name: 'English' },
    { code: 'ja-JP', name: '日本語' }
  ]

  const handleToggleScreenShare = () => {
    if (window.electronAPI) {
      window.electronAPI.send('screenshare:toggle')
    }
  }

  const handleLanguageChange = (value: string) => {
    if (setLanguage) {
      if (isScreenSharing) {
        handleToggleScreenShare()
      }
      setLanguage(value as SupportedLanguage)
    }
  }

  const handleCustomPromptConfirm = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isScreenSharing) {
        handleToggleScreenShare()
      }
      setCustomPrompt?.(draftPrompt)
      e.currentTarget.blur()
    }
  }

  const onShowHistory = () => {
    if (window.electronAPI) {
      window.electronAPI.send('history:open')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setTimeout(() => {
      onClose()
    }, 100)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[430px] p-3 bg-muted/95 border-border/50 max-h-[80vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm font-medium">{t('settingsTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {/* History Button (Moved from ActionsPanel) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowHistory}
            className="w-full justify-start text-sm h-10 text-black hover:bg-black/10 hover:text-black"
          >
            <History className="mr-2 h-4 w-4" />
            {t('viewHistory')}
          </Button>

          {/* Language Selection */}
          <div className="space-y-1.5 p-2 rounded-lg border border-border/50 bg-background/30">
            <div className="flex items-center space-x-2">
              <LanguagesIcon className="h-3 w-3 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">{t('languageSettings')}</h3>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">{t('selectOutputLanguage')}</Label>
              <Select value={language || 'zh-TW'} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-[120px] h-7 text-sm px-2 bg-muted/95 border-border/50">
                  <SelectValue placeholder={t('languageSelectPlaceholder')} />
                </SelectTrigger>
                <SelectContent className="bg-muted/95 border-border/50">
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code} className="text-sm">
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Prompt Section */}
          <div className="space-y-1.5 p-2 rounded-lg border border-border/50 bg-background/30">
            <div className="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <h3 className="text-sm font-medium text-foreground">{t('customPromptTitle')}</h3>
            </div>
            <div className="space-y-1">
              <Textarea
                id="custom-prompt"
                placeholder={t('customPromptPlaceholder')}
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                onKeyDown={handleCustomPromptConfirm}
                className="h-24 text-sm border-border/50 bg-muted/95 focus-visible:ring-0 focus-visible:border-primary focus-visible:outline-none"
              />
              <p className="text-[10px] text-muted-foreground">{t('customPromptHint')}</p>
            </div>
          </div>

          {/* Sign Out Button */}
          <Button variant="destructive" onClick={handleSignOut} className="w-full h-9 text-sm mt-2">
            <LogOut className="mr-2 h-4 w-4" />
            {t('signOut')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
