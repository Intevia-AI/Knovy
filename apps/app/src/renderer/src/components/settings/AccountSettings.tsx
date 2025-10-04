interface AccountSettingsProps {
  sessionProfile: any
}

export function AccountSettings({ sessionProfile }: AccountSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">Account</h2>
        <p className="text-sm text-muted-foreground">
          Manage your account and subscription
        </p>
      </div>
      {/* Content will be implemented in Phase 4 */}
      <div className="p-8 text-center text-muted-foreground">
        Account settings coming soon...
      </div>
    </div>
  )
}
