import { Geist, Geist_Mono } from "next/font/google";

import "@workspace/ui/globals.css";
import { Providers } from "@/components/providers";
import { validateEnv } from "@/lib/validateEnv";
import { LanguageProvider } from "@/context/language-context";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased `}
      >
        <Providers>
          <LanguageProvider>{children}</LanguageProvider>
          <SpeedInsights />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
