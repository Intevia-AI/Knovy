import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion'
import { useTranslation } from '@/context/TranslationContext'

export function QuitHintPanel() {
  const [isOpen, setIsOpen] = useState(true)
  const { t } = useTranslation()
  const popoverId = 'quit-hint'

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('popover:prepare-to-close', (id) => {
      if (id === popoverId) {
        setIsOpen(false)
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const handleAnimationComplete = () => {
    if (!isOpen) {
      window.electronAPI.send('popover:ready-to-close', popoverId)
    }
  }

  const shortcut = window.electronAPI.platform === 'darwin' ? '⌘Q' : 'Ctrl+Q'
  const message = t('quitHint').replace('{shortcut}', shortcut)

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center w-full h-full p-2 glass-popover select-none"
        >
          {/* h-8 matches the updater's button height so the bar is the same
              height as the updater popover (h-full does not resolve — the bar
              sizes to its content). */}
          <p className="flex items-center h-8 text-sm font-medium text-black">{message}</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
