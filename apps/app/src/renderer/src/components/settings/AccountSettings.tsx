import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface SessionProfile {
  user_id: string
  role: string
  app_settings: Record<string, any>
  entitlements: Record<string, any>
  quotas: Record<string, { limit: number; used: number }>
}

interface AccountSettingsProps {
  sessionProfile: SessionProfile | null
}

export function AccountSettings({ sessionProfile }: AccountSettingsProps) {
  const { user, refreshSessionProfile, signOut } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshSessionProfile()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Auto-refresh session profile every 60 seconds to keep quota usage up-to-date
  useEffect(() => {
    const interval = setInterval(() => {
      // Silently refresh without showing the loading spinner
      refreshSessionProfile()
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [refreshSessionProfile])

  const handleSignOut = async () => {
    await signOut()
    // Close settings window after signing out
    window.electronAPI.send('settings:close')
  }

  const getQuotaAlias = (metric: string): string => {
    const aliases: Record<string, string> = {
      daily_transcription_minutes: 'Session Duration',
      'daily_ai_action:keyword-search_calls': 'Keyword Search',
      'daily_ai_action:recommend-response_calls': 'Recommend Response',
      'daily_ai_action:chat_calls': 'Chat',
      'daily_ai_action:screenshot_calls': 'Screenshot',
      'daily_ai_action:answer_calls': 'Answer',
      'daily_ai_action:summary_calls': 'Summary'
    }

    return aliases[metric] || formatQuotaName(metric)
  }

  const formatQuotaName = (metric: string) => {
    const name = metric
      .replace('daily_', '')
      .replace('ai_action:', '')
      .replace('_calls', '')
      .replace('session_count', 'sessions')
      .replace('_', ' ')
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const getQuotaOrder = (metric: string): number => {
    const order: Record<string, number> = {
      daily_transcription_minutes: 1,
      'daily_ai_action:chat_calls': 2,
      'daily_ai_action:keyword-search_calls': 3,
      'daily_ai_action:recommend-response_calls': 4,
      'daily_ai_action:screenshot_calls': 5,
      'daily_ai_action:answer_calls': 6,
      'daily_ai_action:summary_calls': 7
    }

    return order[metric] || 999
  }

  if (!user || !sessionProfile) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>

        {/* Profile Card Skeleton */}
        <Card className="bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Quotas Card Skeleton */}
        <Card className="bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Skeleton className="h-4 w-[160px]" />
                <Skeleton className="h-1.5 flex-1 rounded-full" />
                <Skeleton className="h-4 w-[90px]" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions Card Skeleton */}
        <Card className="bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Extract quota data - all quotas from session profile
  const quotas = sessionProfile?.quotas ? Object.entries(sessionProfile.quotas) : []

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <Card className="bg-background/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-border/50">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email || ''} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {(user.email || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium text-foreground">{user.email}</p>
              </div>
              <Badge
                variant={sessionProfile.role === 'admin' ? 'default' : 'secondary'}
                className="capitalize"
              >
                {sessionProfile.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Quotas Card */}
      <Card className="bg-background/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Daily Quotas</CardTitle>
              <CardDescription className="text-xs mt-1">Resets every 24 hours</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh quotas"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotas.length > 0 ? (
            quotas
              .filter(([metric]) => {
                // Hide specific quotas
                const lowercaseMetric = metric.toLowerCase()
                return (
                  !lowercaseMetric.includes('session') &&
                  !lowercaseMetric.includes('transcription_enhance') &&
                  !lowercaseMetric.includes('enhancement')
                )
              })
              .sort(([metricA], [metricB]) => getQuotaOrder(metricA) - getQuotaOrder(metricB))
              .map(([metric, data]) => {
                const isUnlimited = data.limit === -1
                const percentage = isUnlimited ? 0 : Math.min((data.used / data.limit) * 100, 100)

                return (
                  <div key={metric} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground whitespace-nowrap w-[160px]">
                      {getQuotaAlias(metric)}
                    </span>
                    {isUnlimited ? (
                      <div className="flex-1" />
                    ) : (
                      <Progress value={percentage} className="h-1.5 flex-1" />
                    )}
                    <span className="font-mono text-foreground whitespace-nowrap w-[90px] text-right">
                      {isUnlimited ? '∞' : `${Math.round(data.used)} / ${data.limit}`}
                    </span>
                  </div>
                )
              })
          ) : (
            <p className="text-muted-foreground text-xs text-center py-4">
              Usage data not available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card className="bg-background/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Account Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
