import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useI18n } from '@/hooks/useI18n'
import { useOllamaModelState } from '@/hooks/useOllamaModelState'

const RECOMMENDED_MODEL = 'gemma4:e4b'
const POPOVER_ID = 'model-gate'

type GateKind = 'no-model' | 'downloading' | 'error'

export function ModelGatePopover() {
  const { t } = useI18n()
  const { state, selectModel, setAiCorrection } = useOllamaModelState()
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    const unsub = window.electronAPI.on('popover:prepare-to-close', (id: string) => {
      if (id === POPOVER_ID) setIsOpen(false)
    })
    return () => {
      if (unsub) unsub()
    }
  }, [])

  const close = () => window.electronAPI.send('popover:close', POPOVER_ID)
  const handleAnimationComplete = () => {
    if (!isOpen) window.electronAPI.send('popover:ready-to-close', POPOVER_ID)
  }

  const kind: GateKind = !state.reachable
    ? 'error'
    : state.phase === 'error'
      ? 'error'
      : state.phase === 'downloading' || state.phase === 'verifying'
        ? 'downloading'
        : 'no-model'

  const title =
    kind === 'no-model'
      ? t('gateNoModelTitle')
      : kind === 'downloading'
        ? t('gateDownloadingTitle')
        : t('gateErrorTitle')

  const body =
    kind === 'no-model'
      ? t('gateNoModelBody')
      : kind === 'downloading'
        ? t('gateDownloadingBody')
        : !state.reachable
          ? t('gateErrorOllamaUnavailable')
          : state.error?.kind === 'disk-full'
            ? t('gateErrorDiskFull')
            : state.error?.kind === 'network'
              ? t('gateErrorNetwork')
              : t('gateErrorGeneric')

  // Size the popover window to its content so it sits flush above the bar,
  // consistent with the other popover windows (otherwise a fixed-height window
  // leaves a transparent gap below the shorter content).
  useEffect(() => {
    const raf = requestAnimationFrame(async () => {
      const card = document.querySelector('[data-gate-card]') as HTMLElement | null
      const height = card?.offsetHeight ?? document.body.scrollHeight
      if (!height) return
      const bounds = await window.electronAPI.invoke('electronAPI:getMainWindowBounds')
      if (!bounds) return
      const width = 360
      const x = bounds.x + Math.round((bounds.width - width) / 2)
      const y = bounds.y - height - 8
      await window.electronAPI.invoke('popover:resize', { id: POPOVER_ID, width, height, x, y })
    })
    return () => cancelAnimationFrame(raf)
  }, [kind])

  const startRaw = () => {
    window.electronAPI.send('model-gate:start-recording')
    close()
  }
  const download = () => {
    selectModel(RECOMMENDED_MODEL)
    close()
  }
  const dontAskAgain = async () => {
    await setAiCorrection('off')
    window.electronAPI.send('model-gate:start-recording')
    close()
  }
  const retry = () => {
    selectModel(state.model)
    close()
  }
  const installOllama = () => {
    window.electronAPI.openExternal('https://ollama.com/download')
  }

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          data-gate-card
          className="flex flex-col gap-3 w-full p-4 glass-popover rounded-lg"
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{body}</p>
          </div>

          {kind === 'downloading' && <Progress value={state.progress} className="h-2" />}

          <div className="flex flex-col gap-2">
            {kind === 'no-model' && (
              <>
                <Button size="sm" onClick={download}>
                  {t('btnDownloadModel')}
                </Button>
                <Button size="sm" variant="outline" onClick={startRaw}>
                  {t('btnRecordRaw')}
                </Button>
                <Button size="sm" variant="ghost" onClick={dontAskAgain}>
                  {t('btnDontAskAgain')}
                </Button>
              </>
            )}
            {kind === 'downloading' && (
              <Button size="sm" variant="outline" onClick={startRaw}>
                {t('btnRecordRaw')}
              </Button>
            )}
            {kind === 'error' && (
              <>
                {state.reachable ? (
                  <Button size="sm" onClick={retry}>
                    {t('btnRetry')}
                  </Button>
                ) : (
                  <Button size="sm" onClick={installOllama}>
                    {t('btnStartOllama')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={startRaw}>
                  {t('btnRecordRaw')}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
