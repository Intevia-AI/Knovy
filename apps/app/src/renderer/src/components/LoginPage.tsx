'use client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Loader2, X } from 'lucide-react'
import { Logo } from '@/components/logo'
import { motion } from 'motion'

const AuthPageContainer = ({ children }: { children: React.ReactNode }) => {
  const { user, signOut } = useAuth()

  const handleClose = async () => {
    if (user) {
      await signOut()
    }
    window.electronAPI.send('app:quit')
  }

  return (
    <div
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="flex flex-col items-center justify-center h-screen text-foreground select-none bg-transparent overflow-hidden rounded-lg glass-popover"
    >
      <button
        onClick={handleClose}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="absolute top-2 right-2 z-10 p-1 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted-foreground/10 transition-colors"
        aria-label="Close window"
      >
        <X size={16} />
      </button>
      {children}
    </div>
  )
}

export function LoginPage() {
  const { signInWithProvider, isLoading } = useAuth()

  const handleSignIn = () => {
    signInWithProvider('google').catch((error) => {
      console.error('Sign-in failed', error)
    })
  }

  return (
    <AuthPageContainer>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex flex-col items-center justify-center text-center p-8"
      >
        <Logo className="h-12 w-12 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Welcome to Knovy</h1>
        <p className="text-muted-foreground mb-6">Sign in to continue</p>
        <Button
          onClick={handleSignIn}
          disabled={isLoading}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="w-full max-w-xs rounded-full"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In with Google'}
        </Button>
      </motion.div>
    </AuthPageContainer>
  )
}

export const Waitlist = () => (
  <AuthPageContainer>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center text-center p-8"
    >
      <Logo className="h-12 w-12 mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">Oops!</h1>
      <p className="text-muted-foreground mb-6">
        We're still in close-beta! We'll notify you when you have access.
      </p>
      <Button
        className="w-full max-w-xs rounded-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={() => {
          window.electronAPI.openExternal('https://intevia.app')
        }}
      >
        Join the Waitlist
      </Button>
    </motion.div>
  </AuthPageContainer>
)
