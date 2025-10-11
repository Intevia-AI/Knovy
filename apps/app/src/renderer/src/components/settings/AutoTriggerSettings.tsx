import { useState, useEffect } from 'react'
import { Zap, AlertCircle, Info } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslation } from '@/context/TranslationContext'
import type { AutoTriggerSettings as AutoTriggerSettingsType } from '@/types/settings'

export function AutoTriggerSettings() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AutoTriggerSettingsType | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load initial settings
    const loadSettings = async () => {
      try {
        const autoTriggerSettings =
          await window.electronAPI.autoTrigger.getSettings()
        setSettings(autoTriggerSettings)
      } catch (error) {
        console.error('[AutoTriggerSettings] Error loading settings:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()

    // Listen for settings changes
    const unsubscribe = window.electronAPI.autoTrigger.onSettingsChanged(
      (newSettings: AutoTriggerSettingsType) => {
        setSettings(newSettings)
      }
    )

    return () => unsubscribe()
  }, [])

  const updateSettings = async (updates: Partial<AutoTriggerSettingsType>) => {
    try {
      const newSettings = await window.electronAPI.autoTrigger.updateSettings(updates)
      setSettings(newSettings)
    } catch (error) {
      console.error('[AutoTriggerSettings] Error updating settings:', error)
    }
  }

  const handleEnabledToggle = () => {
    if (settings) {
      updateSettings({ enabled: !settings.enabled })
    }
  }

  const handleApprovalModeChange = (value: string) => {
    if (settings) {
      updateSettings({ approvalMode: value as 'ask' | 'automatic' })
    }
  }

  const handleThresholdChange = (value: number[]) => {
    if (settings) {
      updateSettings({ confidenceThreshold: value[0] })
    }
  }

  const handleActionToggle = (actionKey: keyof AutoTriggerSettingsType['enabledActions']) => {
    if (settings) {
      updateSettings({
        enabledActions: {
          ...settings.enabledActions,
          [actionKey]: !settings.enabledActions[actionKey]
        }
      })
    }
  }

  const getThresholdWarning = () => {
    if (!settings) return null
    const threshold = settings.confidenceThreshold

    if (threshold < 0.5) {
      return { type: 'warning' as const, message: t('thresholdWarningLow') }
    } else if (threshold >= 0.5 && threshold <= 0.8) {
      return { type: 'info' as const, message: t('thresholdWarningMedium') }
    } else {
      return { type: 'warning' as const, message: t('thresholdWarningHigh') }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Enable Toggle Card Skeleton */}
        <Card className="bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-6 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Skeleton className="h-5 w-40 mb-1" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          </CardContent>
        </Card>

        {/* Approval Mode Card Skeleton */}
        <Card className="bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load auto-trigger settings.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const thresholdWarning = getThresholdWarning()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t('autoTriggerTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('autoTriggerDescription')}</p>
      </div>

      {/* Enable/Disable Toggle Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">{t('enableAutoTrigger')}</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('enableAutoTrigger')}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('autoTriggerDescription')}
              </p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={handleEnabledToggle} />
          </div>
        </CardContent>
      </Card>

      {/* Approval Mode Card */}
      {settings.enabled && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">{t('approvalMode')}</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={settings.approvalMode} onValueChange={handleApprovalModeChange}>
              <div className="flex items-start space-x-3 rounded-lg border border-border bg-background/50 p-4 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="ask" id="ask" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor="ask"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {t('approvalModeAsk')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('approvalModeAskDescription')}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border border-border bg-background/50 p-4 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="automatic" id="automatic" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor="automatic"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {t('approvalModeAutomatic')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('approvalModeAutomaticDescription')}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Confidence Threshold Card */}
      {settings.enabled && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">{t('confidenceThreshold')}</h3>
            <p className="text-sm text-muted-foreground">{t('confidenceThresholdDescription')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('thresholdLow')}</span>
                <span className="text-2xl font-semibold text-primary">
                  {Math.round(settings.confidenceThreshold * 100)}%
                </span>
                <span className="text-sm text-muted-foreground">{t('thresholdHigh')}</span>
              </div>

              <Slider
                value={[settings.confidenceThreshold]}
                onValueChange={handleThresholdChange}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />

              {thresholdWarning && (
                <Alert variant={thresholdWarning.type === 'warning' ? 'default' : 'default'}>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {thresholdWarning.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enabled Actions Card */}
      {settings.enabled && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">{t('enabledActions')}</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recommend Response */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-4">
              <div className="flex-1">
                <Label className="text-sm font-medium">{t('actionRecommendResponse')}</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('actionRecommendResponseDescription')}
                </p>
              </div>
              <Switch
                checked={settings.enabledActions.recommendResponse}
                onCheckedChange={() => handleActionToggle('recommendResponse')}
              />
            </div>

            {/* Schedule Reminder (Future) */}
            <div className="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/30 p-4 opacity-60">
              <div className="flex-1">
                <Label className="text-sm font-medium text-muted-foreground">
                  {t('actionScheduleReminder')}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('actionScheduleReminderDescription')}
                </p>
                <p className="text-xs text-primary mt-1 font-medium">Coming Soon</p>
              </div>
              <Switch disabled checked={false} />
            </div>

            {/* Send Email (Future) */}
            <div className="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/30 p-4 opacity-60">
              <div className="flex-1">
                <Label className="text-sm font-medium text-muted-foreground">
                  {t('actionSendEmail')}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('actionSendEmailDescription')}
                </p>
                <p className="text-xs text-primary mt-1 font-medium">Coming Soon</p>
              </div>
              <Switch disabled checked={false} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
