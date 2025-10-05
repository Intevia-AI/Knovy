import { useState, useEffect } from 'react'
import { Languages, Info, Monitor, ShieldCheck } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import { useTranslation } from '@/context/TranslationContext'
import type { SupportedLanguage } from '@/lib/translations'

const languages = [
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en-US', name: 'English' }
]

export function GeneralSettings() {
  const { language, setLanguage, t } = useTranslation()
  const [isRecording, setIsRecording] = useState(false)
  const [displays, setDisplays] = useState<any[]>([])
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | undefined>()
  const [isContentProtectionEnabled, setIsContentProtectionEnabled] = useState(false)

  useEffect(() => {
    // Get initial recording state
    window.electronAPI.invoke('get-screenshare-state').then(setIsRecording)

    // Subscribe to recording state changes
    const unsubscribe = window.electronAPI.on('screenshare:state-changed', setIsRecording)
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    // Fetch displays and settings
    const fetchDisplaySettings = async () => {
      try {
        const fetchedDisplays = await window.electronAPI.invoke('electronAPI:getDisplays')
        setDisplays(fetchedDisplays)

        const settings = await window.electronAPI.invoke('electronAPI:getSettings')
        if (settings.displayId) {
          setSelectedDisplayId(settings.displayId)
        }
        if (settings.contentProtection !== undefined) {
          setIsContentProtectionEnabled(settings.contentProtection)
        }
      } catch (error) {
        console.error('[GeneralSettings] Error fetching display settings:', error)
      }
    }

    fetchDisplaySettings()
  }, [])

  const handleLanguageChange = (value: string) => {
    // Stop recording if active
    if (isRecording) {
      window.electronAPI.send('app:graceful-stop-and-execute', { postAction: 'stop' })
    }
    // Update language
    setLanguage?.(value as SupportedLanguage)
  }

  const handleDisplayChange = async (displayIdStr: string) => {
    const displayId = parseInt(displayIdStr, 10)
    setSelectedDisplayId(displayId)
    await window.electronAPI.invoke('electronAPI:setSettings', { displayId })
    window.electronAPI.send('window:set-position', { position: 'bottom-left', displayId })

    // If recording, user should restart manually
    if (isRecording) {
      // Could show a toast notification here about restarting
      console.log('[GeneralSettings] Display changed while recording - restart recommended')
    }
  }

  const handleContentProtectionToggle = () => {
    setIsContentProtectionEnabled(!isContentProtectionEnabled)
    window.electronAPI.toggleContentProtection()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t('generalSection')}</h2>
        <p className="text-sm text-muted-foreground">{t('generalSettingsDescription')}</p>
      </div>

      {/* Language Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">{t('languageSettings')}</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('selectOutputLanguage')}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('generalSettingsDescription')}
              </p>
            </div>
            <Select value={language || 'zh-TW'} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-[200px] bg-background/50 border-border/30">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isRecording && (
            <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/50 p-4">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">{t('languageChangeWarning')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Display Selection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">{t('displaySettingsTitle')}</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('showOnLabel')}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('displaySettingsDescription')}
              </p>
            </div>
            <Select value={selectedDisplayId?.toString()} onValueChange={handleDisplayChange}>
              <SelectTrigger className="w-[200px] bg-background/50 border-border/30">
                <SelectValue placeholder={t('defaultDisplayLabel')} />
              </SelectTrigger>
              <SelectContent>
                {displays.map((display, index) => (
                  <SelectItem key={display.id} value={display.id.toString()}>
                    {`${t('displayLabelPrefix')} ${index + 1}${display.primary ? ` ${t('primaryDisplaySuffix')}` : ''}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Protection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">{t('toggleAppVisibility')}</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('toggleAppVisibilitySubtitle')}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('contentProtectionDescription')}
              </p>
            </div>
            <Switch
              checked={isContentProtectionEnabled}
              onCheckedChange={handleContentProtectionToggle}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
