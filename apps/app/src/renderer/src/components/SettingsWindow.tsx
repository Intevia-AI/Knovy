import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion'
import { Settings } from 'lucide-react'
import { SettingsSidebar } from './SettingsSidebar'
import { GeneralSettings } from './settings/GeneralSettings'
import { HistoryView } from './settings/HistoryView'
import { AccountSettings } from './settings/AccountSettings'
import { DisplaySettings } from './settings/DisplaySettings'
import { ShortcutsView } from './settings/ShortcutsView'
import { AboutView } from './settings/AboutView'
import { useAuth } from '@/hooks/useAuth'

export type SettingsSection = 'general' | 'history' | 'account' | 'display' | 'shortcuts' | 'about'

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
    const components = {
      general: <GeneralSettings />,
      history: <HistoryView />,
      account: <AccountSettings sessionProfile={sessionProfile} />,
      display: <DisplaySettings />,
      shortcuts: <ShortcutsView />,
      about: <AboutView />
    }

    return components[activeSection] || <GeneralSettings />
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col h-screen w-screen bg-transparent"
    >
      {/* Custom Title Bar */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="h-[52px] bg-background/40 backdrop-blur-xl border-b border-border/30 flex items-center select-none drag-region z-20 flex-shrink-0"
      >
        {/* macOS traffic lights spacing (left side) */}
        <div className="w-[80px]" />

        {/* Title centered */}
        <div className="flex items-center justify-center flex-1">
          <Settings className="w-4 h-4 text-primary mr-2" />
          <span className="text-sm font-medium text-foreground">Knovy Settings</span>
        </div>

        {/* Right side spacing for symmetry */}
        <div className="w-[80px]" />
      </motion.div>

      {/* Main Content Area (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="flex-shrink-0"
        >
          <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        </motion.div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full w-full overflow-y-auto bg-background/30 backdrop-blur-xl settings-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-6"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
