import React from "react";
import { LanguagesIcon } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { useLanguage } from "@/context/LanguageContext";
import { SupportedLanguage } from "@/lib/translations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SettingsPopupProps {
  customPrompt?: string;
  setCustomPrompt?: (prompt: string) => void;
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
}

export function SettingsPopup({ customPrompt, setCustomPrompt, isScreenSharing, onToggleScreenShare }: SettingsPopupProps) {
  const { t, language } = useI18n();
  const { setLanguage } = useLanguage();

  const languages = [
    { code: "zh-TW", name: "繁體中文" },
    { code: "en-US", name: "English" },
    { code: "ja-JP", name: "日本語" },
    { code: "original", name: "原始語言" },
  ];

  const handleLanguageChange = (value: string) => {
    if (setLanguage) {
      if (isScreenSharing) {
        onToggleScreenShare();
      }
      setLanguage(value as SupportedLanguage);
    }
  };

  return (
    <div className="grid gap-4 p-4">
      <div className="space-y-2">
        <h4 className="font-medium leading-none">Settings</h4>
        <p className="text-sm text-muted-foreground">
          Manage application settings.
        </p>
      </div>
      <div className="grid gap-2">
        <div className="grid grid-cols-3 items-center gap-4">
          <Label htmlFor="language">Language</Label>
          <Select
            value={language || "zh-TW"}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger className="w-[120px] h-7! text-xs px-2 bg-background!">
              <LanguagesIcon className="h-3 w-3 mr-1" />
              <SelectValue placeholder={t("languageSelectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
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
        <div className="grid grid-cols-3 items-center gap-4">
          <Label htmlFor="custom-prompt">Custom Prompt</Label>
          <Textarea
            id="custom-prompt"
            placeholder="Enter custom prompt..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt?.(e.target.value)}
            className="col-span-2 h-16 text-xs"
          />
        </div>
      </div>
    </div>
  );
}