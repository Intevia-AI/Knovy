import { useState, useEffect } from 'react'
import { Languages, Info } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import { useLanguage } from '@/hooks/useLanguage'
import type { SupportedLanguage } from '@/lib/translations'

const languages = [
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en-US', name: 'English' }
]

export function GeneralSettings() {
  const { language, setLanguage } = useLanguage()
  const [isRecording, setIsRecording] = useState(false)

  useEffect(() => {
    // Get initial recording state
    window.electronAPI.invoke('get-screenshare-state').then(setIsRecording)

    // Subscribe to recording state changes
    const unsubscribe = window.electronAPI.on('screenshare:state-changed', setIsRecording)
    return () => unsubscribe()
  }, [])

  const handleLanguageChange = (value: string) => {
    // Stop recording if active
    if (isRecording) {
      window.electronAPI.send('app:graceful-stop-and-execute', { postAction: 'stop' })
    }
    // Update language
    setLanguage?.(value as SupportedLanguage)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">General</h2>
        <p className="text-sm text-muted-foreground">
          Manage your general application settings
        </p>
      </div>

      {/* Language Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">Language Settings</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">Output Language</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Choose your preferred transcription language
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
              <p className="text-sm text-muted-foreground">
                Changing language will stop your current recording session
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future: Custom Prompts Card */}
      {/* Placeholder for future implementation */}
    </div>
  )
}
