import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'https://esm.sh/@react-email/components';
import * as React from 'https://esm.sh/react';

interface WaitlistWelcomeEmailProps {
  username: string;
}

const translations = {
  zh: {
    preview: '歡迎加入 Knovy 的等待名單！',
    h1: '歡迎加入 Knovy 的等待名單！',
    hi: '安安',
    thanks: '感謝您加入 Knovy 測試版等待名單',
    moreInfo: '再忍耐一下，測試版現在還塞在路上，就快到ㄌ！',
    button: '回到官網',
    questions: '如果有任何問題，請隨時與我們聯繫。',
    best: '感恩的心，',
    team: 'Archi @ Knovy',
  },
};

const baseUrl = 'https://intevia.app';

export const WaitlistWelcomeEmail = ({
  username,
}: WaitlistWelcomeEmailProps) => {
  const t = translations.zh;
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
          <Text style={text}>{t.thanks}</Text>
          <Text style={text}>{t.moreInfo}</Text>
          <Button
            style={btn}
            href={baseUrl}
          >
            {t.button}
          </Button>
          <Text style={text}>{t.questions}</Text>
          <Text style={text}>
            {t.best}
            <br />
            {t.team}
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default WaitlistWelcomeEmail;

const main = {
  backgroundColor: '#f6f9fc',
  padding: '20px',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #f0f0f0',
  borderRadius: '5px',
  padding: '20px',
  margin: '0 auto',
  maxWidth: '600px',
};

const h1 = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const text = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '16px',
  lineHeight: '24px',
  margin: '24px 0',
};

const btn = {
  backgroundColor: '#000',
  color: '#fff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '16px',
  textDecoration: 'none',
  borderRadius: '5px',
  padding: '12px 20px',
  display: 'inline-block',
  margin: '24px 0',
};