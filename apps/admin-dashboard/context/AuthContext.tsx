'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { SupabaseClient, User } from '@supabase/supabase-js';

interface AuthContextType {
  supabase: SupabaseClient;
  user: User | null;
  permissions: string[];
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        const { access_token } = session;
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-api/me/permissions`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            },
          }
        );
        const data = await response.json();
        setPermissions(data?.permissions || []);
      }
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && session) {
        const { access_token } = session;
        fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-api/me/permissions`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            },
          }
        )
        .then(res => res.json())
        .then(data => {
          setPermissions(data?.permissions || []);
        });
      }
      if (event === 'SIGNED_OUT') {
        setPermissions([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ supabase, user, permissions, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};