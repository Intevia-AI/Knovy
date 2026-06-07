import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useI18n } from '@/hooks/useI18n'
import type { ModelState } from '@/hooks/useOllamaModelState'

export type GateKind = 'no-model' | 'downloading' | 'error' | null

interface ModelGateDialogProps {
  kind: GateKind
  state: ModelState
  onClose: () => void
  onDownload: () => void
  onRecordRaw: () => void
  onDontAskAgain: () => void
  onRetry: () => void
  onStartOllama: () => void
}

export function ModelGateDialog({
  kind,
  state,
  onClose,
  onDownload,
  onRecordRaw,
  onDontAskAgain,
  onRetry,
  onStartOllama
}: ModelGateDialogProps) {
  const { t } = useI18n()
  if (!kind) return null

  const title =
    kind === 'no-model'
      ? t('gateNoModelTitle')
      : kind === 'downloading'
        ? t('gateDownloadingTitle')
        : t('gateErrorTitle')

  const body = () => {
    if (kind === 'no-model') return t('gateNoModelBody')
    if (kind === 'downloading') return t('gateDownloadingBody')
    if (!state.reachable) return t('gateErrorOllamaUnavailable')
    if (state.error?.kind === 'disk-full') return t('gateErrorDiskFull')
    if (state.error?.kind === 'network') return t('gateErrorNetwork')
    return t('gateErrorGeneric')
  }

  return (
    <Dialog open={!!kind} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body()}</DialogDescription>
        </DialogHeader>

        {kind === 'downloading' && (
          <div className="space-y-1">
            <Progress value={state.progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {state.progress > 0 ? `${state.progress}%` : ''}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-col gap-2">
          {kind === 'no-model' && (
            <>
              <Button onClick={onDownload}>{t('btnDownloadModel')}</Button>
              <Button variant="outline" onClick={onRecordRaw}>
                {t('btnRecordRaw')}
              </Button>
              <Button variant="ghost" onClick={onDontAskAgain}>
                {t('btnDontAskAgain')}
              </Button>
            </>
          )}
          {kind === 'downloading' && (
            <Button variant="outline" onClick={onRecordRaw}>
              {t('btnRecordRaw')}
            </Button>
          )}
          {kind === 'error' && (
            <>
              {state.reachable ? (
                <Button onClick={onRetry}>{t('btnRetry')}</Button>
              ) : (
                <Button onClick={onStartOllama}>{t('btnStartOllama')}</Button>
              )}
              <Button variant="outline" onClick={onRecordRaw}>
                {t('btnRecordRaw')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
