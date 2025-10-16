"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, permissions, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const hasRedirected = useRef(false);
  const hasHandledAuth = useRef(false);

  useEffect(() => {
    const handleAuth = async () => {
      // Prevent multiple auth checks
      if (hasHandledAuth.current) return;

      if (!loading) {
        if (!user) {
          // Only redirect once
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            router.replace("/login");
          }
        } else if (!permissions.includes("admin:read_users")) {
          // User is logged in but not admin
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            setIsLoggingOut(true);
            hasHandledAuth.current = true;

            // Force logout with notification
            await logout(true, "Access denied. Admin privileges required.");

            // Redirect to login after logout completes
            setTimeout(() => {
              router.replace("/login");
            }, 1500);
          }
        } else {
          // User is authenticated and is admin
          hasHandledAuth.current = true;
        }
      }
    };

    handleAuth();
  }, [user, permissions, loading, router, logout, pathname]);

  // Reset refs when pathname changes to allow new auth check
  useEffect(() => {
    hasRedirected.current = false;
    hasHandledAuth.current = false;
  }, [pathname]);

  if (loading || !user || !permissions.includes("admin:read_users") || isLoggingOut) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p className="text-muted-foreground">{isLoggingOut ? "Access denied..." : "Loading..."}</p>
      </div>
    );
  }

  return <>{children}</>;
}
