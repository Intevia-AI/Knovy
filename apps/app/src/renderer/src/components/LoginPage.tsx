'use client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { Logo } from '@/components/logo'

/**
 * A simple login page that provides a button to sign in with Google.
 * It uses the useAuth hook to access the signInWithProvider function.
 *
 * @component
 * @returns {JSX.Element} The login page UI.
 */
export function LoginPage() {
  const { signInWithProvider, isLoading } = useAuth()

  const handleSignIn = () => {
    signInWithProvider('google').catch((error) => {
      console.error('Sign-in failed', error)
      // Optionally, show an error message to the user
    })
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
      <div className="text-center">
        <Logo className="h-12 w-12 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Welcome to Knovy</h1>
        <p className="text-muted-foreground mb-6">Sign in to continue</p>
        <Button onClick={handleSignIn} disabled={isLoading} className="w-full max-w-xs">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            // Using a generic icon/text as lucide-react may not have a Google logo
            'Sign In with Google'
          )}
        </Button>
      </div>
    </div>
  )
}
