import { useState, useEffect, useRef } from 'react'
import { Logo } from '@/components/Logo'
import { ExternalLink, Download, Loader2, MessageSquare, Github } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useTranslation } from '@/context/TranslationContext'

const WEBSITE_URL = 'https://knovy.app/'
const RELEASES_URL = 'https://github.com/Intevia-AI/Knovy/releases/latest'
// Keep the "Checking..." state visible for at least this long so a near-instant
// result doesn't flash the button text and toast.
const MIN_CHECK_DURATION_MS = 800

export function AboutView() {
  const { t, language } = useTranslation()
  const [appVersion, setAppVersion] = useState<string>('Loading...')
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false)
  const [showGithubFallback, setShowGithubFallback] = useState(false)
  const checkStartedAtRef = useRef(0)
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // Fetch app version from Electron
    window.electronAPI.getAppVersion().then((version: string) => {
      setAppVersion(version)
      setIsLoading(false)
    })

    // Resolve the check no sooner than MIN_CHECK_DURATION_MS after it started,
    // then run the per-result action (toast / fallback) so everything lands together.
    const finishCheck = (action?: () => void) => {
      const elapsed = Date.now() - checkStartedAtRef.current
      const remaining = Math.max(0, MIN_CHECK_DURATION_MS - elapsed)
      clearTimeout(finishTimerRef.current)
      finishTimerRef.current = setTimeout(() => {
        setIsCheckingForUpdates(false)
        action?.()
      }, remaining)
    }

    // Listen for update check results
    const unsubscribeUpdateDownloaded = window.electronAPI.on('updater:update-downloaded', () => {
      console.log('[AboutView] Update downloaded notification received')
      finishCheck()
    })

    const unsubscribeUpToDate = window.electronAPI.on('updater:update-not-available', () => {
      finishCheck(() => toast.success(t('updateUpToDate')))
    })

    const unsubscribeCheckError = window.electronAPI.on('updater:check-error', (error: string) => {
      console.error('[AboutView] Update check failed:', error)
      finishCheck(() => {
        setShowGithubFallback(true)
        toast.error(t('updateCheckFailed'))
      })
    })

    return () => {
      clearTimeout(finishTimerRef.current)
      unsubscribeUpdateDownloaded()
      unsubscribeUpToDate()
      unsubscribeCheckError()
    }
  }, [t])

  const checkForUpdates = () => {
    // Trigger update check via Electron IPC
    clearTimeout(finishTimerRef.current)
    checkStartedAtRef.current = Date.now()
    setIsCheckingForUpdates(true)
    setShowGithubFallback(false)
    window.electronAPI.send('updater:check-for-updates')
    console.log('[AboutView] Manual update check triggered')
  }

  const handleFeedback = () => {
    // Select feedback form based on user's display language
    const feedbackUrl =
      language === 'zh-TW'
        ? 'https://forms.gle/oFzD1YEt47AQaZpU7' // Traditional Chinese form
        : 'https://forms.gle/nA69EhHX9MwncoYb6' // English form
    window.electronAPI.openExternal(feedbackUrl)
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

      {/* Links Card */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => window.electronAPI.openExternal(WEBSITE_URL)}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('visitWebsite')}
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
          {showGithubFallback && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => window.electronAPI.openExternal(RELEASES_URL)}
            >
              <Github className="w-4 h-4 mr-2" />
              {t('downloadFromGitHub')}
            </Button>
          )}
          <Button variant="ghost" className="w-full justify-start" onClick={handleFeedback}>
            <MessageSquare className="w-4 h-4 mr-2" />
            {t('sendFeedback')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
