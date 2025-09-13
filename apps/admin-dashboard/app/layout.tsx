import "@workspace/ui/globals.css";
import { Providers } from "@/components/providers";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "Knovy Admin",
  description: "Administration dashboard for Knovy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <AuthProvider>
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
