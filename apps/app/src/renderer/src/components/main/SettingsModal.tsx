import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { LanguagesIcon, History, LogOut, Loader2, MonitorIcon } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/hooks/useI18n'
import { useLanguage } from '@/context/LanguageContext'
import { SupportedLanguage } from '@/lib/translations'
import { useAuth } from '@/context/AuthContext'
import { motion, AnimatePresence } from 'motion'

export function SettingsModal() {
  const { t } = useI18n()
  const { language, setLanguage } = useLanguage()
  const { signOut } = useAuth()
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [draftPrompt, setDraftPrompt] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const isSigningOutRef = useRef(false)
  const [displays, setDisplays] = useState<any[]>([])
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | undefined>()
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [pendingDisplayId, setPendingDisplayId] = useState<number | null>(null)

  const popoverId = 'settings'

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('popover:prepare-to-close', (id) => {
      if (id === popoverId) {
        setIsOpen(false)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showRestartConfirm) {
          setShowRestartConfirm(false)
        } else {
          setIsOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showRestartConfirm])

  useEffect(() => {
    const getInitialData = async () => {
      if (window.electronAPI) {
        try {
          // Fetch screen share state
          const sharingState = await window.electronAPI.invoke('get-screenshare-state')
          setIsScreenSharing(sharingState)
          const unsubscribeShare = window.electronAPI.on(
            'screenshare:state-changed',
            (isSharing: boolean) => {
              setIsScreenSharing(isSharing)
            }
          )

          // Fetch displays and settings
          const fetchedDisplays = await window.electronAPI.invoke('electronAPI:getDisplays')
          setDisplays(fetchedDisplays)
          const settings = await window.electronAPI.invoke('electronAPI:getSettings')
          if (settings.displayId) {
            setSelectedDisplayId(settings.displayId)
          }

          return () => unsubscribeShare()
        } catch (error) {
          console.error('[SettingsModal] Error fetching initial data:', error)
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

  const applyDisplayChange = async (displayId: number) => {
    setSelectedDisplayId(displayId)
    await window.electronAPI.invoke('electronAPI:setSettings', { displayId })
    window.electronAPI.send('window:set-position', { position: 'bottom-left', displayId })
  }

  const handleDisplayChange = (displayIdStr: string) => {
    const displayId = parseInt(displayIdStr, 10)
    if (isScreenSharing && displayId !== selectedDisplayId) {
      setPendingDisplayId(displayId)
      setShowRestartConfirm(true)
    } else {
      applyDisplayChange(displayId)
    }
  }

  const handleConfirmRestart = () => {
    if (pendingDisplayId === null) return
    applyDisplayChange(pendingDisplayId)
    window.electronAPI.send('settings:request-screenshare-restart')
    setShowRestartConfirm(false)
    setPendingDisplayId(null)
  }

  const handleCancelRestart = () => {
    setShowRestartConfirm(false)
    setPendingDisplayId(null)
  }

  const handleCustomPromptConfirm = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isScreenSharing) {
        handleToggleScreenShare()
      }
      setCustomPrompt(draftPrompt)
      e.currentTarget.blur()
    }
  }

  const onShowHistory = () => {
    if (window.electronAPI) {
      window.electronAPI.send('history:open')
    }
  }

  const handleSignOut = () => {
    setIsSigningOut(true)
    isSigningOutRef.current = true
    setIsOpen(false)
  }

  const handleAnimationComplete = () => {
    // This function is called when the exit animation completes.
    // We can now safely close the window and request the main process to sign out.
    window.electronAPI.send('popover:ready-to-close', popoverId)
    if (isSigningOutRef.current) {
      window.electronAPI.send('auth:request-sign-out')
    }
  }

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="glass-popover p-3 space-y-3 h-screen w-full overflow-y-auto relative"
        >
          <AnimatePresence>
            {showRestartConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-background/50 p-4 rounded-lg border border-border/50 max-w-xs text-center space-y-3 shadow-lg"
                >
                  <h3 className="font-semibold text-foreground">Restart Session?</h3>
                  <p className="text-sm text-muted-foreground">
                    To capture the new display, the current screen sharing session must be
                    restarted.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={handleCancelRestart}>
                      Cancel
                    </Button>
                    <Button onClick={handleConfirmRestart}>Restart</Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* History Button */}
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

          {/* Display Selection */}
          <div className="space-y-1.5 p-2 rounded-lg border border-border/50 bg-background/30">
            <div className="flex items-center space-x-2">
              <MonitorIcon className="h-3 w-3 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Display</h3>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Show on</Label>
              <Select value={selectedDisplayId?.toString()} onValueChange={handleDisplayChange}>
                <SelectTrigger className="w-[120px] h-7 text-sm px-2 bg-muted/95 border-border/50">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent className="bg-muted/95 border-border/50">
                  {displays.map((display, index) => (
                    <SelectItem key={display.id} value={display.id.toString()}>
                      {`Display ${index + 1}${display.primary ? ' (Primary)' : ''}`}
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
          <Button
            variant="destructive"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full h-9 text-sm mt-2"
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                {t('signOut')}
              </>
            )}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
