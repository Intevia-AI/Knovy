import React from 'react'
import { Button } from '@/components/ui/button'
import { LanguagesIcon } from 'lucide-react'
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

interface AdvancedSettingsWindowProps {
  isOpen: boolean
  onClose: () => void
  language?: string
  setLanguage?: (language: string) => void
  customPrompt?: string
  setCustomPrompt?: (prompt: string) => void
  isScreenSharing: boolean
  onToggleScreenShare: () => void
}

export default function AdvancedSettingsWindow({
  isOpen,
  onClose,
  language,
  setLanguage,
  customPrompt,
  setCustomPrompt,
  isScreenSharing,
  onToggleScreenShare
}: AdvancedSettingsWindowProps) {
  const [draftPrompt, setDraftPrompt] = React.useState(customPrompt || '')
  const [confirmedPrompt, setConfirmedPrompt] = React.useState(customPrompt)

  const languages = [
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'en-US', name: 'English' },
    { code: 'ja-JP', name: '日本語' }
  ]

  // 處理語言選擇
  const handleLanguageChange = (value: string) => {
    console.log('[AdvancedSettingsWindow] 選擇語言:', value)
    if (setLanguage) {
      // 如果正在螢幕分享，先停止分享
      if (isScreenSharing) {
        console.log('[AdvancedSettingsWindow] 正在螢幕分享，先停止分享')
        onToggleScreenShare()
      }
      setLanguage(value)
    }
  }

  // 處理 custom prompt 確認
  const handleCustomPromptConfirm = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // 如果正在螢幕分享，先停止分享
      if (isScreenSharing) {
        console.log('[AdvancedSettingsWindow] 正在螢幕分享，先停止分享')
        onToggleScreenShare()
      }
      // 確認提示詞
      setConfirmedPrompt(draftPrompt)
      if (setCustomPrompt) {
        setCustomPrompt(draftPrompt)
      }
      e.currentTarget.blur()
    }
  }

  // 處理清除 custom prompt
  const handleClearCustomPrompt = () => {
    // 如果正在螢幕分享，先停止分享
    if (isScreenSharing) {
      console.log('[AdvancedSettingsWindow] 正在螢幕分享，先停止分享')
      onToggleScreenShare()
    }
    setConfirmedPrompt(undefined)
    if (setCustomPrompt) {
      setCustomPrompt('')
    }
    setDraftPrompt('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[430px] p-3 bg-muted/95 border-border/50 max-h-[60vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm font-medium">進階設定</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {/* Language Selection Section */}
          {setLanguage && (
            <div className="space-y-1.5 p-2 rounded-lg border border-border/50 bg-background/30">
              <div className="flex items-center space-x-2">
                <LanguagesIcon className="h-3 w-3 text-muted-foreground" />
                <h3 className="text-xs font-medium text-foreground">語言設定</h3>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">選擇輸出語言</Label>
                <Select value={language || 'zh-TW'} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-[100px] h-6 text-xs px-2 bg-muted/95 border-border/50">
                    <SelectValue placeholder="選擇語言" />
                  </SelectTrigger>
                  <SelectContent className="bg-muted/95 border-border/50">
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code} className="text-xs">
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Custom Prompt Section */}
          {setCustomPrompt && (
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
                <h3 className="text-xs font-medium text-foreground">模型要求</h3>
              </div>

              {!confirmedPrompt ? (
                <div className="space-y-1">
                  <Label htmlFor="custom-prompt" className="text-xs text-muted-foreground">
                    輸入自定義提示詞
                  </Label>
                  <Textarea
                    id="custom-prompt"
                    placeholder="輸入自定義提示詞後按 Enter..."
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    onKeyDown={handleCustomPromptConfirm}
                    className="h-16 text-xs border-border/50 bg-muted/95 focus-visible:ring-0 focus-visible:border-primary focus-visible:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    按 Enter 確認，Shift + Enter 換行
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">當前模型要求</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearCustomPrompt}
                      className="h-5 text-xs bg-muted/95"
                    >
                      清除
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground break-words bg-muted/95 p-2 rounded-md border border-border/50">
                    {confirmedPrompt}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
