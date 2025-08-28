/**
 * @fileoverview Root layout component for the Intevia AI Electron application.
 * Provides global providers, styling, and environment validation for the entire app.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@workspace/ui/globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@workspace/ui/components/sonner";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "../context/AuthContext";
import { validateEnv } from "@/lib/validateEnv";

// Validate environment variables on application startup
// This runs server-side during Next.js initialization
validateEnv();

/** @type {NextFont} Inter font configuration for consistent typography */
const inter = Inter({ subsets: ["latin"] });

/** @type {Metadata} Application metadata for SEO and browser display */
export const metadata: Metadata = {
  title: "Intevia AI",
  description: "Intevia AI a real-time AI transcription and translation app",
};

/**
 * Root layout component that wraps the entire application.
 * Provides global context providers, styling, and notification system.
 *
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} Root layout with providers and global styling
 */
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
