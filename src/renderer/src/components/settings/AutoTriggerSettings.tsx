import { useState, useEffect } from 'react'
import { Zap, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
        const autoTriggerSettings = await window.electronAPI.autoTrigger.getSettings()
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

  const handleActionToggle = (actionKey: keyof AutoTriggerSettingsType['actions']) => {
    if (settings) {
      updateSettings({
        actions: {
          ...settings.actions,
          [actionKey]: {
            ...settings.actions[actionKey],
            enabled: !settings.actions[actionKey].enabled
          }
        }
      })
    }
  }

  const handleActionApprovalModeChange = (
    actionKey: keyof AutoTriggerSettingsType['actions'],
    value: 'ask' | 'automatic'
  ) => {
    if (settings) {
      updateSettings({
        actions: {
          ...settings.actions,
          [actionKey]: {
            ...settings.actions[actionKey],
            approvalMode: value
          }
        }
      })
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
              <p className="text-xs text-muted-foreground mt-1">{t('autoTriggerDescription')}</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={handleEnabledToggle} />
          </div>
        </CardContent>
      </Card>

      {/* Actions Card with per-action settings */}
      {settings.enabled && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">{t('enabledActions')}</h3>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recommend Response */}
            <div className="space-y-3 rounded-lg border border-border bg-background/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium">{t('actionRecommendResponse')}</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('actionRecommendResponseDescription')}
                  </p>
                </div>
                <Switch
                  checked={settings.actions.recommendResponse.enabled}
                  onCheckedChange={() => handleActionToggle('recommendResponse')}
                />
              </div>

              {/* Per-action approval mode */}
              {settings.actions.recommendResponse.enabled && (
                <div className="pl-4 border-l-2 border-border space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('approvalMode')}
                  </Label>
                  <RadioGroup
                    value={settings.actions.recommendResponse.approvalMode}
                    onValueChange={(value) =>
                      handleActionApprovalModeChange(
                        'recommendResponse',
                        value as 'ask' | 'automatic'
                      )
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ask" id="recommend-ask" />
                      <Label htmlFor="recommend-ask" className="text-xs cursor-pointer">
                        {t('approvalModeAsk')}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="automatic" id="recommend-auto" />
                      <Label htmlFor="recommend-auto" className="text-xs cursor-pointer">
                        {t('approvalModeAutomatic')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            {/* Schedule Reminder (Future) */}
            <div className="space-y-3 rounded-lg border border-dashed border-muted bg-muted/30 p-4 opacity-60">
              <div className="flex items-center justify-between">
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
            </div>

            {/* Send Email (Future) */}
            <div className="space-y-3 rounded-lg border border-dashed border-muted bg-muted/30 p-4 opacity-60">
              <div className="flex items-center justify-between">
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
