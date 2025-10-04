import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { SettingsSidebar } from './SettingsSidebar'
import { GeneralSettings } from './settings/GeneralSettings'
import { HistoryView } from './settings/HistoryView'
import { AccountSettings } from './settings/AccountSettings'
import { DisplaySettings } from './settings/DisplaySettings'
import { ShortcutsView } from './settings/ShortcutsView'
import { AboutView } from './settings/AboutView'
import { useAuth } from '@/hooks/useAuth'

export type SettingsSection =
  | 'general'
  | 'history'
  | 'account'
  | 'display'
  | 'shortcuts'
  | 'about'

export function SettingsWindow() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const { sessionProfile } = useAuth()

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.send('settings:close')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSettings />
      case 'history':
        return <HistoryView />
      case 'account':
        return <AccountSettings sessionProfile={sessionProfile} />
      case 'display':
        return <DisplaySettings />
      case 'shortcuts':
        return <ShortcutsView />
      case 'about':
        return <AboutView />
      default:
        return <GeneralSettings />
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-transparent">
      {/* Custom Title Bar */}
      <div className="h-[52px] bg-background/40 backdrop-blur-xl border-b border-border/30 flex items-center select-none drag-region z-20 flex-shrink-0">
        {/* macOS traffic lights spacing (left side) */}
        <div className="w-[80px]" />

        {/* Title centered */}
        <div className="flex items-center justify-center flex-1">
          <Settings className="w-4 h-4 text-primary mr-2" />
          <span className="text-sm font-medium text-foreground">Knovy Settings</span>
        </div>

        {/* Right side spacing for symmetry */}
        <div className="w-[80px]" />
      </div>

      {/* Main Content Area (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="flex-shrink-0">
          <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full w-full overflow-y-auto bg-background/30 backdrop-blur-xl settings-scrollbar">
            <div className="p-6">{renderContent()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
