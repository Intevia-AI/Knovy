'use client';

import { useAuth } from '@/context/AuthContext';
import { Button } from '@workspace/ui/components/button';

export default function LoginPage() {
  const { supabase } = useAuth();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border p-8 text-center">
        <h1 className="text-2xl font-bold">Knovy Admin</h1>
        <p className="mb-6 text-muted-foreground">Please sign in to continue</p>
        <Button onClick={handleGoogleLogin} className="w-full">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
