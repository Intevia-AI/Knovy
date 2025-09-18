import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  LanguagesIcon,
  History,
  Power,
  LogOut,
  Loader2,
  MonitorIcon,
  Gauge,
  ShieldCheck
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/hooks/useI18n'
import { useLanguage } from '@/context/LanguageContext'
import { SupportedLanguage } from '@/lib/translations'
import { useAuth } from '@/context/AuthContext'
import { motion, AnimatePresence } from 'motion'

export function SettingsPanel() {
  const { t } = useI18n()
  const { language, setLanguage } = useLanguage()
  const { signOut, sessionProfile } = useAuth()

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
  const [liveDuration, setLiveDuration] = useState(0)
  const [isContentProtectionEnabled, setIsContentProtectionEnabled] = useState(false)
  const popoverId = 'settings'

  const formatQuotaName = (metric: string) => {
    const name = metric
      .replace('daily_', '')
      .replace('ai_action:', '')
      .replace('_calls', '')
      .replace('session_count', 'sessions')
      .replace('_', ' ')
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const quotas = sessionProfile?.quotas
    ? Object.entries(sessionProfile.quotas).map(([metric, data]) => {
        if (metric === 'daily_transcription_minutes') {
          // While sharing, the "used" value from the profile is the baseline. We add the live duration on top.
          const baselineMinutes = data.used
          const liveMinutes = isScreenSharing ? liveDuration / 60 : 0
          return [metric, { ...data, used: baselineMinutes + liveMinutes }]
        }
        return [metric, data]
      })
    : []

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('popover:prepare-to-close', (id) => {
      if (id === popoverId) {
        setIsOpen(false)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const handleDurationUpdate = (duration: number) => {
      setLiveDuration(duration)
    }
    const unsubscribe = window.electronAPI.on('session:duration-update', handleDurationUpdate)

    // Request initial state when panel opens
    window.electronAPI.invoke('get-screenshare-state').then(setIsScreenSharing)

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
          if (settings.contentProtection) {
            setIsContentProtectionEnabled(settings.contentProtection)
          }

          return () => unsubscribeShare()
        } catch (error) {
          console.error('[SettingsPanel] Error fetching initial data:', error)
        }
      }
    }
    getInitialData()
  }, [])

  const languages = [
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'en-US', name: 'English' }
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
          className={`glass-popover p-3 space-y-3 h-screen w-full relative select-none ${
            showRestartConfirm ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
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
                  className="bg-background/50 p-4 rounded-lg border border-border/50 text-center space-y-3"
                >
                  <h3 className="font-semibold text-foreground">{t('restartSessionTitle')}</h3>
                  <p className="text-sm text-muted-foreground">{t('restartSessionMessage')}</p>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={handleCancelRestart}>
                      {t('cancelButton')}
                    </Button>
                    <Button onClick={handleConfirmRestart}>{t('restartButton')}</Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* General Section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2">
              {t('generalSection')}
            </h3>
            <hr className="m-2" />
            <div className="space-y-2 m-2">
              <Button
                variant="default"
                size="sm"
                onClick={onShowHistory}
                className="w-full h-9 text-sm m-2"
              >
                <History className="mr-2 h-4 w-4" />
                {t('viewHistory')}
              </Button>
            </div>
            {/* Language Selection */}
            <hr className="m-2" />
            <div className="space-y-2 p-2 m-2">
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
            {/* <hr className="m-2" />
            <div className="space-y-2 p-2 m-2">
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
            </div> */}
          </div>

          {/* Appearance Section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2">
              {t('appearanceSection')}
            </h3>
            {/* Display Selection */}
            <hr className="m-2" />
            <div className="space-y-2 p-2 m-2">
              <div className="flex items-center space-x-2">
                <MonitorIcon className="h-3 w-3 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">{t('displaySettingsTitle')}</h3>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">{t('showOnLabel')}</Label>
                <Select value={selectedDisplayId?.toString()} onValueChange={handleDisplayChange}>
                  <SelectTrigger className="w-[120px] h-7 text-sm px-2 bg-muted/95 border-border/50">
                    <SelectValue placeholder={t('defaultDisplayLabel')} />
                  </SelectTrigger>
                  <SelectContent className="bg-muted/95 border-border/50">
                    {displays.map((display, index) => (
                      <SelectItem key={display.id} value={display.id.toString()}>
                        {`${t('displayLabelPrefix')} ${index + 1}${display.primary ? ` ${t('primaryDisplaySuffix')}` : ''}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* App Visibility Toggle */}
            <hr className="m-2" />
            <div className="space-y-2 p-2 m-2">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">{t('toggleAppVisibility')}</h3>
              </div>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="content-protection-switch"
                  className="text-sm text-muted-foreground"
                >
                  {t('toggleAppVisibilitySubtitle')}
                </Label>
                <Switch
                  id="content-protection-switch"
                  checked={isContentProtectionEnabled}
                  onCheckedChange={() => {
                    setIsContentProtectionEnabled(!isContentProtectionEnabled)
                    window.electronAPI.toggleContentProtection()
                  }}
                />
              </div>
            </div>
          </div>

          {/* Account Section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2">
              {t('accountSection')}
            </h3>
            {/* Usage Quotas */}
            <hr className="m-2" />
            <div className="space-y-2 p-2 m-2">
              <div className="flex items-center space-x-2">
                <Gauge className="h-3 w-3 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">Daily Quotas</h3>
              </div>
              <div className="space-y-2 text-sm pt-1">
                {quotas.length > 0 ? (
                  quotas.map(([metric, data]) => (
                    <div key={metric} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{formatQuotaName(metric)}</span>
                      <span className="font-mono text-foreground">
                        {data.limit === -1 ? '∞' : `${Math.round(data.used)} / ${data.limit}`}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-xs text-center">
                    Usage data not available.
                  </p>
                )}
              </div>
            </div>
            {/* Sign Out Button */}
            <div className="space-y-2 m-2">
              <Button
                variant="destructive"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full h-9 text-sm m-2"
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
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Quit Knovy Section */}
          <div>
            <div className="space-y-2 m-2">
              <Button
                variant="default"
                onClick={() => window.electronAPI.quitApp()}
                className="w-full h-9 text-sm m-2"
              >
                <Power className="mr-2 h-4 w-4" />
                {t('quitKnovy')}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
