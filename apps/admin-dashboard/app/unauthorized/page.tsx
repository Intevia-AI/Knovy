"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleUnauthorized = async () => {
      // Force logout with notification
      await logout(true, "Access denied. Admin privileges required.");

      // Redirect to login after a brief delay
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    };

    handleUnauthorized();
  }, [logout, router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Access Denied</h1>
      <p className="text-muted-foreground mt-2">Admin privileges required.</p>
      <p className="text-sm text-muted-foreground mt-4">Redirecting to login...</p>
    </div>
  );
}
