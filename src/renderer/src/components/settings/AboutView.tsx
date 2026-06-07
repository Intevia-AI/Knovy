import { useState, useEffect } from 'react'
import { Logo } from '@/components/Logo'
import { Sparkles, ExternalLink, Download, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'motion'
import { useTranslation } from '@/context/TranslationContext'

export function AboutView() {
  const { t } = useTranslation()
  const [appVersion, setAppVersion] = useState<string>('Loading...')
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false)

  useEffect(() => {
    // Fetch app version from Electron
    window.electronAPI.getAppVersion().then((version: string) => {
      setAppVersion(version)
      setIsLoading(false)
    })

    // Listen for update check completion or errors
    const unsubscribeUpdateDownloaded = window.electronAPI.on('updater:update-downloaded', () => {
      setIsCheckingForUpdates(false)
      console.log('[AboutView] Update downloaded notification received')
    })

    const unsubscribeCheckError = window.electronAPI.on('updater:check-error', (error: string) => {
      setIsCheckingForUpdates(false)
      console.error('[AboutView] Update check failed:', error)
      // You could show a toast notification here
    })

    return () => {
      unsubscribeUpdateDownloaded()
      unsubscribeCheckError()
    }
  }, [])

  const checkForUpdates = () => {
    // Trigger update check via Electron IPC
    setIsCheckingForUpdates(true)
    window.electronAPI.send('updater:check-for-updates')
    console.log('[AboutView] Manual update check triggered')
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* App Info Card Skeleton */}
        <Card className="text-center">
          <CardContent className="pt-6 space-y-4">
            {/* App Icon Skeleton */}
            <div className="w-24 h-24 mx-auto rounded-2xl bg-muted animate-pulse" />

            {/* App Name Skeleton */}
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>

            <div className="text-sm space-y-2 flex flex-col items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardContent>
        </Card>

        {/* Links Card Skeleton */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t('aboutTab')}</h2>
        <p className="text-sm text-muted-foreground">{t('aboutDescription')}</p>
      </div>

      {/* App Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="text-center">
          <CardContent className="pt-6 space-y-4">
            {/* App Icon */}
            <div className="w-24 h-24 mx-auto rounded-2xl bg-secondary flex items-center justify-center">
              <Logo className="w-12 h-12 text-secondary-foreground" />
            </div>
            {/* App Name */}
            <div>
              <h2 className="text-2xl font-bold">Knovy</h2>
              <p className="text-sm text-muted-foreground">{t('aiPoweredTranscription')}</p>
            </div>

            <div className="text-sm space-y-1">
              <p className="font-mono">
                {t('versionLabel')} {appVersion}
              </p>
              <p className="text-muted-foreground">© {new Date().getFullYear()} Intevia AI</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Links Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Button variant="ghost" className="w-full justify-start" asChild>
              <a href="https://knovy.ai" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('visitWebsite')}
              </a>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={checkForUpdates}
              disabled={isCheckingForUpdates}
            >
              {isCheckingForUpdates ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isCheckingForUpdates ? t('checkingForUpdates') : t('checkForUpdates')}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
