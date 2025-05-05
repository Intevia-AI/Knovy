import React from "react";
import { Button } from "@workspace/ui/components/button";
import { LanguagesIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";

interface AdvancedSettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  language?: string;
  setLanguage?: (language: string) => void;
  customPrompt?: string;
  setCustomPrompt?: (prompt: string) => void;
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
}

export default function AdvancedSettingsWindow({
  isOpen,
  onClose,
  language,
  setLanguage,
  customPrompt,
  setCustomPrompt,
  isScreenSharing,
  onToggleScreenShare,
}: AdvancedSettingsWindowProps) {
  const [draftPrompt, setDraftPrompt] = React.useState(customPrompt || "");
  const [confirmedPrompt, setConfirmedPrompt] = React.useState(customPrompt);

  const languages = [
    { code: "zh-TW", name: "繁體中文" },
    { code: "en-US", name: "English" },
    { code: "ja-JP", name: "日本語" },
    { code: "original", name: "原始語言" },
  ];

  // 處理語言選擇
  const handleLanguageChange = (value: string) => {
    console.log("[AdvancedSettingsWindow] 選擇語言:", value);
    if (setLanguage) {
      // 如果正在螢幕分享，先停止分享
      if (isScreenSharing) {
        console.log("[AdvancedSettingsWindow] 正在螢幕分享，先停止分享");
        onToggleScreenShare();
      }
      setLanguage(value);
    }
  };

  // 處理 custom prompt 確認
  const handleCustomPromptConfirm = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // 如果正在螢幕分享，先停止分享
      if (isScreenSharing) {
        console.log("[AdvancedSettingsWindow] 正在螢幕分享，先停止分享");
        onToggleScreenShare();
      }
      // 確認提示詞
      setConfirmedPrompt(draftPrompt);
      if (setCustomPrompt) {
        setCustomPrompt(draftPrompt);
      }
      e.currentTarget.blur();
    }
  };

  // 處理清除 custom prompt
  const handleClearCustomPrompt = () => {
    // 如果正在螢幕分享，先停止分享
    if (isScreenSharing) {
      console.log("[AdvancedSettingsWindow] 正在螢幕分享，先停止分享");
      onToggleScreenShare();
    }
    setConfirmedPrompt(undefined);
    if (setCustomPrompt) {
      setCustomPrompt('');
    }
    setDraftPrompt('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-4 bg-muted/95 border-border/50">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm font-medium">進階設定</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Language Selection */}
          {setLanguage && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">
                  語言選擇
                </Label>
                <Select
                  value={language || "zh-TW"}
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger className="w-[120px] h-7 text-xs px-2 bg-muted/95 border-border/50">
                    <LanguagesIcon className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="選擇語言" />
                  </SelectTrigger>
                  <SelectContent className="bg-muted/95 border-border/50">
                    {languages.map((lang) => (
                      <SelectItem
                        key={lang.code}
                        value={lang.code}
                        className="text-xs"
                      >
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Custom Prompt Input */}
          {setCustomPrompt && !confirmedPrompt && (
            <div className="space-y-1.5">
              <Label
                htmlFor="custom-prompt"
                className="text-xs font-medium text-foreground"
              >
                客製化模型要求
              </Label>
              <Textarea
                id="custom-prompt"
                placeholder="輸入自定義提示詞後按 Enter..."
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                onKeyDown={handleCustomPromptConfirm}
                className="h-7 text-xs border-border/50 bg-muted/95 focus-visible:ring-0 focus-visible:border-primary focus-visible:outline-none"
              />
            </div>
          )}

          {/* Confirmed Prompt Display */}
          {confirmedPrompt && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">
                  當前模型要求
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCustomPrompt}
                  className="h-6 text-xs bg-muted/95"
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
      </DialogContent>
    </Dialog>
  );
} 