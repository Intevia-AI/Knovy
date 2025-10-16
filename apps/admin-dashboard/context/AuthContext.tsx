"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { toast } from "sonner";

interface AuthContextType {
  supabase: SupabaseClient;
  user: User | null;
  permissions: string[];
  loading: boolean;
  logout: (showNotification?: boolean, message?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const logout = async (showNotification = false, message?: string) => {
    try {
      // Clear state first to prevent any race conditions
      setUser(null);
      setPermissions([]);

      // Clear storage
      localStorage.clear();
      sessionStorage.clear();

      // Sign out from Supabase (this clears cookies)
      await supabase.auth.signOut();

      // Show notification if requested
      if (showNotification) {
        toast.error(message || "You have been logged out");
      }

      // Wait a bit to ensure all async operations complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error("Error during logout:", error);
      // Still clear local state even if supabase signout fails
      setUser(null);
      setPermissions([]);
      localStorage.clear();
      sessionStorage.clear();

      if (showNotification) {
        toast.error(message || "Logged out (with errors)");
      }
    }
  };

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        // Get user profile to check role
        const { access_token } = session;
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-session-profile`,
            {
              headers: {
                Authorization: `Bearer ${access_token}`,
              },
            },
          );

          if (response.ok) {
            const data = await response.json();
            // If user has admin role, grant all admin permissions
            if (data.role === "admin") {
              setPermissions(["admin:read_users", "admin:write_users", "admin:analytics"]);
            } else {
              setPermissions([]);
            }
          } else {
            console.error("Failed to fetch user profile:", response.status);
            setPermissions([]);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setPermissions([]);
        }
      }
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session) {
        const { access_token } = session;
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-session-profile`,
            {
              headers: {
                Authorization: `Bearer ${access_token}`,
              },
            },
          );

          if (response.ok) {
            const data = await response.json();
            // If user has admin role, grant all admin permissions
            if (data.role === "admin") {
              setPermissions(["admin:read_users", "admin:write_users", "admin:analytics"]);
            } else {
              setPermissions([]);
            }
          } else {
            console.error("Failed to fetch user profile:", response.status);
            setPermissions([]);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setPermissions([]);
        }
      }
      if (event === "SIGNED_OUT") {
        setPermissions([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ supabase, user, permissions, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
