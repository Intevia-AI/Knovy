import { motion } from 'motion'
import { Settings, History, User, Monitor, Keyboard, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SettingsSection } from './SettingsWindow'

interface NavItem {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'history', label: 'History', icon: History },
  { id: 'account', label: 'Account', icon: User },
  { id: 'display', label: 'Display', icon: Monitor },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info }
]

interface SettingsSidebarProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <div className="w-[180px] h-full bg-background/40 backdrop-blur-xl border-r border-border/30 p-4">
      <nav className="space-y-1">
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
                'text-sm transition-all duration-200',
                isActive
                  ? 'text-foreground font-medium bg-white/90 backdrop-blur-sm shadow-sm'
                  : 'text-muted-foreground hover:bg-white/60 hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </motion.button>
          )
        })}
      </nav>
    </div>
  )
}
