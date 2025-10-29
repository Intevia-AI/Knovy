import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "https://esm.sh/@react-email/components";
import * as React from "https://esm.sh/react";

interface BetaInvitationEmailProps {
  username: string;
  locale: string;
}

const translations = {
  en: {
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

const baseUrl = "https://intevia.app";
const downloadUrl = "https://intevia.app/download"; // Update with actual download link

export const BetaInvitationEmail = ({ username, locale }: BetaInvitationEmailProps) => {
  const t = translations[locale as keyof typeof translations] || translations["en"];

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{t.h1}</Heading>

          <Text style={text}>
            {t.hi} {username},
          </Text>

          <Text style={text}>{t.congrats}</Text>

          <Text style={text}>{t.betaAccess}</Text>

          <Section style={featureList}>
            {t.features.map((feature, index) => (
              <Text key={index} style={featureItem}>
                ✓ {feature}
              </Text>
            ))}
          </Section>

          <Heading style={h2}>{t.getStarted}</Heading>

          <Text style={text}>{t.downloadApp}</Text>

          <Button style={btn} href={downloadUrl}>
            {t.downloadButton}
          </Button>

          <Section style={noteSection}>
            <Text style={noteText}>
              💡 {t.note}
            </Text>
          </Section>

          <Text style={text}>{t.questions}</Text>

          <Text style={text}>
            {t.best}
            <br />
            {t.team}
          </Text>

          <Section style={footer}>
            <Text style={footerText}>{t.footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default BetaInvitationEmail;

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  padding: "20px",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #f0f0f0",
  borderRadius: "5px",
  padding: "20px",
  margin: "0 auto",
  maxWidth: "600px",
};

const h1 = {
  color: "#333",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "28px",
  fontWeight: "bold",
  margin: "40px 0 20px",
  padding: "0",
  textAlign: "center" as const,
};

const h2 = {
  color: "#333",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "20px",
  fontWeight: "600",
  margin: "32px 0 16px",
  padding: "0",
};

const text = {
  color: "#333",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
};

const featureList = {
  backgroundColor: "#f8f9fa",
  border: "1px solid #e9ecef",
  borderRadius: "4px",
  padding: "16px",
  margin: "20px 0",
};

const featureItem = {
  color: "#333",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "8px 0",
};

const btn = {
  backgroundColor: "#000",
  color: "#fff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  borderRadius: "5px",
  padding: "14px 24px",
  display: "inline-block",
  margin: "24px 0",
  textAlign: "center" as const,
};

const noteSection = {
  backgroundColor: "#fff9e6",
  border: "1px solid #ffe066",
  borderRadius: "4px",
  padding: "12px 16px",
  margin: "24px 0",
};

const noteText = {
  color: "#856404",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0",
};

const footer = {
  marginTop: "40px",
  paddingTop: "20px",
  borderTop: "1px solid #e9ecef",
};

const footerText = {
  color: "#6c757d",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
  textAlign: "center" as const,
};
