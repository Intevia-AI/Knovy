import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion'

export function UpdaterPanel() {
  const [isOpen, setIsOpen] = useState(true)
  const popoverId = 'updater'

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

  const handleRestart = () => {
    console.log('Restarting application')
    window.electronAPI.send('updater:quit-and-install')
  }

  const handleLater = () => {
    console.log('Closing updater panel')
    window.electronAPI.send('popover:close', popoverId)
  }

  const handleAnimationComplete = () => {
    if (!isOpen) {
      console.log('Updater panel ready to close')
      window.electronAPI.send('popover:ready-to-close', popoverId)
    }
  }

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-between w-full h-full p-2 glass-popover select-none"
        >
          <p className="text-sm font-medium text-black pl-2">New version available</p>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleLater}
              className="h-8 px-4 rounded-full text-sm bg-muted text-black hover:bg-white hover:text-black"
            >
              Later
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleRestart}
              className="h-8 px-4 rounded-full bg-black text-white hover:bg-gray-800 shadow-md shadow-black/20"
            >
              Restart
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
