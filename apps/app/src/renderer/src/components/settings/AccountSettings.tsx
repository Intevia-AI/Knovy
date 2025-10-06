import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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

  const handleSignOut = async () => {
    await signOut()
    // Close settings window after signing out
    window.electronAPI.send('settings:close')
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

  if (!user || !sessionProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Account</h2>
          <p className="text-sm text-muted-foreground">Loading account information...</p>
        </div>
      </div>
    )
  }

  // Extract quota data - all quotas from session profile
  const quotas = sessionProfile?.quotas
    ? Object.entries(sessionProfile.quotas)
    : []

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
        <CardContent className="space-y-2 text-sm">
          {quotas.length > 0 ? (
            quotas.map(([metric, data]) => (
              <div key={metric} className="flex justify-between items-center">
                <span className="text-muted-foreground">{formatQuotaName(metric)}</span>
                <span className="font-mono text-foreground">
                  {data.limit === -1 ? '∞' : `${Math.round(data.used)} / ${data.limit}`}
                </span>
              </div>
            ))
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
