"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Eye, ExternalLink } from "lucide-react";

interface EmailPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sampleEmail?: string;
}

export function EmailPreviewDialog({
  isOpen,
  onOpenChange,
  sampleEmail = "user@example.com",
}: EmailPreviewDialogProps) {
  const [locale, setLocale] = useState<"en" | "zh-TW">("en");

  // Email content translations
  const translations = {
    en: {
      subject: "You're invited to Knovy Beta!",
      preview: "You're invited to Knovy Beta!",
      h1: "Welcome to Knovy Beta! 🎉",
      hi: "Hi",
      congrats: "Congratulations! You've been selected to join the Knovy Beta program.",
      betaAccess: "You now have exclusive early access to all premium features, including:",
      features: [
        "Unlimited transcription minutes",
        "AI-powered transcription enhancement",
        "Advanced AI actions (summarize, chat, keyword search)",
        "Screenshot analysis",
        "Smart response recommendations",
        "Priority support"
      ],
      getStarted: "Getting Started",
      downloadApp: "Download Knovy for macOS and sign in with your email address to get started:",
      downloadButton: "Download Knovy",
      note: "Note: Your beta access will be automatically activated when you sign in for the first time.",
      questions: "If you have any questions or feedback, please don't hesitate to reach out. We're excited to hear from you!",
      best: "Welcome aboard,",
      team: "Archi @ INTEVIA",
      footer: "You're receiving this email because you joined the Knovy waitlist. If you no longer wish to participate in the beta program, please contact us.",
    },
    "zh-TW": {
      subject: "您已被邀請加入 Knovy Beta！",
      preview: "您已被邀請加入 Knovy Beta！",
      h1: "歡迎加入 Knovy Beta！🎉",
      hi: "安安",
      congrats: "恭喜！您已被選中加入 Knovy Beta 測試計畫。",
      betaAccess: "您現在可以搶先體驗所有進階功能，包括：",
      features: [
        "無限轉錄時長",
        "AI 增強轉錄功能",
        "進階 AI 功能（摘要、對話、關鍵字搜尋）",
        "螢幕截圖分析",
        "智慧回覆建議",
        "優先技術支援"
      ],
      getStarted: "開始使用",
      downloadApp: "下載 Knovy macOS 版本，並使用您的電子郵件地址登入即可開始使用：",
      downloadButton: "下載 Knovy",
      note: "注意：當您首次登入時，Beta 權限將自動啟用。",
      questions: "如果您有任何問題或建議，請隨時與我們聯繫。我們很期待聽到您的反饋！",
      best: "歡迎加入，",
      team: "Archi @ INTEVIA",
      footer: "您收到此郵件是因為您加入了 Knovy 等待名單。如果您不再希望參與 Beta 測試計畫，請與我們聯繫。",
    },
  };

  const t = translations[locale];
  const username = sampleEmail.split("@")[0];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Email Preview
          </DialogTitle>
          <DialogDescription>
            Preview how the beta invitation email will look for recipients.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Language selector */}
          <div className="flex items-center gap-4">
            <Label htmlFor="preview-locale" className="whitespace-nowrap">Email Language:</Label>
            <Select value={locale} onValueChange={(value: "en" | "zh-TW") => setLocale(value)}>
              <SelectTrigger id="preview-locale" className="w-[250px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh-TW">繁體中文 (Traditional Chinese)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Email metadata */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">From:</span>
              <span className="font-medium">info@intevia.app</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">To:</span>
              <span className="font-medium">{sampleEmail}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subject:</span>
              <span className="font-medium">{t.subject}</span>
            </div>
          </div>

          {/* Email preview */}
          <div className="border rounded-lg overflow-hidden bg-white">
            {/* Email content with styling matching the actual email */}
            <div style={{ backgroundColor: "#f6f9fc", padding: "20px" }}>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #f0f0f0",
                  borderRadius: "5px",
                  padding: "20px",
                  margin: "0 auto",
                  maxWidth: "600px",
                  fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
                }}
              >
                {/* H1 */}
                <h1
                  style={{
                    color: "#333",
                    fontSize: "28px",
                    fontWeight: "bold",
                    margin: "40px 0 20px",
                    padding: "0",
                    textAlign: "center",
                  }}
                >
                  {t.h1}
                </h1>

                {/* Greeting */}
                <p
                  style={{
                    color: "#333",
                    fontSize: "16px",
                    lineHeight: "24px",
                    margin: "16px 0",
                  }}
                >
                  {t.hi} {username},
                </p>

                {/* Congrats */}
                <p
                  style={{
                    color: "#333",
                    fontSize: "16px",
                    lineHeight: "24px",
                    margin: "16px 0",
                  }}
                >
                  {t.congrats}
                </p>

                {/* Beta access intro */}
                <p
                  style={{
                    color: "#333",
                    fontSize: "16px",
                    lineHeight: "24px",
                    margin: "16px 0",
                  }}
                >
                  {t.betaAccess}
                </p>

                {/* Features list */}
                <div
                  style={{
                    backgroundColor: "#f8f9fa",
                    border: "1px solid #e9ecef",
                    borderRadius: "4px",
                    padding: "16px",
                    margin: "20px 0",
                  }}
                >
                  {t.features.map((feature, index) => (
                    <p
                      key={index}
                      style={{
                        color: "#333",
                        fontSize: "15px",
                        lineHeight: "24px",
                        margin: "8px 0",
                      }}
                    >
                      ✓ {feature}
                    </p>
                  ))}
                </div>

                {/* Getting Started */}
                <h2
                  style={{
                    color: "#333",
                    fontSize: "20px",
                    fontWeight: "600",
                    margin: "32px 0 16px",
                    padding: "0",
                  }}
                >
                  {t.getStarted}
                </h2>

                {/* Download instructions */}
                <p
                  style={{
                    color: "#333",
                    fontSize: "16px",
                    lineHeight: "24px",
                    margin: "16px 0",
                  }}
                >
                  {t.downloadApp}
                </p>

                {/* Download button */}
                <div style={{ margin: "24px 0", textAlign: "center" }}>
                  <a
                    href="https://intevia.app/download"
                    style={{
                      backgroundColor: "#000",
                      color: "#fff",
                      fontSize: "16px",
                      fontWeight: "600",
                      textDecoration: "none",
                      borderRadius: "5px",
                      padding: "14px 24px",
                      display: "inline-block",
                    }}
                  >
                    {t.downloadButton}
                  </a>
                </div>

                {/* Note */}
                <div
                  style={{
                    backgroundColor: "#fff9e6",
                    border: "1px solid #ffe066",
                    borderRadius: "4px",
                    padding: "12px 16px",
                    margin: "24px 0",
                  }}
                >
                  <p
                    style={{
                      color: "#856404",
                      fontSize: "14px",
                      lineHeight: "20px",
                      margin: "0",
                    }}
                  >
                    💡 {t.note}
                  </p>
                </div>

                {/* Questions */}
                <p
                  style={{
                    color: "#333",
                    fontSize: "16px",
                    lineHeight: "24px",
                    margin: "16px 0",
                  }}
                >
                  {t.questions}
                </p>

                {/* Signature */}
                <p
                  style={{
                    color: "#333",
                    fontSize: "16px",
                    lineHeight: "24px",
                    margin: "16px 0",
                  }}
                >
                  {t.best}
                  <br />
                  {t.team}
                </p>

                {/* Footer */}
                <div
                  style={{
                    marginTop: "40px",
                    paddingTop: "20px",
                    borderTop: "1px solid #e9ecef",
                  }}
                >
                  <p
                    style={{
                      color: "#6c757d",
                      fontSize: "12px",
                      lineHeight: "18px",
                      margin: "0",
                      textAlign: "center",
                    }}
                  >
                    {t.footer}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">ℹ️ Preview Information</p>
            <p className="text-blue-600">
              This is a preview of how the email will appear to recipients. The actual email will be sent using professional HTML rendering with proper formatting and compatibility across all email clients.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
