import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@workspace/ui/globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@workspace/ui/components/sonner";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from '../context/AuthContext';
import { validateEnv } from "@/lib/validateEnv";

// Validate environment variables on application startup
// This runs server-side during Next.js initialization
validateEnv();

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Intevia AI",
  description: "Intevia AI a real-time AI transcription and translation app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <LanguageProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}
