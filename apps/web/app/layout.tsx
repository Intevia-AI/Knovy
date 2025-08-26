import { Geist, Geist_Mono } from "next/font/google";
import { headers } from 'next/headers';

import "@workspace/ui/globals.css";
import { Providers } from "@/components/providers";
import { validateEnv } from "@/lib/validateEnv";
import { LanguageProvider } from "@/context/language-context";
import { getDictionary } from "@/lib/i18n";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

// Validate environment variables on application startup
// This runs server-side during Next.js initialization
validateEnv();

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const getLocale = async () => {
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language');
  if (!acceptLanguage) return 'en';

  if (acceptLanguage.includes('zh-TW')) return 'zh-TW';
  if (acceptLanguage.includes('en')) return 'en';

  return 'en';
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased `}
      >
        <Providers>
          <LanguageProvider initialLocale={locale} initialTranslations={dictionary}>
            {children}
          </LanguageProvider>
          <SpeedInsights />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
