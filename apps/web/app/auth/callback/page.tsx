"use client";

import { useEffect } from "react";
import { Logo } from "@/components/logo";

export default function AuthCallbackPage() {
  useEffect(() => {
    const attemptRedirect = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      let redirectUrl;

      if (hash) {
        // Forward the entire hash to the custom protocol
        redirectUrl = `intevia://auth/callback${hash}`;
      } else if (search) {
        // Forward the entire query string to the custom protocol as a hash
        redirectUrl = `intevia://auth/callback#${search.substring(1)}`;
      } else {
        // Handle cases where there's no hash or query string
        const error = "No authentication data found in URL.";
        console.error(error);
        redirectUrl = `intevia://auth/callback#error=${encodeURIComponent(error)}`;
      }

      console.log(`Attempting to redirect to: ${redirectUrl}`);

      // Try redirecting immediately
      window.location.href = redirectUrl;

      // As a fallback, try creating a link and clicking it, in case direct assignment is blocked.
      setTimeout(() => {
        try {
          const link = document.createElement('a');
          link.href = redirectUrl;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          console.error("Fallback redirect failed:", e);
        }
      }, 500);
    };

    const timer = setTimeout(attemptRedirect, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-transparent">
      <div className="w-full max-w-sm text-center">
        <Logo className="mx-auto h-12 w-auto" />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">
          Authentication
        </h1>
        <p className="mt-2 text-muted-foreground">
          Please wait while we redirect you back to the application.
        </p>
        <p className="mt-8 text-xs text-muted-foreground">
          You can close this window later.
        </p>
      </div>
    </section>
  );
}
