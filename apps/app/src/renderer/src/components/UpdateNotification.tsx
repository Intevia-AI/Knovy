import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

export function UpdateNotification() {
  const [popoverId, setPopoverId] = useState('')

  useEffect(() => {
    // The component's ID is derived from the URL hash (e.g., #update-notification -> 'update-notification')
    const id = window.location.hash.substring(1)
    setPopoverId(id)

    // Listen for the signal from the main process to prepare for closing
    const unsubscribe = window.electronAPI.on('popover:prepare-to-close', (idToClose) => {
      // Check if this is the popover that should be closed
      if (idToClose === id) {
        // This popover has no exit animations, so we can respond immediately
        window.electronAPI.send('popover:ready-to-close', id)
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const handleRestart = () => {
    if (window.electronAPI) {
      window.electronAPI.send('updater:quit-and-install')
    }
  }

  const handleLater = () => {
    if (window.electronAPI && popoverId) {
      // Use the dynamic ID to close the correct popover
      window.electronAPI.send('popover:close', popoverId)
    }
  }

  return (
    <div className="flex items-center justify-between w-full h-full p-2 glass-popover select-none">
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
    </div>
  )
}
