"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const hasLoggedOut = useRef(false);

  useEffect(() => {
    const handleLogout = async () => {
      // Prevent multiple logout attempts
      if (hasLoggedOut.current) return;
      hasLoggedOut.current = true;

      try {
        // Logout without notification (we'll show a success message)
        await logout(false);

        // Show success message
        toast.success("Successfully logged out");

        // Wait a bit longer to ensure session is fully cleared
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Use replace instead of push to avoid back button issues
        router.replace("/login");
      } catch (error) {
        console.error("Logout error:", error);
        toast.error("Error during logout");
        // Still redirect even if there's an error
        router.replace("/login");
      }
    };

    handleLogout();
  }, [logout, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Logging out...</h1>
        <p className="text-muted-foreground">Please wait while we sign you out.</p>
      </div>
    </div>
  );
}
