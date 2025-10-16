// This file is required for Supabase OAuth flow
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const { supabase } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code from the URL
        const code = searchParams.get("code");

        if (code) {
          // Exchange the code for a session using PKCE flow
          // The code_verifier is automatically retrieved from cookies by the Supabase client
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error("Error exchanging code for session:", error);
            setError(error.message);
            setTimeout(() => router.push("/login"), 2000);
            return;
          }

          if (data.session) {
            // Successfully authenticated, redirect to home
            router.push("/");
          } else {
            setError("No session returned");
            setTimeout(() => router.push("/login"), 2000);
          }
        } else {
          // No code in URL, might be hash fragment OAuth (older flow)
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            console.error("Error getting session:", error);
            setError(error.message);
            setTimeout(() => router.push("/login"), 2000);
            return;
          }

          if (data.session) {
            router.push("/");
          } else {
            setError("No authentication code found");
            setTimeout(() => router.push("/login"), 2000);
          }
        }
      } catch (err) {
        console.error("Unexpected error in auth callback:", err);
        setError("An unexpected error occurred");
        setTimeout(() => router.push("/login"), 2000);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Authentication Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-4">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}
