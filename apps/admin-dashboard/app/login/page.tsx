"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function LoginPage() {
  const { supabase, user, permissions, loading } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  // Auto-redirect if user is already logged in as admin
  // Use ref to prevent infinite redirect loops
  useEffect(() => {
    // Only redirect if we have a valid session AND admin permissions
    // Add extra check to ensure permissions array is not empty
    if (!loading && user && permissions.length > 0 && permissions.includes("admin:read_users") && !hasRedirected.current) {
      hasRedirected.current = true;
      // Use replace to avoid history stack issues
      router.replace("/");
    }
  }, [user, permissions, loading, router]);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Skip if default is true
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        console.error("Error initiating OAuth flow:", error);
      }
    } catch (err) {
      console.error("Unexpected error during login:", err);
    }
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Don't render login form if user is already logged in (will redirect)
  if (user && permissions.includes("admin:read_users")) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p className="text-muted-foreground">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-sm rounded-lg bg-background/60 backdrop-blur-xl border border-white/10 p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          Knovy Admin
        </h1>
        <p className="mb-6 text-muted-foreground">Please sign in to continue</p>
        <Button
          onClick={handleGoogleLogin}
          className="w-full bg-primary/90 hover:bg-primary backdrop-blur-sm transition-all"
        >
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
