import { motion } from 'motion'
import {
  Settings,
  History,
  User,
  Monitor,
  Keyboard,
  Info,
  Power,
  Zap,
  MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/context/TranslationContext'
import type { SettingsSection } from '../SettingsPage'
import type { TranslationKey } from '@/lib/translations'
import { Button } from '@/components/ui/button'

interface NavItem {
  id: SettingsSection
  labelKey: TranslationKey
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { id: 'history', labelKey: 'historyTab', icon: History },
  { id: 'general', labelKey: 'generalTab', icon: Settings },
  { id: 'autoTrigger', labelKey: 'autoTriggerTab', icon: Zap },
  { id: 'shortcuts', labelKey: 'shortcutsTab', icon: Keyboard },
  { id: 'account', labelKey: 'accountTab', icon: User },
  { id: 'about', labelKey: 'aboutTab', icon: Info }
]

interface SettingsSidebarProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  const { t, language } = useTranslation()

  const handleQuit = () => {
    window.electronAPI.quitApp()
  }

  const handleFeedback = () => {
    // Select feedback form based on user's display language
    const feedbackUrl =
      language === 'zh-TW'
        ? 'https://forms.gle/oFzD1YEt47AQaZpU7' // Traditional Chinese form
        : 'https://forms.gle/nA69EhHX9MwncoYb6' // English form

    console.log('[SettingsSidebar] Opening feedback form:', { language, feedbackUrl })
    window.electronAPI.openExternal(feedbackUrl)
  }

  return (
    <div className="w-[180px] h-full bg-background/40 backdrop-blur-xl border-r border-white/50 p-4 flex flex-col">
      <nav className="space-y-1 flex-1">
        {navItems.map((item, index) => {
          const Icon = item.icon
          const isActive = activeSection === item.id

          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg w-full text-left',
                'text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'text-foreground font-medium bg-accent/70 backdrop-blur-sm shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{t(item.labelKey)}</span>
            </motion.button>
          )
        })}
      </nav>

      {/* Feedback Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="mb-2"
      >
        <Button variant="ghost" onClick={handleFeedback} className="w-full justify-start gap-3">
          <MessageSquare className="w-4 h-4" />
          <span className="text-sm">{t('sendFeedback')}</span>
        </Button>
      </motion.div>

      {/* Quit Button at the bottom */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <Button
          variant="ghost"
          onClick={handleQuit}
          className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Power className="w-4 h-4" />
          <span className="text-sm">Quit Knovy</span>
        </Button>
      </motion.div>
    </div>
  )
}
